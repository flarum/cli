import path from 'path'
import {create as createMemFs, Store} from 'mem-fs'
import {create as createMemFsEditor, Editor} from 'mem-fs-editor'

import {ExtenderGenerationSchema, FilesystemOperationSchema, Schema, StubGenerationSchema} from '../contracts/GenerationSchemasInterface'
import extenderSchemas, {Extenders} from '../schemas/extenders'
import filesystemSchemas, {Filesystems} from '../schemas/filesystem'
import stubSchemas, {Stubs} from '../schemas/stubs'
import ExtenderDef from '../contracts/ExtenderDefInterface'
import PhpSubsystemClient from './PhpSubsystemClient'
import {MemFsUtil} from './MemfsUtil'

enum OperationType {
    STUB,
    EXTENDER,
    FILESYSTEM // an abstract filesystem change
}

/**
 * Naming conventions for PHP classes, follows https://www.php.net/manual/en/language.namespaces.rules.php
 *
 *    - _____Class: Qualified name
 *    - _____ClassName: Just the class name
 *    - _____ClassNamespace: Just the class namespace
 *
 * `${____ClassNamespace}\\${____ClassName}` = ____Class
 */
interface OperationParams {
    [key: string]: string;
}

type ExtenderParams = OperationParams

type FilesystemParams = OperationParams

interface StubParams extends OperationParams {
    className: string;
}

interface Operation {
    type: OperationType;
    schema: ExtenderGenerationSchema | FilesystemOperationSchema | StubGenerationSchema;
    params: OperationParams;
    newFilePath?: string;
}

export default class BoilerplateBuilder {
    protected store: Store;

    protected fs: Editor;

    protected phpClient: PhpSubsystemClient;

    protected cliDir: string;

    protected extDir: string;

    protected cwd: string;

    protected requestedDir?: string;

    protected ops: Operation[] = [];

    constructor(cliDir: string, extDir: string, cwd: string, requestedDir?: string) {
      this.cliDir = cliDir
      this.extDir = extDir
      this.cwd = cwd
      this.requestedDir = requestedDir

      this.store = createMemFs()
      this.fs = createMemFsEditor(this.store)
      this.phpClient = new PhpSubsystemClient(cliDir)
    }

    filesystemOp(filesystemOp: Filesystems, closure: (fs: Editor, fsUtil: MemFsUtil, cliDir: string, params: FilesystemParams) => void, params: FilesystemParams) {
      const schema = filesystemSchemas[filesystemOp]
      if (!schema) throw new Error(`No defined schema for filesystem op ${filesystemOp}`)

      const validationErrors = this.validateParams(schema, params)
      if (validationErrors.length) {
        throw new Error(validationErrors.join('\n'))
      }

      closure(this.fs, new MemFsUtil(this.fs, this.extDir), this.cliDir, params)

      this.ops.push({
        params, schema, type: OperationType.EXTENDER,
      })

      return this
    }

    extender(extender: Extenders, params: ExtenderParams): BoilerplateBuilder {
      const schema = extenderSchemas[extender]
      if (!schema) throw new Error(`No defined schema for extender ${extender}`)

      const validationErrors = this.validateParams(schema, params)
      if (validationErrors.length) {
        throw new Error(validationErrors.join('\n'))
      }

      const filledExtenderDef = this.populateExtenderDef(schema.extenderDef, params)

      const currExtendPhp = this.fs.read(path.resolve(this.extDir, 'extend.php'))
      this.phpClient.withExtender(currExtendPhp, filledExtenderDef)

      this.ops.push({
        params, schema, type: OperationType.EXTENDER,
      })

      return this
    }

