import path from 'path';
import { ExpressionType, ExtenderDef, PhpSubsystemProvider } from '../../src/provider/php-provider';

describe('PhpProvider Works', function () {
  test('Can add simple extender', async function () {
    const provider = new PhpSubsystemProvider(path.resolve(__dirname, '../../php-subsystem/index.php'));

    const extendContent = `<?php
    use Flarum\\Extend;

    return [];
    `;

    const newExtender: ExtenderDef = {
      extender: {
        className: 'Flarum\\Extend\\Event',
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
          ],
        },
      ],
    };

    expect(provider.withExtender(extendContent, newExtender)).toStrictEqual(`<?php
    use Flarum\\Extend;

    return [(new Extend\\Event())->listen(\\Flarum\\Post\\Event\\Saving::class, \\Some\\Class::class)];
    `);
  });
});
