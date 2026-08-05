import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(name) {
  const result = spawnSync(process.execPath, ['tests/material-catalog-cases.mjs', name], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('current and legacy body catalogs remain separate', () => {
  const current = fixture('current');
  const legacy = fixture('legacy');
  assert.equal(current.status, 'PASS');
  assert.equal(current.matchedCatalog.role, 'current-body');
  assert.equal(legacy.decision.status, 'PASS');
  assert.equal(legacy.decision.matchedCatalog.role, 'legacy-body');
  assert.equal(legacy.catalog.entries[0].candidates[0].explicitHex, '#1414B4');
});

test('generation and duplicate ambiguity are fail/review closed', () => {
  assert.equal(fixture('explicit-mismatch').decisionCode, 'generation_mismatch');
  assert.equal(fixture('cross-generation').decisionCode, 'cross_generation_ambiguous');
  const duplicate = fixture('duplicate-legacy');
  assert.equal(duplicate.status, 'REVIEW');
  assert.equal(duplicate.candidates.filter((entry) => entry.role === 'legacy-body').length, 2);
  const otherNumber = fixture('other-number');
  assert.equal(otherNumber.status, 'FAIL');
  assert.equal(otherNumber.decisionCode, 'body_other_number_match');
});

test('sleeve exact generic and unregistered decisions are catalog based', () => {
  const exact = fixture('sleeve-exact');
  assert.equal(exact.decision.status, 'PASS');
  assert.equal(exact.decision.decisionCode, 'sleeve_exact_key_match');
  const generic = fixture('sleeve-generic');
  assert.equal(generic.white.status, 'PASS');
  assert.equal(generic.black.status, 'PASS');
  const missing = fixture('sleeve-unregistered');
  assert.notEqual(missing.missing.status, 'PASS');
  assert.equal(missing.conflicting.status, 'FAIL');
});

test('registry validates role source hash and warm reuse', () => {
  const result = fixture('registry');
  assert.deepEqual(result.roles, ['current-body', 'legacy-body', 'sleeve-material']);
  assert.equal(result.warmReadStable, true);
  assert.equal(result.missingRejected, true);
  assert.equal(result.driftRejected, true);
});

test('schema 4 analyzer preserves core report and CLI success contracts', () => {
  const result = fixture('analyzer');
  assert.equal(result.schemaVersion, 4);
  assert.equal(result.overallStatus, 'PASS');
  assert.equal(result.coreFields, true);
  assert.equal(result.coverage, 'full');
  assert.equal(result.bodyRole, 'current-body');
  assert.equal(result.sleeveCode, 'sleeve_exact_key_match');
  assert.equal(result.cli.ok, true);
});
