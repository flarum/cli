import { getFsPaths, runStep } from '../../utils';

import { GenerateEventListenerExtender } from '../../../src/steps/extenders/event-listener';
import { PathProvider } from '../../../src/provider/path-provider';

interface ExtenderTest {
  extenderClass: any;

  params: Record<string, unknown>;
}

const requestedDir = '/ext/src/somePath';

const testSpecs: ExtenderTest[] = [
  // Event Listener
  {
    extenderClass: GenerateEventListenerExtender,
    params: {
      eventClass: 'Flarum\\Post\\Event\\Saving',
      listenerClass: 'Flarum\\Demo\\Listener\\SaveToDb',
    },
  },
];

describe('Extender tests', function () {
  testSpecs.forEach(spec => {
    test(`Extender test: ${spec.extenderClass.name}`, async function () {
      const initialFilesCallback = (pathProvider: PathProvider) => {
        const initial: Record<string, string> = {};
        initial[pathProvider.ext('extend.php')] = `<?php

return [];
`;
        return initial;
      };

      const { fs } = await runStep(spec.extenderClass, Object.values(spec.params), {}, initialFilesCallback, requestedDir);

      expect(getFsPaths(fs)).toStrictEqual(['/ext/extend.php'].sort());
    });
  });
});
