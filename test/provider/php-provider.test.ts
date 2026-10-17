import path from 'path';
import { ExpressionType, ExtenderDef, ParamTypeType, PhpSubsystemProvider } from '../../src/providers/php-provider';

const extendContent = `<?php
namespace Muralf\\Dummy;

use Flarum\\Extend;

return [];
`;

const expectedComplex = `<?php
namespace Muralf\\Dummy;

use Flarum\\Extend;

return [(new Extend\\Imaginary('hello', 7, \\Flarum\\Notification::class))
        ->listen(\\Flarum\\Post\\Event\\Saving::class, \\Some\\Class::class, function (array $someArray, string $someString, \\Flarum\\Database\\Migration $migration) {
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

describe('adding an extender to extend.php', function () {
  const provider = new PhpSubsystemProvider(path.resolve(__dirname, '../../php-subsystem/index.php'));

  const classConst = (value: string) => ({ type: ExpressionType.CLASS_CONST, value, auxiliaryValue: 'class' });

  const listener: ExtenderDef = {
    // Fully qualified with a leading backslash, as the steps that add extenders give it.
    extender: { className: '\\Flarum\\Extend\\Event' },
    methodCalls: [{ methodName: 'listen', args: [classConst('Flarum\\Post\\Event\\Saving'), classConst('Acme\\Thing\\Listener\\SavePost')] }],
  };

  const optional = `    (new Extend\\Conditional())
        ->whenExtensionEnabled('flarum-tags', function () {
            return [
                (new Extend\\Event())
                    ->listen(Saving::class, SaveTags::class),
            ];
        }),`;

  test.each([
    ['namespaced', '\nnamespace Acme\\Thing;\n'],
    ['without a namespace', ''],
  ])('adds it to the array the file returns, not to one a Conditional returns (%s)', function (_shape, namespace) {
    const code = provider.withExtender(
      `<?php
${namespace}
use Flarum\\Extend;

return [
${optional}
];
`,
      listener
    );

    // The Conditional's array is left as it was, so the listener is added once, to the file's own.
    expect(code).toContain(optional);
    expect(code.split('SavePost::class').length).toBe(2);
  });

  test('chains onto an extender of the same kind the file already returns', function () {
    const code = provider.withExtender(
      `<?php

namespace Acme\\Thing;

use Flarum\\Extend;

return [
    (new Extend\\Event())
        ->listen(Saving::class, SaveTags::class),
];
`,
      listener
    );

    expect(code.split('new Extend\\Event()').length).toBe(2);
    expect(code).toMatch(/->listen\(Saving::class, SaveTags::class\)\s*->listen\(\\Flarum\\Post\\Event\\Saving::class, Listener\\SavePost::class\)/);
  });

  test('adds it to the array a wrapping function returns, when that is the outermost one', function () {
    const code = provider.withExtender(
      `<?php

namespace Acme\\Thing;

use Flarum\\Extend;

return (function () {
    return [
${optional}
    ];
})();
`,
      listener
    );

    expect(code).toContain(optional);
    expect(code.split('SavePost::class').length).toBe(2);
    expect(code).toMatch(/SavePost::class\),?\s*];\s*}\)\(\);/);
  });
});
