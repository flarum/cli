import FormatCode from '../../../src/steps/upgrade/twopointoh/frontend/format';

async function upgrade(code: string, file = 'js/src/forum/index.ts'): Promise<string> {
  const step = new FormatCode({} as any, '/extension', 1, 1, false);
  const result = await step.applyReplacements(file, code, step.advancedContent(file, code));

  return result.updated as string;
}

describe('the formatting step', () => {
  it('formats a declaration file that exports from an ambient module', async () => {
    // As fof/discussion-language's 1.x typings have it. Valid TypeScript, but
    // Babel reports the export as undeclared unless it is told not to check.
    const source = `declare module '@fof-follow-tags' {
  import type Component from 'flarum/common/Component';
  const components: {
    SubscriptionModal: typeof Component & { prototype: any };
  };
  export { components };
}
`;

    expect(await upgrade(source, 'js/src/@types/missing-modules.d.ts')).toBe(source);
  });

  it('still fails a file that is not valid code', () => {
    // Only the undeclared export check is off. Any other error Babel finds
    // still stops the step, rather than it rewriting code it misread.
    const step = new FormatCode({} as any, '/extension', 1, 1, false);

    expect(() => step.advancedContent('js/src/forum/index.ts', 'const a = 1;\nconst a = 2;\n')).toThrow(
      "Could not parse: Identifier 'a' has already been declared."
    );
  });
});
