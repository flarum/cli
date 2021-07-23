<?php

namespace Flarum\CliPhpSubsystem;

use PhpParser\Node\Expr;
use PhpParser\PrettyPrinter\Standard;

class CustomPrettyPrinter extends Standard
{
    /**
     * @todo this is just a temporary solution, we should look into formatters such as php cs fixer
     */
    protected function pExpr_MethodCall(Expr\MethodCall $node) {
        return $this->pDereferenceLhs($node->var) . "\n        ->" . $this->pObjectProperty($node->name)
             . '(' . $this->pMaybeMultiline($node->args) . ')';
    }
}
