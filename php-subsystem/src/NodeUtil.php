<?php

namespace Flarum\CliPhpSubsystem;

use PhpParser\Node;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PhpParser\Node\NullableType;
use PhpParser\Node\UnionType;

class NodeUtil
{
    public static function makeType(array $types): ?Node
    {
        $realTypes = array_map(function ($type) {
            if (strpos($type, '\\') !== false || preg_match('/[A-Z]/', $type[0])) {
                return new Name($type, [
                    'resolvedName' => new Name($type)
                ]);
            }

            return new Identifier($type);
        }, array_filter($types, function ($type) {
            return $type !== 'null';
        }));

        $returnType = null;

        if (count($realTypes) > 1) {
            $returnType = new UnionType($realTypes);
        } elseif (! empty($realTypes[0])) {
            $returnType = $realTypes[0];
        }

        if (in_array('null', $types)) {
            $returnType = new NullableType($returnType);
        }

        return $returnType;
    }

    public static function addUsesToNamespace(Node\Stmt\Namespace_ $node, array $uses): void
    {
        $uses = array_map(function (string $fqn) {
            return new \PhpParser\Node\Stmt\Use_([
                new \PhpParser\Node\Stmt\UseUse(new Name($fqn))
            ]);
        }, array_filter($uses, function (string $fqn) use ($node) {
            foreach ($node->stmts as $stmt) {
                if ($stmt instanceof \PhpParser\Node\Stmt\Use_ && $stmt->uses[0]->name->toString() === $fqn) {
                    return false;
                }
            }

            return true;
        }));

        usort($uses, fn ($a, $b) => strcasecmp($a->uses[0]->name->toString(), $b->uses[0]->name->toString()));

        // Each goes where it sorts among the imports already there, as the
        // Flarum StyleCI preset orders them, or after the last one.
        foreach ($uses as $use) {
            $lastUseStatement = null;
            $position = null;

            foreach ($node->stmts as $index => $stmt) {
                if ($stmt instanceof \PhpParser\Node\Stmt\Use_) {
                    $lastUseStatement = $index;

                    if (is_null($position) && strcasecmp($stmt->uses[0]->name->toString(), $use->uses[0]->name->toString()) > 0) {
                        $position = $index;
                    }
                } elseif (! is_null($lastUseStatement)) {
                    break;
                }
            }

            // Without any imports yet, it opens the namespace.
            array_splice($node->stmts, $position ?? (is_null($lastUseStatement) ? 0 : $lastUseStatement + 1), 0, [$use]);
        }
    }

    public static function className($expr): ?string
    {
        return $expr->getAttribute('resolvedName')?->name ?? $expr->name;
    }
}
