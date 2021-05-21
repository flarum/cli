import {ArgType} from '../contracts/ExtenderDefInterface'
import {ExtenderGenerationSchema} from '../contracts/GenerationSchemasInterface'

export enum Extenders {
    EventListen = 'event-listen'
}

const schemas: { [key in Extenders]?: ExtenderGenerationSchema } = {}

schemas[Extenders.EventListen] = {
  humanName: 'Event Listener',
  extenderDef: {
    extender: {
      className: '\\Flarum\\Extend\\Event',
    },
    methodCalls: [
      {
        methodName: 'listen',
        args: [
          {
            type: ArgType.CLASS_CONST,
            value: '${eventClass}',
            auxiliaryValue: 'class',
          },
          {
            type: ArgType.CLASS_CONST,
            value: '${listenerClass}',
            auxiliaryValue: 'class',
          },
        ],
      },
    ],
  },
  args: [
    {
      name: 'eventClass',
    },
    {
      name: 'listenerClass',
    },
  ],
}

export default schemas
