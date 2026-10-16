import path from 'path';
import { PhpSubsystemProvider } from '../../../src/providers/php-provider';

const php = new PhpSubsystemProvider(path.resolve(__dirname, '../../../php-subsystem/index.php'));

const upgrade = (file: string, code: string): string => php.run('upgrade.2-0.misc', { file, code }).code;

describe('the misc backend step', () => {
  describe('notification types', () => {
    const extendPhp = (types: string) => `<?php

namespace Acme\\Thing;

use Flarum\\Extend;

return [
    (new Extend\\Notification())
${types},
];
`;

    it("drops 1.x's serializer argument", () => {
      const code = upgrade(
        'extend.php',
        extendPhp(`        ->type(Notifications\\LaunchBlueprint::class, Api\\LaunchSerializer::class, ['alert', 'email'])`)
      );

      expect(code).toContain("->type(Notifications\\LaunchBlueprint::class, ['alert', 'email'])");
    });

    it("keeps 2.x's drivers enabled by default", () => {
      // As fof/follow-users' 2.x extend.php has it.
      const code = upgrade(
        'extend.php',
        extendPhp(`        ->type(Notifications\\NewFollowerBlueprint::class, ['alert'])
        ->type(Notifications\\NewDiscussionBlueprint::class, ['alert', 'email'])`)
      );

      expect(code).toContain("->type(Notifications\\NewFollowerBlueprint::class, ['alert'])");
      expect(code).toContain("->type(Notifications\\NewDiscussionBlueprint::class, ['alert', 'email'])");
    });
  });

  describe('notification blueprints', () => {
    const blueprint = (uses: string, implementsList: string) => `<?php

namespace Acme\\Thing\\Notifications;

${uses}
class LaunchBlueprint implements ${implementsList}
{
}
`;

    it('implement AlertableInterface, imported in order', () => {
      const code = upgrade(
        'src/Notifications/LaunchBlueprint.php',
        blueprint('use Flarum\\Notification\\Blueprint\\BlueprintInterface;\nuse Flarum\\User\\User;\n', 'BlueprintInterface')
      );

      expect(code).toContain(`use Flarum\\Notification\\AlertableInterface;
use Flarum\\Notification\\Blueprint\\BlueprintInterface;
use Flarum\\User\\User;`);
      expect(code).toContain('class LaunchBlueprint implements BlueprintInterface, AlertableInterface');
    });

    it('that already do are left as they were', () => {
      // As fof/follow-users' 2.x blueprints have it.
      const code = blueprint(
        'use Flarum\\Notification\\AlertableInterface;\nuse Flarum\\Notification\\Blueprint\\BlueprintInterface;\nuse Flarum\\Notification\\MailableInterface;\n',
        'BlueprintInterface, MailableInterface, AlertableInterface'
      );
      const upgraded = upgrade('src/Notifications/LaunchBlueprint.php', code);

      expect(upgraded.match(/AlertableInterface/g)).toHaveLength(2);
    });

    it('get the import even when they have no other', () => {
      const code = upgrade('src/Notifications/LaunchBlueprint.php', blueprint('', '\\Flarum\\Notification\\Blueprint\\BlueprintInterface'));

      expect(code).toContain('use Flarum\\Notification\\AlertableInterface;');
      expect(code).toContain('implements \\Flarum\\Notification\\Blueprint\\BlueprintInterface, AlertableInterface');
    });
  });
});
