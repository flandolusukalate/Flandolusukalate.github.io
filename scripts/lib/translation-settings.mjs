import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { writeJsonAtomically } from './atomic-json.mjs';

export const models = ['deepseek-flash', 'deepseek-v4-pro'];
// DPAPI binds the saved key to this Windows account. Secrets travel over stdin,
// never in process arguments, browser storage, repository files or logs.
export function protectKey(value, decrypt = false) {
  if (process.platform !== 'win32') throw new Error('Persistent keys require Windows. Use DEEPSEEK_API_KEY instead.');
  const script = "$ErrorActionPreference='Stop'; $v=[Console]::In.ReadToEnd(); " + (decrypt
    ? "$s=ConvertTo-SecureString $v; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}"
    : "$s=ConvertTo-SecureString $v -AsPlainText -Force; [Console]::Out.Write((ConvertFrom-SecureString $s))");
  return new Promise((resolve, reject) => {
    // PowerShell 7 module paths can break Windows PowerShell's Security module.
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'psmodulepath'));
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env, windowsHide:true, stdio:['pipe','pipe','ignore'] });
    let output = '';
    const timer = setTimeout(() => child.kill(), 15000);
    child.stdout.on('data', chunk => { output += chunk; });
    child.on('error', () => { clearTimeout(timer); reject(new Error('Windows key protection is unavailable.')); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error('Cannot unlock the saved key. Enter it again in Translation settings.')); });
    child.stdin.on('error', () => {}); child.stdin.end(value);
  });
}

export async function translationSettings({ directory = join(process.env.APPDATA || homedir(), 'FlandoluSpace'), env = process.env, crypt = protectKey } = {}) {
  const file = join(directory, 'translation.json');
  let settings = { model:models[0], automatic:false, encryptedKey:'' };
  try { settings = { ...settings, ...JSON.parse(await readFile(file, 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Cannot read local translation settings: ' + file); }
  const publicState = () => ({ configured:!!(env.DEEPSEEK_API_KEY || settings.encryptedKey), fromEnvironment:!!env.DEEPSEEK_API_KEY, model:settings.model, automatic:settings.automatic === true });
  return {
    publicState,
    async credentials() {
      const key = env.DEEPSEEK_API_KEY || (settings.encryptedKey && await crypt(settings.encryptedKey, true));
      if (!key) throw new Error('请先在「翻译设置」填写 DeepSeek API Key。 / Configure a DeepSeek API key first.');
      if (!models.includes(settings.model)) throw new Error('Choose a supported DeepSeek model in Translation settings.');
      return { key, model:settings.model };
    },
    async save(input) {
      if (!models.includes(input.model) || typeof input.automatic !== 'boolean') throw new Error('Invalid translation settings.');
      if (input.key !== undefined && (typeof input.key !== 'string' || input.key.length > 500 || /\s/.test(input.key))) throw new Error('API Key must not contain whitespace (max 500 characters).');
      if (env.DEEPSEEK_API_KEY && (input.key || input.clearKey)) throw new Error('The key comes from DEEPSEEK_API_KEY. Change it in the terminal, then restart the editor.');
      const next = { model:input.model, automatic:input.automatic, encryptedKey:input.clearKey ? '' : settings.encryptedKey };
      if (input.key) next.encryptedKey = await crypt(input.key);
      if (!next.encryptedKey && !env.DEEPSEEK_API_KEY) next.automatic = false;
      await writeJsonAtomically(file, next); settings = next;
      return publicState();
    }
  };
}
