<?php

namespace Flarum\CliPhpSubsystem\Upgrade\TwoPointOh;

use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitor;
use PhpParser\NodeVisitorAbstract;
use PhpParser\ParserFactory;

/**
 * Factories for an extension's models, written from what its migrations say
 * about each model's table.
 */
class ModelFactories
{
    /**
     * Blueprint methods that add a column, by the kind of value it holds.
     */
    protected const COLUMN_TYPES = [
        'increments' => 'int', 'bigIncrements' => 'int', 'mediumIncrements' => 'int', 'smallIncrements' => 'int', 'tinyIncrements' => 'int', 'id' => 'int',
        'integer' => 'int', 'bigInteger' => 'int', 'mediumInteger' => 'int', 'smallInteger' => 'int', 'tinyInteger' => 'int',
        'unsignedInteger' => 'int', 'unsignedBigInteger' => 'int', 'unsignedMediumInteger' => 'int', 'unsignedSmallInteger' => 'int', 'unsignedTinyInteger' => 'int',
        'foreignId' => 'int', 'year' => 'int',
        'string' => 'string', 'char' => 'string', 'macAddress' => 'string', 'ulid' => 'string',
        'text' => 'text', 'tinyText' => 'text', 'mediumText' => 'text', 'longText' => 'text',
        'boolean' => 'bool',
        'dateTime' => 'datetime', 'dateTimeTz' => 'datetime', 'timestamp' => 'datetime', 'timestampTz' => 'datetime',
        'date' => 'datetime', 'time' => 'datetime', 'timeTz' => 'datetime',
        'json' => 'json', 'jsonb' => 'json',
        'decimal' => 'number', 'unsignedDecimal' => 'number', 'float' => 'number', 'double' => 'number',
        'enum' => 'enum', 'set' => 'enum',
        'uuid' => 'uuid',
        'ipAddress' => 'ip',
        'binary' => 'binary',
    ];

    protected const AUTO_INCREMENTS = ['increments', 'bigIncrements', 'mediumIncrements', 'smallIncrements', 'tinyIncrements', 'id'];

    /**
     * Each table's columns, by name, in the order they were added.
     *
     * @var array<string, array<string, array>>
     */
    protected array $tables = [];

    /**
     * Replay the migrations' `up`s, in the order Flarum runs them, and return
     * the tables they leave.
     *
     * @param array<string, string> $migrations Each migration's code, by file name.
     */
    public function schema(array $migrations): array
    {
        ksort($migrations);

        $this->tables = [];
        $parser = (new ParserFactory())->createForHostVersion();

        foreach ($migrations as $code) {
            foreach ($parser->parse($code) ?? [] as $statement) {
                if ($statement instanceof Node\Stmt\Return_ && $statement->expr) {
                    $this->migration($statement->expr);
                }
            }
        }

        return ['tables' => (object) array_map('array_values', $this->tables)];
    }

    protected function migration(Node\Expr $migration): void
    {
        if ($migration instanceof Node\Expr\StaticCall && $migration->class instanceof Node\Name && $migration->class->getLast() === 'Migration' && $migration->name instanceof Node\Identifier) {
            $this->helper($migration->name->toString(), array_map(fn (Node\Arg $arg) => $arg->value, $migration->getArgs()));

            return;
        }

        if ($migration instanceof Node\Expr\Array_) {
            foreach ($migration->items as $item) {
                if ($item && $this->literal($item->key) === 'up' && ($item->value instanceof Node\Expr\Closure || $item->value instanceof Node\Expr\ArrowFunction)) {
                    $this->up($item->value);
                }
            }
        }
    }

    /**
     * What a `Flarum\Database\Migration` helper does.
     */
    protected function helper(string $name, array $args): void
    {
        $table = $this->literal($args[0] ?? null);

        if (! is_string($table)) {
            return;
        }

        switch ($name) {
            case 'createTable':
            case 'createTableIfNotExists':
                $this->tables[$table] = [];

                if (isset($args[1])) {
                    $this->blueprint($table, $args[1]);
                }
                break;

            case 'renameTable':
                $this->renameTable($table, $this->literal($args[1] ?? null));
                break;

            case 'addColumns':
            case 'dropColumns':
                foreach ($args[1]->items ?? [] as $item) {
                    $column = $this->literal($item?->key);

                    if (! is_string($column)) {
                        continue;
                    }

                    if ($name === 'dropColumns') {
                        unset($this->tables[$table][$column]);
                    } elseif ($item->value instanceof Node\Expr\Array_) {
                        $this->addColumn($table, $column, $item->value);
                    }
                }
                break;

            case 'renameColumn':
                $this->renameColumn($table, $this->literal($args[1] ?? null), $this->literal($args[2] ?? null));
                break;

            case 'renameColumns':
                foreach ($args[1]->items ?? [] as $item) {
                    $this->renameColumn($table, $this->literal($item?->key), $this->literal($item?->value));
                }
                break;
        }
    }

