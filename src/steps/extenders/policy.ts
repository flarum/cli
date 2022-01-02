import { Validator } from '../../utils/validation';
import { ExpressionType } from '../../providers/php-provider';
import { BaseExtenderStep, ExtenderGenerationSchema } from './base';
import chalk from 'chalk';

export class GeneratePolicyExtender extends BaseExtenderStep {
  type = 'Generate policy extender';

  protected schema: ExtenderGenerationSchema = {
    extenderDef: {
      extender: {
        className: '\\Flarum\\Extend\\Policy',
      },
      methodCalls: [
        {
          methodName: 'modelPolicy',
          args: [
            {
              type: ExpressionType.CLASS_CONST,
              value: '${modelClass}',
              auxiliaryValue: 'class',
            },
            {
              type: ExpressionType.CLASS_CONST,
              value: '${policyClass}',
              auxiliaryValue: 'class',
            },
          ],
        },
      ],
    },
    params: [
      {
        name: 'modelClass',
        type: 'text',
        validate: Validator.class,
        message: `Model Class (${chalk.dim('Vendor\\Path\\Model')})`,
      },
      {
        name: 'policyClass',
        type: 'text',
        validate: Validator.class,
        message: `Your Policy Class (${chalk.dim('Your\\Extension\\Access\\ClassName')})`,
      },
    ],
  };
}
