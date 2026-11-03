import { writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

export async function writeJsonAtomically(path, value, replace = rename) {
  await mkdir(dirname(path), { recursive:true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value), { flag:'wx', mode:0o600 });
    for (let attempt = 0; ; attempt++) {
      try { await replace(temporary, path); break; }
      catch (error) {
        // Windows readers/virus scanners may briefly hold the destination.
        // Never remove the previous file to work around a sharing violation.
        if (!['EPERM','EBUSY','EACCES'].includes(error.code) || attempt === 5) throw error;
        await setTimeout(25 * 2 ** attempt);
      }
    }
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
