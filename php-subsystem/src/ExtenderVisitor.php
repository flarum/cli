<?php

namespace Flarum\CliPhpSubsystem;

use PhpParser\BuilderFactory;
use PhpParser\Node;
use PhpParser\NodeVisitorAbstract;

class ExtenderVisitor extends NodeVisitorAbstract
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
      $extender = $this->nodeFactory->new('Extend\Event');
      $extender = $this->nodeFactory->methodCall($extender, 'listen', [$this->params['event'], $this->params['event']]);
      $newExtender = new Node\Expr\ArrayItem($extender);
      $node->expr->items[] = $newExtender;
      return $node;
    }
  }
}
