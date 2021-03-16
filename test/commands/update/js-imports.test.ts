import {expect, test} from '@oclif/test'

describe('update:js-imports', () => {
  test
  .stdout()
  .command(['update:js-imports'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['update:js-imports', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
