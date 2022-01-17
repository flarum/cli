import { Store } from 'mem-fs';
import { create } from 'mem-fs-editor';

export async function commitAsync(fs: Store): Promise<boolean> {
  return new Promise((resolve, _reject) => {
    create(fs).commit(err => {
      if (err) {
        throw new Error(err);
      }

      resolve(true);
    });
  });
}
