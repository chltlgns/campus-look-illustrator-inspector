#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';
import {
  REGISTRY_SCHEMA,
  buildIrregularCatalog,
  createCatalog,
  evaluateBodyMaterial,
  evaluateSleeveMaterial,
  loadCatalogRegistry,
  parseBodySpecification,
  parseSleeveSpecification,
  registryFromCatalogs,
} from '../material-catalog.mjs';

const hashes = {
  current: 'a'.repeat(64),
  legacy: 'b'.repeat(64),
  sleeve: 'c'.repeat(64),
};

function bodyCatalog(role, rgb, options = {}) {
  const generation = role === 'current-body' ? 'current' : 'legacy';
  const candidates = options.candidates ?? [{ label: `${generation} TR 10번`, rgb }];
  return createCatalog({
    catalogId: role,
    role,
    generation,
    sourceSha256: hashes[generation],
    entries: [{
      material: 'TR하이미어',
      number: 10,
      referenceState: options.referenceState,
      candidates,
    }],
  });
}

function sleeveCatalog() {
  return createCatalog({
    catalogId: 'sleeve-reference',
    role: 'sleeve-material',
    generation: 'reference',
    sourceSha256: hashes.sleeve,
    entries: [
      { supplier: '동인', family: null, finish: '민무늬', number: 34, colorName: '회색', candidates: [{ label: '동인 민무늬 회색 34번', rgb: [120, 120, 120] }] },
      { supplier: null, family: '니플레자', finish: null, number: 1, colorName: '', candidates: [{ label: '니플레자 1번', rgb: [250, 250, 250] }] },
      { supplier: null, family: '니플레자', finish: null, number: 4, colorName: '', candidates: [{ label: '니플레자 4번', rgb: [5, 5, 5] }] },
      { supplier: '화성', family: null, finish: '엠보', number: 3, colorName: '빨강', candidates: [{ label: '화성 3번 엠보 빨강', rgb: [200, 0, 0] }] },
    ],
  });
}

