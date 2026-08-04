#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SOURCE_INVENTORY = Object.freeze([
  ['analyze-proof.mjs', 'e77df8e7213a6a255e51d50d071aab9a1b6429192fabebcf79445a49c902877d'],
  ['build-live-test-html.mjs', '3be404559e06df460c6832c03bd61131abca4b0e19ba035124badd074d580853'],
  ['build-live-test-report.mjs', 'ab008c115936fcbeac8bbfa0efafc3e0f8855e9ea131fd20b501ee8b6f19d46e'],
  ['check-illustrator.sh', 'f255446ff296a23ea8c9ed16b2bdc530d6fb6d58d38dade97d543ac57357454f'],
  ['check-proof.sh', 'bbac801d323bb9806fcda20ce549d35a9daeee92898f033910390baeab197692'],
  ['inspect-illustrator.ps1', '43d77c786164e60fbcc45737a3c2a151d3c3323f5a14ce356c3a5ccd2a3c5afe'],
  ['illustrator/CampuslookProofCheck.jsx', '764da1f221e2cf0895a205577d65ad8280b82ea02df18c81f0b844864cc9a1f5'],
  ['illustrator/FastProofInspector.jsx', '1378a71c352812483d2a34c4eeca7d3d438f637115386f6f90ceec6f729b9231'],
  ['illustrator/batch-check-ai.ps1', 'a4e53f3bf5dc44b6b0d0a90fec0ea055e201b63e6fad116a986b76d12a9b24b9'],
  ['illustrator/check-active-illustrator.ps1', 'a65fe6d6a338528b5978099340118faf04e4799d19cea88c15585c90e04e671e'],
  ['illustrator/install-illustrator-script.ps1', '756381fbe7300bbaa90eee6d6dfe56e01fdf8e6cdc4d673ef5870d9d63ac36ab'],
  ['illustrator/run-proof-check.ps1', '20292592a33a2f26ae8ccde8cd4e04fb72b8fa4a5991f150eb176d4e930e1e53'],
]);

export const FORBIDDEN_DIRECTORY_NAMES = new Set([
  'reports',
  'downloads',
  'samples',
  '.cache',
  '.memory-bank',
]);
export const FORBIDDEN_EXTENSIONS = new Set([
  '.ai', '.pdf', '.eps', '.jpg', '.jpeg', '.png',
]);
export const MAX_TRACKED_BYTES = 1024 * 1024;

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function validateRelativePath(relativePath, size = 0) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
    throw new Error(`migration_path_invalid: ${relativePath}`);
  }
  const parts = relativePath.split(/[\\/]/);
  if (parts.some((part) => FORBIDDEN_DIRECTORY_NAMES.has(part.toLowerCase()))) {
    throw new Error(`migration_forbidden_directory: ${relativePath}`);
  }
  if (path.basename(relativePath).toUpperCase() === 'NUL') {
    throw new Error(`migration_forbidden_name: ${relativePath}`);
  }
  if (FORBIDDEN_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) {
    throw new Error(`migration_forbidden_extension: ${relativePath}`);
  }
  if (size > MAX_TRACKED_BYTES) {
    throw new Error(`migration_oversize_artifact: ${relativePath}`);
  }
}

export function validateProductContent(relativePath, text) {
  if (/\/home\/[^/]+\/campus-look-ops(?:\/|$)/.test(text)) {
    throw new Error(`migration_legacy_parent_path: ${relativePath}`);
  }
  if (/\.\.\/lib\/(?:naver-credentials|naver-imap)\.mjs/.test(text)) {
    throw new Error(`migration_parent_dependency: ${relativePath}`);
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) {
    throw new Error(`migration_secret_like_content: ${relativePath}`);
  }
}

function gitLines(repoRoot, args) {
  const output = execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
  return output.split('\n').filter(Boolean);
}

export function verifyMigration({
  repoRoot,
  manifestPath = path.join(repoRoot, 'migration/source-manifest.json'),
  sourceRoot = null,
  requireClean = false,
} = {}) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 'campuslook-source-migration/v1') {
    throw new Error('migration_manifest_schema_invalid');
  }
  const expected = new Map(SOURCE_INVENTORY);
  if (manifest.entries.length !== expected.size) {
    throw new Error('migration_manifest_entry_count_mismatch');
  }
  for (const entry of manifest.entries) {
    if (expected.get(entry.path) !== entry.sourceSha256) {
      throw new Error(`migration_source_inventory_mismatch: ${entry.path}`);
    }
    const targetPath = path.join(repoRoot, entry.path);
    if (!fs.statSync(targetPath).isFile() || sha256File(targetPath) !== entry.targetSha256) {
      throw new Error(`migration_target_hash_mismatch: ${entry.path}`);
    }
    if (sourceRoot) {
      const sourcePath = path.join(sourceRoot, entry.path);
      if (!fs.statSync(sourcePath).isFile() || sha256File(sourcePath) !== entry.sourceSha256) {
        throw new Error(`migration_source_hash_mismatch: ${entry.path}`);
      }
    }
  }

  const tracked = gitLines(repoRoot, ['ls-files']);
  for (const relativePath of tracked) {
    const absolutePath = path.join(repoRoot, relativePath);
    validateRelativePath(relativePath, fs.statSync(absolutePath).size);
  }
  const productPaths = [...SOURCE_INVENTORY.map(([entry]) => entry), 'illustrator/inspector-root.ps1'];
  for (const relativePath of productPaths) {
    validateProductContent(relativePath, fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
  }
  const remotes = gitLines(repoRoot, ['remote']);
  if (remotes.length) throw new Error('migration_remote_not_allowed');
  if (requireClean && gitLines(repoRoot, ['status', '--porcelain=v1']).length) {
    throw new Error('migration_repository_dirty');
  }
  return {
    ok: true,
    entries: manifest.entries.length,
    trackedFiles: tracked.length,
    remotes: 0,
  };
}

function parseArgs(argv) {
  const result = { sourceRoot: null, requireClean: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--source-root') result.sourceRoot = path.resolve(argv[++index]);
    else if (argv[index] === '--require-clean') result.requireClean = true;
    else throw new Error(`unknown_argument: ${argv[index]}`);
  }
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const args = parseArgs(process.argv.slice(2));
    console.log(JSON.stringify(verifyMigration({ repoRoot, ...args })));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
