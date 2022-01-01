import {genExtScaffolder} from '../../src/steps/gen-ext-scaffolder'

describe('genExtScaffolder', function() {
    it('validates', async function() {
        const scaffolder = genExtScaffolder();

        await scaffolder.validate();
    })
})