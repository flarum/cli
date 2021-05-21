
import {execSync} from 'child_process'
import path from 'path'
import ExtenderDef from '../contracts/ExtenderDefInterface'

export default class PhpSubsystemClient {
    protected cliDir: string;

    constructor(cliDir: string) {
      this.cliDir = cliDir
    }

    withExtender(extendContents: string, extenderDef: ExtenderDef): string {
      const input = JSON.stringify({
        'extend.php': extendContents,
        op: 'extender.add',
        params: extenderDef,
      })

      const res = execSync(`php ${path.resolve(this.cliDir, 'php-subsystem/index.php')}`, {input})

      return res.toString()
    }
}
