<?php

namespace Flarum\CliPhpSubsystem;

use PhpParser\Lexer;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitor;
use PhpParser\Parser;
use PhpParser\ParserFactory;
use PhpParser\PrettyPrinter;

class ModifyExtend
{
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

  public function __construct()
  {
    $this->prettyPrinter = new PrettyPrinter\Standard(['shortArraySyntax' => true]);
    $this->traverser = new NodeTraverser();
  }

  public function run($input)
  {
    $this->traverser->addVisitor(new ExtenderVisitor($input['params']));

    $process = $this->backupOriginal($input['extend.php']);

    $ast = $this->traverser->traverse($process['ast']);

    echo $this->prettyPrinter->printFormatPreserving($ast, $process['oldAst'], $process['oldTokens']);
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
