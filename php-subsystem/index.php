<?php

use Flarum\CliPhpSubsystem\ModifyExtend;

require __DIR__ . '/vendor/autoload.php';

$input = json_decode(file_get_contents("php://stdin"), true);

(new ModifyExtend())->run($input);
