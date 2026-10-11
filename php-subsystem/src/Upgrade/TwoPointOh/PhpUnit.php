<?php

namespace Flarum\CliPhpSubsystem\Upgrade\TwoPointOh;

use Flarum\CliPhpSubsystem\NodeUtil;
use Flarum\CliPhpSubsystem\NodeVisitors\AddUses;
use Flarum\CliPhpSubsystem\Upgrade\Replacement;
use Flarum\CliPhpSubsystem\Upgrade\ReplacementResult;
use PhpParser\Comment;
use PhpParser\Comment\Doc;
use PhpParser\Modifiers;
use PhpParser\Node;
use PhpParser\NodeVisitor;

class PhpUnit extends Replacement
{
    /**
     * PHPUnit 12 reads test metadata only from attributes. These annotations
     * have one: [attribute, whether it takes the rest of the line, where PHPUnit
     * allows it].
     */
    protected const ANNOTATIONS = [
        'test' => ['Test', false, ['method']],
        'group' => ['Group', true, ['class', 'method']],
        'ticket' => ['Ticket', true, ['class', 'method']],
        'testdox' => ['TestDox', true, ['class', 'method']],
        'doesNotPerformAssertions' => ['DoesNotPerformAssertions', false, ['class', 'method']],
        'runInSeparateProcess' => ['RunInSeparateProcess', false, ['method']],
        'runTestsInSeparateProcesses' => ['RunTestsInSeparateProcesses', false, ['class']],
        'before' => ['Before', false, ['method']],
        'after' => ['After', false, ['method']],
        'beforeClass' => ['BeforeClass', false, ['method']],
        'afterClass' => ['AfterClass', false, ['method']],
        'preCondition' => ['PreCondition', false, ['method']],
        'postCondition' => ['PostCondition', false, ['method']],
        // On a method, PHPUnit 12.3 deprecates it.
        'coversNothing' => ['CoversNothing', false, ['class']],
    ];

    /**
     * Annotations PHPUnit read that need an attribute the upgrade can't work
     * out. They stay, flagged.
     */
    protected const OTHER_ANNOTATIONS = [
        'backupGlobals', 'backupStaticAttributes', 'covers', 'coversDefaultClass', 'large', 'medium',
        'preserveGlobalState', 'requires', 'small', 'testWith', 'uses',
    ];

    public const ATTRIBUTES_DOCS = 'https://docs.phpunit.de/en/12.5/attributes.html';

    /**
     * Assertions PHPUnit 10 removed, each for one that does the same.
     */
    public const RENAMED_ASSERTIONS = [
        'assertObjectHasAttribute' => 'assertObjectHasProperty',
        'assertObjectNotHasAttribute' => 'assertObjectNotHasProperty',
        'assertRegExp' => 'assertMatchesRegularExpression',
        'assertNotRegExp' => 'assertDoesNotMatchRegularExpression',
        'assertFileNotExists' => 'assertFileDoesNotExist',
        'assertFileNotIsReadable' => 'assertFileIsNotReadable',
        'assertFileNotIsWritable' => 'assertFileIsNotWritable',
        'assertDirectoryNotExists' => 'assertDirectoryDoesNotExist',
        'assertDirectoryNotIsReadable' => 'assertDirectoryIsNotReadable',
        'assertDirectoryNotIsWritable' => 'assertDirectoryIsNotWritable',
        'assertNotIsReadable' => 'assertIsNotReadable',
        'assertNotIsWritable' => 'assertIsNotWritable',
    ];

    /**
     * The TestCase stub helpers PHPUnit 12 removed, and the will*() method
     * that replaces `->will($this->helper(...))`.
     */
    public const STUB_HELPERS = [
        'returnValue' => 'willReturn',
        'returnValueMap' => 'willReturnMap',
        'returnArgument' => 'willReturnArgument',
        'returnCallback' => 'willReturnCallback',
        'returnSelf' => 'willReturnSelf',
        'throwException' => 'willThrowException',
        'onConsecutiveCalls' => 'willReturnOnConsecutiveCalls',
    ];

