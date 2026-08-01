import { StepFailures } from '../../../src/steps/upgrade/twopointoh/step-failures';

describe('StepFailures', () => {
  it('has nothing to report when no file failed', () => {
    const failures = new StepFailures();

    expect(failures.any()).toBe(false);
    expect(failures.count()).toBe(0);
  });

  it('records the file and the reason it failed', () => {
    const failures = new StepFailures();

    failures.record('src/Api/ListThingController.php', new Error('Unexpected token at line 42'));

    expect(failures.any()).toBe(true);
    expect(failures.count()).toBe(1);

    const report = failures.report();

    expect(report).toContain('src/Api/ListThingController.php');
    expect(report).toContain('Unexpected token at line 42');
  });

  it('keeps going after the first failure so one run surfaces them all', () => {
    // The point of collecting rather than throwing on the first: an author
    // fixes everything the step found in one pass, instead of rediscovering
    // problems one re-run at a time.
    const failures = new StepFailures();

    failures.record('a.php', new Error('first problem'));
    failures.record('b.php', new Error('second problem'));
    failures.record('c.php', new Error('third problem'));

    expect(failures.count()).toBe(3);

    const report = failures.report();

    expect(report).toContain('a.php');
    expect(report).toContain('b.php');
    expect(report).toContain('c.php');
    expect(report).toContain('third problem');
  });

  it('reports a non-Error throw without losing what it was', () => {
    const failures = new StepFailures();

    // Transformers can reject with a string, or with a PHP subsystem payload.
    failures.record('odd.php', 'a plain string failure');

    expect(failures.report()).toContain('a plain string failure');
  });

  it('reports the message rather than the whole stack', () => {
    // Stacks belong behind a debug flag; the author needs the file and the
    // reason, not our internals.
    const error = new Error('the useful part');
    error.stack = 'Error: the useful part\n    at Object.<anonymous> (/cli/src/internal.ts:1:1)';

    const failures = new StepFailures();
    failures.record('x.php', error);

    const report = failures.report();

    expect(report).toContain('the useful part');
    expect(report).not.toContain('/cli/src/internal.ts');
  });
});
