/* eslint-disable no-template-curly-in-string */
import { Validator } from '../../utils/validation';
import { ArgType } from '../../provider/php-provider';
import { BaseExtenderStep } from './base';
import chalk from 'chalk';

export class GenerateEventListenerExtender extends BaseExtenderStep {
  type = 'Generate Event Listener extender';

  protected schema = {
    extenderDef: {
      extender: {
        className: '\\Flarum\\Extend\\Event',
      },
      methodCalls: [
        {
          methodName: 'listen',
          args: [
            {
              type: ArgType.CLASS_CONST,
              value: '${eventClass}',
              auxiliaryValue: 'class',
            },
            {
              type: ArgType.CLASS_CONST,
              value: '${listenerClass}',
              auxiliaryValue: 'class',
            },
          ],
        },
      ],
    },
    params: [
      {
        name: 'eventClass',
        type: 'text',
        validate: Validator.class,
        message: `Event Class (${chalk.dim('Vendor\\Path\\Event')})`,
      },
      {
        name: 'listenerClass',
        type: 'text',
        validate: Validator.class,
        message: `Your Listener Class (${chalk.dim('Your\\Extension\\Listener\\ClassName')})`,
      },
    ],
  };
}