    /**
     * What PHPUnit removed without a drop-in replacement, by the version that
     * removed it. These names are PHPUnit's alone, so they are flagged on any
     * object.
     */
    public const REMOVED = [
        'withConsecutive' => '10',
        'setMethods' => '10',
        'setMethodsExcept' => '10',
        'assertEqualXMLStructure' => '10',
        'getMockForAbstractClass' => '12',
        'getMockForTrait' => '12',
        'addMethods' => '12',
    ];

    /**
     * Likewise, but only TestCase methods: other objects have methods of the
     * same name (a translator's setLocale(), say), so these are flagged only
     * on `$this`, `self` and `static`.
     */
    public const REMOVED_FROM_TEST_CASE = [
        'at' => '10',
        'getMockClass' => '10',
        'expectDeprecation' => '10',
        'expectDeprecationMessage' => '10',
        'expectDeprecationMessageMatches' => '10',
        'expectError' => '10',
        'expectErrorMessage' => '10',
        'expectErrorMessageMatches' => '10',
        'expectNotice' => '10',
        'expectNoticeMessage' => '10',
        'expectNoticeMessageMatches' => '10',
        'expectWarning' => '10',
        'expectWarningMessage' => '10',
        'expectWarningMessageMatches' => '10',
        'iniSet' => '12',
        'setLocale' => '12',
        'createTestProxy' => '12',
        'getMockFromWsdl' => '12',
        'getObjectForTrait' => '12',
        // Stub helpers used other than through will().
        'returnValue' => '12',
        'returnValueMap' => '12',
        'returnArgument' => '12',
        'returnCallback' => '12',
        'returnSelf' => '12',
        'throwException' => '12',
        'onConsecutiveCalls' => '12',
    ];

    protected const CHANGELOGS = [
        '10' => 'https://github.com/sebastianbergmann/phpunit/blob/10.0.0/ChangeLog-10.0.md',
        '12' => 'https://github.com/sebastianbergmann/phpunit/blob/12.0.0/ChangeLog-12.0.md',
    ];

    protected $dataProviders = [];

    protected $usedModels = [];

    protected function operations(): array
    {
        return ['run', 'postRun', 'replaceRemovedApis', 'flagRemovedApis', 'tablesToModels', 'postTablesToModels'];
    }

    function run(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        if (strpos($file, '.php') === false) {
            return null;
        }

        $traverser = $this->traverser();

        $traverser->addVisitor($visitor = new class ($this) extends \PhpParser\NodeVisitorAbstract {
            public $dataProviders = [];
            public $attributes = [];

            public function __construct(private PhpUnit $phpUnit)
            {
            }

            public function leaveNode(Node $node)
            {
                if ($node instanceof Node\Stmt\Namespace_ && ! empty($this->attributes)) {
                    $uses = array_map(fn (string $attribute) => "PHPUnit\\Framework\\Attributes\\$attribute", array_keys($this->attributes));
                    sort($uses);

                    NodeUtil::addUsesToNamespace($node, $uses);
                }

                $target = match (true) {
                    $node instanceof Node\Stmt\ClassMethod => 'method',
                    $node instanceof Node\Stmt\Class_ => 'class',
                    default => null,
                };

                if (! $target || ! $node->getDocComment()) {
                    return null;
                }

                [$doc, $groups, $providers, $unconverted] = $this->phpUnit->readMetadata($node->getDocComment()->getText(), $target);

                if (! $groups && ! $unconverted) {
                    return null;
                }

                if ($groups) {
                    $comments = array_values(array_filter($node->getComments(), fn ($comment) => ! $comment instanceof Doc));

                    if ($doc !== null) {
                        $comments[] = new Doc($doc);
                    }

                    $node->setAttribute('comments', $comments);
                }

                if ($unconverted) {
                    $names = implode(', ', array_map(fn (string $name) => "@$name", array_unique($unconverted)));

                    $node->setAttribute('comments', PhpUnit::withComment(
                        $node->getComments(),
                        "// @TODO: PHPUnit 12 no longer reads $names here. Use attributes instead: ".PhpUnit::ATTRIBUTES_DOCS
                    ));
                }

                foreach ($groups as $group) {
                    $name = $group->attrs[0]->name->toString();

                    // A test already given the attribute keeps just that.
                    if (! $this->hasAttribute($node, $name)) {
                        $node->attrGroups[] = $group;
                        $this->attributes[$name] = true;
                    }
                }

                array_push($this->dataProviders, ...$providers);

                return $node;
            }

            protected function hasAttribute(Node $node, string $name): bool
            {
                foreach ($node->attrGroups as $group) {
                    foreach ($group->attrs as $attribute) {
                        if ($attribute->name->getLast() === $name) {
                            return true;
                        }
                    }
                }

                return false;
            }
        });

        $ast = $traverser->traverse($ast);

        $this->dataProviders = $visitor->dataProviders;

        return new ReplacementResult($ast);
    }

