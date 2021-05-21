import {FilesystemOperationSchema} from '../contracts/GenerationSchemasInterface'

export enum Filesystems {
    InitExtension = 'init-extension',
    UpdateJsImports = 'update-js-imports',
}

const schemas: { [key in Filesystems]?: FilesystemOperationSchema } = {}

schemas[Filesystems.InitExtension] = {
  humanName: 'Create Extension',
  args: [],
}

schemas[Filesystems.UpdateJsImports] = {
  humanName: 'Update JS imports',
  args: [
  ],
}

export default schemas