    /**
     * What the schema builder does in an `up`, in order.
     */
    protected function up(Node\Expr\Closure|Node\Expr\ArrowFunction $up): void
    {
        $traverser = new NodeTraverser();

        $traverser->addVisitor(new class ($this) extends NodeVisitorAbstract {
            public function __construct(private ModelFactories $factories)
            {
            }

            public function enterNode(Node $node)
            {
                if (! $node instanceof Node\Expr\MethodCall || ! $node->name instanceof Node\Identifier) {
                    return null;
                }

                $args = array_map(fn (Node\Arg $arg) => $arg->value, $node->getArgs());

                return $this->factories->builder($node->name->toString(), $args) ? NodeVisitor::DONT_TRAVERSE_CHILDREN : null;
            }
        });

        $traverser->traverse($up instanceof Node\Expr\Closure ? $up->stmts : [new Node\Stmt\Expression($up->expr)]);
    }

    /**
     * A schema builder call, if it is one that changes a table.
     */
    public function builder(string $method, array $args): bool
    {
        $table = $this->literal($args[0] ?? null);
        $callback = $args[1] ?? null;

        if (! is_string($table)) {
            return false;
        }

        if (in_array($method, ['create', 'table']) && ($callback instanceof Node\Expr\Closure || $callback instanceof Node\Expr\ArrowFunction)) {
            if ($method === 'create') {
                $this->tables[$table] = [];
            }

            $this->blueprint($table, $callback);

            return true;
        }

        if ($method === 'rename' && count($args) === 2) {
            $this->renameTable($table, $this->literal($args[1]));

            return true;
        }

        if (in_array($method, ['drop', 'dropIfExists']) && count($args) === 1) {
            unset($this->tables[$table]);

            return true;
        }

        return false;
    }

    /**
     * What a Blueprint callback does to its table.
     */
    protected function blueprint(string $table, Node\Expr $callback): void
    {
        $this->tables[$table] ??= [];

        $param = $callback->params[0]->var->name ?? null;

        if (! is_string($param) || ! ($callback instanceof Node\Expr\Closure || $callback instanceof Node\Expr\ArrowFunction)) {
            return;
        }

        $statements = $callback instanceof Node\Expr\Closure ? $callback->stmts : [new Node\Stmt\Expression($callback->expr)];

        $traverser = new NodeTraverser();

        $traverser->addVisitor(new class ($this, $table, $param) extends NodeVisitorAbstract {
            public function __construct(private ModelFactories $factories, private string $table, private string $param)
            {
            }

            public function enterNode(Node $node)
            {
                if (! $node instanceof Node\Stmt\Expression) {
                    return null;
                }

                // $table->string('name')->nullable(): the call on $table, then its modifiers.
                $calls = [];
                $expr = $node->expr;

                while ($expr instanceof Node\Expr\MethodCall && $expr->name instanceof Node\Identifier) {
                    array_unshift($calls, $expr);
                    $expr = $expr->var;
                }

                if ($calls && $expr instanceof Node\Expr\Variable && $expr->name === $this->param) {
                    $this->factories->column($this->table, $calls);
                }

                return NodeVisitor::DONT_TRAVERSE_CHILDREN;
            }
        });

        $traverser->traverse($statements);
    }

