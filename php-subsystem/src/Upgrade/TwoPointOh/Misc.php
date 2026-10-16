<?php

namespace Flarum\CliPhpSubsystem\Upgrade\TwoPointOh;

use Flarum\CliPhpSubsystem\NodeUtil;
use Flarum\CliPhpSubsystem\NodeVisitors\ChangeSignatures;
use Flarum\CliPhpSubsystem\Upgrade\Replacement;
use Flarum\CliPhpSubsystem\Upgrade\ReplacementResult;
use PhpParser\Modifiers;
use PhpParser\Node;
use PhpParser\Node\ArrayItem;
use PhpParser\Node\PropertyItem;
use PhpParser\NodeVisitor;

class Misc extends Replacement
{
    protected $carbonDiffMethods = [
        'diffAsDateInterval',
        'diffAsCarbonInterval',
        'diffInUnit',
        'diffInYears',
        'diffInQuarters',
        'diffInMonths',
        'diffInWeeks',
        'diffInDays',
        'diffInWeekdays',
        'diffInWeekendDays',
        'diffInHours',
        'diffInMinutes',
        'diffInSeconds',
        'diffInMicroseconds',
        'diffInMilliseconds',
    ];
    protected $carbonDiffMethodsWithClosure = [
        'diffInDaysFiltered',
        'diffInHoursFiltered',
    ];
    protected $carbonDiffMethodsWithClosureAndInterval = [
        'diffFiltered'
    ];

    protected function operations(): array
    {
        return ['run', 'types', 'alertable', 'optionalArgs', 'constructorPropertyPromotion'];
    }

    function run(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        if (strpos($file, 'extend.php') !== false) {
            return new ReplacementResult(
                $this->removeSecondArgFromNotificationTypeExtender($ast)
            );
        }

        return new ReplacementResult(
            $this->misc($ast)
        );
    }

    private function misc(array $ast): array
    {
        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\NameResolver(null, [
            'replaceNodes' => false,
        ]));

