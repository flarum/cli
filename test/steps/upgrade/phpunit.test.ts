import path from 'path';
import { PhpSubsystemProvider } from '../../../src/providers/php-provider';
import PhpUnit from '../../../src/steps/upgrade/twopointoh/backend/phpunit';

/**
 * PHPUnit 12 reads metadata only from attributes, and drops the stub helpers
 * and assertions 10 and 12 removed. These tests pin how the upgrade carries a
 * PHPUnit 9 test over.
 */

const php = new PhpSubsystemProvider(path.resolve(__dirname, '../../../php-subsystem/index.php'));

const upgrade = (code: string): string => php.run('upgrade.2-0.phpunit', { file: 'tests/integration/api/ThingTest.php', code }).code;

/** A test class around the given body, as a 1.x extension would have it. */
const testClass = (body: string, classDoc = '') => `<?php

namespace Acme\\Thing\\Tests\\integration\\api;

use Flarum\\Testing\\integration\\TestCase;
${classDoc}
class ThingTest extends TestCase
{
${body}
}
`;

describe('the PHPUnit step', () => {
  it('puts the imports it adds where they sort among those already there', () => {
    const code = upgrade(
      testClass(`    /**
     * @test
     */
    public function it_works()
    {
        $this->assertTrue(true);
    }`).replace(
        'use Flarum\\Testing\\integration\\TestCase;\n',
        'use Flarum\\Testing\\integration\\TestCase;\nuse Psr\\Http\\Message\\ResponseInterface;\n'
      )
    );

    expect(code).toContain(`use Flarum\\Testing\\integration\\TestCase;
use PHPUnit\\Framework\\Attributes\\Test;
use Psr\\Http\\Message\\ResponseInterface;`);
  });

  describe('annotations', () => {
    it('turns @test and @dataProvider into attributes, and makes the provider static', () => {
      expect(
        upgrade(
          testClass(`    /**
     * @test
     * @dataProvider things
     */
    public function it_works(string $thing)
    {
        $this->assertTrue(true);
    }

    public function things(): array
    {
        return [['a']];
    }`)
        )
      ).toBe(`<?php

namespace Acme\\Thing\\Tests\\integration\\api;

use Flarum\\Testing\\integration\\TestCase;
use PHPUnit\\Framework\\Attributes\\DataProvider;
use PHPUnit\\Framework\\Attributes\\Test;

class ThingTest extends TestCase
{
    #[Test]
    #[DataProvider('things')]
    public function it_works(string $thing)
    {
        $this->assertTrue(true);
    }

    public static function things(): array
    {
        return [['a']];
    }
}
`);
    });

    it('puts #[Test] first, as Flarum does, wherever @test was written', () => {
      // As flarum/approval's tests have it.
      const code = upgrade(
        testClass(`    /**
     * @dataProvider unallowedUsers
     * @test
     */
    public function can_only_see_approved(?int $authenticatedAs)
    {
    }`)
      );

      expect(code).toContain(`    #[Test]
    #[DataProvider('unallowedUsers')]
    public function can_only_see_approved(?int $authenticatedAs)`);
    });

    it('turns the class annotations into attributes', () => {
      const code = upgrade(
        testClass(
          `    public function test_it_works()
    {
        $this->assertTrue(true);
    }`,
          `
/**
 * @group slow
 * @runTestsInSeparateProcesses
 * @coversNothing
 */`
        )
      );

      expect(code).toContain(`use PHPUnit\\Framework\\Attributes\\CoversNothing;
use PHPUnit\\Framework\\Attributes\\Group;
use PHPUnit\\Framework\\Attributes\\RunTestsInSeparateProcesses;
`);
      expect(code).toContain(`#[Group('slow')]
#[RunTestsInSeparateProcesses]
#[CoversNothing]
class ThingTest extends TestCase`);
      expect(code).not.toContain('/**');
    });

    it('turns the method annotations into attributes, in the order they were written', () => {
      const code = upgrade(
        testClass(`    /**
     * @before
     */
    public function prepare()
    {
    }

    /**
     * @test
     * @group api
     * @depends prepare_things
     * @doesNotPerformAssertions
     * @runInSeparateProcess
     * @testdox It works for every thing
     * @ticket 1234
     */
    public function it_works()
    {
    }`)
      );

      expect(code).toContain(`    #[Before]
    public function prepare()`);
      expect(code).toContain(`    #[Test]
    #[Group('api')]
    #[Depends('prepare_things')]
    #[DoesNotPerformAssertions]
    #[RunInSeparateProcess]
    #[TestDox('It works for every thing')]
    #[Ticket('1234')]
    public function it_works()`);

      for (const attribute of ['Before', 'Test', 'Group', 'Depends', 'DoesNotPerformAssertions', 'RunInSeparateProcess', 'TestDox', 'Ticket']) {
        expect(code).toContain(`use PHPUnit\\Framework\\Attributes\\${attribute};`);
      }
    });

    it('points a provider or dependency in another class at that class', () => {
      const code = upgrade(
        testClass(`    /**
     * @test
     * @dataProvider \\Acme\\Thing\\Tests\\Fixtures::things
     * @depends Acme\\Thing\\Tests\\SetupTest::it_sets_up
     */
    public function it_works(string $thing)
    {
    }`)
      );

      expect(code).toContain(`    #[DataProviderExternal(\\Acme\\Thing\\Tests\\Fixtures::class, 'things')]
    #[DependsExternal(\\Acme\\Thing\\Tests\\SetupTest::class, 'it_sets_up')]`);
      expect(code).not.toContain(`DataProvider('`);
      expect(code).toContain('use PHPUnit\\Framework\\Attributes\\DataProviderExternal;');
      expect(code).toContain('use PHPUnit\\Framework\\Attributes\\DependsExternal;');
    });

    it('keeps the rest of a doc comment', () => {
      const code = upgrade(
        testClass(`    /**
     * Guests can't see hidden things.
     *
     * @test
     */
    public function guests_cant_see_hidden_things()
    {
    }`)
      );

      expect(code).toContain(`    /**
     * Guests can't see hidden things.
     */
    #[Test]
    public function guests_cant_see_hidden_things()`);
    });

    it('flags the annotations it has no attribute for, and keeps them', () => {
      const code = upgrade(
        testClass(`    /**
     * @test
     * @covers \\Acme\\Thing\\Thing::save
     * @requires extension intl
     * @coversNothing
     */
    public function it_saves()
    {
    }`)
      );

      expect(code).toContain(`    /**
     * @covers \\Acme\\Thing\\Thing::save
     * @requires extension intl
     * @coversNothing
     */
    // @TODO: PHPUnit 12 no longer reads @covers, @requires, @coversNothing here. Use attributes instead: https://docs.phpunit.de/en/12.5/attributes.html
    #[Test]
    public function it_saves()`);
    });

    it('leaves doc comments that are not PHPUnit metadata alone', () => {
      const source = testClass(`    /**
     * @param string $thing
     * @return void
     */
    public function helper(string $thing): void
    {
    }`);

      expect(upgrade(source)).toBe(source);
    });

    it('does nothing to a test that already uses attributes', () => {
      const source = `<?php

namespace Acme\\Thing\\Tests\\integration\\api;

use Flarum\\Testing\\integration\\TestCase;
use PHPUnit\\Framework\\Attributes\\Test;

class ThingTest extends TestCase
{
    #[Test]
    public function it_works()
    {
    }
}
`;

      expect(upgrade(source)).toBe(source);
    });
  });

  describe('prepareDatabase()', () => {
    const prepare = (rows: string, models: Record<string, string> = {}) =>
      php.run('upgrade.2-0.phpunit', {
        file: 'tests/integration/api/ThingTest.php',
        code: testClass(`    public function setUp(): void
    {
        parent::setUp();

        $this->prepareDatabase([
${rows}
        ]);
    }`),
        data: { models },
      }).code;

    it("names the extension's own tables by their models, so their factories fill them", () => {
      const code = prepare(
        `            'users' => [$this->normalUser()],
            'acme_things' => [['id' => 1, 'title' => 'A thing']],
            'acme_thing_user' => [['thing_id' => 1, 'user_id' => 2]],`,
        Object.fromEntries([['acme_things', 'Acme\\Thing\\Thing']])
      );

      expect(code).toContain(`            User::class => [$this->normalUser()],
            Thing::class => [['id' => 1, 'title' => 'A thing']],
            'acme_thing_user' => [['thing_id' => 1, 'user_id' => 2]],`);
      expect(code).toContain('use Acme\\Thing\\Thing;');
      expect(code).toContain('use Flarum\\User\\User;');
    });

    it('names the api_keys table by its model', () => {
      const code = prepare(`            'api_keys' => [['key' => 'secret']],`);

      expect(code).toContain(`            ApiKey::class => [['key' => 'secret']],`);
      expect(code).toContain('use Flarum\\Api\\ApiKey;');
    });

    it('names a model in full when another has its short name', () => {
      const code = prepare(
        `            'users' => [$this->normalUser()],
            'acme_users' => [['id' => 1]],`,
        Object.fromEntries([['acme_users', 'Acme\\Thing\\User']])
      );

      expect(code).toContain(`            User::class => [$this->normalUser()],
            \\Acme\\Thing\\User::class => [['id' => 1]],`);
      expect(code).not.toContain('use Acme\\Thing\\User;');
    });
  });

  describe('assertions PHPUnit 10 removed', () => {
    it('renames the ones that were replaced', () => {
      const code = upgrade(
        testClass(`    public function test_it_works()
    {
        $this->assertObjectHasAttribute('id', $thing);
        $this->assertObjectNotHasAttribute('secret', $thing);
        static::assertRegExp('/a/', $text);
        self::assertNotRegExp('/b/', $text);
        $this->assertFileNotExists($path);
        $this->assertFileNotIsReadable($path);
        $this->assertFileNotIsWritable($path);
        $this->assertDirectoryNotExists($path);
        $this->assertDirectoryNotIsReadable($path);
        $this->assertDirectoryNotIsWritable($path);
        $this->assertNotIsReadable($path);
        $this->assertNotIsWritable($path);
    }`)
      );

      expect(code).toContain(`        $this->assertObjectHasProperty('id', $thing);
        $this->assertObjectNotHasProperty('secret', $thing);
        static::assertMatchesRegularExpression('/a/', $text);
        self::assertDoesNotMatchRegularExpression('/b/', $text);
        $this->assertFileDoesNotExist($path);
        $this->assertFileIsNotReadable($path);
        $this->assertFileIsNotWritable($path);
        $this->assertDirectoryDoesNotExist($path);
        $this->assertDirectoryIsNotReadable($path);
        $this->assertDirectoryIsNotWritable($path);
        $this->assertIsNotReadable($path);
        $this->assertIsNotWritable($path);`);
    });
  });

  describe('test doubles', () => {
    it('configures stubs with the will*() methods PHPUnit 12 keeps', () => {
      const code = upgrade(
        testClass(`    public function test_it_works()
    {
        $stub->method('a')->will($this->returnValue(1));
        $stub->method('b')->will($this->returnValueMap($map));
        $stub->method('c')->will($this->returnArgument(0));
        $stub->method('d')->will($this->returnCallback(fn () => 1));
        $stub->method('e')->will($this->returnSelf());
        $stub->method('f')->will($this->throwException(new \\Exception()));
        $stub->method('g')->will($this->onConsecutiveCalls(1, 2));
    }`)
      );

      expect(code).toContain(`        $stub->method('a')->willReturn(1);
        $stub->method('b')->willReturnMap($map);
        $stub->method('c')->willReturnArgument(0);
        $stub->method('d')->willReturnCallback(fn () => 1);
        $stub->method('e')->willReturnSelf();
        $stub->method('f')->willThrowException(new \\Exception());
        $stub->method('g')->willReturnOnConsecutiveCalls(1, 2);`);
    });

    it('flags what PHPUnit removed without a replacement', () => {
      const code = upgrade(
        testClass(`    public function test_it_works()
    {
        $thing = $this->getMockForAbstractClass(Thing::class);
        $mock->expects($this->at(0))->method('save');
        $mock->method('save')->withConsecutive(['a'], ['b']);
        $this->expectError();
    }`)
      );

      expect(code)
        .toContain(`        // @TODO: PHPUnit 12 has no getMockForAbstractClass(). https://github.com/sebastianbergmann/phpunit/blob/12.0.0/ChangeLog-12.0.md
        $thing = $this->getMockForAbstractClass(Thing::class);`);
      expect(code).toContain(`        // @TODO: PHPUnit 12 has no at(). https://github.com/sebastianbergmann/phpunit/blob/10.0.0/ChangeLog-10.0.md
        $mock->expects($this->at(0))->method('save');`);
      expect(code)
        .toContain(`        // @TODO: PHPUnit 12 has no withConsecutive(). https://github.com/sebastianbergmann/phpunit/blob/10.0.0/ChangeLog-10.0.md
        $mock->method('save')->withConsecutive(['a'], ['b']);`);
      expect(code)
        .toContain(`        // @TODO: PHPUnit 12 has no expectError(). https://github.com/sebastianbergmann/phpunit/blob/10.0.0/ChangeLog-10.0.md
        $this->expectError();`);
    });

    it('leaves methods of the same name on other objects alone', () => {
      const source = testClass(`    public function test_it_works()
    {
        $translator->setLocale('de');
        $calendar->at(0);
        $config->iniSet('a', 'b');
    }`);

      expect(upgrade(source)).toBe(source);
    });
  });

  describe('run again, as --force-steps does', () => {
    it('changes nothing it already changed', () => {
      const once = upgrade(
        testClass(`    /**
     * @test
     * @covers \\Acme\\Thing\\Thing
     */
    public function it_works()
    {
        $thing = $this->getMockForAbstractClass(Thing::class);
        $stub->method('a')->will($this->returnValue(1));
    }`)
      );

      expect(upgrade(once)).toBe(once);
      expect(once.match(/@TODO/g)).toHaveLength(2);
    });
  });
});

describe('the PHPUnit step, as the author sees it', () => {
  const step = new PhpUnit({} as any, '/extension', 1, 1, false);

  it('says it brings the tests to PHPUnit 12', () => {
    expect(step.type).toBe('PHPUnit 9 to 12 changes');
    expect(step.gitCommit().message).toBe('chore(2.0): Backend tests + PHPUnit 9 to 12 changes');
    expect(step.gitCommit().description).toContain('PHPUnit 12');
    expect(step.pauseMessage()).toContain('Flarum 2.0 uses PHPUnit 12.');
    expect(step.pauseMessage()).toContain('https://github.com/sebastianbergmann/phpunit/blob/12.5/DEPRECATIONS.md');
    expect(step.pauseMessage()).not.toContain('PHPUnit 11');
  });
});
