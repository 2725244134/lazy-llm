import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export interface CliRunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function resolveRuntimeCommand(): { command: string; args: string[] } {
  if (process.versions.bun) {
    return { command: process.execPath, args: [] };
  }

  return { command: 'bun', args: [] };
}

export function runCliScript(scriptPath: string, input: unknown | string): CliRunResult {
  const absoluteScriptPath = resolve(process.cwd(), scriptPath);
  const stdin = typeof input === 'string' ? input : JSON.stringify(input);
  const { command, args } = resolveRuntimeCommand();

  const result = spawnSync(command, [...args, absoluteScriptPath], {
    cwd: process.cwd(),
    input: stdin,
    encoding: 'utf8',
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}
