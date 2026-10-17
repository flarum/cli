import fs from 'fs';
import os from 'os';
import path from 'path';
import { PhpSubsystemProvider } from '../../../src/providers/php-provider';
import Search from '../../../src/steps/upgrade/twopointoh/backend/search';

const php = new PhpSubsystemProvider(path.resolve(__dirname, '../../../php-subsystem/index.php'));

const upgrade = (file: string, code: string, data: Record<string, unknown> = {}): string => php.run('upgrade.2-0.search', { file, code, data }).code;

/** A 1.x filter, as the step has it once the gambit parts are gone. */
const filter = (constrain: string, uses = 'use Illuminate\\Database\\Query\\Builder;\n') => `<?php

namespace Acme\\Thing\\Search;

use Flarum\\Filter\\FilterInterface;
use Flarum\\Filter\\FilterState;
${uses}
class LanguageFilter implements FilterInterface
{
    public function getFilterKey(): string
    {
        return 'language';
    }

    public function filter(FilterState $filterState, string $filterValue, bool $negate): void
    {
        $codes = explode(',', trim($filterValue, '"'));

        $this->constrain($filterState->getQuery(), $negate, $codes);
    }
${constrain}
}
`;

describe('the search step, on a filter', () => {
  it('gives filter() the 2.0 signature, and its body the new parameter names', () => {
    const code = upgrade('src/Search/LanguageFilter.php', filter(''));

    expect(code).toContain(`use Flarum\\Search\\Filter\\FilterInterface;
use Flarum\\Search\\SearchState;`);
    expect(code).toContain(`    public function filter(SearchState $state, array|string $value, bool $negate): void
    {
        $codes = explode(',', trim($value, '"'));

        $this->constrain($state->getQuery(), $negate, $codes);
    }`);
  });

  it("changes only the query builder's type in its own constrain() helper", () => {
    // As fof/discussion-language's 1.x LanguageFilterGambit has it. The query a
    // filter is given is an Eloquent builder in 2.0; the rest is the extension's.
    const code = upgrade(
      'src/Search/LanguageFilter.php',
      filter(`
    protected function constrain(Builder $query, bool $negate, array $codes): void
    {
        $codes = array_filter($codes, fn ($c) => $c !== 'any');

        if ($negate) {
            $query->whereNotIn('discussions.language_id', $codes);
        } else {
            $query->whereIn('discussions.language_id', $codes);
        }
    }`)
    );

    expect(code).toContain(`
    protected function constrain(\\Illuminate\\Database\\Eloquent\\Builder $query, bool $negate, array $codes): void
    {
        $codes = array_filter($codes, fn ($c) => $c !== 'any');

        if ($negate) {
            $query->whereNotIn('discussions.language_id', $codes);
        } else {
            $query->whereIn('discussions.language_id', $codes);
        }
    }`);
  });

  it("changes the query builder's type in a constrain() shaped as core's are", () => {
    // As core 1.x's UnreadFilterGambit has it.
    const code = upgrade(
      'src/Search/LanguageFilter.php',
      filter(
        `
    protected function constrain(Builder $query, User $actor, bool $negate): void
    {
    }`,
        'use Flarum\\User\\User;\nuse Illuminate\\Database\\Query\\Builder;\n'
      )
    );

    expect(code).toContain('protected function constrain(\\Illuminate\\Database\\Eloquent\\Builder $query, User $actor, bool $negate): void');
  });

  it("changes the query builder's type wherever constrain() takes it, and whatever it returns", () => {
    const code = upgrade(
      'src/Search/LanguageFilter.php',
      filter(`
    protected function constrain(array $codes, ?Builder $query = null)
    {
        return $query;
    }`)
    );

    expect(code).toContain('protected function constrain(array $codes, ?\\Illuminate\\Database\\Eloquent\\Builder $query = null)\n');
  });

  it('leaves a constrain() that already takes an Eloquent builder as it was', () => {
    const constrain = `
    protected function constrain(Builder $query, bool $negate, array $codes): void
    {
    }`;

    const code = upgrade('src/Search/LanguageFilter.php', filter(constrain, 'use Illuminate\\Database\\Eloquent\\Builder;\n'));

    expect(code).toContain(constrain);
  });
});

