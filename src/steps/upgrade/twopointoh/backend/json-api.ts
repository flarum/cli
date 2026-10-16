import { AdvancedContent, BaseUpgradeStep, GitCommit, Replacement } from '../base';
import chalk from 'chalk';
import { genExtScaffolder } from '../../../gen-ext-scaffolder';
import { GenerateApiResourceExtender } from '../../../extenders/api-resource';
import { StepManager } from 'boilersmith/step-manager';
import { FlarumProviders } from '../../../../providers';
import { GenerateAdvancedApiResourceStub } from '../../../stubs/backend/advanced-api-resource';

export default class JsonApi extends BaseUpgradeStep {
  type = 'Prepare for JSON:API changes.';
  beforeHook = true;

  protected modelEndpoints: Record<string, any> = {};
  protected models: Record<string, any> = {};

  before(file: string, code: string, _advanced: AdvancedContent): void {
    // files with the patterns CreateXController, DeleteXController, ListXController, ShowXController, UpdateXController
    const matches = file.match(/(Create|Delete|List|Show|Update)([A-Z][A-z]+)+Controller\.php/);

    if (matches) {
      let model = matches[2];

      if (matches[1].startsWith('List')) {
        model = model.endsWith('ies') ? model.slice(0, -3) + 'y' : model.endsWith('s') ? model.slice(0, -1) : model;
      }

      this.modelEndpoints[model] ??= [];
      this.modelEndpoints[model].push(matches[1].toLowerCase());
      return;
    }

    if (
      (code.includes(' extends AbstractModel') && code.includes('use Flarum\\Database\\AbstractModel')) ||
      (code.includes(' extends Model') && code.includes('use Illuminate\\Database\\Eloquent\\Model'))
    ) {
      const className = file.split('/').pop()!.replace('.php', '');
      const namespace = code.match(/namespace ([^;]+);/)?.[1];
      this.models[className] = `${namespace}\\${className}`;
    }
  }

  replacements(file: string): Replacement[] {
    if (!file.endsWith('.php')) return [];

    let collected: any = null;

    return [
      this.flagAvatarUrl(),
      async (file, code) => {
        const output = this.php!.run('upgrade.2-0.json-api', { file, code });

        collected = output.collected;

        return {
          updated: output.code,
        };
      },
      async (file) => {
        if (!collected) return null;

        if (file.endsWith('extend.php')) return null;

        if (Object.keys(collected).length > 0 && collected.serializer) {
          const modelClassName = collected.model ? collected.model.split('\\').pop() : collected.serializer.replace('Serializer', '');

          const predefinedParams = {
            className: `${modelClassName}Resource`,
            modelClass: collected.model || this.models[modelClassName],
            modelType: collected.type,
            endpoints: this.modelEndpoints[modelClassName] ?? [],
            relations: collected.relations,
          };

          const result = await this.command.runSteps(
            new StepManager<FlarumProviders>().silentGroup((steps) => {
              steps
                .namedStep(
                  'api-resource-stub',
                  new GenerateAdvancedApiResourceStub(this.command.STUB_PATH, genExtScaffolder()),
                  {},
                  [],
                  predefinedParams
                )
                .step(new GenerateApiResourceExtender(), {}, [
                  {
                    sourceStep: 'api-resource-stub',
                    exposedName: 'class',
                    consumedName: 'resourceClass',
                  },
                ]);
            })
          );

          if (!result.succeeded) {
            this.command.error(result.error);
          }
        }

        return null;
      },
    ];
  }

  targets(): string[] {
    return ['src/**/*', 'extend.php'];
  }

  /**
   * 2.0's user resource has avatarSrcset next to avatarUrl, and browsers
   * prefer it, so code that only sets the URL still shows a user's uploaded
   * avatar on most screens.
   */
  flagAvatarUrl(): Replacement {
    return (file, code) => {
      if (/["']avatarUrl["']/.test(code)) {
        this.leaveTodo(
          file,
          "It sets avatarUrl. 2.0's API also has avatarSrcset, which browsers prefer over the URL: set it too, or a user's uploaded avatar still shows."
        );
      }

      return null;
    };
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): JSON:API changes',
      description: 'Flarum 2.0 completely changes the JSON:API implementation',
    };
  }

  pauseMessage(): string {
    const link = 'https://docs.flarum.org/2.x/extend/update-2_0#jsonapi';
    const readMore = chalk.dim(`Read more: ${link}`);
    const guideLink = 'https://docs.flarum.org/2.x/extend/update-2_0-api';
    const exampleReadMore = chalk.dim(
      `Checkout our additional guide which provides concrete examples for the upgrading process of the JSON:API layer:`
    );

    return `Flarum 2.0 completely refactors the JSON:API implementation. The way resource CRUD operations,
                     serialization and extending other resources is done has completely changed.

                     The tool cannot completely automate this change, but it has added some boilerplate code and TODO comments to help you get started.
                     You should make whatever changes you can now, then properly test and adapt your code once the upgrade process is over.

                     ${readMore}

                     ${exampleReadMore}
                     ${guideLink}`;
  }
}
