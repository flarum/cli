/* eslint-disable no-template-curly-in-string */
import chalk from 'chalk';
import { Validator } from '../../utils/validation';
import { ParamTypeType, ExpressionType } from '../../providers/php-provider';
import { BaseExtenderStep, ExtenderGenerationSchema } from './base';

export class GenerateApiSerializerAttributesExtender extends BaseExtenderStep {
  type = 'Generate API Serializer attributes extender';

  protected schema: ExtenderGenerationSchema = {
    extenderDef: {
      extender: {
        className: '\\Flarum\\Extend\\ApiSerializer',
        args: [
          {
            type: ExpressionType.CLASS_CONST,
            value: '${serializerClass}',
            auxiliaryValue: 'class',
          },
        ],
      },
      methodCalls: [
        {
          methodName: 'attributes',
          args: [
            {
              type: ExpressionType.CLOSURE,
              value: {
                params: [
                  {
                    name: 'serializer',
                    type: '${serializerClass}',
                    typeType: ParamTypeType.CLASS,
                  },
                  {
                    name: 'model',
                    type: '${modelClass}',
                    typeType: ParamTypeType.CLASS,
                  },
                  {
                    name: 'attributes',
                    type: 'array',
                    typeType: ParamTypeType.PRIMITIVE,
                  },
                ],
                commentText: 'See https://docs.flarum.org/extend/api.html#serializers',
                return: {
                  type: ExpressionType.VARIABLE,
                  value: 'attributes',
                },
              },
            },
          ],
        },
      ],
    },
    params: [
      {
        name: 'serializerClass',
        type: 'text',
        validate: Validator.class,
        message: `API Serializer (${chalk.dim('Vendor\\Path\\Api\\Serializer\\Class')})`,
      },
      {
        name: 'modelClass',
        type: 'text',
        validate: Validator.class,
        message: `Model (${chalk.dim('Vendor\\Path\\Model\\Class')})`,
      },
    ],
  };
}