function fullRegistry(currentRgb = [200, 20, 20], legacyRgb = [20, 20, 180], legacyOptions = {}) {
  return registryFromCatalogs([
    bodyCatalog('current-body', currentRgb),
    bodyCatalog('legacy-body', legacyRgb, legacyOptions),
    sleeveCatalog(),
  ]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function writeSyntheticProofPng(filePath) {
  const width = 500;
  const height = 500;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const rgb = x / width < 0.43
        ? [200, 20, 20]
        : x / width < 0.52 ? [120, 120, 120] : [255, 255, 255];
      const offset = row + 1 + x * 3;
      raw[offset] = rgb[0];
      raw[offset + 1] = rgb[1];
      raw[offset + 2] = rgb[2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

function runCase(name) {
  if (name === 'current') {
    return evaluateBodyMaterial([200, 20, 20], parseBodySpecification('TR하이미어 / 빨강 (10번)'), fullRegistry());
  }
  if (name === 'legacy') {
    const observation = {
      fullArtworkBounds: [0, 100, 100, 0],
      texts: [{ contents: 'TR10번 : 1414B4', bounds: [40, 55, 60, 45] }],
      paths: [{ filled: true, bounds: [25, 75, 75, 25] }],
    };
    const image = {};
    const legacy = buildIrregularCatalog({
      observation,
      image,
      catalogId: 'legacy-body',
      role: 'legacy-body',
      generation: 'legacy',
      sourceSha256: hashes.legacy,
      samplePatch: () => [20, 20, 180],
    });
    const registry = registryFromCatalogs([bodyCatalog('current-body', [200, 20, 20]), legacy, sleeveCatalog()]);
    return { catalog: legacy, decision: evaluateBodyMaterial([20, 20, 180], parseBodySpecification('TR하이미어 / 네이비 (10번)'), registry) };
  }
  if (name === 'explicit-mismatch') {
    return evaluateBodyMaterial([20, 20, 180], parseBodySpecification('현행 TR하이미어 / 네이비 (10번)'), fullRegistry());
  }
  if (name === 'cross-generation') {
    return evaluateBodyMaterial([102, 30, 30], parseBodySpecification('TR하이미어 / 빨강 (10번)'), fullRegistry([100, 30, 30], [104, 30, 30]));
  }
  if (name === 'other-number') {
    const current = createCatalog({
      catalogId: 'current-body',
      role: 'current-body',
      generation: 'current',
      sourceSha256: hashes.current,
      entries: [
        { material: 'TR하이미어', number: 10, candidates: [{ label: 'TR 10번', rgb: [115, 0, 0] }] },
        { material: 'TR하이미어', number: 11, candidates: [{ label: 'TR 11번', rgb: [100, 0, 0] }] },
      ],
    });
    return evaluateBodyMaterial(
      [100, 0, 0],
      parseBodySpecification('TR하이미어 / 빨강 (10번)'),
      registryFromCatalogs([current]),
    );
  }
  if (name === 'duplicate-legacy') {
    const registry = fullRegistry([200, 20, 20], [20, 20, 180], {
      referenceState: 'ambiguous',
      candidates: [
        { label: 'TR10번 : 1414B4', rgb: [20, 20, 180], explicitHex: '#1414B4' },
        { label: 'TR10번', rgb: [20, 180, 20] },
      ],
    });
    return evaluateBodyMaterial([20, 20, 180], parseBodySpecification('TR하이미어 / 네이비 (10번)'), registry);
  }
  if (name === 'sleeve-exact') {
    const specification = parseSleeveSpecification('동인 민무늬 회색 34번');
    return { specification, decision: evaluateSleeveMaterial([120, 120, 120], specification, fullRegistry()) };
  }
  if (name === 'sleeve-generic') {
    const whiteSpec = parseSleeveSpecification('니플 레자 / 흰색');
    const blackSpec = parseSleeveSpecification('니플레자 검정');
    return {
      white: evaluateSleeveMaterial([250, 250, 250], whiteSpec, fullRegistry()),
      black: evaluateSleeveMaterial([5, 5, 5], blackSpec, fullRegistry()),
    };
  }
  if (name === 'sleeve-unregistered') {
    const missingSpec = parseSleeveSpecification('미등록레자 보라색 77번');
    const conflictingSpec = parseSleeveSpecification('동인 민무늬 회색 99번');
    return {
      missing: evaluateSleeveMaterial([80, 30, 100], missingSpec, fullRegistry()),
      conflicting: evaluateSleeveMaterial([200, 0, 0], conflictingSpec, fullRegistry()),
    };
  }
  if (name === 'registry') {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'campuslook-material-registry-'));
    try {
      const catalogs = fullRegistry().catalogs;
      const references = catalogs.map((catalog, index) => {
        const relative = `catalog-${index}.json`;
        fs.writeFileSync(path.join(temporary, relative), JSON.stringify(catalog));
        return {
          role: catalog.role,
          catalogId: catalog.catalogId,
          sourceSha256: catalog.source.sha256,
          path: relative,
        };
      });
      const registryPath = path.join(temporary, 'registry.json');
      fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: REGISTRY_SCHEMA, requireFull: true, catalogs: references }));
      const first = loadCatalogRegistry(registryPath);
      const firstMtime = fs.statSync(references.map((entry) => path.join(temporary, entry.path))[0]).mtimeMs;
      const second = loadCatalogRegistry(registryPath);
      const secondMtime = fs.statSync(references.map((entry) => path.join(temporary, entry.path))[0]).mtimeMs;
      const missingRegistry = { schemaVersion: REGISTRY_SCHEMA, requireFull: true, catalogs: references.slice(0, 1) };
      fs.writeFileSync(registryPath, JSON.stringify(missingRegistry));
      let missingRejected = false;
      try { loadCatalogRegistry(registryPath); } catch (error) { missingRejected = /필수 role 누락/.test(error.message); }
      fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: REGISTRY_SCHEMA, requireFull: true, catalogs: references }));
      const tampered = JSON.parse(fs.readFileSync(path.join(temporary, references[1].path), 'utf8'));
      tampered.source.sha256 = 'd'.repeat(64);
      fs.writeFileSync(path.join(temporary, references[1].path), JSON.stringify(tampered));
      let driftRejected = false;
      try { loadCatalogRegistry(registryPath); } catch (error) { driftRejected = /source hash 불일치/.test(error.message); }
      return {
        coverage: first.coverage,
        roles: first.catalogs.map((catalog) => catalog.role),
        warmReadStable: second.coverage === 'full' && firstMtime === secondMtime,
        missingRejected,
        driftRejected,
      };
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  if (name === 'analyzer') {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'campuslook-material-analyzer-'));
    try {
      const registry = fullRegistry();
      const references = registry.catalogs.map((catalog, index) => {
        const relative = `catalog-${index}.json`;
        fs.writeFileSync(path.join(temporary, relative), JSON.stringify(catalog));
        return { role: catalog.role, catalogId: catalog.catalogId, sourceSha256: catalog.source.sha256, path: relative };
      });
      const registryPath = path.join(temporary, 'registry.json');
      fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: REGISTRY_SCHEMA, requireFull: true, catalogs: references }));
      writeSyntheticProofPng(path.join(temporary, 'artboard-0.png'));
      const text = (contents, x, y) => ({ artboardIndex: 0, normalized: { x, y }, contents });
      const inspection = {
        document: { name: 'synthetic-proof.ai' },
        artboards: [{ index: 0, name: 'synthetic', render: 'artboard-0.png' }],
        texts: [
          text('테스트 고객', 0.10, 0.60),
          text('캠퍼스룩 야구점퍼', 0.40, 0.60),
          text('TR하이미어 / 빨강 (10번)', 0.10, 0.64),
          text('2 by 2 시보리', 0.40, 0.64),
          text('4온스 퀄팅', 0.10, 0.68),
          text('빨강 단추 7개', 0.40, 0.68),
          text('동인 민무늬 회색 34번', 0.10, 0.72),
          text('쌍입술주머니', 0.40, 0.72),
        ],
      };
      const inspectionPath = path.join(temporary, 'document.json');
      const output = path.join(temporary, 'result');
      fs.writeFileSync(inspectionPath, JSON.stringify(inspection));
      const result = spawnSync(process.execPath, [
        path.resolve('analyze-proof.mjs'),
        '--inspection', inspectionPath,
        '--catalog-registry', registryPath,
        '--output', output,
      ], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr || result.stdout);
      const report = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));
      return {
        schemaVersion: report.schemaVersion,
        overallStatus: report.overallStatus,
        coreFields: ['document', 'designCount', 'overallStatus', 'designs', 'performance', 'limitations']
          .every((field) => Object.hasOwn(report, field)),
        coverage: report.catalogProvenance.coverage,
        bodyRole: report.materialCheck.matchedCatalog.role,
        sleeveCode: report.sleeveCheck.decisionCode,
        limitation: report.limitations.materialAuthentication,
        cli: JSON.parse(result.stdout),
      };
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  throw new Error(`unknown case: ${name}`);
}

try {
  console.log(JSON.stringify(runCase(process.argv[2]), null, 2));
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exit(1);
}