        $traverser->addVisitor(new class ($this->carbonDiffMethods, $this->carbonDiffMethodsWithClosure, $this->carbonDiffMethodsWithClosureAndInterval) extends \PhpParser\NodeVisitorAbstract {
            protected $carbonDiffMethods;
            protected $carbonDiffMethodsWithClosure;
            protected $carbonDiffMethodsWithClosureAndInterval;

            public function __construct(array $carbonDiffMethods, array $carbonDiffMethodsWithClosure, array $carbonDiffMethodsWithClosureAndInterval)
            {
                $this->carbonDiffMethods = $carbonDiffMethods;
                $this->carbonDiffMethodsWithClosure = $carbonDiffMethodsWithClosure;
                $this->carbonDiffMethodsWithClosureAndInterval = $carbonDiffMethodsWithClosureAndInterval;
            }

            public function leaveNode(\PhpParser\Node $node)
            {
                if ($node instanceof Node\Stmt\Namespace_) {
                    foreach ($node->stmts as $index => $stmt) {
                        if ($stmt instanceof Node\Stmt\Use_) {
                            if ($stmt->uses[0]->name->name === 'Staudenmeir\EloquentEagerLimit\HasEagerLimit') {
                                unset($node->stmts[$index]);
                            }
                        }
                    }
                }

                if ($node instanceof \PhpParser\Node\Stmt\Class_) {
                    $dates = null;
                    $datesIndex = null;

                    foreach ($node->stmts as $index => $stmt) {
                        if ($stmt instanceof Node\Stmt\TraitUse) {
                            foreach ($stmt->traits as $trait) {
                                if ($trait->getAttribute('resolvedName')->name === 'Staudenmeir\EloquentEagerLimit\HasEagerLimit') {
                                    unset($node->stmts[$index]);
                                }
                            }
                        }

                        if ($stmt instanceof \PhpParser\Node\Stmt\Property) {
                            if ($stmt->props[0]->name->name === 'dates') {
                                $dates = $stmt->props[0]->default->items;
                                $datesIndex = $index;
                            }
                        }
                    }

                    /*
                     * convert $dates to $casts
                     */
                    if ($dates) {
                        $datesAsCasts = array_map(function (ArrayItem $date) {
                            return new \PhpParser\Node\Expr\ArrayItem(
                                new \PhpParser\Node\Scalar\String_('datetime'),
                                new \PhpParser\Node\Scalar\String_($date->value->value)
                            );
                        }, $dates);

                        $castsFound = false;

                        foreach ($node->stmts as $stmt) {
                            if ($stmt instanceof \PhpParser\Node\Stmt\Property) {
                                if ($stmt->props[0]->name->name === 'casts') {
                                    $stmt->props[0]->default->items = array_merge($stmt->props[0]->default->items, $datesAsCasts);
                                    unset($node->stmts[$datesIndex]);
                                    $castsFound = true;
                                }
                            }
                        }

                        if (! $castsFound) {
                            $node->stmts[$datesIndex] = new \PhpParser\Node\Stmt\Property(
                                Modifiers::PROTECTED,
                                [new PropertyItem('casts', new \PhpParser\Node\Expr\Array_($datesAsCasts))]
                            );
                        }
                    }
                }

                // Make the $absolute argument true (that was the default in v2, was changed to false in v3 :`)
                if ($node instanceof Node\Expr\MethodCall) {
                    // here it's the second argument.
                    if (in_array($node->name->name, $this->carbonDiffMethods) && empty($node->args[1])) {
                        if (empty($node->args[0])) {
                            $node->args[0] = new Node\Arg(new Node\Expr\ConstFetch(new Node\Name('null')));
                        }

                        $node->args[1] = new Node\Arg(new Node\Expr\ConstFetch(new Node\Name('true')));
                    }

                    // here it's the third argument.
                    if (in_array($node->name->name, $this->carbonDiffMethodsWithClosure) && empty($node->args[2])) {
                        if (empty($node->args[0])) {
                            return; // impossible
                        }

                        if (empty($node->args[1])) {
                            $node->args[1] = new Node\Arg(new Node\Expr\ConstFetch(new Node\Name('null')));
                        }

                        $node->args[2] = new Node\Arg(new Node\Expr\ConstFetch(new Node\Name('true')));
                    }

                    // here it's the fourth argument.
                    if (in_array($node->name->name, $this->carbonDiffMethodsWithClosureAndInterval) && empty($node->args[3])) {
                        if (empty($node->args[0])) {
                            return; // impossible
                        }

                        if (empty($node->args[1])) {
                            return; // impossible
                        }

                        if (empty($node->args[2])) {
                            $node->args[2] = new Node\Arg(new Node\Expr\ConstFetch(new Node\Name('null')));
                        }

                        $node->args[3] = new Node\Arg(new Node\Expr\ConstFetch(new Node\Name('true')));
                    }
                }
            }
        });

