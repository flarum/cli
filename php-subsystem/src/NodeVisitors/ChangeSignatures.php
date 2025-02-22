<?php

namespace Flarum\CliPhpSubsystem\NodeVisitors;

use Closure;
use Flarum\CliPhpSubsystem\NodeUtil;
use PhpParser\Node;
use PhpParser\Node\Stmt\Class_;
use PhpParser\NodeVisitorAbstract;

class ChangeSignatures extends NodeVisitorAbstract
{
    protected $changes = [];
    protected $custom = null;
    protected $valid = false;
    protected $uses = [];

    public function __construct(array $changes, Closure $custom = null)
    {
        $this->changes = $changes;
        $this->custom = $custom;
    }

    public function enterNode(Node $node)
    {
        if ($node instanceof Node\Stmt\Use_) {
            foreach ($node->uses as $use) {
                $this->uses[($use->alias ? $use->alias->name : null) ?? $use->name->getLast()] = $use->name->toString();
            }
        }

        if (! $this->valid && $node instanceof Class_) {
            $implements = array_map(function (Node\Name $interface) {
                return NodeUtil::className($interface);
            }, $node->implements);

            $extends = $node->extends ? NodeUtil::className($node->extends) : null;

            if ($extends && isset($this->changes[$extends])) {
                $this->valid = true;
                return;
            }

            foreach ($implements as $interface) {
                if (isset($this->changes[$interface])) {
                    $this->valid = true;
                    return;
                }
            }
        }
    }

    public function leaveNode(\PhpParser\Node $node)
    {
        if (! $this->valid) {
            return;
        }

        if ($node instanceof \PhpParser\Node\Stmt\ClassMethod) {
            foreach ($this->changes as $methods) {
                foreach ($methods as $method => $types) {
                    // property not method.
                    if (strpos($method, '$') === 0) {
                        continue;
                    }

                    if ($method !== $node->name->name) {
                        continue;
                    }

                    if ($returnType = NodeUtil::makeType($types['return'] ?? [])) {
                        $node->returnType = $returnType;
                    }

                    $k = 0;
                    foreach ($types['params'] ?? [] as $param => $paramTypes) {
                        foreach ($node->params as $i => $paramNode) {
                            if ($i === $k) {
                                if ($paramType = NodeUtil::makeType($paramTypes)) {
                                    if (! ($paramType instanceof Node\Name)
                                        || ($paramType->getAttribute('resolvedName')
                                            && $paramNode->type->getAttribute('resolvedName')
                                            && ltrim($paramType->getAttribute('resolvedName')->name, '\\') !== ltrim($paramNode->type->getAttribute('resolvedName')->name, '\\')
                                        )
                                    ) {
                                        $paramNode->type = $paramType;
                                    }
                                }

                                if ($paramNode->var->name !== $param) {
                                    $oldName = $paramNode->var->name;
                                    $paramNode->var->name = $param;

                                    // If the parameter name is changed, we need to update the parameter name inside the method.
                                    $this->updateVariableName($node, $oldName, $param);
                                }
                            }
                        }
                        $k++;
                    }

                    if (isset($types['rename'])) {
                        $node->name->name = $types['rename'];
                    }

                    if (! empty($types['visibility'])) {
                        $node->flags = $types['visibility'];
                    }
                }
            }
        }

        if ($node instanceof Node\Stmt\Property) {
            foreach ($this->changes as $properties) {
                foreach ($properties as $property => $changes) {
                    if (strpos($property, '$') !== 0) {
                        continue;
                    }

                    if ($property !== '$' . $node->props[0]->name->name) {
                        continue;
                    }

                    if (! empty($changes['type']) && ($type = NodeUtil::makeType($changes['type']))) {
                        $node->type = $type;
                    }
                }
            }
        }

        $this->custom && ($this->custom)($node);
    }

    private function updateVariableName($node, string $oldName, string $newName): void
    {
        if (! $node instanceof Node) {
            return;
        }

        if (($node instanceof Node\Expr\Variable || $node instanceof Node\Arg) && $node->name === $oldName) {
            $node->name = $newName;
        }

        if ($node instanceof Node\Stmt\Function_ || $node instanceof Node\Stmt\ClassMethod) {
            foreach ($node->params as $param) {
                if ($param->var->name === $oldName) {
                    $param->var->name = $newName;
                }
            }
        }

        if (property_exists($node, 'var') && $node->var) {
            if ($node->var->name === $oldName) {
                $node->var->name = $newName;
            } else {
                $this->updateVariableName($node->var, $oldName, $newName);
            }
        }

        if (is_iterable($node)) {
            foreach ($node as $child) {
                $this->updateVariableName($child, $oldName, $newName);
            }
        }

        if (property_exists($node, 'stmts') && $node->stmts) {
            foreach ($node->stmts as $stmt) {
                $this->updateVariableName($stmt, $oldName, $newName);
            }
        }

        if (property_exists($node, 'expr') && $node->expr) {
            $this->updateVariableName($node->expr, $oldName, $newName);
        }

        if (property_exists($node, 'items') && $node->items) {
            foreach ($node->items as $item) {
                $this->updateVariableName($item, $oldName, $newName);
            }
        }

        if (property_exists($node, 'args') && $node->args) {
            foreach ($node->args as $arg) {
                $this->updateVariableName($arg, $oldName, $newName);
            }
        }

        if (property_exists($node, 'cond') && $node->cond) {
            $this->updateVariableName($node->cond, $oldName, $newName);
        }

        if (property_exists($node, 'stmt') && $node->stmt) {
            $this->updateVariableName($node->stmt, $oldName, $newName);
        }

        if (property_exists($node, 'value') && $node->value) {
            $this->updateVariableName($node->value, $oldName, $newName);
        }
    }
}
