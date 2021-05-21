import {StubGenerationSchema} from '../contracts/GenerationSchemasInterface'

export enum Stubs {
    Migration = 'migration',
    EventListener = 'event-listener'
}

const schemas: { [key in Stubs]?: StubGenerationSchema } = {}

schemas[Stubs.Migration] = {
  humanName: 'Migration',
  recommendedNamespace: 'migrations',
  sourceFile: 'migration.php',
  args: [],
}

schemas[Stubs.EventListener] = {
  humanName: 'Event Listener',
  recommendedNamespace: 'Listener',
  sourceFile: 'backend/event-listener.php',
  args: [
    {
      name: 'className',
    },
    {
      name: 'classNamespace',
    },
    {
      name: 'eventClass',
    },
    {
      name: 'eventClassName',
    },
  ],
}

export default schemas
