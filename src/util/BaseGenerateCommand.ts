import { execSync } from 'child_process';
import path from 'path';
import ExtenderParams from "../contracts/ExtenderParamsInterface";
import BaseFsCommand from "./BaseFsCommand";

export default abstract class BaseGenerateCommand extends BaseFsCommand {
  static flags = { ...BaseFsCommand.flags };

  static args = [...BaseFsCommand.args];

  protected async addExtender(extDir: string, params: ExtenderParams): Promise<string> {
    const currExtendContents = this.fs.read(path.resolve(extDir, 'extend.php'));
    const input = JSON.stringify({
      'extend.php': currExtendContents,
      op: 'extender.add',
      params
    });

    const res = execSync(`php ${this.getCliDir('php-subsystem/index.php')}`, { input });

    return res.toString();
  }

  protected validateClassNameFullyQualified(s: string) {
    return /^(\\([0-9a-zA-Z]+))+$/.test(s.trim()) || 'Invalid PHP class. Must be fully qualified.';
  }

  protected validateClassName(s: string) {
    return /^([0-9a-zA-Z]+)/.test(s.trim()) || 'Invalid PHP class name: only alphanumerical characters allowed.';
  }
  
  protected subPathToPhpNamespace(path: string) {
    return path.replace('src/', '').split('/').join('\\');
  }
}
