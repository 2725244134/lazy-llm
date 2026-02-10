import type { ViewRect } from '../../electron/ipc/contracts.js';
import {
  calculateQuickPromptBounds,
  type QuickPromptGeometryInput,
} from '../../electron/views/quickPromptGeometry.js';
import {
  expectRecord,
  readBoolean,
  readJsonFromStdin,
  readNumber,
  writeErrorJson,
  writeJson,
} from './jsonCli.js';

function parseRect(rectLike: Record<string, unknown>): ViewRect {
  return {
    x: readNumber(rectLike, 'x'),
    y: readNumber(rectLike, 'y'),
    width: readNumber(rectLike, 'width'),
    height: readNumber(rectLike, 'height'),
  };
}

function parseQuickPromptGeometryInput(value: unknown): QuickPromptGeometryInput {
  const input = expectRecord(value, 'input');
  const viewportLike = expectRecord(input.viewport, 'viewport');
  const anchorLike = expectRecord(input.anchor, 'anchor');

  return {
    viewport: {
      width: readNumber(viewportLike, 'width'),
      height: readNumber(viewportLike, 'height'),
    },
    anchor: parseRect(anchorLike),
    requestedHeight: readNumber(input, 'requestedHeight'),
    passthroughMode: readBoolean(input, 'passthroughMode'),
    minWidth: readNumber(input, 'minWidth'),
    maxWidth: readNumber(input, 'maxWidth'),
    minHeight: readNumber(input, 'minHeight'),
    maxHeight: readNumber(input, 'maxHeight'),
    viewportPadding: readNumber(input, 'viewportPadding'),
  };
}

export async function runQuickPromptGeometryCli(): Promise<void> {
  const payload = await readJsonFromStdin();
  const input = parseQuickPromptGeometryInput(payload);
  const result = calculateQuickPromptBounds(input);
  writeJson(result);
}

async function main(): Promise<void> {
  try {
    await runQuickPromptGeometryCli();
  } catch (error) {
    writeErrorJson(error);
    process.exitCode = 1;
  }
}

void main();
