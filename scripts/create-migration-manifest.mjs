#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_INVENTORY, sha256File } from './verify-migration.mjs';

function requiredValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0 || !argv[index + 1]) throw new Error(`missing_argument: ${flag}`);
  return path.resolve(argv[index + 1]);
}

try {
  const argv = process.argv.slice(2);
  const sourceRoot = requiredValue(argv, '--source-root');
  const targetRoot = argv.includes('--target-root')
    ? requiredValue(argv, '--target-root')
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const output = argv.includes('--output')
    ? requiredValue(argv, '--output')
    : path.join(targetRoot, 'migration/source-manifest.json');

  const transformations = new Map([
    ['build-live-test-html.mjs', 'removed machine-specific fixture default; explicit sanitized directory required'],
    ['build-live-test-report.mjs', 'removed machine-specific fixture default; explicit sanitized directory required'],
    ['check-proof.sh', 'replaced machine-specific palette default with explicit argument or environment'],
    ['illustrator/install-illustrator-script.ps1', 'installer now writes validated repository-root sidecar'],
    ['illustrator/run-proof-check.ps1', 'legacy parent absolute root replaced by shared fail-closed source/runtime resolution, validated WSL UNC and drive conversion, and Git-external outputs'],
  ]);
  const entries = SOURCE_INVENTORY.map(([relativePath, expectedSourceSha256]) => {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);
    const observedSourceSha256 = sha256File(sourcePath);
    if (observedSourceSha256 !== expectedSourceSha256) {
      throw new Error(`migration_source_hash_mismatch: ${relativePath}`);
    }
    const targetSha256 = sha256File(targetPath);
    return {
      path: relativePath,
      sourceSha256: expectedSourceSha256,
      targetSha256,
      transformation: transformations.get(relativePath) || 'byte-identical source copy',
    };
  });
  const manifest = {
    schemaVersion: 'campuslook-source-migration/v1',
    createdAt: '2026-08-04T02:19:17Z',
    sourceLabel: 'legacy-campus-look-ops-inspector',
    sourceParentObservedCommit: '094f192be8fb4289ee549ede92bff19ff715bc06',
    sourceInventorySha256: 'aecd418ecff40e9dc387fffe20fce5299943a81ef5f55f4bf88717fbafa23d2b',
    entries,
    excluded: [
      'reports', 'downloads', 'samples', '.cache', '.memory-bank', 'NUL',
      'AI/PDF/EPS/JPG/PNG artifacts', 'files larger than 1 MiB',
      'mail download and credential-dependent code',
    ],
  };
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, output, entries: entries.length }));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
