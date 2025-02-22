<?php

namespace Flarum\CliPhpSubsystem\Upgrade\TwoPointOh;

use Flarum\CliPhpSubsystem\ExtenderUtil;
use Flarum\CliPhpSubsystem\NodeUtil;
use Flarum\CliPhpSubsystem\NodeVisitors\ChangeSignatures;
use Flarum\CliPhpSubsystem\NodeVisitors\ReplaceUses;
use Flarum\CliPhpSubsystem\Upgrade\Replacement;
use Flarum\CliPhpSubsystem\Upgrade\ReplacementResult;
use PhpParser\Modifiers;
use PhpParser\Node;
use PhpParser\NodeVisitor;

class Search extends Replacement
{
    protected $data = [];

    protected function operations(): array
    {
        return ['gambitToFilter', 'run', 'replaceNamespaces', 'changeSignatures', 'extenders', 'removeOldExtenders'];
    }

    function gambitToFilter(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        $filterClasses = ! empty($data['filterClasses'])
            ? $data['filterClasses']
            : [];

        if (! in_array($file, $filterClasses)) {
            return null;
        }

        if (strpos($code, 'implements FilterInterface') !== false) {
            return null;
        }

        $data['filterKey'] = $data['gambits'][0]['filterKey'] ?? '';

        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\NameResolver(null, [
            'replaceNodes' => false,
        ]));

        $traverser->addVisitor(new class ($data) extends \PhpParser\NodeVisitorAbstract {
            public $data = [];

            public function __construct($data)
            {
                $this->data = $data;
            }

            public function leaveNode(Node $node)
            {
                if ($node instanceof Node\Stmt\Namespace_) {
                    NodeUtil::addUsesToNamespace($node, [
                        'Flarum\\Search\\Filter\\FilterInterface',
                    ]);
                }

                if ($node instanceof Node\Stmt\Class_) {
                    $implementsFilterInterface = false;

                    foreach ($node->implements as $interface) {
                        if ($interface->name === 'FilterInterface') {
                            $implementsFilterInterface = true;
                        }
                    }

                    if (! $implementsFilterInterface) {
                        $node->implements[] = new Node\Name('FilterInterface', [
                            'resolvedName' => new Node\Name('Flarum\\Search\\Filter\\FilterInterface'),
                        ]);

                        $node->stmts[] = new Node\Stmt\ClassMethod('getFilterKey', [
                            'type' => Modifiers::PUBLIC,
                            'stmts' => [
                                new Node\Stmt\Return_(
                                    new Node\Scalar\String_($this->data['filterKey'])
                                ),
                            ],
                            'returnType' => new Node\Name('string'),
                        ]);
                    }
                }
            }
        });

