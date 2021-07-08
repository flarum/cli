/* eslint-disable no-template-curly-in-string */
import { Validator } from '../../utils/validation';
import { ExpressionType } from '../../provider/php-provider';
import { BaseExtenderStep, ExtenderGenerationSchema } from './base';
import chalk from 'chalk';

export class GenerateRoutesExtender extends BaseExtenderStep {
  type = 'Generate Route extender';

  protected schema: ExtenderGenerationSchema = {
    extenderDef: {
      extender: {
        className: '\\Flarum\\Extend\\Routes',
        args: [
          {
            type: ExpressionType.SCALAR,
            value: 'api',
          },
        ],
      },
      methodCalls: [
        {
          methodName: '${httpMethod}',
          args: [
            {
              type: ExpressionType.SCALAR,
              value: '${routePath}',
            },
            {
              type: ExpressionType.SCALAR,
              value: '${routeName}',
            },
            {
              type: ExpressionType.CLASS_CONST,
              value: '${routeHandler}',
              auxiliaryValue: 'class',
            },
          ],
        },
      ],
    },
    params: [
      {
        name: 'httpMethod',
        type: 'autocomplete',
        message: 'HTTP Method',
        choices: ['post', 'get', 'delete', 'patch', 'put'].map((method: string) => ({
          title: method,
          value: method,
        })),
      },
      {
        name: 'routePath',
        type: 'text',
        message: `Route Path (${chalk.dim('/pathName')})`,
      },
      {
        name: 'routeName',
        type: 'text',
        validate: Validator.routeName,
        message: `Route Name (Must be unique: ${chalk.dim('pathName.index')})`,
      },
      {
        name: 'routeHandler',
        type: 'text',
        validate: Validator.class,
        message: `Route Handler class ${chalk.dim('Vendor\\Path\\ClassName')})`,
      },
    ],
  };
}