    /**
     * What one chain of Blueprint calls does to the table.
     *
     * @param Node\Expr\MethodCall[] $calls
     */
    public function column(string $table, array $calls): void
    {
        $method = $calls[0]->name->toString();
        $args = array_map(fn (Node\Arg $arg) => $arg->value, $calls[0]->getArgs());
        $modifiers = array_slice($calls, 1);

        switch ($method) {
            case 'timestamps':
            case 'nullableTimestamps':
            case 'timestampsTz':
                $this->define($table, ['name' => 'created_at', 'type' => 'datetime', 'nullable' => true]);
                $this->define($table, ['name' => 'updated_at', 'type' => 'datetime', 'nullable' => true]);

                return;

            case 'softDeletes':
            case 'softDeletesTz':
                $this->define($table, ['name' => $this->literal($args[0] ?? null) ?? 'deleted_at', 'type' => 'datetime', 'nullable' => true]);

                return;

            case 'rememberToken':
                $this->define($table, ['name' => 'remember_token', 'type' => 'string', 'nullable' => true]);

                return;

            case 'morphs':
            case 'nullableMorphs':
                $name = $this->literal($args[0] ?? null);

                if (is_string($name)) {
                    $this->define($table, ['name' => "{$name}_type", 'type' => 'string', 'nullable' => $method === 'nullableMorphs']);
                    $this->define($table, ['name' => "{$name}_id", 'type' => 'int', 'nullable' => $method === 'nullableMorphs']);
                }

                return;

            case 'addColumn':
                $type = $this->literal($args[0] ?? null);
                $name = $this->literal($args[1] ?? null);

                if (is_string($type) && is_string($name)) {
                    $this->addColumn($table, $name, new Node\Expr\Array_([
                        new Node\ArrayItem(new Node\Scalar\String_($type)),
                        ...(($args[2] ?? null) instanceof Node\Expr\Array_ ? $args[2]->items : []),
                    ]));
                }

                return;

            case 'foreign':
                $on = $this->modifierArgument($modifiers, 'on');

                foreach ($this->names($args[0] ?? null) as $name) {
                    if (is_string($on) && isset($this->tables[$table][$name])) {
                        $this->tables[$table][$name]['references'] = $on;
                    }
                }

                return;

            case 'dropForeign':
                foreach ($this->names($args[0] ?? null) as $name) {
                    // An index name, `{table}_{column}_foreign`, or the column.
                    $name = preg_replace('/^'.preg_quote($table, '/').'_(.+)_foreign$/', '$1', $name);

                    if (isset($this->tables[$table][$name])) {
                        $this->tables[$table][$name]['references'] = null;
                    }
                }

                return;

            case 'dropColumn':
                foreach ($args as $arg) {
                    foreach ($this->names($arg) as $name) {
                        unset($this->tables[$table][$name]);
                    }
                }

                return;

            case 'renameColumn':
                $this->renameColumn($table, $this->literal($args[0] ?? null), $this->literal($args[1] ?? null));

                return;
        }

        if (! isset(self::COLUMN_TYPES[$method])) {
            return;
        }

        $column = [
            'name' => $method === 'id' ? ($this->literal($args[0] ?? null) ?? 'id') : $this->literal($args[0] ?? null),
            'type' => self::COLUMN_TYPES[$method],
            'nullable' => false,
            'autoIncrement' => in_array($method, self::AUTO_INCREMENTS)
                // integer('id', true)
                || (self::COLUMN_TYPES[$method] === 'int' && $this->literal($args[1] ?? null) === true),
        ];

        if ($column['type'] === 'enum') {
            $column['values'] = array_values(array_filter(array_map(fn ($item) => $this->literal($item?->value), $args[1]->items ?? []), 'is_string'));
        }

        foreach ($modifiers as $modifier) {
            $column = $this->modify($column, $modifier);
        }

        if (is_string($column['name'])) {
            $this->define($table, $column);
        }
    }

    /**
     * A column with one modifier applied.
     */
    protected function modify(array $column, Node\Expr\MethodCall $modifier): array
    {
        $args = $modifier->getArgs();

        switch ($modifier->name->toString()) {
            case 'nullable':
                $column['nullable'] = ! isset($args[0]) || $this->literal($args[0]->value) !== false;
                break;

            case 'default':
                if (isset($args[0]) && $this->isLiteral($args[0]->value)) {
                    $column['default'] = ['value' => $this->literal($args[0]->value)];
                } else {
                    $column['defaultExpression'] = true;
                }
                break;

            case 'useCurrent':
                $column['defaultExpression'] = true;
                break;

            case 'autoIncrement':
                $column['autoIncrement'] = true;
                break;

            case 'constrained':
                $on = isset($args[0]) ? $this->literal($args[0]->value) : null;
                $column['references'] = is_string($on) ? $on : preg_replace('/_id$/', '', (string) $column['name']).'s';
                break;

            case 'on':
                $on = isset($args[0]) ? $this->literal($args[0]->value) : null;
                $column['references'] = is_string($on) ? $on : null;
                break;

            case 'change':
                $column['change'] = true;
                break;
        }

        return $column;
    }