        return new ReplacementResult($traverser->traverse($ast));
    }

    function run(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\NameResolver(null, [
            'replaceNodes' => false,
        ]));

        if (strpos($file, 'Repository') !== false || strpos($code, ' extends AbstractSearcher') !== false) {
            ///**
            //     * Get a new query builder for the banned IP table.
            //     *
            //     * @return Builder
            //     */
            //    public function query()
            //    {
            //        return BannedIP::query();
            //    }
            // ------------------
            //public function __construct(array $filters, array $filterMutators, BannedIPRepository $bannedIPs)
            //    {
            //        parent::__construct($filters, $filterMutators);
            //
            //        $this->bannedIPs = $bannedIPs;
            //    }
            //
            //    protected function getQuery(User $actor): Builder
            //    {
            //        return $this->bannedIPs->query();
            //    }
            $traverser->addVisitor($collector = new class($file, $code) extends \PhpParser\NodeVisitorAbstract {
                public $data = [];
                protected $file;
                protected $code;
                protected $map = [];

                public function __construct($file, $code)
                {
                    $this->file = $file;
                    $this->code = $code;
                }

                public function enterNode(Node $node)
                {
                    $exploded = explode(DIRECTORY_SEPARATOR, $this->file);
                    $class = str_replace('.php', '', $exploded[count($exploded) - 1]);
                    preg_match('/namespace (.*);/', $this->code, $matches);
                    $namespace = $matches[1] ?? '';
                    $fqnClass = $namespace . '\\' . $class;

                    if (strpos($this->file, 'Repository') !== false) {
                        if ($node instanceof Node\Stmt\ClassMethod && $node->name->name === 'query') {
                            if (isset($node->stmts[0]) && $node->stmts[0] instanceof Node\Stmt\Return_) {
                                $expr = $node->stmts[0]->expr;

                                if ($expr instanceof Node\Expr\StaticCall) {
                                    $model = NodeUtil::className($expr->class);
                                    $this->data['repositories'][$class]['model'] = $model;
                                }
                            }
                        }
                    }

                    if (strpos($this->code, ' extends AbstractSearcher') !== false) {
                        // public function __construct(array $filters, array $filterMutators, BannedIPRepository $bannedIPs)
                        // we first need a map of properties to their types
                        if ($node instanceof Node\Stmt\ClassMethod && $node->name->name === '__construct') {
                            foreach ($node->params as $param) {
                                if ($param->type instanceof Node\Name && ! empty($param->type->getAttribute('resolvedName'))) {
                                    $this->map[$param->var->name] = $param->type->name;
                                }
                            }
                        }

                        if ($node instanceof Node\Stmt\ClassMethod && $node->name->name === 'getQuery') {
                            if (isset($node->stmts[0]) && $node->stmts[0] instanceof Node\Stmt\Return_) {
                                $expr = $node->stmts[0]->expr;

                                // return $this->bannedIPs->query();
                                // we need the repository class
                                if ($expr instanceof Node\Expr\MethodCall && $expr->var instanceof Node\Expr\PropertyFetch && isset($this->map[$expr->var->name->name])) {
                                    $this->data['searchers'][$fqnClass]['repository'] = $this->map[$expr->var->name->name];
                                } elseif ($expr instanceof Node\Expr\MethodCall && $expr->var instanceof Node\Expr\StaticCall) {
                                    $model = NodeUtil::className($expr->var->class);
                                    $this->data['searchers'][$fqnClass]['model'] = $model;
                                }
                            }
                        }
                    }
                }
            });
        }

        if (strpos($file, 'extend.php') !== false) {
            //// before
            //(new Extend\Filter(PostFilterer::class))
            //	->addFilter(PostTagFilter::class),
            //
            //(new Extend\Filter(DiscussionFilterer::class))
            //	->addFilter(TagFilterGambit::class)
            //	->addFilterMutator(HideHiddenTagsFromAllDiscussionsPage::class),
            //
            //(new Extend\SimpleFlarumSearch(DiscussionSearcher::class))
            //	->addGambit(TagFilterGambit::class),
            //
            //(new Extend\SimpleFlarumSearch(TagSearcher::class))
            //	->setFullTextGambit(FullTextGambit::class),
            //
            //// after
            //(new Extend\SearchDriver(DatabaseSearchDriver::class))
            //	->addFilter(PostSearcher::class, PostTagFilter::class)
            //	->addFilter(DiscussionSearcher::class, TagFilter::class)
            //	->addMutator(DiscussionSearcher::class, HideHiddenTagsFromAllDiscussionsPage::class)
            //	->addSearcher(Tag::class, TagSearcher::class)
            //	->setFulltext(TagSearcher::class, FulltextFilter::class),

            if (strpos($code, 'namespace ') === false) {
                $returnExtendersNode = $ast[count($ast) - 1];
            } else {
                $returnExtendersNode = null;
            }

            $traverser->addVisitor($visitor = new class ($returnExtendersNode) extends \PhpParser\NodeVisitorAbstract {
                public $data = [
                    'to_delete' => [],
                    // searcherClass => [
                    //     'mutators' => [],
                    //     'filters' => [],
                    //     'fulltext' => [],
                    // ]
                    'searchers' => [],
                ];
                /** @var Node\Stmt\Return_ */
                protected $returnExtendersNode = null;

                public function __construct($returnExtendersNode)
                {
                    $this->returnExtendersNode = $returnExtendersNode;
                }

                private function findNew(Node $node): ?Node\Expr\New_
                {
                    if ($node instanceof Node\Expr\New_) {
                        return $node;
                    }

                    if ($node instanceof Node\Expr\MethodCall) {
                        return $this->findNew($node->var);
                    }

                    return null;
                }

                public function leaveNode(Node $node)
                {
                    if ($node instanceof Node\Expr\MethodCall) {
                        $method = $node->name->name;

                        if (! in_array($method, ['addFilter', 'addFilterMutator', 'addGambit', 'setFullTextGambit'])) {
                            return $node;
                        }

                        $new = $this->findNew($node);

                        if (! $new) {
                            return $node;
                        }

                        $resolvedName = $new->class->getAttribute('resolvedName');

                        if (! $resolvedName) {
                            return $node;
                        }

                        $class = $resolvedName->name;

                        if (! in_array($class, ['Flarum\\Extend\\Filter', 'Flarum\\Extend\\SimpleFlarumSearch'])) {
                            return $node;
                        }

                        if ($class === 'Flarum\Extend\Filter') {
                            $filterer = NodeUtil::className($new->args[0]->value->class);

                            if ($filterer === 'Flarum\\Discussion\\Filter\\DiscussionFilterer') {
                                $searcher = 'Flarum\\Discussion\\Search\\DiscussionSearcher';
                            } elseif ($filterer === 'Flarum\\Post\\Filter\\PostFilterer') {
                                $searcher = 'Flarum\\Post\\Filter\\PostSearcher';
                            } else {
                                $searcher = str_replace('Filterer', 'Searcher', $filterer);
                            }

                            $arg = $node->args[0];

                            if ($arg->value instanceof Node\Expr\ClassConstFetch) {
                                $arg->value->class->name = str_replace(['FilterGambit', 'GambitFilter'], 'Filter', $arg->value->class->name);
                                $arg->value->class->name = str_replace('Gambit', 'Filter', $arg->value->class->name);
                            } elseif ($arg->value instanceof Node\Scalar\String_) {
                                $arg->value->value = str_replace(['FilterGambit', 'GambitFilter'], 'Filter', $arg->value->value);
                                $arg->value->value = str_replace('Gambit', 'Filter', $arg->value->value);
                            }

                            if ($method === 'addFilter') {
                                $this->data['searchers'][$searcher]['filters'][] = $arg->value;
                            } elseif ($method === 'addFilterMutator') {
                                $this->data['searchers'][$searcher]['mutators'][] = $arg->value;
                            }
                        } elseif ($class === 'Flarum\Extend\SimpleFlarumSearch') {
                            $searcher = NodeUtil::className($new->args[0]->value->class);

                            $arg = $node->args[0];

                            if ($arg->value instanceof Node\Expr\ClassConstFetch) {
                                $arg->value->class->name = str_replace(['FilterGambit', 'GambitFilter'], 'Filter', $arg->value->class->name);
                                $arg->value->class->name = str_replace('Gambit', 'Filter', $arg->value->class->name);

                                /** @var Node\Identifier $resolvedName */
                                $resolvedName = $arg->value->class->getAttribute('resolvedName');

                                if ($resolvedName) {
                                    $resolvedName->name = str_replace(['FilterGambit', 'GambitFilter'], 'Filter', $resolvedName->name);
                                    $resolvedName->name = str_replace('Gambit', 'Filter', $resolvedName->name);
                                }
                            } elseif ($arg->value instanceof Node\Scalar\String_) {
                                $arg->value->value = str_replace(['FilterGambit', 'GambitFilter'], 'Filter', $arg->value->value);
                                $arg->value->value = str_replace('Gambit', 'Filter', $arg->value->value);
                            }

                            if ($method === 'addGambit') {
                                $this->data['searchers'][$searcher]['filters'][] = $arg->value;
                            } elseif ($method === 'setFullTextGambit') {
                                $this->data['searchers'][$searcher]['fulltext'] = isset($resolvedName)
                                    ? $resolvedName->name
                                    : ($arg->value instanceof Node\Expr\ClassConstFetch
                                        ? $arg->value->class->name
                                        : $arg->value->value);
                            }
                        }

                        if ($node->var instanceof Node\Expr\New_) {
                            $this->data['to_delete'][] = $node;
                        }
                    }

                    if ($node instanceof Node\Stmt\Namespace_) {
                        $this->returnExtendersNode = $node->stmts[count($node->stmts) - 1];
                    }
                }
            });

            $traverser->addVisitor(new class ($visitor) extends \PhpParser\NodeVisitorAbstract {
                public $visitor;

                public function __construct($visitor)
                {
                    $this->visitor = $visitor;
                }
            });
        }

        $traverser->traverse($ast);

        if (isset($visitor)) {
            $this->data = $visitor->data;

            foreach ($this->data['searchers'] ?? [] as $searcher => $_) {
                $className = explode('\\', $searcher)[count(explode('\\', $searcher)) - 1];

                foreach ($this->data['searchers'] ?? [] as $secondSearcher => $__) {
                    if ($searcher === $secondSearcher) {
                        continue;
                    }

                    $secondClassName = explode('\\', $secondSearcher)[count(explode('\\', $secondSearcher)) - 1];

                    if ($className === $secondClassName) {
                        if (strpos($searcher, 'Filter') !== false) {
                            unset($this->data['searchers'][$searcher]);
                        } else {
                            unset($this->data['searchers'][$secondSearcher]);
                        }
                    }
                }
            }
        }

        $collectorData = [];

        if (isset($collector)) {
            $collectorData = $collector->data;
        } elseif (isset($visitor)) {
            $collectorData = [
                'extendData' => $visitor->data,
            ];
        }

        return new ReplacementResult($code, $collectorData);
    }

    function replaceNamespaces(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        $traverser = $this->traverser();

        $traverser->addVisitor(new ReplaceUses(array_merge([
            [
                'from' => 'Flarum\\Search\\AbstractSearcher',
                'to' => 'Flarum\\Search\\Database\\AbstractSearcher',
            ],
            [
                'from' => 'Flarum\\Filter\\FilterState',
                'to' => 'Flarum\\Search\\SearchState',
            ],
            [
                'from' => 'Flarum\\Query',
                'to' => 'Flarum\\Search',
                'partial' => true,
            ],
            [
                'from' => 'Flarum\\Filter',
                'to' => 'Flarum\\Search\\Filter',
                'partial' => true,
            ],
            [
                'from' => 'Flarum\\Search\\QueryCriteria',
                'to' => 'Flarum\\Search\\SearchCriteria',
            ],
        ], $data['replacements'] ?? [])));

        return new ReplacementResult($traverser->traverse($ast));
    }

    function changeSignatures(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\NameResolver(null, [
            'replaceNodes' => false,
        ]));

        $traverser->addVisitor(new ChangeSignatures([
            'Flarum\\Search\\Filter\\FilterInterface' => [
                'filter' => [
                    'visibility' => Modifiers::PUBLIC,
                    'params' => [
                        'state' => ['SearchState'],
                        'value' => ['array', 'string'],
                        'negate' => ['bool'],
                    ],
                    'return' => ['void'],
                ],
                'constrain' => [
                    'params' => [
                        'query' => ['\\Illuminate\\Database\\Eloquent\\Builder'],
                        'actor' => ['\\Flarum\\User\\User'],
                        'negate' => ['bool'],
                    ],
                    'return' => ['void'],
                ],
            ],
        ]));

        return new ReplacementResult($traverser->traverse($ast));
    }

    function extenders(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        if (empty($this->data['searchers'])) {
            return null;
        }

        $extenderDef = [
            'extender' => [
                'className' => '\\Flarum\\Extend\\SearchDriver',
                'args' => [
                    [
                        'type' => 'class_const',
                        'value' => '\\Flarum\\Search\\Database\\DatabaseSearchDriver',
                        'auxiliaryValue' => 'class',
                    ],
                ],
            ],
            'methodCalls' => [],
        ];

        $collectedData = $data['collectedData'] ?? [];

        foreach (($collectedData['searchers'] ?? []) as $searcher => $data) {
            if (empty($data['repository']) && (empty($data['model']))) {
                continue;
            }

            $extenderDef['methodCalls'][] = [
                'methodName' => 'addSearcher',
                'args' => [
                    [
                        'type' => 'class_const',
                        'value' => $data['model'] ?? $collectedData['repositories'][$data['repository']]['model'],
                        'auxiliaryValue' => 'class',
                    ],
                    [
                        'type' => 'class_const',
                        'value' => $searcher,
                        'auxiliaryValue' => 'class',
                    ],
                ],
            ];
        }

        foreach (($this->data['searchers'] ?? []) as $searcher => $data) {
            /** @var Node\Arg $filter */
            foreach (($data['filters'] ?? []) as $filter) {
                $extenderDef['methodCalls'][] = [
                    'methodName' => 'addFilter',
                    'args' => [
                        [
                            'type' => 'class_const',
                            'value' => $searcher,
                            'auxiliaryValue' => 'class',
                        ],
                        [
                            'type' => 'raw',
                            'value' => $filter
                        ],
                    ],
                ];
            }

            /** @var Node\Arg $mutator */
            foreach (($data['mutators'] ?? []) as $mutator) {
                $extenderDef['methodCalls'][] = [
                    'methodName' => 'addMutator',
                    'args' => [
                        [
                            'type' => 'class_const',
                            'value' => $searcher,
                            'auxiliaryValue' => 'class',
                        ],
                        [
                            'type' => 'raw',
                            'value' => $mutator
                        ],
                    ],
                ];
            }

            if ($data['fulltext'] ?? null) {
                $extenderDef['methodCalls'][] = [
                    'methodName' => 'setFulltext',
                    'args' => [
                        [
                            'type' => 'class_const',
                            'value' => $searcher,
                            'auxiliaryValue' => 'class',
                        ],
                        [
                            'type' => 'class_const',
                            'value' => $data['fulltext'],
                            'auxiliaryValue' => 'class',
                        ],
                    ],
                ];
            }
        }

        return new ReplacementResult((new ExtenderUtil($code))->add($extenderDef)['code']);
    }

    function removeOldExtenders(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        $traverser = $this->traverser();

        if (strpos($file, 'extend.php') !== false) {
            $traverser->addVisitor(new class ($this->data) extends \PhpParser\NodeVisitorAbstract {
                public $data = [
                    'to_delete' => [],
                ];

                public function __construct($data)
                {
                    $this->data = $data;
                }

                public function leaveNode(Node $node)
                {
                    if ($node instanceof Node\ArrayItem && count(array_filter($this->data['to_delete'], function (Node $item) use ($node) {
                        return $item->getStartTokenPos() === $node->getStartTokenPos();
                    })) === 1) {
                        return NodeVisitor::REMOVE_NODE;
                    }

                    return $node;
                }
            });
        }

        return new ReplacementResult($traverser->traverse($ast));
    }
}
