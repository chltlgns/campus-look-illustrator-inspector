import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MAX_TRACKED_BYTES,
  validateProductContent,
  validateRelativePath,
  verifyMigration,
} from '../scripts/verify-migration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('check-proof CLI preserves help and safe input failure', () => {
  const help = spawnSync('bash', ['check-proof.sh', '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /check-proof\.sh <.*\.ai>/);
  assert.match(help.stdout, /외부 API나 유료 서비스를 호출하지 않습니다/);

  const missing = spawnSync('bash', ['check-proof.sh'], { cwd: root, encoding: 'utf8' });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /사용법/);
});

test('migration manifest binds target hashes and source-only policy', () => {
  const result = verifyMigration({ repoRoot: root });
  assert.equal(result.ok, true);
  assert.equal(result.entries, 12);
  assert.equal(result.remotes, 0);
});

test('migration policy rejects forbidden paths, size and secret-like content', () => {
  for (const forbidden of [
    'reports/report.json',
    'downloads/mail.bin',
    'samples/sample.txt',
    '.cache/item',
    '.memory-bank/state.json',
    'NUL',
    'fixture.ai',
    'fixture.PDF',
    'fixture.eps',
    'fixture.jpg',
    'fixture.png',
  ]) {
    assert.throws(() => validateRelativePath(forbidden, 10), /migration_/);
  }
  assert.throws(
    () => validateRelativePath('artifact.bin', MAX_TRACKED_BYTES + 1),
    /migration_oversize_artifact/,
  );
  assert.throws(
    () => validateProductContent('fixture.mjs', '-----BEGIN PRIVATE KEY-----'),
    /migration_secret_like_content/,
  );
});

test('report schema and status semantics remain explicit', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'contracts/inspector-result.schema.json'), 'utf8'));
  assert.equal(schema.properties.schemaVersion.const, 3);
  assert.deepEqual(schema.$defs.status.enum, ['PASS', 'REVIEW', 'FAIL']);
  for (const field of ['document', 'designCount', 'overallStatus', 'designs', 'performance', 'limitations']) {
    assert.ok(schema.required.includes(field));
  }
  const analyzer = fs.readFileSync(path.join(root, 'analyze-proof.mjs'), 'utf8');
  assert.match(analyzer, /if \(statuses\.includes\('FAIL'\)\) return 'FAIL'/);
  assert.match(analyzer, /if \(statuses\.includes\('REVIEW'\)\) return 'REVIEW'/);
  assert.match(analyzer, /schemaVersion: 3/);
});

test('portable root and integration documentation are fail-closed', () => {
  const resolver = fs.readFileSync(path.join(root, 'illustrator/inspector-root.ps1'), 'utf8');
  const launcher = fs.readFileSync(path.join(root, 'illustrator/run-proof-check.ps1'), 'utf8');
  const installer = fs.readFileSync(path.join(root, 'illustrator/install-illustrator-script.ps1'), 'utf8');
  const integration = fs.readFileSync(path.join(root, 'docs/integration.md'), 'utf8');
  assert.match(resolver, /CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT/);
  assert.match(resolver, /CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT/);
  assert.match(resolver, /\$source = 'sidecar'/);
  assert.match(resolver, /inspector_root_invalid/);
  assert.doesNotMatch(launcher, /\/home\/doggabiya\/campus-look-ops/);
  assert.doesNotMatch(launcher, /\$workspaceRoot\/(?:reports|\.cache)/);
  assert.match(launcher, /\$runtimeRoot\/reports/);
  assert.match(installer, /inspector-root\.json/);
  assert.match(installer, /schemaVersion = 2/);
  assert.match(integration, /campuslook-inspector-integration\/v1/);
  assert.match(integration, /PASS.*REVIEW.*FAIL/s);
  assert.match(integration, /180초/);
});
