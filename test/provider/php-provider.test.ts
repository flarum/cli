import path from 'path';
import { ExpressionType, ExtenderDef, ParamTypeType, PhpSubsystemProvider } from '../../src/provider/php-provider';

const extendContent = `<?php
namespace Muralf\\Dummy;

use Flarum\\Extend;

return [];
`;

const expectedComplex = `<?php
namespace Muralf\\Dummy;

use Flarum\\Extend;

return [(new Extend\\Imaginary('hello', 7, \\Flarum\\Notification::class))->listen(\\Flarum\\Post\\Event\\Saving::class, \\Some\\Class::class, function (array $someArray, string $someString, \\Flarum\\Database\\Migration $migration) {
    'Comment text here!';
    return $variableName;
})];
`;

describe('PhpProvider Works', function () {
  const provider = new PhpSubsystemProvider(path.resolve(__dirname, '../../php-subsystem/index.php'));

  test('Can add complex but valid extender', async function () {
    const newExtender: ExtenderDef = {
      extender: {
        className: 'Flarum\\Extend\\Imaginary',
        args: [
          {
            type: ExpressionType.SCALAR,
            value: 'hello',
          },
          {
            type: ExpressionType.SCALAR,
            value: 7,
          },
          {
            type: ExpressionType.CLASS_CONST,
            value: 'Flarum\\Notification',
            auxiliaryValue: 'class',
          },
        ],
      },
      methodCalls: [
        {
          methodName: 'listen',
          args: [
            {
              type: ExpressionType.CLASS_CONST,
              value: 'Flarum\\Post\\Event\\Saving',
              auxiliaryValue: 'class',
            },
            {
              type: ExpressionType.CLASS_CONST,
              value: 'Some\\Class',
              auxiliaryValue: 'class',
            },
            {
              type: ExpressionType.CLOSURE,
              value: {
                params: [
                  {
                    typeType: ParamTypeType.PRIMITIVE,
                    type: 'array',
                    name: 'someArray',
                  },
                  {
                    typeType: ParamTypeType.PRIMITIVE,
                    type: 'string',
                    name: 'someString',
                  },
                  {
                    typeType: ParamTypeType.CLASS,
                    type: 'Flarum\\Database\\Migration',
                    name: 'migration',
                  },
                ],
                commentText: 'Comment text here!',
                return: {
                  type: ExpressionType.VARIABLE,
                  value: 'variableName',
                },
              },
            },
          ],
        },
      ],
    };

    expect(provider.withExtender(extendContent, newExtender)).toStrictEqual(expectedComplex);
  });

  test('breaks with invalid schema', function () {
    const newExtender = {
      this: 'isNotAValidSchema',
    };

    expect(() => {
      provider.withExtender(extendContent, newExtender as unknown as ExtenderDef);
    }).toThrow();
  });
});
