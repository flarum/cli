import {expect, test} from '@oclif/test'

describe('generate:migration', () => {
  test
  .stdout()
  .command(['generate:migration'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['generate:migration', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
