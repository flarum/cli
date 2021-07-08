/* eslint-disable no-template-curly-in-string */
import { Validator } from '../../utils/validation';
import { ExpressionType } from '../../provider/php-provider';
import { BaseExtenderStep, ExtenderGenerationSchema } from './base';
import chalk from 'chalk';

export class GenerateServiceProviderExtender extends BaseExtenderStep {
  type = 'Generate Service Provider extender';

  protected schema: ExtenderGenerationSchema = {
    extenderDef: {
      extender: {
        className: '\\Flarum\\Extend\\ServiceProvider',
      },
      methodCalls: [
        {
          methodName: 'register',
          args: [
            {
              type: ExpressionType.CLASS_CONST,
              value: '${providerClass}',
              auxiliaryValue: 'class',
            },
          ],
        },
      ],
    },
    params: [
      {
        name: 'providerClass',
        type: 'text',
        validate: Validator.class,
        message: `Provider Class (${chalk.dim('Vendor\\Path\\Event')})`,
      },
    ],
  };
}
