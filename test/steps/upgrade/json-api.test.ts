import path from 'path';
import { PhpSubsystemProvider } from '../../../src/providers/php-provider';
import JsonApi from '../../../src/steps/upgrade/twopointoh/backend/json-api';

const php = new PhpSubsystemProvider(path.resolve(__dirname, '../../../php-subsystem/index.php'));

const upgrade = (code: string): string => php.run('upgrade.2-0.json-api', { file: 'extend.php', code }).code;

// The extend.php of a 1.x extension adding an attribute to a core serializer.
const oneExtendPhp = `<?php

namespace Acme\\Thing;

use Flarum\\Api\\Serializer\\BasicUserSerializer;
use Flarum\\Extend;

return [
    (new Extend\\ApiSerializer(BasicUserSerializer::class))
        ->attributes(Api\\AddThing::class),
];
`;

describe('the JSON:API step, in extend.php', () => {
  it('marks the extenders to replace with a TODO linking to the docs', () => {
    expect(upgrade(oneExtendPhp)).toContain(
      '    // @TODO: Replace with the new implementation https://docs.flarum.org/2.x/extend/api#extending-api-resources\n    (new Extend\\ApiSerializer(BasicUserSerializer::class))'
    );
  });

  it('adds no imports, as nothing uses them until the TODO is done', () => {
    expect(upgrade(oneExtendPhp)).toContain(`
use Flarum\\Api\\Serializer\\BasicUserSerializer;
use Flarum\\Extend;

return [`);
  });

  it('leaves an extend.php without API extenders as it was', () => {
    const code = oneExtendPhp.replace(
      `    (new Extend\\ApiSerializer(BasicUserSerializer::class))
        ->attributes(Api\\AddThing::class),
`,
      ''
    );

    expect(upgrade(code)).not.toContain('@TODO');
  });
});

describe('the JSON:API step, on code that sets avatarUrl', () => {
  const followUps = async (code: string) => {
    const step = new JsonApi({} as any, '/extension', 1, 1, false);

    await step.flagAvatarUrl()('src/Api/AddGravatar.php', code, null);

    return (step as any).followUps;
  };

  it('leaves setting avatarSrcset to do, which browsers prefer', async () => {
    // As ianm/gravatar's 1.x serializer attributes have it.
    expect(await followUps("<?php\n\n$attributes['avatarUrl'] = $this->gravatar->getForUser($user->id);\n")).toEqual([
      { file: 'src/Api/AddGravatar.php', line: null, text: expect.stringContaining('avatarSrcset, which browsers prefer over the URL') },
    ]);
  });

  it('leaves nothing to do for code that does not', async () => {
    expect(await followUps("<?php\n\n$attributes['displayName'] = $user->display_name;\n")).toEqual([]);
  });
});
