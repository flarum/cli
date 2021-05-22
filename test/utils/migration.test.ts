import { getNextMigrationName } from '../../src/utils/migration';

describe('getNextMigrationName', function () {
  jest
    .useFakeTimers('modern')
    .setSystemTime(new Date('2020-01-01T03:24:00').getTime());

  test('formats properly', function () {
    const noMigrations: string[] = [];

    expect(getNextMigrationName(noMigrations, 'some name')).toBe('2020_01_01_000000_some_name.php');
    expect(getNextMigrationName(noMigrations, 'SoMe __ NaMME')).toBe('2020_01_01_000000_some____namme.php');
  });

  test('migrations on other days dont affect number', function () {
    const existingMigrations = [
      '1995_02_20_123456_something.php',
      '2001_01_01_000000_test.php',
      '2083_06_17_666666_migration.php',
    ];

    expect(getNextMigrationName(existingMigrations, 'some name')).toBe('2020_01_01_000000_some_name.php');
  });

  test('migrations on same day result in number being one above greatest', function () {
    const existingMigrations = [
      '2020_01_01_000000_something.php',
      '2020_01_01_012345_test.php',
      '2020_01_01_999998_migration.php',
    ];

    expect(getNextMigrationName(existingMigrations, 'some name')).toBe('2020_01_01_999999_some_name.php');
  });
});
