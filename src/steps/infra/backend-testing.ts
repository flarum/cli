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

  jsonToAugment = {
    'composer.json': ['scripts', 'scripts-description', 'require-dev'],
  };
}
