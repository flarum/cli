<?php

namespace Flarum\CliPhpSubsystem\Upgrade\TwoPointOh;

use Flarum\CliPhpSubsystem\NodeUtil;
use Flarum\CliPhpSubsystem\Upgrade\Replacement;
use Flarum\CliPhpSubsystem\Upgrade\ReplacementResult;
use PhpParser\NodeVisitor;

class JsonApi extends Replacement
{
    protected function operations(): array
    {
        return ['run', 'extenders'];
    }

    function run(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        if (strpos($file, 'extend.php') !== false) {
            return null;
        }

        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\NameResolver(null, [
            'replaceNodes' => false,
        ]));
        $traverser->addVisitor(new NodeVisitor\ParentConnectingVisitor());

        // Go through every class that extends Flarum\Api\Serializer\AbstractSerializer
        // Add a comment to remove the class.
        // Collect the value of the `type` property of the class.
        // Collect the type (doctype) of the first arg of the getDefaultAttributes method.

        $traverser->addVisitor($visitor = new class () extends \PhpParser\NodeVisitorAbstract {
            public $collect = [];

            const STALE = [
                'Flarum\Api\Serializer\AbstractSerializer',
                'Flarum\Api\Controller\AbstractSerializeController',
                'Flarum\Api\Controller\AbstractShowController',
                'Flarum\Api\Controller\AbstractCreateController',
                'Flarum\Api\Controller\AbstractUpdateController',
                'Flarum\Api\Controller\AbstractDeleteController',
                'Flarum\Api\Controller\AbstractListController',
            ];

            public function enterNode(\PhpParser\Node $node)
            {
                if ($node instanceof \PhpParser\Node\Stmt\Class_ && $node->extends) {
                    if (in_array(NodeUtil::className($node->extends), self::STALE)) {
                        $node->setAttribute('comments', [new \PhpParser\Comment\Doc(<<<PHPDOC
                        /**
                         * @TODO: Remove this in favor of one of the API resource classes that were added.
                         *      Or extend an existing API Resource to add this to.
                         *      Or use a vanilla RequestHandlerInterface controller.
                         *      @link https://docs.flarum.org/2.x/extend/api#endpoints
                         */
                        PHPDOC)]);
                    } else {
                        return NodeVisitor::DONT_TRAVERSE_CHILDREN;
                    }
                }

                if ($node instanceof \PhpParser\Node\Stmt\Property) {
                    if (! $node->isStatic() && $node->props[0]->name->name === 'type') {
                        $this->collect['type'] = $node->props[0]->default->value;
                        $this->collect['serializer'] = $node->getAttribute('parent')->name->name;
                    }
                }

                if ($node instanceof \PhpParser\Node\Stmt\ClassMethod) {
                    if ($node->name->name === 'getDefaultAttributes' && ($doc = $node->getDocComment())) {
                        // Get the type from the docblock
                        preg_match('/@param\s+([^\s]+)\s+\$'.$node->params[0]->var->name.'/', $doc->getText(), $matches);

                        $model = null;

                        if (! empty($matches[1])) {
                            $model = ltrim($matches[1], '\\');

                            $types = array_values(array_filter(explode('|', $model), function ($model) {
                                return $model !== 'null' && $model !== 'array';
                            }));

                            $model = ! empty($types[0]) && !in_array($types[0], ['object', 'array']) ? trim($types[0]) : null;
                        }

                        $this->collect['model'] = $model;
                    }
                }

                if ($node instanceof \PhpParser\Node\Stmt\Return_) {
                    if ($node->expr instanceof \PhpParser\Node\Expr\MethodCall && in_array($node->expr->name->name, ['hasOne', 'hasMany'])) {
                        $parent = $node->getAttribute('parent');

                        if ($parent instanceof \PhpParser\Node\Stmt\ClassMethod) {
                            $this->collect['relations'][] = [$parent->name->name, $node->expr->name->name];
                        }
                    }
                }
            }
        });

        $ast = $traverser->traverse($ast);

        $collected = $visitor->collect;

        if (isset($collected['model']) && strpos($collected['model'], '\\') === false) {
            $fqn = preg_match("/use (.+\\\\{$collected['model']});/", $code, $matches) ? $matches[1] : null;

            if ($fqn) {
                $collected['model'] = $fqn;
            }
        }

        return new ReplacementResult($ast, compact('collected'));
    }

    function extenders(string $file, string $code, array $ast): ?ReplacementResult
    {
        if (strpos($file, 'extend.php') === false) {
            return null;
        }

        if (strpos($code, 'use Flarum\Api\Schema') !== false) {
            return null;
        }

        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\NameResolver(null, [
            'replaceNodes' => false,
        ]));

        $traverser->addVisitor(new NodeVisitor\ParentConnectingVisitor());

        $traverser->addVisitor(new class () extends \PhpParser\NodeVisitorAbstract {
            public $hasExtenders = false;

            const LINK_TO_DOCS = 'https://docs.flarum.org/2.x/extend/api#extending-api-resources';
            const COMMENT = '// @TODO: Replace with the new implementation '.self::LINK_TO_DOCS;

            public function enterNode(\PhpParser\Node $node)
            {
                if ($node instanceof \PhpParser\Node\Expr\New_) {
                    if ($node->class instanceof \PhpParser\Node\Name) {
                        $class = NodeUtil::className($node->class);

                        if (in_array($class, ['Flarum\Extend\ApiSerializer', 'Flarum\Extend\ApiController', 'Flarum\Foundation\AbstractValidator'])) {
                            $parent = $node->getAttribute('parent');

                            while ($parent && ! $parent instanceof \PhpParser\Node\Expr\ArrayItem) {
                                $parent = $parent->getAttribute('parent');
                            }

                            if ($parent) {
                                $parent->setAttribute('comments', [new \PhpParser\Comment\Doc(self::COMMENT)]);
                            }

                            $this->hasExtenders = true;
                        }
                    }
                }
            }

            public function leaveNode(\PhpParser\Node $node)
            {
                if (! $this->hasExtenders) {
                    return null;
                }

                if ($node instanceof \PhpParser\Node\Stmt\Namespace_) {
                    NodeUtil::addUsesToNamespace($node, [
                        'Flarum\Api\Context',
                        'Flarum\Api\Endpoint',
                        'Flarum\Api\Resource',
                        'Flarum\Api\Schema',
                    ]);
                }
            }
        });

        return new ReplacementResult($traverser->traverse($ast));
    }
}
