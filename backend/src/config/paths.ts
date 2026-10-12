import { existsSync } from 'node:fs';
import path from 'node:path';

// The backend directory: the nearest ancestor with package.json. Works the same
// from src/ (ts-node-dev), dist/ (production build) and test-dist/ (tests).
function findProjectRoot(start: string): string {
  let dir = start;
  while (!existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`package.json not found above ${start}`);
    dir = parent;
  }
  return dir;
}

export const PROJECT_ROOT = findProjectRoot(__dirname);
