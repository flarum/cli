import {expect, test} from '@oclif/test'

describe('infra:backend-testing', () => {
  test
  .stdout()
  .command(['infra:backend-testing'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['infra:backend-testing', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