    /**
     * A column as `Migration::addColumns()` and `$table->addColumn()` give it:
     * its type, then its options.
     */
    protected function addColumn(string $table, string $name, Node\Expr\Array_ $definition): void
    {
        $column = ['name' => $name, 'type' => null, 'nullable' => false, 'autoIncrement' => false];

        foreach ($definition->items as $item) {
            $value = $this->literal($item?->value);
            $option = $this->literal($item?->key);

            if ($item && $item->key === null && $column['type'] === null && is_string($value)) {
                $column['type'] = self::COLUMN_TYPES[$value] ?? null;
            } elseif ($option === 'nullable') {
                $column['nullable'] = (bool) $value;
            } elseif ($option === 'default') {
                if ($this->isLiteral($item->value)) {
                    $column['default'] = ['value' => $value];
                } else {
                    $column['defaultExpression'] = true;
                }
            } elseif ($option === 'autoIncrement') {
                $column['autoIncrement'] = (bool) $value;
            } elseif ($option === 'allowed' && $item->value instanceof Node\Expr\Array_) {
                $column['values'] = array_values(array_filter(array_map(fn ($allowed) => $this->literal($allowed?->value), $item->value->items), 'is_string'));
            }
        }

        if ($column['type'] !== null) {
            $this->define($table, $column);
        }
    }

    /**
     * Add the column, or, given change(), replace the one of that name. Since
     * Laravel 11, a changed column keeps nothing it does not restate. Its
     * foreign key is a separate constraint, so that stays.
     */
    protected function define(string $table, array $column): void
    {
        $existing = $this->tables[$table][$column['name']] ?? null;

        unset($column['change']);

        $column += ['nullable' => false, 'autoIncrement' => false, 'references' => $existing['references'] ?? null];

        if ($column['references'] === null && $existing) {
            $column['references'] = $existing['references'] ?? null;
        }

        $this->tables[$table][$column['name']] = $column;
    }

    protected function renameTable(string $from, mixed $to): void
    {
        if (is_string($to) && isset($this->tables[$from])) {
            $this->tables[$to] = $this->tables[$from];
            unset($this->tables[$from]);
        }
    }

    protected function renameColumn(string $table, mixed $from, mixed $to): void
    {
        if (! is_string($from) || ! is_string($to) || ! isset($this->tables[$table][$from])) {
            return;
        }

        $renamed = [];

        foreach ($this->tables[$table] as $name => $column) {
            $renamed[$name === $from ? $to : $name] = $name === $from ? ['name' => $to] + $column : $column;
        }

        $this->tables[$table] = $renamed;
    }

    /**
     * The column names a call was given: one, or a list.
     *
     * @return string[]
     */
    protected function names(?Node\Expr $arg): array
    {
        if ($arg instanceof Node\Expr\Array_) {
            return array_values(array_filter(array_map(fn ($item) => $this->literal($item?->value), $arg->items), 'is_string'));
        }

        $name = $this->literal($arg);

        return is_string($name) ? [$name] : [];
    }

    /**
     * @param Node\Expr\MethodCall[] $modifiers
     */
    protected function modifierArgument(array $modifiers, string $method): mixed
    {
        foreach ($modifiers as $modifier) {
            if ($modifier->name->toString() === $method && isset($modifier->getArgs()[0])) {
                return $this->literal($modifier->getArgs()[0]->value);
            }
        }

        return null;
    }

    /**
     * Core models with a factory, by table.
     */
    public const CORE_MODELS = [
        'users' => 'Flarum\User\User',
        'discussions' => 'Flarum\Discussion\Discussion',
        'posts' => 'Flarum\Post\Post',
        'groups' => 'Flarum\Group\Group',
        'access_tokens' => 'Flarum\Http\AccessToken',
        'api_keys' => 'Flarum\Api\ApiKey',
        'tags' => 'Flarum\Tags\Tag',
        'flags' => 'Flarum\Flags\Flag',
    ];

    protected const HAS_FACTORY = 'Illuminate\Database\Eloquent\Factories\HasFactory';

