import chalk from 'chalk';
import { Validator } from '../../../utils/validation';
import { BasePhpStubStep } from '../php-base';

export class GenerateEventListenerStub extends BasePhpStubStep {
  type = 'Generate Event Listener Class';

  protected additionalExposes = ['eventClass'];

  protected phpClassParams = ['eventClass'];

  protected schema = {
    recommendedSubdir: 'Listener',
    sourceFile: 'backend/event-listener.php',
    params: [
      {
        name: 'className',
        type: 'text',
        message: 'Listener class name',
        validate: Validator.className,
      },
      {
        name: 'classNamespace',
        type: 'text',
        message: 'Class Namespace',
      },
      {
        name: 'eventClass',
        type: 'text',
        message: `Event Class (${chalk.dim('Vendor\\Path\\Event')})`,
        validate: Validator.class,
      },
      {
        name: 'eventClassName',
        type: 'text',
        message: 'Event Class Name',
      },
    ],
  };
}
