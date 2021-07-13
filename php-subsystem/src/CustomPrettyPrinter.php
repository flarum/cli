<?php

namespace Flarum\CliPhpSubsystem;

use PhpParser\Node\Expr;
use PhpParser\PrettyPrinter\Standard;

class CustomPrettyPrinter extends Standard
{
    protected function pExpr_MethodCall(Expr\MethodCall $node) {
        return $this->pDereferenceLhs($node->var) . "\n\t\t->" . $this->pObjectProperty($node->name)
             . '(' . $this->pMaybeMultiline($node->args) . ')';
    }
}
