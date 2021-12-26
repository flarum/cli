import { getFsPaths, runStep } from '../../utils';

import { GenerateApiSerializerAttributesExtender } from '../../../src/steps/extenders/api-serializer';
import { GenerateEventListenerExtender } from '../../../src/steps/extenders/event';
import { GenerateRoutesExtender } from '../../../src/steps/extenders/route';
import { GenerateServiceProviderExtender } from '../../../src/steps/extenders/service-provider';
import { GeneratePolicyExtender } from '../../../src/steps/extenders/policy';
import { GenerateConsoleCommandExtender } from '../../../src/steps/extenders/console-command';
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
  // API Attributes
  {
    extenderClass: GenerateApiSerializerAttributesExtender,
    params: {
      serializerClass: 'Flarum\\Api\\Serializer\\UserSerializer',
      modelClass: 'Flarum\\User\\User',
    },
  },
  // Route
  {
    extenderClass: GenerateRoutesExtender,
    params: {
      routePath: '/potatoes',
      routeName: 'potatoes.index',
      routeHandler: 'Flarum\\Demo\\Api\\Controller\\ListPotatoesController',
    },
  },
  // Service Provider
  {
    extenderClass: GenerateServiceProviderExtender,
    params: {
      className: 'CustomServiceProvider',
    },
  },
  // Policy
  {
    extenderClass: GeneratePolicyExtender,
    params: {
      modelClass: 'Flarum\\CustomModel\\CustomModel',
      policyClass: 'Flarum\\Access\\CustomModelPolicy',
    },
  },
  // Console Command
  {
    extenderClass: GenerateConsoleCommandExtender,
    params: {
      commandClass: 'Flarum\\Console\\CustomCommand',
    },
  },
];

describe('Extender tests', function () {
  for (const spec of testSpecs) {
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
  }
});