    protected const MODEL_BASES = ['Flarum\Database\AbstractModel', 'Illuminate\Database\Eloquent\Model'];

    /**
     * The models among an extension's classes: those that extend a model base
     * class directly or through the extension's own classes. A subclass of a
     * core model, such as a post type, shares that model's table and factory.
     *
     * @param array<string, string> $files Each file's code, by path.
     */
    public function models(array $files): array
    {
        $classes = [];

        foreach ($files as $file => $code) {
            foreach ($this->classesIn($code) as $class) {
                $classes[$class['class']] = $class + ['file' => $file];
            }
        }

        $models = [];

        foreach ($classes as $name => $class) {
            $ancestors = [];
            $parent = $class['parent'];

            while ($parent !== null && isset($classes[$parent]) && ! in_array($parent, $ancestors)) {
                $ancestors[] = $parent;
                $parent = $classes[$parent]['parent'];
            }

            if ($class['abstract'] || ! in_array($parent, self::MODEL_BASES)) {
                continue;
            }

            $lineage = [$class, ...array_map(fn (string $ancestor) => $classes[$ancestor], $ancestors)];

            $models[] = [
                'file' => $class['file'],
                'class' => $name,
                'table' => array_values(array_filter(array_column($lineage, 'table')))[0] ?? null,
                'hasFactory' => in_array(true, array_column($lineage, 'hasFactory'), true),
            ];
        }

        usort($models, fn (array $a, array $b) => strcmp($a['file'], $b['file']));

        return ['models' => $models, 'core' => self::CORE_MODELS];
    }

    /**
     * The classes a file declares, with names resolved.
     */
    protected function classesIn(string $code): array
    {
        $ast = (new ParserFactory())->createForHostVersion()->parse($code) ?? [];

        $traverser = new NodeTraverser();
        $traverser->addVisitor(new NodeVisitor\NameResolver());
        $ast = $traverser->traverse($ast);

        $classes = [];

        foreach ((new \PhpParser\NodeFinder())->findInstanceOf($ast, Node\Stmt\Class_::class) as $class) {
            if (! $class->namespacedName) {
                continue;
            }

            $table = null;
            $hasFactory = false;

            foreach ($class->stmts as $statement) {
                if ($statement instanceof Node\Stmt\Property) {
                    foreach ($statement->props as $property) {
                        if ($property->name->toString() === 'table' && is_string($this->literal($property->default))) {
                            $table = $this->literal($property->default);
                        }
                    }
                }

                if ($statement instanceof Node\Stmt\TraitUse) {
                    foreach ($statement->traits as $trait) {
                        $hasFactory = $hasFactory || $trait->toString() === self::HAS_FACTORY;
                    }
                }
            }

            $classes[] = [
                'class' => $class->namespacedName->toString(),
                'parent' => $class->extends?->toString(),
                'abstract' => $class->isAbstract(),
                'table' => $table,
                'hasFactory' => $hasFactory,
            ];
        }

        return $classes;
    }

    /**
     * A factory for the model the file declares, from its table's columns,
     * and the model with the HasFactory trait.
     *
     * @param array{columns: ?array, models: array<string, string>} $data
     *   The model's table's columns (null if the migrations say nothing of
     *   it), and the models with a factory, by table.
     */
    public function factory(string $file, string $code, array $data): array
    {
        $ast = (new ParserFactory())->createForHostVersion()->parse($code) ?? [];

        $traverser = new NodeTraverser();
        $traverser->addVisitor(new NodeVisitor\NameResolver(null, ['replaceNodes' => false]));
        $ast = $traverser->traverse($ast);

        $finder = new \PhpParser\NodeFinder();
        $namespace = $finder->findFirstInstanceOf($ast, Node\Stmt\Namespace_::class);
        $class = $finder->findFirst($ast, fn (Node $node) => $node instanceof Node\Stmt\Class_ && ! $node->isAbstract() && $node->name);

        if (! $namespace || ! $class) {
            return ['code' => $code, 'factory' => null];
        }

        $model = $class->namespacedName->toString();
        $table = array_search($model, $data['models'] ?? [], true);

        return [
            'code' => $this->withHasFactory($code, $namespace, $class),
            'factory' => $this->factoryCode($namespace, $class->name->toString(), $data['columns'] ?? null, $data['models'] ?? [], is_string($table) ? $table : null),
        ];
    }

