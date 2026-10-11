import fs from 'fs';
import os from 'os';
import path from 'path';
import { PhpSubsystemProvider } from '../../../src/providers/php-provider';
import ModelFactories from '../../../src/steps/upgrade/twopointoh/backend/model-factories';
import PhpUnit from '../../../src/steps/upgrade/twopointoh/backend/phpunit';

/**
 * Flarum 2.0 tests fill a model's columns from its factory, when the model
 * has one. The upgrade writes a factory for each of an extension's models,
 * from what its migrations say about the model's table.
 */

const php = new PhpSubsystemProvider(path.resolve(__dirname, '../../../php-subsystem/index.php'));

type Column = {
  name: string;
  type: string;
  nullable: boolean;
  autoIncrement: boolean;
  references: string | null;
  default?: { value: unknown };
  values?: string[];
};

const schemaOf = (migrations: Record<string, string>): Record<string, Column[]> =>
  php.run('upgrade.2-0.migrations-schema', { data: { migrations } }).tables;

/** Each column as [name, type, nullable, references]. */
const shape = (columns: Column[]) => columns.map((column) => [column.name, column.type, column.nullable, column.references]);

// The flags extension's own 1.x migrations, which its 2.x FlagFactory was
// written against.
const flagsMigrations = {
  '2015_09_02_000000_create_flags_table.php': `<?php

use Flarum\\Database\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;

return Migration::createTable(
    'flags',
    function (Blueprint $table) {
        $table->increments('id');
        $table->integer('post_id')->unsigned();
        $table->string('type');
        $table->integer('user_id')->unsigned()->nullable();
        $table->string('reason')->nullable();
        $table->string('reason_detail')->nullable();
        $table->dateTime('time');
    }
);
`,
  '2018_06_27_101500_change_flags_rename_time_to_created_at.php': `<?php

use Flarum\\Database\\Migration;

return Migration::renameColumn('flags', 'time', 'created_at');
`,
  '2018_06_27_101600_change_flags_add_foreign_keys.php': `<?php

use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Database\\Schema\\Builder;

return [
    'up' => function (Builder $schema) {
        $schema->getConnection()
            ->table('flags')
            ->whereNotExists(function ($query) {
                $query->selectRaw(1)->from('posts')->whereColumn('id', 'post_id');
            })
            ->delete();

        $schema->table('flags', function (Blueprint $table) {
            $table->foreign('post_id')->references('id')->on('posts')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    },

    'down' => function (Builder $schema) {
        $schema->table('flags', function (Blueprint $table) {
            $table->dropForeign(['post_id']);
            $table->dropForeign(['user_id']);
        });
    }
];
`,
  '2019_10_22_000000_change_reason_text_col_type.php': `<?php

use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Database\\Schema\\Builder;

return [
    'up' => function (Builder $schema) {
        $schema->table('flags', function (Blueprint $table) {
            $table->text('reason_detail')->change();
        });
    },

    'down' => function (Builder $schema) {
        $schema->table('flags', function (Blueprint $table) {
            $table->string('reason_detail')->change();
        });
    }
];
`,
};

