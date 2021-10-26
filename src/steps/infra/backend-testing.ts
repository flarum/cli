import { BaseInfraStep } from './base';

export class BackendTestingInfra extends BaseInfraStep {
  type = 'Add/update backend testing infrastructure';

  protected filesToReplace = [
    'tests/phpunit.integration.xml',
    'tests/phpunit.unit.xml',
    'tests/fixtures/.gitkeep',
    'tests/integration/setup.php',
    'tests/unit/.gitkeep',
    '.github/workflows/test.yml',
  ];

  protected jsonToAugment = {
    'composer.json': [
      'scripts.test',
      'scripts.test:unit',
      'scripts.test:integration',
      'scripts.test:setup',
      'scripts-description.test',
      'scripts-description.test:unit',
      'scripts-description.test:integration',
      'scripts-description.test:setup',
      'require-dev.flarum/testing',
    ],
  };
}
