/* eslint-disable no-template-curly-in-string */
import { Validator } from '../../utils/validation';
import { ExpressionType } from '../../provider/php-provider';
import { BaseExtenderStep, ExtenderGenerationSchema } from './base';
import chalk from 'chalk';

export class GenerateConsoleCommandExtender extends BaseExtenderStep {
  type = 'Generate console extender';

  protected schema: ExtenderGenerationSchema = {
    extenderDef: {
      extender: {
        className: '\\Flarum\\Extend\\Console',
      },
      methodCalls: [
        {
          methodName: 'command',
          args: [
            {
              type: ExpressionType.CLASS_CONST,
              value: '${commandClass}',
              auxiliaryValue: 'class',
            },
          ],
        },
      ],
    },
    params: [
      {
        name: 'commandClass',
        type: 'text',
        validate: Validator.class,
        message: `Command Class (${chalk.dim('Vendor\\Path\\Command')})`,
      },
    ],
  };
}