describe('reading a table from the migrations', () => {
  it('follows the flags extension from its first migration to its last', () => {
    expect(shape(schemaOf(flagsMigrations).flags)).toEqual([
      ['id', 'int', false, null],
      ['post_id', 'int', false, 'posts'],
      ['type', 'string', false, null],
      ['user_id', 'int', true, 'users'],
      ['reason', 'string', true, null],
      // Since Laravel 11, change() replaces the column: without nullable()
      // again, it is NOT NULL on a new install.
      ['reason_detail', 'text', false, null],
      ['created_at', 'datetime', false, null],
    ]);
    expect(schemaOf(flagsMigrations).flags[0].autoIncrement).toBe(true);
  });

  it('runs the migrations in order, whatever order they are given in', () => {
    const reversed = Object.fromEntries(Object.entries(flagsMigrations).reverse());

    expect(shape(schemaOf(reversed).flags)).toEqual(shape(schemaOf(flagsMigrations).flags));
  });

  it('reads what the other migration helpers and the schema builder do, and ignores down', () => {
    const tables = schemaOf({
      '2020_01_01_000000_create_things.php': `<?php

use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Database\\Schema\\Builder;

return [
    'up' => function (Builder $schema) {
        $schema->create('acme_things', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('title', 200);
            $t->boolean('is_hidden')->default(false);
            $t->enum('status', ['draft', 'published']);
            $t->json('settings')->nullable();
            $t->unsignedInteger('views')->default(0);
            $t->timestamps();
        });
    },

    'down' => function (Builder $schema) {
        $schema->drop('acme_things');
    }
];
`,
      '2020_02_01_000000_add_columns.php': `<?php

use Flarum\\Database\\Migration;

return Migration::addColumns('acme_things', [
    'summary' => ['text', 'nullable' => true],
    'rank' => ['integer', 'unsigned' => true, 'default' => 5],
    'obsolete' => ['string', 'length' => 10],
]);
`,
      '2020_03_01_000000_tidy.php': `<?php

use Flarum\\Database\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Database\\Schema\\Builder;

return [
    'up' => function (Builder $schema) {
        if (! $schema->hasColumn('acme_things', 'slug')) {
            $schema->table('acme_things', function (Blueprint $table) {
                $table->string('slug')->nullable();
                $table->dropColumn('obsolete');
                $table->renameColumn('views', 'view_count');
            });
        }

        $schema->rename('acme_things', 'acme_items');
    },
    'down' => function (Builder $schema) {
        $schema->rename('acme_items', 'acme_things');
    }
];
`,
    });

    expect(tables).not.toHaveProperty('acme_things');
    expect(shape(tables.acme_items)).toEqual([
      ['id', 'int', false, null],
      ['user_id', 'int', false, 'users'],
      ['title', 'string', false, null],
      ['is_hidden', 'bool', false, null],
      ['status', 'enum', false, null],
      ['settings', 'json', true, null],
      ['view_count', 'int', false, null],
      ['created_at', 'datetime', true, null],
      ['updated_at', 'datetime', true, null],
      ['summary', 'text', true, null],
      ['rank', 'int', false, null],
      ['slug', 'string', true, null],
    ]);

    const column = (name: string) => tables.acme_items.find((c) => c.name === name)!;

    expect(column('is_hidden').default).toEqual({ value: false });
    expect(column('view_count').default).toEqual({ value: 0 });
    expect(column('rank').default).toEqual({ value: 5 });
    expect(column('status').values).toEqual(['draft', 'published']);
    expect(column('title').default).toBeUndefined();
  });
});

const thingModel = `<?php

/*
 * This file is part of acme/thing.
 */

namespace Acme\\Thing;

use Flarum\\Database\\AbstractModel;
use Flarum\\Database\\ScopeVisibilityTrait;

class Thing extends AbstractModel
{
    use ScopeVisibilityTrait;

    protected $table = 'acme_things';
}
`;

describe('finding the models', () => {
  const modelsIn = (files: Record<string, string>) => php.run('upgrade.2-0.models', { data: { files } }).models;

  it('finds the classes that are models, in their own table', () => {
    expect(
      modelsIn({
        'src/Thing.php': thingModel,
        'src/Base/Model.php': `<?php

namespace Acme\\Thing\\Base;

use Flarum\\Database\\AbstractModel;

abstract class Model extends AbstractModel
{
}
`,
        'src/Widget.php': `<?php

namespace Acme\\Thing;

use Acme\\Thing\\Base\\Model;
use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;

class Widget extends Model
{
    use HasFactory;
}
`,
        'src/Legacy.php': `<?php

namespace Acme\\Thing;

class Legacy extends \\Illuminate\\Database\\Eloquent\\Model
{
    protected $table = 'acme_legacy';
}
`,
        'src/Post/ThingPost.php': `<?php

namespace Acme\\Thing\\Post;

use Flarum\\Post\\AbstractEventPost;

class ThingPost extends AbstractEventPost
{
}
`,
        'src/Listener/SaveThing.php': `<?php

namespace Acme\\Thing\\Listener;

class SaveThing
{
}
`,
      })
    ).toEqual([
      { file: 'src/Legacy.php', class: 'Acme\\Thing\\Legacy', table: 'acme_legacy', hasFactory: false },
      { file: 'src/Thing.php', class: 'Acme\\Thing\\Thing', table: 'acme_things', hasFactory: false },
      // Its table follows the class name; the step works that out.
      { file: 'src/Widget.php', class: 'Acme\\Thing\\Widget', table: null, hasFactory: true },
    ]);
  });
});