    /**
     * Read the PHPUnit metadata out of a doc comment.
     *
     * @return array{0: ?string, 1: Node\AttributeGroup[], 2: string[], 3: string[]}
     *   The doc comment without the annotations that became attributes (null
     *   if nothing else was in it), those attributes in the order they were
     *   written, the data providers in the same class, and the annotations
     *   that could not be converted.
     */
    public function readMetadata(string $doc, string $target): array
    {
        $lines = explode("\n", $doc);
        $kept = [];
        $groups = [];
        $providers = [];
        $unconverted = [];

        foreach ($lines as $line) {
            $content = preg_replace('~^\s*(/\*\*|\*(?!/))?\s*~', '', $line);
            $content = preg_replace('~\s*\*/\s*$~', '', $content);

            if (! preg_match('/^@(\w+)(?:\s+(.*))?$/', $content, $matches)) {
                $kept[] = $line;
                continue;
            }

            [$name, $argument] = [$matches[1], trim($matches[2] ?? '')];

            $group = match (true) {
                $target === 'method' && in_array($name, ['dataProvider', 'depends']) => $this->reference($name, $argument, $providers),
                isset(self::ANNOTATIONS[$name]) && in_array($target, self::ANNOTATIONS[$name][2]) => $this->attribute($name, $argument),
                default => null,
            };

            if ($group) {
                $groups[] = $group;
                continue;
            }

            if (isset(self::ANNOTATIONS[$name]) || in_array($name, self::OTHER_ANNOTATIONS) || in_array($name, ['dataProvider', 'depends'])) {
                $unconverted[] = $name;
            }

            $kept[] = $line;
        }

        if (! $groups) {
            return [$doc, [], [], $unconverted];
        }

        return [$this->rebuildDoc($kept), $groups, $providers, $unconverted];
    }

    /**
     * An attribute for a @dataProvider or @depends naming a method in this
     * class or, as `Class::method`, in another.
     */
    protected function reference(string $name, string $argument, array &$providers): ?Node\AttributeGroup
    {
        $attribute = $name === 'dataProvider' ? 'DataProvider' : 'Depends';

        if (preg_match('/^\w+$/', $argument)) {
            if ($name === 'dataProvider') {
                $providers[] = $argument;
            }

            return $this->group($attribute, [new Node\Scalar\String_($argument)]);
        }

        // PHPUnit took the class name as written, so it is fully qualified.
        if (preg_match('/^\\\\?([A-Za-z_][\w\\\\]*)::(\w+)$/', $argument, $matches) && $matches[2] !== 'class') {
            return $this->group($attribute.'External', [
                new Node\Expr\ClassConstFetch(new Node\Name\FullyQualified($matches[1]), 'class'),
                new Node\Scalar\String_($matches[2]),
            ]);
        }

        return null;
    }

    protected function attribute(string $name, string $argument): ?Node\AttributeGroup
    {
        [$attribute, $takesArgument] = self::ANNOTATIONS[$name];

        if (! $takesArgument) {
            return $this->group($attribute);
        }

        return $argument === '' ? null : $this->group($attribute, [new Node\Scalar\String_($argument)]);
    }

    protected function group(string $attribute, array $arguments = []): Node\AttributeGroup
    {
        return new Node\AttributeGroup([
            new Node\Attribute(new Node\Name($attribute), array_map(fn (Node\Expr $argument) => new Node\Arg($argument), $arguments)),
        ]);
    }

