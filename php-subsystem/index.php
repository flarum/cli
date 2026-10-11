<?php

use Flarum\CliPhpSubsystem\ExtenderUtil;

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);

if (PHP_VERSION_ID < 80000) {
    echo json_encode([
        'error' => 'PHP 8.0 or newer is required'
    ]);
    exit(1);
}

require __DIR__ . '/vendor/autoload.php';

$input = json_decode(file_get_contents("php://stdin"), true);

try {
    switch ($input['op']) {
        case 'extender.add':
            $output = (new ExtenderUtil($input['extend.php']))->add($input['params']);
            break;

        case 'upgrade.2-0.misc':
            $output = (new Flarum\CliPhpSubsystem\Upgrade\TwoPointOh\Misc())->handle($input['file'], $input['code'] ?? null, $input['data'] ?? []);
            break;

        case 'upgrade.2-0.email-views':
            $output = (new Flarum\CliPhpSubsystem\Upgrade\TwoPointOh\EmailViews())->handle($input['file'], $input['code'] ?? null, $input['data'] ?? []);
            break;

        case 'upgrade.2-0.filesystem':
            $output = (new Flarum\CliPhpSubsystem\Upgrade\TwoPointOh\Filesystem())->handle($input['file'], $input['code'] ?? null, $input['data'] ?? []);
            break;

        case 'upgrade.2-0.intervention-image':
            $output = (new Flarum\CliPhpSubsystem\Upgrade\TwoPointOh\InterventionImage())->handle($input['file'], $input['code'] ?? null, $input['data'] ?? []);
            break;

        case 'upgrade.2-0.json-api':
            $output = (new Flarum\CliPhpSubsystem\Upgrade\TwoPointOh\JsonApi())->handle($input['file'], $input['code'] ?? null, $input['data'] ?? []);
            break;

        case 'upgrade.2-0.search':
            $output = (new Flarum\CliPhpSubsystem\Upgrade\TwoPointOh\Search())->handle($input['file'], $input['code'] ?? null, $input['data'] ?? []);
            break;

        case 'upgrade.2-0.migrations-schema':
            $output = (new Flarum\CliPhpSubsystem\Upgrade\TwoPointOh\ModelFactories())->schema($input['data']['migrations'] ?? []);
            break;

        case 'upgrade.2-0.models':
            $output = (new Flarum\CliPhpSubsystem\Upgrade\TwoPointOh\ModelFactories())->models($input['data']['files'] ?? []);
            break;

        case 'upgrade.2-0.model-factory':
            $output = (new Flarum\CliPhpSubsystem\Upgrade\TwoPointOh\ModelFactories())->factory($input['file'], $input['code'], $input['data'] ?? []);
            break;

        case 'upgrade.2-0.phpunit':
            $output = (new Flarum\CliPhpSubsystem\Upgrade\TwoPointOh\PhpUnit())->handle($input['file'], $input['code'] ?? null, $input['data'] ?? []);
            break;
    }

    echo json_encode($output);
} catch (Throwable $e) {
    echo json_encode([
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}


