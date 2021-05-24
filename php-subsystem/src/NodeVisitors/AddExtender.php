<?php

namespace Flarum\CliPhpSubsystem\NodeVisitors;

use PhpParser\BuilderFactory;
use PhpParser\NameContext;
use PhpParser\Node;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\Stmt\Return_;
use PhpParser\NodeVisitorAbstract;

class AddExtender extends NodeVisitorAbstract
{
  /**
   * @var BuilderFactory
   */
  protected $nodeFactory;

  /**
   * @var NameContext
   */
  protected $nameContext;

  public function __construct($params, NameContext $nameContext)
  {
    $this->nodeFactory = new BuilderFactory();
    $this->params = $params;
    $this->nameContext = $nameContext;
  }

  public function leaveNode(Node $node)
  {
    if ($node instanceof Node\Stmt\Return_ && $node->expr instanceof Node\Expr\Array_) {
      $extender = $this->getOrCreateExtender($node->expr, $this->params['extender']);
      $exists = $extender instanceof Node\Expr\ArrayItem;

      $arrayItem = $exists ? $extender : null;
      $extender = $exists ? $extender->value : $extender;

      if (isset($this->params['methodCalls'])) {
        foreach ($this->params['methodCalls'] as $methodCall) {
          $extender = $this->nodeFactory->methodCall(
            $extender,
            $methodCall['methodName'],
            array_map([$this, 'cleanArg'], $methodCall['args'])
          );
        }
      }

      if ($arrayItem) {
        $arrayItem->value = $extender;
      } else {
        $node->expr->items[] = new Node\Expr\ArrayItem($extender);
      }

      return $node;
    }
  }

  protected function getOrCreateExtender(Node\Expr\Array_ $arr, $extenderSpec)
  {
    $className = $extenderSpec['className'];
    if (isset($extenderSpec['args'])) {
      $args = array_map([$this, 'cleanArg'], $extenderSpec['args']);
    } else {
      $args = [];
    }

    foreach ((array) $arr->items as $item) {
      if (($extender = $this->recurseGetExtender($item, $className, $args))) {
        return $extender;
      }
    }

    return $this->nodeFactory->new($this->resolveName($className), $args);
  }

  protected function recurseGetExtender(Node $node, string $className, $args)
  {
    if ($node instanceof Node\Expr\ArrayItem) {
      if (!$this->recurseGetExtender($node->value, $className, $args)) return;

      return $node;
    }
    else if ($node instanceof Node\Expr\MethodCall) {
      return $this->recurseGetExtender($node->var, $className, $args);
    } else if ($node instanceof Node\Expr\New_) {
      $nameMatches = $this->nameMatches($node->class, $className);
      $argsMatch = true;

      for ($i = 0; $i < count($args); $i++) {
        if (!$this->argMatchesSpec($node->args[$i], $args[$i])) $argsMatch = false;
      }
      return $nameMatches && $argsMatch ? $node : false;
    }

    return false;
  }

  protected function argMatchesSpec(Node\Arg $arg, $cmp): bool
  {
    if ($cmp['type'] === 'primitive') {
      return $arg->value instanceof Node\Scalar && $cmp['value'] === $arg->value->value;
    }
    else if ($cmp['type'] === 'class_const') {
      return $arg->value instanceof Node\Expr\ClassConstFetch &&
             $arg->value->name->name === $cmp->name->name &&
             $arg->value->class->toString() === $cmp->class->toString();
    }
  }

  protected function nameMatches(Node\Name $name, string $cmp): bool
  {
    return $name->getAttribute('resolvedName')->toCodeString() === $cmp;
  }

  protected function resolveName(string $name): string
  {
    $nameWithoutLeadingSlash = ltrim($name, "\\");
    $nameOptions = $this->nameContext->getPossibleNames($nameWithoutLeadingSlash, Node\Stmt\Use_::TYPE_NORMAL);

    // If there are only 2 options, the name context couldn't find an import.
    // In this case we want to use the fully qualified option, which is always first.
    if (count($nameOptions) === 2) {
      return $nameOptions[0]->toCodeString();
    } else {
      return end($nameOptions)->toCodeString();
    }
  }

  protected function cleanArg($arg): Node {
    switch ($arg['type']) {
      case 'primitive':
        return $arg->value;
      case 'class_const':
        return $this->nodeFactory->classConstFetch(
          $this->resolveName($arg['value']),
          $arg['auxiliaryValue']
        );
      case 'variable':
        return new Variable($arg['value']);
      case 'closure':
        $closure = new ClosureBuilder();
        foreach ($arg['value']['params'] as $param) {
          $newParam = $this->nodeFactory->param($param['name'])
              ->setType($this->resolveName($param['type']))
              ->getNode();
          $closure = $closure->addParam($newParam);
        }

        if (isset($arg['value']['return'])) {
          $closure = $closure->addStmt(
            new Return_(
              $this->cleanArg($arg['value']['return'])
            )
          );
        }

        return $closure->getNode();
    }
  }
}

use PhpParser;
use PhpParser\Builder\FunctionLike;
use PhpParser\BuilderHelpers;
use PhpParser\Node\Expr;

class ClosureBuilder extends FunctionLike
{
    protected $name;
    protected $stmts = [];

    /**
     * Adds a statement.
     *
     * @param Node|PhpParser\Builder $stmt The statement to add
     *
     * @return $this The builder instance (for fluid interface)
     */
    public function addStmt($stmt) {
        $this->stmts[] = BuilderHelpers::normalizeStmt($stmt);

        return $this;
    }

    /**
     * Returns the built function node.
     *
     * @return Stmt\Function_ The built function node
     */
    public function getNode() : Node {
        return new Expr\Closure([
            'byRef'      => $this->returnByRef,
            'params'     => $this->params,
            'returnType' => $this->returnType,
            'stmts'      => $this->stmts,
        ], $this->attributes);
    }
}
