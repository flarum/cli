import { AdvancedContent, BaseUpgradeStep, GitCommit, Replacement } from '../base';
import chalk from 'chalk';
import { StepManager } from 'boilersmith/step-manager';
import { FlarumProviders } from '../../../../providers';
import { genExtScaffolder } from '../../../gen-ext-scaffolder';
import { GenerateGambitStub } from '../../../stubs/frontend/gambit';
import { GenerateSearchGambitExtender } from '../../../js/search-gambit';
import { LocaleStep } from '../../../locale/base';
import { pluralKebabCaseModel } from '../../../../utils/model-name';
import fs from 'fs';
import path from 'path';

type Gambit = {
  name: string;
  pattern: string;
  filterKey?: string;
  filterFile: string;
};

/** A gambit with an is: pattern, such as is:private, rather than a key and value. */
const isBoolean = (gambit: Gambit) => gambit.pattern.includes('is:');

export default class Search extends BaseUpgradeStep {
  type = 'Search & Filter API changes';
  beforeHook = true;
  generatedFrontendStuff = false;

  protected gambits: Gambit[] = [];
  protected data: { collectedData: any; replacements: { from: string; to: string }[]; filterClasses: string[] } = {
    collectedData: {},
    replacements: [],
    filterClasses: [],
  };

  protected searchers: Record<string, string> = {};

  before(file: string, code: string, _advanced: AdvancedContent): void {
    if (code.includes(' extends AbstractSearcher')) {
      const className = file.split('/').pop()!.replace('.php', '');
      const namespace = code.match(/namespace ([^;]+);/)?.[1];
      this.searchers[className] = `${namespace}\\${className}`;
    }
  }

