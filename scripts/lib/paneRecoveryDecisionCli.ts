import {
  decidePaneLoadRecovery,
  type PaneRecoveryDecisionInput,
  type PaneRecoveryState,
} from '../../src/main-services/views/paneRecovery.js';
import {
  expectRecord,
  readBoolean,
  readJsonFromStdin,
  readNumber,
  readString,
  writeErrorJson,
  writeJson,
} from './jsonCli.js';

function parsePaneRecoveryState(value: unknown): PaneRecoveryState {
  const state = expectRecord(value, 'previousState');

  return {
    targetUrl: readString(state, 'targetUrl'),
    attemptCount: readNumber(state, 'attemptCount'),
  };
}

function parsePaneRecoveryDecisionInput(value: unknown): PaneRecoveryDecisionInput {
  const input = expectRecord(value, 'input');
  const previousState = input.previousState === undefined ? undefined : parsePaneRecoveryState(input.previousState);

  return {
    isMainFrame: readBoolean(input, 'isMainFrame'),
    errorCode: readNumber(input, 'errorCode'),
    failedUrl: readString(input, 'failedUrl'),
    targetUrl: readString(input, 'targetUrl'),
    maxRetries: readNumber(input, 'maxRetries'),
    previousState,
  };
}

export async function runPaneRecoveryDecisionCli(): Promise<void> {
  const payload = await readJsonFromStdin();
  const input = parsePaneRecoveryDecisionInput(payload);
  const decision = decidePaneLoadRecovery(input);
  writeJson(decision);
}

async function main(): Promise<void> {
  try {
    await runPaneRecoveryDecisionCli();
  } catch (error) {
    writeErrorJson(error);
    process.exitCode = 1;
  }
}

void main();
