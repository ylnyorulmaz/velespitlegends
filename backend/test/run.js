/* eslint-disable no-console */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function collect(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((ent) => {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) return collect(full);
    return ent.name.endsWith('.test.js') ? [full] : [];
  });
}

const args = process.argv.slice(2);
const unitOnly = args.includes('--unit-only');
const featureOnly = args.includes('--feature-only');

const unitFiles = collect(path.join(__dirname, 'unit'));
const featureFiles = collect(path.join(__dirname, 'feature'));
// Unit first for fast failures; feature needs memory Mongo.
const files = unitOnly ? unitFiles : featureOnly ? featureFiles : [...unitFiles, ...featureFiles];

if (!files.length) {
  console.error('No test files found');
  process.exit(1);
}

const nodeArgs = ['--test', '--test-force-exit'];
if (!unitOnly) nodeArgs.push('--test-concurrency=1');
nodeArgs.push(...files);

const result = spawnSync(process.execPath, nodeArgs, { stdio: 'inherit' });
process.exit(result.status == null ? 1 : result.status);
