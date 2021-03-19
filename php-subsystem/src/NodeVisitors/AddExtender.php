<?php

namespace Flarum\CliPhpSubsystem\NodeVisitors;

use PhpParser\BuilderFactory;
use PhpParser\Comment;
use PhpParser\Node;
use PhpParser\NodeVisitorAbstract;

class AddExtender extends NodeVisitorAbstract
{
  /**
   * @var BuilderFactory
   */
  protected $nodeFactory;

  public function __construct($params)
  {
    $this->nodeFactory = new BuilderFactory();
    $this->params = $params;
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
          $extender->setAttribute('comments', [new Comment("// fdsafdsafdsafdsa")]);
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

    return $this->nodeFactory->new($className, $args);
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

  protected function argMatchesSpec(Node\Arg $arg, $cmp)
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

  protected function nameMatches(Node\Name $name, string $cmp)
  {
    return $name->toString() === $cmp;
  }

  protected function cleanArg($arg) {
    if ($arg['type'] === 'primitive') {
      return $arg->value;
    } else if ($arg['type'] === 'class_const') {
      return new Node\Expr\ClassConstFetch(
        new Node\Name($arg['value']),
        $arg['auxiliaryValue']
      );
    }
  }
}
