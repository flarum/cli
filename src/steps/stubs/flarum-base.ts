import { IO } from "boilersmith/io";
import { Paths } from "boilersmith/paths";
import { BaseStubStep } from "boilersmith/steps/base";
import { Store } from "mem-fs";
import { FlarumProviders } from "../../providers";
import { genExtScaffolder } from "../gen-ext-scaffolder";

export abstract class FlarumBaseStubStep extends BaseStubStep<FlarumProviders, ReturnType<typeof genExtScaffolder>> {
    protected async precompileParams(fs: Store, paths: Paths, io: IO): Promise<Record<string, unknown>> {
        return {
          ...await super.precompileParams(fs, paths, io),
            'extensionId': this.scaffolder.templateParamVal('extensionId', fs, paths),
        };
    }
}