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
        if (! isset($this->params['extender'])) {
            $params = json_encode($this->params);
            throw new \Exception("Invalid Extender Schema. Provided params: $params");
        }

      $extender = $this->getOrCreateExtender($node->expr, $this->params['extender']);
      $exists = $extender instanceof Node\Expr\ArrayItem;

      $arrayItem = $exists ? $extender : null;
      $extender = $exists ? $extender->value : $extender;

      if (isset($this->params['methodCalls'])) {
        foreach ($this->params['methodCalls'] as $methodCall) {
          $extender = $this->nodeFactory->methodCall(
            $extender,
            $methodCall['methodName'],
            array_map([$this, 'specToExpr'], $methodCall['args'])
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

  /**
   * Gets or creates an extender class node with the proper args.
   */
  protected function getOrCreateExtender(Node\Expr\Array_ $existingExtenders, array $extenderSpec)
  {
    $className = $extenderSpec['className'];
    if (isset($extenderSpec['args'])) {
      $argSpecs = $extenderSpec['args'];
      $args = array_map([$this, 'specToExpr'], $extenderSpec['args']);
    } else {
      $argSpecs = [];
      $args = [];
    }

    foreach ((array) $existingExtenders->items as $extender) {
      if (($extender = $this->recurseGetExtender($extender, $className, $argSpecs, $args))) {
        return $extender;
      }
    }

    return $this->nodeFactory->new($this->resolveName($className), $args);
  }

  protected function recurseGetExtender(Node $node, string $className, array $argSpecs, array $args)
  {
    if ($node instanceof Node\Expr\ArrayItem) {
      if (!$this->recurseGetExtender($node->value, $className, $argSpecs, $args)) return;

      return $node;
    }
    else if ($node instanceof Node\Expr\MethodCall) {
      return $this->recurseGetExtender($node->var, $className, $argSpecs, $args);
    } else if ($node instanceof Node\Expr\New_) {
      $nameMatches = $this->nameMatches($node->class, $className);
      $argsMatch = true;

      if (count($node->args) !== count($args)) return false;
      for ($i = 0; $i < count($args); $i++) {
        if (!$this->exprMatchesTarget($node->args[$i]->value, $argSpecs[$i], $args[$i])) $argsMatch = false;
      }
      return $nameMatches && $argsMatch ? $node : false;
    }

    return false;
  }

  protected function exprMatchesTarget(Node\Expr $expr, array $targetSpec, Node\Expr $targetExpr): bool
  {
    if ($targetSpec['type'] === 'scalar') {
      /** @var Node\Scalar $targetExpr */
      return $expr instanceof Node\Scalar && $expr->value === $targetExpr->value;
    }
    else if ($targetSpec['type'] === 'class_const') {
      /** @var $targetExpr Node\Expr\ClassConstFetch */
      return $expr instanceof Node\Expr\ClassConstFetch &&
             $expr->name->name === $targetExpr->name->name &&
             $expr->class->toString() === $targetExpr->class->toString();
    }
  }

  protected function nameMatches(Node\Name $name, string $target): bool
  {
    return $name->getAttribute('resolvedName')->toCodeString() === $target;
  }

  protected function resolveName(string $name): string
  {
    $nameWithoutLeadingSlash = ltrim($name, "\\");
    $nameOptions = $this->nameContext->getPossibleNames($nameWithoutLeadingSlash, Node\Stmt\Use_::TYPE_NORMAL);

    $option = end($nameOptions);

    return $option->isFullyQualified() ? $option->toCodeString() : $option->toString();
  }

  protected function specToExpr(array $spec): Node\Expr {
    switch ($spec['type']) {
      case 'scalar':
        $value = $spec['value'];
        if (is_string($value)) {
          return new Node\Scalar\String_($value);
        }
        if (is_integer($value)) {
          return new Node\Scalar\LNumber($value, ['kind' => Node\Scalar\LNumber::KIND_DEC]);
        }
        if (is_float($value)) {
          return new Node\Scalar\DNumber($value);
        }
        if (is_bool($value)) {
          return new Node\Scalar\LNumber($value, ['kind' => Node\Scalar\LNumber::KIND_BIN]);
        }
      case 'class_const':
        return $this->nodeFactory->classConstFetch(
          $this->resolveName($spec['value']),
          $spec['auxiliaryValue']
        );
      case 'variable':
        return new Variable($spec['value']);
      case 'closure':
        $closure = new ClosureBuilder();
        foreach ($spec['value']['params'] as $param) {
          $type = $param['typeType'] === 'class' ? $this->resolveName($param['type']) : $param['type'];
          $newParam = $this->nodeFactory->param($param['name'])
              ->setType($type)
              ->getNode();
          $closure = $closure->addParam($newParam);
        }

        if (isset($spec['value']['commentText'])) {
          $closure = $closure->addStmt(
            new Node\Scalar\String_($spec['value']['commentText'])
          );
        }

        if (isset($spec['value']['return'])) {
          $closure = $closure->addStmt(
            new Return_(
              $this->specToExpr($spec['value']['return'])
            )
          );
        }

        return $closure->getNode();
      default:
        $type = $spec['type'];
        throw new \Exception("Unrecognized type: $type");
    }
  }
}

// The following class is pretty much a copy of the PhpParser\Builder\Function_ class (with no $name).
// Consult that when working on this.

use PhpParser;
use PhpParser\Builder\FunctionLike;
use PhpParser\BuilderHelpers;
use PhpParser\Node\Expr;

class ClosureBuilder extends FunctionLike
{
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
