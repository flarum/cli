import {expect, test} from '@oclif/test'

describe('generate:backend:event-listener', () => {
  test
  .stdout()
  .command(['generate:backend:event-listener'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['generate:backend:event-listener', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