    protected function factoryCode(Node\Stmt\Namespace_ $namespace, string $model, ?array $columns, array $models, ?string $table): string
    {
        $uses = ['Illuminate\Database\Eloquent\Factories\Factory' => 'Factory'];
        $lines = [];

        foreach ($columns ?? [] as $column) {
            $value = $this->default($column, $table, $models, $namespace->name->toString(), $uses);

            if ($value === 'SKIP') {
                continue;
            }

            $lines[] = str_starts_with($value, '//')
                ? '            '.$value
                : '            '.$this->export($column['name']).' => '.$value.',';
        }

        if ($columns === null) {
            $lines = ['            // @TODO: give each column a default, so tests only need to set the ones they care about.'];
        }

        ksort($uses, SORT_STRING | SORT_FLAG_CASE);

        $header = '';

        foreach ($namespace->getComments() as $comment) {
            $header .= $comment->getText()."\n\n";
        }

        return "<?php\n\n".$header.'namespace '.$namespace->name->toString().";\n\n"
            .implode('', array_map(fn (string $use) => "use $use;\n", array_keys($uses)))
            ."\nclass {$model}Factory extends Factory\n{\n"
            ."    public function definition(): array\n    {\n        return [\n"
            .implode("\n", $lines).($lines ? "\n" : '')
            ."        ];\n    }\n}\n";
    }

    /**
     * The PHP for a column's default in the factory, a // @TODO line when it
     * needs one the upgrade can't give, or SKIP when the database gives it.
     */
    protected function default(array $column, ?string $table, array $models, string $namespace, array &$uses): string
    {
        $name = $column['name'];

        if ($column['autoIncrement']) {
            return 'SKIP';
        }

        if ($name === 'created_at') {
            $uses['Carbon\Carbon'] = 'Carbon';

            return 'Carbon::now()';
        }

        if ($column['references'] ?? null) {
            if ($column['nullable']) {
                return 'null';
            }

            $related = $models[$column['references']] ?? null;

            // A model pointing at its own table would make one of itself forever.
            if (! $related || $column['references'] === $table) {
                return "// @TODO: give $name a default, such as a factory for the model it points at, or set it in each test.";
            }

            return $this->classReference($related, $namespace, $uses).'::factory()';
        }

        if (array_key_exists('default', $column)) {
            return $this->export($column['default']['value']);
        }

        if ($column['defaultExpression'] ?? false) {
            return 'SKIP';
        }

        if ($column['nullable']) {
            return 'null';
        }

        switch ($column['type']) {
            case 'int':
            case 'number':
                return '0';
            case 'bool':
                return 'false';
            case 'datetime':
                $uses['Carbon\Carbon'] = 'Carbon';

                return 'Carbon::now()';
            case 'json':
                return '[]';
            case 'enum':
                return isset($column['values'][0]) ? $this->export($column['values'][0]) : "// @TODO: give $name a default, or set it in each test.";
            case 'uuid':
                return '$this->faker->uuid';
            case 'ip':
                return '$this->faker->ipv4';
            case 'binary':
                return "''";
            case 'string':
            case 'text':
                return match (true) {
                    $name === 'slug' => '$this->faker->slug',
                    $name === 'email' => '$this->faker->safeEmail',
                    $name === 'ip_address' => '$this->faker->ipv4',
                    $name === 'url' || str_ends_with($name, '_url') => '$this->faker->url',
                    $name === 'color' => '$this->faker->hexColor',
                    $column['type'] === 'text' => '$this->faker->sentence',
                    default => '$this->faker->word',
                };
        }

        return "// @TODO: give $name a default, or set it in each test.";
    }

    /**
     * How the factory names a model class: imported, unless it is in the
     * factory's namespace or its name is taken.
     */
    protected function classReference(string $class, string $namespace, array &$uses): string
    {
        $short = substr($class, strrpos($class, '\\') + 1);

        if (substr($class, 0, -strlen($short) - 1) === $namespace) {
            return $short;
        }

        if (isset($uses[$class]) || ! in_array($short, $uses, true)) {
            $uses[$class] = $short;

            return $short;
        }

        return '\\'.$class;
    }

    protected function export(mixed $value): string
    {
        return match (true) {
            $value === null => 'null',
            is_bool($value) => $value ? 'true' : 'false',
            is_int($value), is_float($value) => (string) $value,
            default => "'".addcslashes((string) $value, "\\'")."'",
        };
    }