  replacements(_file: string): Replacement[] {
    return [
      (file, code) => {
        if (code.includes(' extends AbstractRegexGambit') || /implements ([\dA-z]+,\s*)*GambitInterface/.test(code)) {
          const isOnlyGambit = !code.includes('FilterInterface');
          const oldName = file.split('/').pop()!.replace('.php', '');
          const name = oldName.replace('FilterGambit', 'Gambit').replace('GambitFilter', 'Gambit').replace('Filter', 'Gambit');
          const filterName = name.replace('Gambit', 'Filter');
          const pattern = code.match(/ function getGambitPattern\(\)(?:: string)?\s*{\s*return '(.*)';\s*}/)?.[1];
          const filterKey = isOnlyGambit
            ? (pattern || '').replace('is:', '').split(':')[0]
            : code.match(/function getFilterKey\(\)(?:: string)?\s*{\s*return '(.*)';\s*}/)?.[1];

          if (pattern || /^\s+public function apply\(SearchState \$.+$/m.test(code)) {
            const newPath = file
              .replace(/FilterGambit/g, 'Filter')
              .replace(/GambitFilter/g, 'Filter')
              .replace(/Gambit/g, 'Filter');

            if (pattern) this.gambits.push({ name, pattern, filterKey, filterFile: newPath });

            // old fully qualified class name to new fully qualified class name
            const namespace = code.match(/namespace ([^;]+);/)?.[1];
            this.data.replacements.push({ from: `${namespace}\\${oldName}`, to: `${namespace}\\${filterName}` });

            this.data.filterClasses.push(file, newPath);

            return {
              newPath,
              updated: code
                .replace(oldName, filterName)
                .replace(' extends AbstractRegexGambit', '')
                .replace('use Flarum\\Search\\AbstractRegexGambit;\n', '')
                .replace('use Flarum\\Search\\GambitInterface;\n', '')
                .replace(/implements ([\dA-z]+,\s*)*GambitInterface(,\s*)?/, 'implements $1')
                .replace(/\s*\w+ function getGambitPattern\(\)(?:: string)?\s*{\s*return '.*';\s*}/, '')
                .replace(/(\s*protected function )conditions(\([^)]*\)\s*{.*?[^ ] {4}})/s, isOnlyGambit ? '$1filter$2' : '')
                .replace(/\s*public function apply\(([^)]*)\)\s*{.*?[^ ] {4}}/s, '')
                .replace(/namespace (.*)Gambit([^;]+);/, `namespace $1Filter$2;`)
                .replace(/namespace (.*)Gambit([^;]*);/, `namespace $1Filter$2;`),
            };
          }
        }

        return null;
      },

      async (file, code) => {
        const data: any = this.data;
        data.gambits = this.gambits;
        const output = this.php!.run('upgrade.2-0.search', { file, code, data });

        if (output.searchers) {
          this.data.collectedData.searchers = { ...this.data.collectedData.searchers, ...output.searchers };
        }

        if (output.repositories) {
          this.data.collectedData.repositories = { ...this.data.collectedData.repositories, ...output.repositories };
        }

        if (output.extendData) {
          this.data.collectedData.extendData = { ...this.data.collectedData.extendData, ...output.extendData };
        }

        return {
          updated: output.code,
        };
      },

      (file, code) => {
        if (!code.includes(' extends AbstractFilterer') || !code.includes('use Flarum\\Filter\\AbstractFilterer')) {
          return null;
        }

        const className = file.split('/').pop()!.replace('.php', '');
        const wouldbeSearcher = className?.replace('Filterer', 'Searcher');

        if (this.searchers[wouldbeSearcher]) {
          // there is already an equivalent searcher
          return {
            delete: true,
            updated: null,
          };
        }

        return {
          newPath: file.replace(className, wouldbeSearcher),
          updated: code
            .replace('Flarum\\Filter\\AbstractFilterer', 'Flarum\\Search\\Database\\AbstractSearcher')
            .replace('AbstractFilterer', 'AbstractSearcher')
            .replace(className, wouldbeSearcher),
        };
      },

      async (_file) => {
        if (this.gambits.length > 0 && Object.keys(this.data.collectedData.extendData?.searchers || {}).length > 0) {
          const result = await this.command.runSteps(
            new StepManager<FlarumProviders>().silentGroup((steps) => {
              this.gambits.forEach((gambit, index) => {
                const relatedSearcher = Object.keys(this.data.collectedData.extendData.searchers).find((searcher) => {
                  const filters = this.data.collectedData.extendData.searchers[searcher].filters || [];
                  return filters.some((filter: any) => {
                    return gambit.filterFile.includes(filter.class.name.replaceAll('\\', '/'));
                  });
                });

                let type = 'discussions';

                if (relatedSearcher) {
                  type = pluralKebabCaseModel(relatedSearcher.split('\\').pop()!.replace('Searcher', ''));
                }

                const gambitSteps = steps
                  .namedStep(`gambit-${index}`, new GenerateGambitStub(this.command.STUB_PATH, genExtScaffolder()), {}, [], {
                    frontend: 'common',
                    className: gambit.name,
                    type: isBoolean(gambit) ? 'boolean' : 'key-value',
                    filterKey: gambit.filterKey,
                  })
                  .step(
                    new GenerateSearchGambitExtender(),
                    {},
                    [
                      {
                        sourceStep: `gambit-${index}`,
                        exposedName: 'classNamespace',
                        consumedName: 'className',
                      },
                    ],
                    {
                      frontend: 'common',
                      modelType: type,
                    }
                  );

                this.gambitTranslations(gambit).forEach((translation) => {
                  gambitSteps.step(new LocaleStep(genExtScaffolder()), {}, [], translation);
                });

                delete this.gambits[index];
              });
            })
          );

          if (!result.succeeded) {
            this.command.error(result.error);
          }

          this.generatedFrontendStuff = true;
        }

        return null;
      },

      (_file, code) => {
        if (!code.includes('$criteria->query') && !code.includes('SearchCriteria $criteria')) {
          return null;
        }

        return {
          updated: code.replace('$criteria->query', '$criteria->filters'),
        };
      },
    ];
  }

  /**
   * The translations a gambit's stub uses: its key, and a key-value gambit's
   * hint, which the search shows beside it. Only the author can say what the
   * hint should be, so it is left for them to write.
   */
  gambitTranslations(gambit: Gambit): { key: string; value: string }[] {
    let gambitKey = gambit.pattern.replace('is:', '');

    if (gambitKey.includes(':')) {
      gambitKey = gambitKey.split(':')[0];
    }

    const translations = [{ key: `lib.gambits.${gambit.filterKey}.key`, value: gambitKey }];

    if (!isBoolean(gambit)) {
      const hint = `lib.gambits.${gambit.filterKey}.hint`;
      const locale = fs.existsSync(path.join(this.root, 'resources/locale/en.yml')) ? 'resources/locale/en.yml' : 'locale/en.yml';

      translations.push({ key: hint, value: gambitKey });
      this.leaveTodo(locale, `describe what the ${gambitKey} gambit takes in ${hint}, which the search shows beside it.`);
    }

    return translations;
  }

  targets(): string[] {
    return ['src/**/*', 'extend.php'];
  }

  gitCommit(): GitCommit {
    return {
      message: 'chore(2.0): Search & Filter API changes',
      description: 'Flarum 2.0 introduces a search driver implementation and moves gambits to the frontend.',
    };
  }

  pauseMessage(): string {
    const link = 'https://docs.flarum.org/2.x/extend/update-2_0#searchfilter-system';
    const readMore = chalk.dim(`Read more: ${link}`);
    const exampleBeforeLink = 'https://github.com/flarum/framework/blob/1.x/extensions/tags';
    const exampleAfterLink = 'https://github.com/flarum/framework/blob/2.x/extensions/tags';
    const exampleReadMore = chalk.dim(
      `We recommend looking at a comparison between the bundled extensions (like tags) from 1.x to 2.x to have a better understanding of the changes:`
    );

    return `Flarum 2.0 introduces a new search driver implementation. It also merges Filterers and Searchers into a single API.
                     Gambits are now handled on the frontend side where they are converted to filters.
                     The tool has attempted to automatically update your codebase, please review the changes then proceed with the upgrade.

                     ${readMore}

                     ${exampleReadMore}
                     ${exampleBeforeLink}
                     ${exampleAfterLink}`;
  }
}