describe('writing a factory', () => {
  const column = (name: string, type: string, extra: Record<string, unknown> = {}) => ({
    name,
    type,
    nullable: false,
    autoIncrement: false,
    references: null,
    ...extra,
  });

  const columns = [
    column('id', 'int', { autoIncrement: true }),
    column('user_id', 'int', { references: 'users' }),
    column('parent_id', 'int', { nullable: true, references: 'acme_things' }),
    column('original_id', 'int', { references: 'acme_things' }),
    column('category_id', 'int', { references: 'acme_categories' }),
    column('title', 'string'),
    column('slug', 'string'),
    column('email', 'string'),
    column('body', 'text'),
    column('status', 'enum', { values: ['draft', 'published'] }),
    column('is_hidden', 'bool', { default: { value: false } }),
    column('views', 'int', { default: { value: 0 } }),
    column('score', 'number'),
    column('ip_address', 'string'),
    column('settings', 'json', { nullable: true }),
    column('options', 'json'),
    column('token', 'string', { defaultExpression: true }),
    column('approved_at', 'datetime'),
    column('created_at', 'datetime', { nullable: true }),
    column('updated_at', 'datetime', { nullable: true }),
  ];

  const result = () =>
    php.run('upgrade.2-0.model-factory', {
      file: 'src/Thing.php',
      code: thingModel,
      data: {
        columns,
        models: Object.fromEntries([
          ['users', 'Flarum\\User\\User'],
          ['acme_things', 'Acme\\Thing\\Thing'],
        ]),
      },
    });

  it('fills each column the way Flarum 2.0 factories do', () => {
    expect(result().factory).toBe(`<?php

/*
 * This file is part of acme/thing.
 */

namespace Acme\\Thing;

use Carbon\\Carbon;
use Flarum\\User\\User;
use Illuminate\\Database\\Eloquent\\Factories\\Factory;

class ThingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'parent_id' => null,
            // @TODO: give original_id a default, such as a factory for the model it points at, or set it in each test.
            // @TODO: give category_id a default, such as a factory for the model it points at, or set it in each test.
            'title' => $this->faker->word,
            'slug' => $this->faker->slug,
            'email' => $this->faker->safeEmail,
            'body' => $this->faker->sentence,
            'status' => 'draft',
            'is_hidden' => false,
            'views' => 0,
            'score' => 0,
            'ip_address' => $this->faker->ipv4,
            'settings' => null,
            'options' => [],
            'approved_at' => Carbon::now(),
            'created_at' => Carbon::now(),
            'updated_at' => null,
        ];
    }
}
`);
  });

  it('gives the model the factory', () => {
    expect(result().code).toBe(`<?php

/*
 * This file is part of acme/thing.
 */

namespace Acme\\Thing;

use Flarum\\Database\\AbstractModel;
use Flarum\\Database\\ScopeVisibilityTrait;
use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;

class Thing extends AbstractModel
{
    use HasFactory;
    use ScopeVisibilityTrait;

    protected $table = 'acme_things';
}
`);
  });

  it('leaves a model that already has the factory alone', () => {
    const withFactory = result().code;

    expect(php.run('upgrade.2-0.model-factory', { file: 'src/Thing.php', code: withFactory, data: { columns, models: {} } }).code).toBe(withFactory);
  });

  it('writes an empty factory, flagged, when the migrations say nothing of the table', () => {
    const factory = php.run('upgrade.2-0.model-factory', { file: 'src/Thing.php', code: thingModel, data: { columns: null, models: {} } }).factory;

    expect(factory).toContain(`        return [
            // @TODO: give each column a default, so tests only need to set the ones they care about.
        ];`);
    expect(factory).not.toContain('use Carbon\\Carbon;');
  });
});

describe('giving a model the factory', () => {
  const withFactory = (code: string) => php.run('upgrade.2-0.model-factory', { file: 'src/Thing.php', code, data: { columns: [], models: {} } }).code;

  it('puts the trait above the first statement, past its doc comment', () => {
    expect(
      withFactory(`<?php

namespace Acme\\Thing;

use Flarum\\Database\\AbstractModel;

class Thing extends AbstractModel
{
    /**
     * The table.
     */
    protected $table = 'acme_things';
}
`)
    ).toBe(`<?php

namespace Acme\\Thing;

use Flarum\\Database\\AbstractModel;
use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;

class Thing extends AbstractModel
{
    use HasFactory;

    /**
     * The table.
     */
    protected $table = 'acme_things';
}
`);
  });

  it('fills an empty class body', () => {
    expect(
      withFactory(`<?php

namespace Acme\\Thing;

class Thing extends \\Flarum\\Database\\AbstractModel
{
}
`)
    ).toBe(`<?php

namespace Acme\\Thing;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;

class Thing extends \\Flarum\\Database\\AbstractModel
{
    use HasFactory;
}
`);
  });

  it('sorts the import among the others', () => {
    expect(
      withFactory(`<?php

namespace Acme\\Thing;

use Flarum\\Database\\AbstractModel;
use Illuminate\\Support\\Str;

class Thing extends AbstractModel
{
    protected $table = 'acme_things';
}
`)
    ).toContain(`use Flarum\\Database\\AbstractModel;
use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Support\\Str;
`);
  });
});