describe('the search step, in extend.php', () => {
  const extend = (registrations: string, uses = '') => `<?php

namespace Acme\\Thing;

use Flarum\\Discussion\\Filter\\DiscussionFilterer;
use Flarum\\Discussion\\Search\\DiscussionSearcher;
use Flarum\\Extend;
${uses}
return [
${registrations}
];
`;

  const replacements = { replacements: [{ from: 'Acme\\Thing\\Search\\LanguageFilterGambit', to: 'Acme\\Thing\\Search\\LanguageFilter' }] };

  it('registers a filter once, when 1.x registered it as both a gambit and a filter', () => {
    // As fof/discussion-language's 1.x extend.php has it.
    const code = upgrade(
      'extend.php',
      extend(`    (new Extend\\SimpleFlarumSearch(DiscussionSearcher::class))
        ->addGambit(Search\\LanguageFilterGambit::class),

    (new Extend\\Filter(DiscussionFilterer::class))
        ->addFilter(Search\\LanguageFilterGambit::class),`),
      replacements
    );

    expect(code).toContain(`return [
    (new Extend\\SearchDriver(\\Flarum\\Search\\Database\\DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, Search\\LanguageFilter::class),
];`);
  });

  it('registers it once however each registration names the class', () => {
    // Imported, fully qualified, or as a string: each is 1.x code in the wild.
    const code = upgrade(
      'extend.php',
      extend(
        `    (new Extend\\SimpleFlarumSearch(DiscussionSearcher::class))
        ->addGambit(LanguageFilterGambit::class)
        ->addGambit('Acme\\\\Thing\\\\Search\\\\LanguageFilterGambit'),

    (new Extend\\Filter(DiscussionFilterer::class))
        ->addFilter(\\Acme\\Thing\\Search\\LanguageFilterGambit::class),`,
        'use Acme\\Thing\\Search\\LanguageFilterGambit;\n'
      ),
      replacements
    );

    expect(code.match(/->addFilter\(/g)).toHaveLength(1);
  });

  it('reports the filters it found by the names they are registered with', () => {
    // The step reads them to tell which searcher a gambit's filter belongs to.
    const { extendData } = php.run('upgrade.2-0.search', {
      file: 'extend.php',
      code: extend(`    (new Extend\\Filter(DiscussionFilterer::class))
        ->addFilter(\\Acme\\Thing\\Search\\LanguageFilterGambit::class)
        ->addFilter('Acme\\\\Thing\\\\Search\\\\CountryFilterGambit')
        ->addFilter(Search\\RegionFilterGambit::class),`),
      data: replacements,
    });

    expect(extendData.searchers['Flarum\\Discussion\\Search\\DiscussionSearcher'].filters).toStrictEqual([
      { class: { name: 'Acme\\Thing\\Search\\LanguageFilter' } },
      { class: { name: 'Acme\\Thing\\Search\\CountryFilter' } },
      { class: { name: 'Search\\RegionFilter' } },
    ]);
  });

  it('keeps each of several filters and mutators, once each', () => {
    const code = upgrade(
      'extend.php',
      extend(`    (new Extend\\SimpleFlarumSearch(DiscussionSearcher::class))
        ->addGambit(Search\\LanguageFilterGambit::class)
        ->addGambit(Search\\CountryFilterGambit::class),

    (new Extend\\Filter(DiscussionFilterer::class))
        ->addFilter(Search\\LanguageFilterGambit::class)
        ->addFilter(Search\\CountryFilterGambit::class)
        ->addFilterMutator(Search\\HideOthers::class)
        ->addFilterMutator(Search\\HideOthers::class),`),
      replacements
    );

    expect(code).toContain(`    (new Extend\\SearchDriver(\\Flarum\\Search\\Database\\DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, Search\\LanguageFilter::class)
        ->addFilter(DiscussionSearcher::class, Search\\CountryFilter::class)
        ->addMutator(DiscussionSearcher::class, Search\\HideOthers::class),`);
  });
});

describe('the search step, on the gambits it moves to the frontend', () => {
  const step = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'search-gambits-'));

    fs.mkdirSync(path.join(root, 'resources/locale'), { recursive: true });
    fs.writeFileSync(path.join(root, 'resources/locale/en.yml'), 'acme-thing: {}\n');

    return new Search({} as any, root, 1, 1, false);
  };

  it("translates a key-value gambit's key and the hint its stub shows, and leaves the hint to write", () => {
    // As fof/discussion-language's 1.x LanguageFilterGambit has it.
    const search = step();

    expect(
      search.gambitTranslations({
        name: 'LanguageGambit',
        pattern: 'language:(.+)',
        filterKey: 'language',
        filterFile: 'src/Search/LanguageFilter.php',
      })
    ).toStrictEqual([
      { key: 'lib.gambits.language.key', value: 'language' },
      { key: 'lib.gambits.language.hint', value: 'language' },
    ]);

    expect((search as any).followUps).toEqual([
      { file: 'resources/locale/en.yml', line: null, text: expect.stringContaining('lib.gambits.language.hint') },
    ]);
  });

  it("translates a boolean gambit's key, as its stub has no hint", () => {
    const search = step();

    expect(
      search.gambitTranslations({ name: 'PrivateGambit', pattern: 'is:private', filterKey: 'private', filterFile: 'src/Search/PrivateFilter.php' })
    ).toStrictEqual([{ key: 'lib.gambits.private.key', value: 'private' }]);

    expect((search as any).followUps).toEqual([]);
  });
});