    /**
     * The model's code with the HasFactory trait, and its import, added where
     * they belong. Edited as text, from the end, so the rest stays as it is.
     */
    protected function withHasFactory(string $code, Node\Stmt\Namespace_ $namespace, Node\Stmt\Class_ $class): string
    {
        foreach ($class->stmts as $statement) {
            if ($statement instanceof Node\Stmt\TraitUse) {
                foreach ($statement->traits as $trait) {
                    if ($trait->getAttribute('resolvedName')?->toString() === self::HAS_FACTORY) {
                        return $code;
                    }
                }
            }
        }

        $edits = [];

        // The trait: with the class's other traits, else above everything else.
        $first = $class->stmts[0] ?? null;
        $trait = null;

        foreach ($class->stmts as $statement) {
            if ($statement instanceof Node\Stmt\TraitUse) {
                $trait = $statement;
                break;
            }
        }

        if ($trait || $first) {
            $at = $this->startOf($trait ?? $first);
            $indent = $this->indentAt($code, $at);
            $edits[$at] = 'use HasFactory;'."\n".($trait ? '' : "\n").$indent;
        } else {
            // An empty body: everything between its braces becomes the trait.
            $close = $class->getEndFilePos();
            $open = strrpos(substr($code, 0, $close), '{');
            $indent = $this->indentAt($code, $class->getStartFilePos());
            $edits[$open] = "{\n$indent    use HasFactory;\n$indent}";
            $code = substr($code, 0, $open).substr($code, $close + 1);
        }

        // The import: in order among the others, unless it is there already.
        $imports = array_values(array_filter($namespace->stmts, fn (Node $node) => $node instanceof Node\Stmt\Use_ && $node->type === Node\Stmt\Use_::TYPE_NORMAL));
        $imported = array_map(fn (Node\Stmt\Use_ $use) => $use->uses[0]->name->toString(), $imports);

        if (! in_array(self::HAS_FACTORY, $imported)) {
            $after = null;

            foreach ($imports as $import) {
                if (strcasecmp($import->uses[0]->name->toString(), self::HAS_FACTORY) > 0) {
                    $edits[$this->startOf($import)] = 'use '.self::HAS_FACTORY.";\n";
                    $after = false;
                    break;
                }

                $after = $import;
            }

            if ($after) {
                $edits[$after->getEndFilePos() + 1] = "\nuse ".self::HAS_FACTORY.';';
            } elseif ($after === null) {
                $edits[$namespace->name->getEndFilePos() + 2] = "\n\nuse ".self::HAS_FACTORY.';';
            }
        }

        krsort($edits);

        foreach ($edits as $at => $text) {
            $code = substr($code, 0, $at).$text.substr($code, $at);
        }

        return $code;
    }

    /**
     * Where a statement starts, comments included.
     */
    protected function startOf(Node $node): int
    {
        $comments = $node->getComments();

        return $comments ? $comments[0]->getStartFilePos() : $node->getStartFilePos();
    }

    protected function indentAt(string $code, int $at): string
    {
        $lineStart = strrpos(substr($code, 0, $at), "\n");

        return substr($code, $lineStart === false ? 0 : $lineStart + 1, $at - ($lineStart === false ? 0 : $lineStart + 1));
    }

    protected function isLiteral(?Node\Expr $expr): bool
    {
        return $expr instanceof Node\Scalar\String_
            || $expr instanceof Node\Scalar\Int_
            || $expr instanceof Node\Scalar\Float_
            || ($expr instanceof Node\Expr\UnaryMinus && ($expr->expr instanceof Node\Scalar\Int_ || $expr->expr instanceof Node\Scalar\Float_))
            || ($expr instanceof Node\Expr\ConstFetch && in_array($expr->name->toLowerString(), ['true', 'false', 'null']));
    }

    /**
     * The value of a literal: a string, number, boolean or null. Anything else
     * is null.
     */
    protected function literal(?Node\Expr $expr): mixed
    {
        if (! $this->isLiteral($expr)) {
            return null;
        }

        if ($expr instanceof Node\Expr\UnaryMinus) {
            return -$expr->expr->value;
        }

        if ($expr instanceof Node\Expr\ConstFetch) {
            return ['true' => true, 'false' => false, 'null' => null][$expr->name->toLowerString()];
        }

        return $expr->value;
    }
}