    stub(stub: Stubs, params: StubParams): BoilerplateBuilder {
      const schema = stubSchemas[stub]
      if (!schema) throw new Error(`No defined schema for stub ${stub}`)

      // pre-process params
      params.classNamespace = this.stubNamespace(schema)
      params.class = `${params.classNamespace}\\${params.className}`

      const validationErrors = this.validateParams(schema, params)
      if (validationErrors.length) {
        throw new Error(validationErrors.join('\n'))
      }

      const newFilePath = path.resolve(this.extDir, 'src', ...params.classNamespace.split('\\'), `${params.class}.php`)

      this.ops.push({
        params, schema, newFilePath, type: OperationType.STUB,
      })

      this.fs.copyTpl(path.resolve(this.extDir, schema.sourceFile), newFilePath, params)

      return this
    }

    groupWith(callback: (builder: BoilerplateBuilder, params: OperationParams) => void): BoilerplateBuilder {
      callback(this, this.ops[-1].params)

      return this
    }

    async execute(): Promise<string[]> {
      await new Promise((resolve, reject) => {
        this.fs.commit(err => {
          if (err) {
            throw new Error(err)
          }

          resolve(0)
        })
      })

      return this.ops.map(op => {
        switch (op.type) {
        case OperationType.EXTENDER:
          return `Extender of type "${op.schema.humanName}" added to \`extend.php\``
        case OperationType.STUB:
          return `New "${op.schema.humanName}" generated at ${op.newFilePath}`
        case OperationType.FILESYSTEM:
          return `Successful filesystem operation: ${op.schema.humanName}`
        }
      })
    }

    protected validateParams(schema: Schema, params: OperationParams): string[] {
      const errors: string[] = []

      schema.args.forEach(argSpec => {
        if (!(argSpec.name in params)) {
          errors.push(`Missing required parameter: ${argSpec.name}`)
        }
      })

      return errors
    }

    protected _extensionComposerJson?: any;

    protected extensionComposerJson() {
      if (!this._extensionComposerJson) {
        this._extensionComposerJson = this.fs.readJSON(path.resolve(this.extDir, 'composer.json'))
      }

      return this._extensionComposerJson
    }

    protected _extensionMetadata?: any;

    protected extensionMetadata() {
      if (!this._extensionMetadata) {
        const data: any = {}
        const extensionComposerJson: any = this.extensionComposerJson()
        data.packageName = extensionComposerJson.name || ''
        data.packageDescription = extensionComposerJson.description || ''
        data.license = extensionComposerJson.license || ''
        data.authorName = ''
        data.authorEmail = ''
        data.packageNamespace = (Object.keys(extensionComposerJson?.autoload['psr-4'] ?? {})[0] || '').slice(0, -1).replace('\\', '\\\\')
        data.extensionName = extensionComposerJson?.extra['flarum-extension'].title || ''

        this._extensionMetadata = data
      }

      return this._extensionMetadata
    }

    protected populateExtenderDef(extenderDef: ExtenderDef, params: ExtenderParams): ExtenderDef {
      const fill = (val: string, params: ExtenderParams) => {
        return val.replace(/\${(.*)}/gm, (match, ...args): string => {
          return params[match[1]]
        })
      }

      const recursiveCopyAndFill = (obj: any, params: ExtenderParams): any => {
        if (typeof obj === 'string') return fill(obj, params)
        if (Array.isArray(obj)) return obj.map(v => recursiveCopyAndFill(v, params))
        if (obj !== new Object(obj)) return obj

        const newObj: any = {}

        Object.keys(obj).forEach(key => {
          const value = obj[key]

          newObj[key] = recursiveCopyAndFill(value, params)
        })

        return newObj
      }

      return recursiveCopyAndFill(extenderDef, params)
    }

    /**
     * If the user has explicitly requested a directory, use that.
     *
     * Otherwise, use the recommended namespace for the stub.
     */
    protected stubNamespace(schema: StubGenerationSchema): string {
      const packageNamespace = this.extensionMetadata().packageNamespace

      // if (this.requestedDir) {

      // }

      const recommendedNamespace = schema.recommendedNamespace.replace('.', '\\')

      return `${packageNamespace}\\${recommendedNamespace}`
    }
}
