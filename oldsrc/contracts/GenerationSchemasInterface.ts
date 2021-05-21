import ExtenderDef from './ExtenderDefInterface'

export interface Schema {
    humanName: string;
    args: UserProvidedArgs[];
}

export interface ExtenderGenerationSchema extends Schema {
    extenderDef: ExtenderDef;
}

export type FilesystemOperationSchema = Schema

export interface StubGenerationSchema extends Schema {
    /**
     * A period-delimited namespace for where the stub should be
     * located relative to the extension root.
     */
    recommendedNamespace: string;

    /**
     * The relative path to the stub's source file relative to the
     * `stubs` directory.
     */
    sourceFile: string;
}

export interface UserProvidedArgs {
    name: string;
    regex?: RegExp;
}