    /**
     * The doc comment from the lines left in it, or null if none of them says
     * anything. Blank lines left at either end go.
     */
    protected function rebuildDoc(array $lines): ?string
    {
        $blank = fn (string $line) => preg_match('~^\s*\*?\s*$~', $line);

        // A one-line doc comment held only the annotation.
        if (count($lines) < 2) {
            return null;
        }

        $first = array_shift($lines);
        $last = array_pop($lines);

        while ($lines && $blank(end($lines))) {
            array_pop($lines);
        }

        while ($lines && $blank(reset($lines))) {
            array_shift($lines);
        }

        if (! $lines && trim($first) === '/**') {
            return null;
        }

        return implode("\n", [$first, ...$lines, $last]);
    }

    function postRun(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        if (strpos($file, '.php') === false) {
            return null;
        }

        $traverser = $this->traverser();

        // In the second traversal, we make the data providers static.
        $traverser->addVisitor(new class ($this->dataProviders) extends \PhpParser\NodeVisitorAbstract {
            protected $dataProviders = [];

            public function __construct(array $dataProviders)
            {
                $this->dataProviders = $dataProviders;
            }

            public function leaveNode(Node $node)
            {
                if ($node instanceof Node\Stmt\ClassMethod) {
                    $name = $node->name->name;

                    if (in_array($name, $this->dataProviders)) {
                        // data providers must now be static
                        if (! $node->isStatic()) {
                            $node->flags |= Modifiers::STATIC;
                        }
                    }
                }

                return $node;
            }
        });

        return new ReplacementResult($traverser->traverse($ast));
    }

