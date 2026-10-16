import Dependencies from '../../../src/steps/upgrade/twopointoh/dependencies';

/**
 * The file as a step writes it back after changing `flarum/core`.
 */
async function writeBack(file: string, code: string): Promise<string> {
  const step = new Dependencies({} as any, '/extension', 1, 1, false);
  const content = step.advancedContent(file, code) as Record<string, any>;

  content.require['flarum/core'] = '^2.0.0';

  return step.updateCode(file, code, content);
}

describe('a JSON file written back by an upgrade step', () => {
  it('keeps its trailing newline', async () => {
    const code = '{\n    "require": {\n        "flarum/core": "^1.2.0"\n    }\n}\n';

    expect(await writeBack('composer.json', code)).toBe('{\n    "require": {\n        "flarum/core": "^2.0.0"\n    }\n}\n');
  });

  it('gets no trailing newline when it had none', async () => {
    const code = '{\n    "require": {\n        "flarum/core": "^1.2.0"\n    }\n}';

    expect(await writeBack('composer.json', code)).toBe('{\n    "require": {\n        "flarum/core": "^2.0.0"\n    }\n}');
  });

  it('keeps its indentation', async () => {
    const twoSpaces = '{\n  "require": {\n    "flarum/core": "^1.2.0"\n  }\n}\n';
    const tabs = '{\n\t"require": {\n\t\t"flarum/core": "^1.2.0"\n\t}\n}\n';

    expect(await writeBack('composer.json', twoSpaces)).toBe('{\n  "require": {\n    "flarum/core": "^2.0.0"\n  }\n}\n');
    expect(await writeBack('js/package.json', tabs)).toBe('{\n\t"require": {\n\t\t"flarum/core": "^2.0.0"\n\t}\n}\n');
  });

  it('keeps Windows line endings', async () => {
    const code = '{\r\n    "require": {\r\n        "flarum/core": "^1.2.0"\r\n    }\r\n}\r\n';

    expect(await writeBack('composer.json', code)).toBe('{\r\n    "require": {\r\n        "flarum/core": "^2.0.0"\r\n    }\r\n}\r\n');
  });

  it('is indented as before when it has no indented line to go by', async () => {
    expect(await writeBack('composer.json', '{"require": {"flarum/core": "^1.2.0"}}')).toBe(
      '{\n    "require": {\n        "flarum/core": "^2.0.0"\n    }\n}'
    );
  });
});
