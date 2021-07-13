<?php

namespace Flarum\CliPhpSubsystem;

use Flarum\CliPhpSubsystem\CustomPrettyPrinter;
use PhpParser\Lexer;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitor;
use PhpParser\NodeVisitor\NameResolver;
use PhpParser\Parser;
use PhpParser\PrettyPrinter;

class ExtenderUtil
{
  /**
   * Value of the extension's extend.php file.
   *
   * @var string
   */
  protected $extendVal;

  /**
   * @var NameResolver
   */
  protected $nameResolver;

  /**
   * @var Parser
   */
  protected $parser;

  /**
   * @var PrettyPrinter\Standard
   */
  protected $prettyPrinter;

  /**
   * @var NodeTraverser
   */
  protected $traverser;

  public function __construct($currExtendValue)
  {
    $this->extendVal = $currExtendValue;
    $this->prettyPrinter = new CustomPrettyPrinter(['shortArraySyntax' => true]);
    $this->nameResolver = new NodeVisitor\NameResolver(null, [
      'replaceNodes' => false
    ]);
    $this->traverser = new NodeTraverser();
    $this->traverser->addVisitor($this->nameResolver);
  }

  public function add($params)
  {
    return $this->run(new NodeVisitors\AddExtender($params, $this->nameResolver->getNameContext()));
  }

  protected function run(NodeVisitor $visitor)
  {
    $original = $this->backupOriginal($this->extendVal);

    $this->traverser->addVisitor($visitor);

    $ast = $this->traverser->traverse($original['ast']);

    return $this->prettyPrinter->printFormatPreserving($ast, $original['oldAst'], $original['oldTokens']);
  }

  protected function backupOriginal($originalCode) {
    $lexer = new Lexer\Emulative([
      'usedAttributes' => [
        'comments',
        'startLine', 'endLine',
        'startTokenPos', 'endTokenPos',
      ],
    ]);
    $parser = new Parser\Php7($lexer);

    $traverser = new NodeTraverser();
    $traverser->addVisitor(new NodeVisitor\CloningVisitor());

    $oldAst = $parser->parse($originalCode);
    $oldTokens = $lexer->getTokens();

    $ast = $traverser->traverse($oldAst);

    return compact('oldTokens', 'oldAst', 'ast');
  }
}
