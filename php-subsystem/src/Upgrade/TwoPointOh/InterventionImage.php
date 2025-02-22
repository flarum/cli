<?php

namespace Flarum\CliPhpSubsystem\Upgrade\TwoPointOh;

use Flarum\CliPhpSubsystem\NodeUtil;
use Flarum\CliPhpSubsystem\NodeVisitors\ReplaceUses;
use Flarum\CliPhpSubsystem\Upgrade\Replacement;
use Flarum\CliPhpSubsystem\Upgrade\ReplacementResult;
use PhpParser\Node;
use PhpParser\Node\Expr\Cast\Object_;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\PropertyFetch;
use PhpParser\NodeVisitor;

class InterventionImage extends Replacement
{
    protected function operations(): array
    {
        return ['run'];
    }

    function run(string $file, string $code, array $ast, array $data): ?ReplacementResult
    {
        $traverser = $this->traverser();

        $traverser->addVisitor(new NodeVisitor\NameResolver(null, [
            'replaceNodes' => false,
        ]));
        $traverser->addVisitor(new NodeVisitor\ParentConnectingVisitor());

        $traverser->addVisitor(new class () extends \PhpParser\NodeVisitorAbstract {
            protected $propertyTypes = [];

            public function enterNode(Node $node)
            {
                if ($node instanceof Node\Stmt\Property
                    && $node->type
                    && $node->type->hasAttribute('resolvedName')
                    && strpos(NodeUtil::className($node->type), 'Intervention\\Image\\') === 0
                ) {
                    $this->propertyTypes[$node->props[0]->name->name] = NodeUtil::className($node->type);
                }

                if ($node instanceof Node\Stmt\ClassMethod && $node->name->name === '__construct') {
                    foreach ($node->params as $param) {
                        if (! $param->flags
                            || ! $param->type
                            || ! $param->type->hasAttribute('resolvedName')
                            || ! is_string($param->var->name)
                            || strpos(NodeUtil::className($param->type), 'Intervention\\Image\\') !== 0
                        ) {
                            continue;
                        }

                        $this->propertyTypes[$param->var->name] = NodeUtil::className($param->type);
                    }
                }
            }

            public function leaveNode(\PhpParser\Node $node)
            {
                // if we are accessing an object under the Intervention\Image namespace
                if ($node instanceof PropertyFetch && isset($this->propertyTypes[$node->name->name])) {
                    $primeParent = $this->findPrimeParent($node);

                    $primeParent->setAttribute('comments', [new \PhpParser\Comment\Doc(<<<PHPDOC
                    /**
                     * @TODO: confirm if this still works with intervention/image v3
                     *        see: https://image.intervention.io/v3/introduction/upgrade
                     */
                    PHPDOC)]);
                }
            }

            protected function findPrimeParent($node)
            {
                if ($node->getAttribute('parent') instanceof Node\Stmt\ClassMethod || $node->getAttribute('parent') instanceof Node\Stmt\Function_) {
                    return $node;
                }

                return $this->findPrimeParent($node->getAttribute('parent'));
            }
        });

        return new ReplacementResult($traverser->traverse($ast));
    }
}
