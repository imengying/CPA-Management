#!/usr/bin/env node
/**
 * TypeScript 7 side-by-side shim.
 *
 * `typescript-eslint` (and the packages it builds on) still require the TS 6
 * compiler API: they declare `peerDependencies.typescript: >=4.8.4 <6.1.0` and
 * throw at import time when they resolve TS 7. The upgrade guide recommends
 * running them against TS 6 while `tsc` itself moves to 7.
 *
 * npm/pnpm express that with a nested override; bun's `overrides` only accept a
 * flat map, so the TS 6 copy is materialised here instead. `typescript6` is an
 * alias install of the pinned 6.x release.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'node_modules');
const source = path.join(root, 'typescript6');
if (!fs.existsSync(source)) {
  console.warn('[nest-ts6] 未找到 node_modules/typescript6，跳过');
  process.exit(0);
}

/** Packages that resolve the TypeScript API through a peer dependency. */
const consumers = [
  'typescript-eslint',
  'ts-api-utils',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  '@typescript-eslint/project-service',
  '@typescript-eslint/tsconfig-utils',
  '@typescript-eslint/typescript-estree',
  '@typescript-eslint/type-utils',
  '@typescript-eslint/utils',
];

let installed = 0;
for (const name of consumers) {
  const target = path.join(root, name, 'node_modules', 'typescript');
  const scope = path.dirname(target);
  if (!fs.existsSync(path.join(root, name))) continue;
  if (fs.existsSync(target)) continue;
  fs.mkdirSync(scope, { recursive: true });
  fs.cpSync(source, target, { recursive: true, dereference: true });
  installed += 1;
}
console.log(`[nest-ts6] 已为 ${installed} 个包提供 TS 6`);