    function tablesToModels(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        if (strpos($file, '.php') === false) {
            return null;
        }

        $traverser = $this->traverser();

        // Replace the following example:
        // $this->prepareDatabase([
        //     'users' => [...],
        //     'discussions' => [...],
        // ]);
        // with:
        // $this->prepareDatabase([
        //     User::class => [...],
        //     Discussion::class => [...],
        // ]);

        $traverser->addVisitor($visitor = new class extends \PhpParser\NodeVisitorAbstract {
            protected $models = [
                'users' => 'Flarum\\User\\User',
                'discussions' => 'Flarum\\Discussion\\Discussion',
                'groups' => 'Flarum\\Group\\Group',
                'tags' => 'Flarum\\Tags\\Tag',
                'flags' => 'Flarum\\Flags\\Flag',
                'posts' => 'Flarum\\Post\\Post',
                'access_tokens' => 'Flarum\\Http\\AccessToken',
            ];

            public $usedModels = [];

            public function leaveNode(Node $node)
            {
                if ($node instanceof Node\Expr\MethodCall) {
                    if ($node->var instanceof Node\Expr\Variable && $node->var->name === 'this') {
                        if ($node->name instanceof Node\Identifier && $node->name->name === 'prepareDatabase') {
                            if ($node->args[0]->value instanceof Node\Expr\Array_) {
                                foreach ($node->args[0]->value->items as $item) {
                                    if ($item->key instanceof Node\Scalar\String_) {
                                        $table = $item->key->value;

                                        if (isset($this->models[$table])) {
                                            $exploded = explode('\\', $this->models[$table]);
                                            $className = end($exploded);
                                            $item->key = new Node\Expr\ClassConstFetch(new Node\Name($className), 'class');
                                            $this->usedModels[$this->models[$table]] = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        $ast = $traverser->traverse($ast);

        $this->usedModels = $visitor->usedModels;

        return new ReplacementResult($ast);
    }

    function postTablesToModels(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        if (strpos($file, '.php') === false) {
            return null;
        }

        if (empty($this->usedModels)) {
            return null;
        }

        $traverser = $this->traverser();

        $traverser->addVisitor(new AddUses(array_keys($this->usedModels)));

        return new ReplacementResult($traverser->traverse($ast));
    }

    /**
     * Rename the assertions PHPUnit 10 replaced, and configure stubs through
     * the will*() methods instead of the helpers PHPUnit 12 removed.
     */
    function replaceRemovedApis(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        if (strpos($file, '.php') === false) {
            return null;
        }

        $traverser = $this->traverser();

        $traverser->addVisitor(new class () extends \PhpParser\NodeVisitorAbstract {
            public function leaveNode(Node $node)
            {
                if (! ($node instanceof Node\Expr\MethodCall || $node instanceof Node\Expr\StaticCall) || ! $node->name instanceof Node\Identifier) {
                    return null;
                }

                if (isset(PhpUnit::RENAMED_ASSERTIONS[$node->name->name])) {
                    $node->name = new Node\Identifier(PhpUnit::RENAMED_ASSERTIONS[$node->name->name]);

                    return $node;
                }

                // ->will($this->returnValue(1)) is ->willReturn(1).
                if ($node instanceof Node\Expr\MethodCall && $node->name->name === 'will' && count($node->args) === 1 && $node->args[0] instanceof Node\Arg) {
                    $helper = $node->args[0]->value;

                    if (PhpUnit::onTestCase($helper) && $helper->name instanceof Node\Identifier && isset(PhpUnit::STUB_HELPERS[$helper->name->name])) {
                        return new Node\Expr\MethodCall($node->var, PhpUnit::STUB_HELPERS[$helper->name->name], $helper->args, $node->getAttributes());
                    }
                }

                return null;
            }
        });

        return new ReplacementResult($traverser->traverse($ast));
    }

    /**
     * Flag what PHPUnit removed without a drop-in replacement, above the
     * statement that uses it.
     */
    function flagRemovedApis(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        if (strpos($file, '.php') === false) {
            return null;
        }

        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\ParentConnectingVisitor());

        $traverser->addVisitor($visitor = new class () extends \PhpParser\NodeVisitorAbstract {
            /** @var \SplObjectStorage<Node\Stmt, array<string, string>> */
            public \SplObjectStorage $flags;

            public function __construct()
            {
                $this->flags = new \SplObjectStorage();
            }

            public function leaveNode(Node $node)
            {
                if (! ($node instanceof Node\Expr\MethodCall || $node instanceof Node\Expr\StaticCall) || ! $node->name instanceof Node\Identifier) {
                    return null;
                }

                $name = $node->name->name;
                $version = PhpUnit::REMOVED[$name] ?? (PhpUnit::onTestCase($node) ? PhpUnit::REMOVED_FROM_TEST_CASE[$name] ?? null : null);

                if (! $version) {
                    return null;
                }

                $statement = $node;

                while ($statement && ! $statement instanceof Node\Stmt) {
                    $statement = $statement->getAttribute('parent');
                }

                if ($statement) {
                    $flags = isset($this->flags[$statement]) ? $this->flags[$statement] : [];
                    $flags[$name] = $version;
                    $this->flags[$statement] = $flags;
                }

                return null;
            }
        });

        $ast = $traverser->traverse($ast);

        foreach ($visitor->flags as $statement) {
            $comments = $statement->getComments();

            foreach ($visitor->flags[$statement] as $name => $version) {
                $comments = self::withComment($comments, "// @TODO: PHPUnit 12 has no $name(). ".self::CHANGELOGS[$version]);
            }

            $statement->setAttribute('comments', $comments);
        }

        return new ReplacementResult($ast);
    }

    /**
     * The comments with one more line, unless an earlier run already added it.
     */
    public static function withComment(array $comments, string $text): array
    {
        foreach ($comments as $comment) {
            if ($comment->getText() === $text) {
                return $comments;
            }
        }

        return [...$comments, new Comment($text)];
    }

    /**
     * Whether a call is to the test case itself: `$this->`, `self::`, `static::`.
     */
    public static function onTestCase(Node $node): bool
    {
        if ($node instanceof Node\Expr\MethodCall) {
            return $node->var instanceof Node\Expr\Variable && $node->var->name === 'this';
        }

        if ($node instanceof Node\Expr\StaticCall) {
            return $node->class instanceof Node\Name && in_array($node->class->toLowerString(), ['self', 'static', 'parent']);
        }

        return false;
    }
}
