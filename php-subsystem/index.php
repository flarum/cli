<?php

use Flarum\CliPhpSubsystem\ExtenderUtil;

require __DIR__ . '/vendor/autoload.php';

$input = json_decode(file_get_contents("php://stdin"), true);

switch ($input['op']) {
  case 'extender.add':
    $output = (new ExtenderUtil($input['extend.php']))->add($input['params']);
    break;
}

echo $output;