        return $traverser->traverse($ast);
    }

    private function removeSecondArgFromNotificationTypeExtender(array $ast): array
    {
        $traverser = $this->traverser();

        $traverser->addVisitor(new class () extends \PhpParser\NodeVisitorAbstract {
            public function enterNode(\PhpParser\Node $node)
            {
                if ($node instanceof \PhpParser\Node\Expr\MethodCall) {
                    if ($class = $this->getClass($node)) {
                        if ($class === 'Extend\Notification') {
                            // 1.x's second argument is the serializer. 2.x's is the
                            // drivers enabled by default, an array, which stays.
                            $serializer = $node->args[1]->value ?? null;

                            if ($node->name->name === 'type' && ($serializer instanceof \PhpParser\Node\Expr\ClassConstFetch || $serializer instanceof \PhpParser\Node\Scalar\String_)) {
                                $args = $node->args;
                                unset($args[1]);
                                $node->args = array_values($args);
                            }
                        }
                    }
                }
            }

            private function getClass(\PhpParser\Node\Expr\MethodCall $node): ?string
            {
                if ($node->var instanceof \PhpParser\Node\Expr\New_ && $node->var->class instanceof \PhpParser\Node\Name) {
                    return $node->var->class->toString();
                }

                if ($node->var instanceof \PhpParser\Node\Expr\MethodCall) {
                    return $this->getClass($node->var);
                }

                return null;
            }
        });

        return $traverser->traverse($ast);
    }

    function types(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\NameResolver(null, [
            'replaceNodes' => false,
        ]));
        $traverser->addVisitor(new NodeVisitor\ParentConnectingVisitor());

        $traverser->addVisitor(new ChangeSignatures([
            'Flarum\\Notification\\Blueprint\\BlueprintInterface' => [
                'getFromUser' => [
                    'return' => ['\Flarum\User\User', 'null']
                ],
                'getSubject' => [
                    'return' => ['\Flarum\Database\AbstractModel', 'null']
                ],
                'getData' => [
                    'return' => ['mixed']
                ],
                'getType' => [
                    'return' => ['string']
                ],
                'getSubjectModel' => [
                    'return' => ['string']
                ],
            ],
            'Flarum\\Notification\\MailableInterface' => [
                'getEmailView' => [
                    'rename' => 'getEmailViews',
                    'return' => ['array']
                ],
                'getEmailSubject' => [
                    'params' => [
                        'translator' => ['\Flarum\Locale\TranslatorInterface'],
                    ],
                    'return' => ['string']
                ],
            ],
            'Flarum\\Post\\MergeableInterface' => [
                'saveAfter' => [
                    'return' => ['static']
                ],
            ],
            'Flarum\\Post\\AbstractEventPost' => [
                '$type' => [
                    'type' => ['string']
                ],
                'saveAfter' => [
                    'return' => ['static'],
                ],
            ],
            'Flarum\\Foundation\\AbstractValidator' => [
                '$rules' => [
                    'type' => ['array']
                ],
                'assertValid' => [
                    'return' => ['void']
                ],
                'getRules' => [
                    'return' => ['array']
                ],
                'getMessages' => [
                    'return' => ['array']
                ],
                'makeValidator' => [
                    'return' => ['\Illuminate\Validation\Validator']
                ],
            ],
            'Flarum\\Extend\\ExtenderInterface' => [
                'extend' => [
                    'return' => ['void']
                ],
            ],
            'Flarum\\Extend\\LifecycleInterface' => [
                'onEnable' => [
                    'return' => ['void']
                ],
                'onDisable' => [
                    'return' => ['void']
                ],
            ],
            'Flarum\\Api\\Controller\\AbstractDeleteController' => [
                'delete' => [
                    'return' => ['void']
                ],
            ],
            'Flarum\\User\\AvatarValidator' => [
                'assertValid' => [
                    'return' => ['void']
                ],
                'getMaxSize' => [
                    'return' => ['int']
                ],
                'getAllowedTypes' => [
                    'return' => ['array']
                ],
            ],
        ], function (Node $node) {
            if ($node instanceof Node\Stmt\Return_
                && $node->expr instanceof Node\Scalar\String_
                && $node->getAttribute('parent') instanceof Node\Stmt\ClassMethod
                && in_array($node->getAttribute('parent')->name->name, ['getEmailView', 'getEmailViews'])
            ) {
                $node->expr = new Node\Expr\Array_([
                    new Node\Expr\ArrayItem(
                        $node->expr,
                        new Node\Scalar\String_('text')
                    ),
                ]);
            }

            if ($node instanceof Node\Stmt\ClassMethod
                && $node->name->name == 'getData'
                && empty($node->stmts)
            ) {
                // return []
                $node->stmts = [
                    new Node\Stmt\Return_(
                        new Node\Expr\Array_([], ['kind' => Node\Expr\Array_::KIND_SHORT])
                    )
                ];
            }
        }));

        return new ReplacementResult($traverser->traverse($ast));
    }

    function alertable(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        if (strpos($file, 'extend.php') !== false) {
            return null;
        }

        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\NameResolver(null, [
            'replaceNodes' => false,
        ]));
        $traverser->addVisitor(new NodeVisitor\ParentConnectingVisitor());

        $traverser->addVisitor(new class () extends \PhpParser\NodeVisitorAbstract {
            protected $valid = false;

            public function enterNode(Node $node)
            {
                // Does this class implement the Flarum\Notification\Blueprint\BlueprintInterface,
                // and not yet the Flarum\Notification\AlertableInterface ?
                if ($node instanceof Node\Stmt\Class_) {
                    $implements = array_map(fn ($interface) => $interface->getAttribute('resolvedName')->name, $node->implements);

                    $this->valid = in_array('Flarum\Notification\Blueprint\BlueprintInterface', $implements)
                        && ! in_array('Flarum\Notification\AlertableInterface', $implements);
                }
            }

            public function leaveNode(\PhpParser\Node $node)
            {
                if (! $this->valid) {
                    return;
                }

                if ($node instanceof Node\Stmt\Namespace_) {
                    NodeUtil::addUsesToNamespace($node, ['Flarum\Notification\AlertableInterface']);
                }

                if ($node instanceof \PhpParser\Node\Stmt\Class_) {
                    // Add the AlertableInterface implementation
                    $node->implements[] = new Node\Name('AlertableInterface');
                }
            }
        });

        return new ReplacementResult($traverser->traverse($ast));
    }

    function optionalArgs(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        $traverser = $this->traverser();

        $traverser->addVisitor(new class () extends \PhpParser\NodeVisitorAbstract {
            public function leaveNode(\PhpParser\Node $node)
            {
                // PHP 8.4 deprecates optional arguments that have a type but does not include the null type.
                if ($node instanceof Node\Param) {

                    if (! $node->type || ! $node->default) {
                        return $node;
                    }

                    if ($node->type instanceof Node\NullableType) {
                        return $node;
                    }

                    if (! $node->default instanceof Node\Expr\ConstFetch || $node->default->name->name !== 'null') {
                        return $node;
                    }

                    if ($node->type instanceof Node\UnionType) {
                        $hasNullType = ! empty(array_filter($node->type->types, function ($type) {
                            return $type instanceof Node\Expr\ConstFetch && $type->name->name === 'null';
                        }));

                        if ($hasNullType) {
                            return $node;
                        }
                    }

                    if ($node->type instanceof Node\Expr\ConstFetch && $node->type->name->name === 'mixed') {
                        return $node;
                    }

                    // Adding the null type
                    if ($node->type instanceof Node\UnionType || $node->type instanceof Node\IntersectionType) {
                        $node->type->types[] = new Node\Expr\ConstFetch(new Node\Name('null'));
                        return $node;
                    }

                    $node->type = new Node\NullableType($node->type);

                    return $node;
                }
            }
        });

        return new ReplacementResult($traverser->traverse($ast));
    }

    function constructorPropertyPromotion(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\ParentConnectingVisitor());

        $traverser->addVisitor(new class () extends \PhpParser\NodeVisitorAbstract {
            protected $data = [];
            protected $currentClass = null;

            public function enterNode(Node $node)
            {
                if ($node instanceof Node\Stmt\Class_) {
                    $this->currentClass = $node->name->name;
                    $this->data[$this->currentClass] = [
                        'properties' => [],
                    ];

                    foreach ($node->stmts as $stmt) {
                        if ($stmt instanceof Node\Stmt\Property) {
                            foreach ($stmt->props as $prop) {
                                if ($prop instanceof PropertyItem) {
                                    $this->data[$this->currentClass]['properties'][$prop->name->name] = [
                                        'flags' => $stmt->flags,
                                        'type' => $stmt->type && property_exists($stmt->type, 'name')
                                            ? $stmt->type->name
                                            : null,
                                        'passed_to_constructor' => false,
                                        'directly_passed' => false,
                                    ];
                                }
                            }
                        }

                        if ($stmt instanceof Node\Stmt\ClassMethod && $stmt->name->name === '__construct') {
                            foreach ($stmt->params as $param) {
                                if (isset($this->data[$this->currentClass]['properties'][$param->var->name])) {
                                    $this->data[$this->currentClass]['properties'][$param->var->name]['passed_to_constructor'] = true;

                                    if (empty($this->data[$this->currentClass]['properties'][$param->var->name]['type']) && $param->type && property_exists($param->type, 'name')) {
                                        $this->data[$this->currentClass]['properties'][$param->var->name]['type'] = $param->type->name;
                                    }
                                }
                            }

                            foreach ($stmt->stmts as $substmt) {
                                if ($substmt instanceof Node\Stmt\Expression && $substmt->expr instanceof Node\Expr\Assign) {
                                    if ($substmt->expr->var instanceof Node\Expr\PropertyFetch) {
                                        $property = $substmt->expr->var->name->name;
                                        $passedTheSameArgVar = $substmt->expr->expr instanceof Node\Expr\Variable && $substmt->expr->expr->name === $property;
                                        if (isset($this->data[$this->currentClass]['properties'][$property]) && $passedTheSameArgVar) {
                                            $this->data[$this->currentClass]['properties'][$property]['directly_passed'] = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            public function leaveNode(\PhpParser\Node $node)
            {
                if ($node instanceof Node\Stmt\Class_) {
                    $this->currentClass = $node->name->name;
                }

                if ($node instanceof Node\Stmt\Property
                    && ! empty($this->data[$this->currentClass]['properties'][$node->props[0]->name->name]['passed_to_constructor'])
                    && ! empty($this->data[$this->currentClass]['properties'][$node->props[0]->name->name]['directly_passed'])
                ) {
                    return NodeVisitor::REMOVE_NODE;
                }

                if ($node instanceof Node\Stmt\ClassMethod && $node->name->name === '__construct' && $node->getDocComment()) {
                    // remove needless dockblock lines such as
                    // @param {type} $property
                    $dockblock = $node->getDocComment()->getText();
                    $modified = false;

                    foreach ($this->data[$this->currentClass]['properties'] as $property => $data) {
                        if (empty($data['passed_to_constructor'] || empty($data['directly_passed']))) {
                            continue;
                        }

                        $dockblock = preg_replace('/^\s*\*\s*@param\s*'.($data['type'] ?? '').'\s*\$'.$property.'\s*.*$/m', '', $dockblock);
                        $modified = true;
                    }

                    if ($modified) {
                        if (preg_match('/^[\/*\s]+$/', $dockblock)) {
                            $node->setAttribute('comments', null);
                        } else {
                            $node->setAttribute('comments', [new \PhpParser\Comment\Doc($dockblock)]);
                        }
                    }
                }

                if ($node instanceof Node\Param && $node->getAttribute('parent') instanceof Node\Stmt\ClassMethod && $node->getAttribute('parent')->name->name === '__construct') {
                    if (! empty($this->data[$this->currentClass]['properties'][$node->var->name]['passed_to_constructor'])
                        && ! empty($this->data[$this->currentClass]['properties'][$node->var->name]['directly_passed'])
                    ) {
                        $node->flags = $this->data[$this->currentClass]['properties'][$node->var->name]['flags'];
                    }
                }

                if ($node instanceof Node\Stmt\Expression && $node->expr instanceof Node\Expr\Assign) {
                    if ($node->expr->var instanceof Node\Expr\PropertyFetch) {
                        $property = $node->expr->var->name->name;

                        if (! empty($this->data[$this->currentClass]['properties'][$property]['passed_to_constructor'])
                            && ! empty($this->data[$this->currentClass]['properties'][$property]['directly_passed'])
                        ) {
                            return NodeVisitor::REMOVE_NODE;
                        }
                    }
                }
            }
        });

        return new ReplacementResult($traverser->traverse($ast));
    }
}