describe('the model factories step', () => {
  const roots: string[] = [];

  /** An extension on disk, and the step run from it. */
  function extension(files: Record<string, string>) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'model-factories-'));
    roots.push(root);

    for (const [file, code] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), code);
    }

    const step = new ModelFactories({} as any, root, 1, 1, false);
    (step as any).php = php;

    const upgrade = (file: string) => step.applyReplacements(file, files[file], step.advancedContent(file, files[file]));

    return { root, step, upgrade };
  }

  const migration = `<?php

use Flarum\\Database\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;

return Migration::createTable('acme_things', function (Blueprint $table) {
    $table->increments('id');
    $table->string('title');
    $table->unsignedInteger('user_id');
    $table->foreign('user_id')->references('id')->on('users');
    $table->timestamps();
});
`;

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
  });

  it('gives each model a factory, written from the migrations', async () => {
    const { step, upgrade } = extension({ 'migrations/2020_01_01_000000_create_acme_things_table.php': migration, 'src/Thing.php': thingModel });

    const result = await upgrade('src/Thing.php');

    expect(result.updated).toContain('    use HasFactory;\n');
    expect(result.newFiles).toEqual([
      {
        path: 'src/ThingFactory.php',
        code: expect.stringContaining(`            'title' => $this->faker->word,
            'user_id' => User::factory(),
            'created_at' => Carbon::now(),
            'updated_at' => null,`),
      },
    ]);
    expect(step.pauseMessage()).toContain('src/ThingFactory.php');
  });

  it('keeps a factory the extension already has', async () => {
    const { upgrade } = extension({ 'src/Thing.php': thingModel, 'src/ThingFactory.php': '<?php // hand-written' });

    const result = await upgrade('src/Thing.php');

    expect(result.updated).toContain('    use HasFactory;\n');
    expect(result.newFiles ?? []).toEqual([]);
  });

  it('leaves a model that has a factory already, and the classes that are not models', async () => {
    const hasFactory = thingModel
      .replace('    use ScopeVisibilityTrait;', '    use HasFactory;\n    use ScopeVisibilityTrait;')
      .replace(
        'use Flarum\\Database\\ScopeVisibilityTrait;',
        'use Flarum\\Database\\ScopeVisibilityTrait;\nuse Illuminate\\Database\\Eloquent\\Factories\\HasFactory;'
      );
    const listener = `<?php

namespace Acme\\Thing\\Listener;

class SaveThing
{
}
`;
    const { upgrade } = extension({
      'src/Thing.php': hasFactory,
      'src/ThingFactory.php': '<?php // hand-written',
      'src/Listener/SaveThing.php': listener,
    });

    expect((await upgrade('src/Thing.php')).updated).toBe(hasFactory);
    expect((await upgrade('src/Listener/SaveThing.php')).updated).toBe(listener);
  });
});

describe('the PHPUnit step, in an extension with models', () => {
  it("names the extension's own tables by their models", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phpunit-models-'));
    const test = `<?php

namespace Acme\\Thing\\Tests\\integration;

use Flarum\\Testing\\integration\\TestCase;

class ThingTest extends TestCase
{
    public function setUp(): void
    {
        parent::setUp();

        $this->prepareDatabase([
            'acme_things' => [['id' => 1]],
        ]);
    }
}
`;

    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src/Thing.php'), thingModel);

    const step = new PhpUnit({} as any, root, 1, 1, false);
    (step as any).php = php;

    const file = 'tests/integration/ThingTest.php';
    const result = await step.applyReplacements(file, test, step.advancedContent(file, test));

    fs.rmSync(root, { recursive: true });

    expect(result.updated).toContain("            Thing::class => [['id' => 1]],");
    expect(result.updated).toContain('use Acme\\Thing\\Thing;');
  });
});
