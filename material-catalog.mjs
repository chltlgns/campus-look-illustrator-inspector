import fs from 'node:fs';
import path from 'node:path';

export const CATALOG_SCHEMA_VERSION = 2;
export const REGISTRY_SCHEMA = 'campuslook-material-catalog-registry/v1';
export const CATALOG_ROLES = Object.freeze(['current-body', 'legacy-body', 'sleeve-material']);
export const EXTRACTOR_VERSION = 'campuslook-material-catalog/v2';

export function normalizeMaterialText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F]/g, ' ')
    .replace(/니플\s*레자/gi, '니플레자')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHex(value) {
  const match = String(value ?? '').match(/#?([0-9A-F]{6})(?![0-9A-F])/i);
  return match ? `#${match[1].toUpperCase()}` : null;
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function rgbToLab([red, green, blue]) {
  const linear = [red, green, blue].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047;
  const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883;
  const f = (item) => (item > 0.008856 ? item ** (1 / 3) : 7.787 * item + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function materialDeltaE(rgbA, rgbB) {
  const labA = rgbToLab(rgbA);
  const labB = rgbToLab(rgbB);
  return Math.sqrt(labA.reduce((sum, value, index) => sum + (value - labB[index]) ** 2, 0));
}

function generationFromText(text) {
  if (/(?:구형|옛날|과거|legacy)/i.test(text)) return 'legacy';
  if (/(?:현행|현재|신형|current)/i.test(text)) return 'current';
  return null;
}

export function parseBodySpecification(value) {
  const raw = normalizeMaterialText(value);
  let material = null;
  if (/TR\s*하이미어/i.test(raw)) material = 'TR하이미어';
  else if (/(?:\(고급\)|고급)\s*하이미어/.test(raw)) material = '(고급)하이미어';
  else if (/하이미어/.test(raw)) material = '(고급)하이미어';
  const numberMatch = raw.match(/\(?\s*(\d{1,2})\s*번\s*\)?/);
  const colorPart = raw.split('/').map((part) => part.trim())[1] ?? raw;
  const colorName = colorPart
    .replace(/\(?\s*\d{1,2}\s*번\s*\)?/g, '')
    .replace(/(?:구형|옛날|과거|legacy|현행|현재|신형|current)/gi, '')
    .trim();
  const inferredTrBlack = !numberMatch
    && material === 'TR하이미어'
    && /^(?:검정색?|블랙)$/i.test(colorName);
  return {
    raw,
    material,
    number: numberMatch ? Number(numberMatch[1]) : inferredTrBlack ? 34 : null,
    numberSource: numberMatch ? 'explicit' : inferredTrBlack ? 'inferred-tr-black' : null,
    colorName,
    generation: generationFromText(raw),
    generationSource: generationFromText(raw) ? 'table' : null,
  };
}

const SLEEVE_SUPPLIERS = ['동인', '화성', '신라', '세성'];
const COLOR_WORDS = ['연회색', '회색', '네이비', '카키', '초록', '옥색', '빨강', '흰색', '백색', '화이트', '검정색', '검정', '블랙'];

function normalizedColorName(text) {
  const found = COLOR_WORDS.find((entry) => text.includes(entry));
  if (!found) return '';
  if (['백색', '화이트'].includes(found)) return '흰색';
  if (['검정색', '블랙'].includes(found)) return '검정';
  return found;
}

export function parseSleeveSpecification(value) {
  const raw = normalizeMaterialText(value);
  const supplier = SLEEVE_SUPPLIERS.find((entry) => raw.includes(entry)) ?? null;
  const family = /니플레자/.test(raw)
    ? '니플레자'
    : /(?:인조가죽|합성피혁|레자)/.test(raw) ? '합성피혁' : null;
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  let finish = null;
  if (compact.includes('양피민무늬')) finish = '양피 민무늬';
  else if (compact.includes('습식') && compact.includes('민무늬')) finish = '습식 민무늬';
  else if (compact.includes('노말PU')) finish = '노말 PU';
  else if (compact.includes('습식')) finish = '습식';
  else if (compact.includes('엠보')) finish = '엠보';
  else if (compact.includes('민무늬')) finish = '민무늬';
  else if (compact.includes('양피')) finish = '양피';
  else if (compact.includes('PU')) finish = 'PU';
  const numberMatch = raw.match(/(?:^|\D)(\d{1,2})\s*번?(?:\D|$)/)
    ?? raw.match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
  const colorName = normalizedColorName(raw);
  return {
    raw,
    supplier,
    family,
    finish,
    number: numberMatch ? Number(numberMatch[1]) : null,
    colorName,
    specificity: supplier || numberMatch || finish ? 'exact' : family && colorName ? 'generic' : 'unknown',
  };
}

function validateRgb(rgb, label) {
  if (!Array.isArray(rgb) || rgb.length !== 3 || rgb.some((value) => !Number.isFinite(Number(value)))) {
    throw new Error(`palette_registry_invalid: RGB가 올바르지 않습니다: ${label}`);
  }
  return rgb.map((value) => Math.max(0, Math.min(255, Number(value))));
}

function catalogEntryKey(entry, role) {
  if (role === 'sleeve-material') {
    return [entry.supplier ?? '', entry.family ?? '', entry.finish ?? '', entry.number ?? '', entry.colorName ?? ''].join('|');
  }
  return `${entry.material}:${entry.number}`;
}

export function createCatalog({ catalogId, role, generation, sourceSha256, entries, sourceDisplayName = '' }) {
  if (!CATALOG_ROLES.includes(role)) throw new Error(`palette_registry_invalid: 알 수 없는 role ${role}`);
  if (!/^[0-9a-f]{64}$/i.test(sourceSha256 ?? '')) {
    throw new Error('palette_registry_invalid: source SHA-256이 올바르지 않습니다.');
  }
  const normalizedEntries = entries.map((entry, entryIndex) => {
    const candidates = (entry.candidates ?? []).map((candidate, candidateIndex) => {
      const rgb = validateRgb(candidate.rgb, `${entryIndex}/${candidateIndex}`);
      return {
        id: candidate.id ?? `candidate-${candidateIndex + 1}`,
        label: normalizeMaterialText(candidate.label),
        rgb,
        hex: normalizeHex(candidate.hex) ?? rgbToHex(rgb),
        explicitHex: normalizeHex(candidate.explicitHex),
        evidence: candidate.evidence ?? null,
      };
    });
    if (!candidates.length) throw new Error(`palette_registry_invalid: candidate가 비어 있습니다: ${entryIndex}`);
    const normalized = {
      ...entry,
      candidates,
      referenceState: entry.referenceState ?? (candidates.length === 1 ? 'single' : 'ambiguous'),
    };
    normalized.key = entry.key ?? catalogEntryKey(normalized, role);
    return normalized;
  });
  const duplicateKeys = normalizedEntries
    .filter((entry) => entry.referenceState !== 'single')
    .map((entry) => entry.key);
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    catalogId,
    role,
    generation,
    extractorVersion: EXTRACTOR_VERSION,
    source: {
      sha256: sourceSha256.toLowerCase(),
      displayName: path.basename(sourceDisplayName || `${role}.ai`),
    },
    referenceState: {
      status: duplicateKeys.length ? 'ambiguous' : 'complete',
      duplicateKeys,
      missingNumbers: [],
    },
    entries: normalizedEntries,
  };
}

function isInside(bounds, x, y) {
  if (!Array.isArray(bounds) || bounds.length !== 4) return false;
  const [left, top, right, bottom] = bounds.map(Number);
  return x >= left && x <= right && y <= top && y >= bottom;
}

function boundsArea(bounds) {
  return Math.abs((Number(bounds[2]) - Number(bounds[0])) * (Number(bounds[1]) - Number(bounds[3])));
}

function bodyLabel(text) {
  const normalized = normalizeMaterialText(text);
  const number = normalized.match(/TR[^0-9]*(\d{1,2})(?:\s*번)?/i)?.[1];
  if (!number) return null;
  return {
    material: 'TR하이미어',
    number: Number(number),
    explicitHex: normalizeHex(normalized.split(':')[1] ?? ''),
  };
}

function sleeveLabel(text) {
  const parsed = parseSleeveSpecification(text);
  if (!parsed.supplier && !parsed.family) return null;
  if (!parsed.number && !parsed.colorName) return null;
  return parsed;
}

export function buildIrregularCatalog({
  observation,
  image,
  catalogId,
  role,
  generation,
  sourceSha256,
  sourceDisplayName = '',
  samplePatch,
}) {
  if (!['legacy-body', 'sleeve-material'].includes(role)) {
    throw new Error(`palette_registry_invalid: irregular role ${role}`);
  }
  const fullBounds = observation.fullArtworkBounds;
  if (!Array.isArray(fullBounds) || fullBounds.length !== 4) {
    throw new Error('palette_registry_invalid: fullArtworkBounds가 없습니다.');
  }
  const paths = (observation.paths ?? [])
    .filter((item) => item.filled === true && Array.isArray(item.bounds));
  const grouped = new Map();
  const unmatchedLabels = [];
  for (const text of observation.texts ?? []) {
    const parsed = role === 'legacy-body' ? bodyLabel(text.contents) : sleeveLabel(text.contents);
    if (!parsed || !Array.isArray(text.bounds)) continue;
    const centerX = (Number(text.bounds[0]) + Number(text.bounds[2])) / 2;
    const centerY = (Number(text.bounds[1]) + Number(text.bounds[3])) / 2;
    const containing = paths
      .filter((item) => isInside(item.bounds, centerX, centerY))
      .sort((left, right) => boundsArea(left.bounds) - boundsArea(right.bounds));
    if (!containing.length) {
      unmatchedLabels.push(normalizeMaterialText(text.contents));
      continue;
    }
    const matchedPath = containing[0];
    const pathCenterX = (Number(matchedPath.bounds[0]) + Number(matchedPath.bounds[2])) / 2;
    const pathCenterY = (Number(matchedPath.bounds[1]) + Number(matchedPath.bounds[3])) / 2;
    const normalizedX = (pathCenterX - Number(fullBounds[0])) / (Number(fullBounds[2]) - Number(fullBounds[0]));
    const normalizedY = (Number(fullBounds[1]) - pathCenterY) / (Number(fullBounds[1]) - Number(fullBounds[3]));
    const rgb = samplePatch(image, normalizedX, normalizedY, 0.006, 0.006);
    const entryBase = role === 'legacy-body'
      ? { material: parsed.material, number: parsed.number }
      : {
          supplier: parsed.supplier,
          family: parsed.family,
          finish: parsed.finish,
          number: parsed.number,
          colorName: parsed.colorName,
        };
    const key = catalogEntryKey(entryBase, role);
    if (!grouped.has(key)) grouped.set(key, { ...entryBase, key, candidates: [] });
    grouped.get(key).candidates.push({
      label: text.contents,
      rgb,
      hex: rgbToHex(rgb),
      explicitHex: parsed.explicitHex ?? null,
      evidence: {
        rule: 'vector-label-containment/rendered-center',
        labelCenter: [centerX, centerY],
        swatchBounds: matchedPath.bounds.map(Number),
      },
    });
  }
  const catalog = createCatalog({
    catalogId,
    role,
    generation,
    sourceSha256,
    sourceDisplayName,
    entries: [...grouped.values()],
  });
  catalog.extractionRule = 'filled vector path containing label center; Illustrator-rendered swatch center median';
  catalog.referenceState.unmatchedLabels = unmatchedLabels;
  if (role === 'legacy-body') {
    const numbers = new Set(catalog.entries.map((entry) => entry.number));
    const maximum = Math.max(0, ...numbers);
    catalog.referenceState.missingNumbers = Array.from({ length: maximum }, (_, index) => index + 1)
      .filter((number) => !numbers.has(number));
    if (catalog.referenceState.missingNumbers.length) catalog.referenceState.status = 'ambiguous';
  }
  return catalog;
}

function validateCatalog(catalog, expected = {}) {
  if (catalog?.schemaVersion !== CATALOG_SCHEMA_VERSION || !CATALOG_ROLES.includes(catalog?.role)) {
    throw new Error('palette_registry_invalid: catalog schema 또는 role이 올바르지 않습니다.');
  }
  if (!catalog.catalogId || !Array.isArray(catalog.entries) || !catalog.entries.length) {
    throw new Error('palette_registry_invalid: catalog identity 또는 entries가 비어 있습니다.');
  }
  if (!/^[0-9a-f]{64}$/.test(catalog.source?.sha256 ?? '')) {
    throw new Error('palette_registry_invalid: catalog source hash가 올바르지 않습니다.');
  }
  if (expected.role && catalog.role !== expected.role) throw new Error('palette_registry_invalid: role 불일치');
  if (expected.catalogId && catalog.catalogId !== expected.catalogId) throw new Error('palette_registry_invalid: catalogId 불일치');
  if (expected.sourceSha256 && catalog.source.sha256 !== expected.sourceSha256.toLowerCase()) {
    throw new Error('palette_registry_invalid: source hash 불일치');
  }
  for (const entry of catalog.entries) {
    if (!Array.isArray(entry.candidates) || !entry.candidates.length) {
      throw new Error('palette_registry_invalid: 빈 candidate entry');
    }
    entry.candidates.forEach((candidate) => validateRgb(candidate.rgb, entry.key));
  }
  return catalog;
}

export function loadCatalogRegistry(registryPath) {
  const resolved = path.resolve(registryPath);
  const registry = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (registry.schemaVersion !== REGISTRY_SCHEMA || !Array.isArray(registry.catalogs)) {
    throw new Error('palette_registry_invalid: registry schema가 올바르지 않습니다.');
  }
  const roles = new Set();
  const catalogs = registry.catalogs.map((reference) => {
    if (roles.has(reference.role)) throw new Error(`palette_registry_invalid: role 중복 ${reference.role}`);
    roles.add(reference.role);
    const catalogPath = path.resolve(path.dirname(resolved), reference.path);
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    return validateCatalog(catalog, reference);
  });
  if (!roles.has('current-body')) throw new Error('palette_registry_invalid: current-body 누락');
  const coverage = roles.has('legacy-body') && roles.has('sleeve-material') ? 'full' : 'current-only';
  if (registry.requireFull === true && coverage !== 'full') {
    throw new Error('palette_registry_invalid: installed mode의 필수 role 누락');
  }
  return { schemaVersion: REGISTRY_SCHEMA, coverage, catalogs };
}

export function registryFromCatalogs(catalogs, coverage = null) {
  catalogs.forEach((catalog) => validateCatalog(catalog));
  return {
    schemaVersion: REGISTRY_SCHEMA,
    coverage: coverage ?? (catalogs.length === 3 ? 'full' : 'current-only'),
    catalogs,
  };
}

function catalogCandidate(catalog, entry, candidate, observedRgb) {
  return {
    catalogId: catalog.catalogId,
    role: catalog.role,
    generation: catalog.generation,
    sourceSha256: catalog.source.sha256,
    key: entry.key,
    material: entry.material ?? null,
    supplier: entry.supplier ?? null,
    family: entry.family ?? null,
    finish: entry.finish ?? null,
    number: entry.number ?? null,
    colorName: entry.colorName ?? '',
    referenceState: entry.referenceState,
    rgb: candidate.rgb,
    hex: candidate.hex ?? rgbToHex(candidate.rgb),
    explicitHex: candidate.explicitHex ?? null,
    label: candidate.label ?? '',
    deltaE: Number(materialDeltaE(observedRgb, candidate.rgb).toFixed(2)),
  };
}

function bodyCandidates(registry, observedRgb, filter = () => true) {
  return registry.catalogs
    .filter((catalog) => ['current-body', 'legacy-body'].includes(catalog.role))
    .flatMap((catalog) => catalog.entries.flatMap((entry) => (
      filter(catalog, entry)
        ? entry.candidates.map((candidate) => catalogCandidate(catalog, entry, candidate, observedRgb))
        : []
    )))
    .sort((left, right) => left.deltaE - right.deltaE);
}

function publicCandidate(candidate) {
  if (!candidate) return null;
  return { ...candidate, sourceSha256: candidate.sourceSha256.slice(0, 12) };
}

export function evaluateBodyMaterial(observedRgb, specification, registry) {
  const sameKey = bodyCandidates(
    registry,
    observedRgb,
    (_catalog, entry) => entry.material === specification.material && entry.number === specification.number,
  );
  const all = bodyCandidates(registry, observedRgb);
  const nearest = all.slice(0, 5).map(publicCandidate);
  const base = {
    expected: null,
    nearest,
    candidates: sameKey.map(publicCandidate),
    matchedCatalog: null,
  };
  if (!specification.material || !specification.number) {
    return { ...base, status: 'REVIEW', decisionCode: 'body_specification_incomplete', reason: '표에서 원단 종류 또는 색상번호를 추출하지 못했습니다.' };
  }
  const requestedGeneration = specification.generation;
  const allowed = requestedGeneration
    ? sameKey.filter((candidate) => candidate.generation === requestedGeneration)
    : sameKey;
  const otherGeneration = requestedGeneration
    ? sameKey.filter((candidate) => candidate.generation !== requestedGeneration)
    : [];
  const allowedStrong = allowed.filter((candidate) => candidate.deltaE <= 12);
  const otherStrong = otherGeneration.filter((candidate) => candidate.deltaE <= 12);
  const globalDifferentStrong = all.find((candidate) => (
    candidate.deltaE <= 5
    && (candidate.material !== specification.material || candidate.number !== specification.number)
  ));

  if (requestedGeneration && !allowedStrong.length && otherStrong.length) {
    return {
      ...base,
      status: 'FAIL',
      decisionCode: 'generation_mismatch',
      matchedCatalog: publicCandidate(otherStrong[0]),
      reason: `표에 ${requestedGeneration} 세대가 명시됐지만 다른 세대 catalog만 강하게 일치합니다.`,
    };
  }
  if (!allowed.length) {
    return {
      ...base,
      status: requestedGeneration ? 'FAIL' : 'REVIEW',
      decisionCode: requestedGeneration ? 'body_reference_missing' : 'body_reference_missing_review',
      reason: '승인 catalog에서 표에 적힌 원단·색상번호 후보를 찾지 못했습니다.',
    };
  }
  if (!allowedStrong.length) {
    const matched = globalDifferentStrong ? publicCandidate(globalDifferentStrong) : null;
    return {
      ...base,
      status: 'FAIL',
      decisionCode: globalDifferentStrong ? 'body_other_number_match' : 'body_no_approved_match',
      matchedCatalog: matched,
      reason: globalDifferentStrong
        ? `시안 몸통색이 표기 번호보다 ${globalDifferentStrong.material} ${globalDifferentStrong.number}번에 명확히 가깝습니다.`
        : '시안 몸통색이 어느 승인된 같은 번호 후보에도 허용 범위로 일치하지 않습니다.',
    };
  }
  if (globalDifferentStrong && allowedStrong[0].deltaE - globalDifferentStrong.deltaE >= 5) {
    return {
      ...base,
      status: 'FAIL',
      decisionCode: 'body_other_number_match',
      matchedCatalog: publicCandidate(globalDifferentStrong),
      reason: `같은 번호 후보도 근접하지만 시안 몸통색은 ${globalDifferentStrong.material} ${globalDifferentStrong.number}번에 명확히 더 가깝습니다.`,
    };
  }
  const strongCatalogs = new Set(allowedStrong.map((candidate) => candidate.catalogId));
  if (!requestedGeneration && strongCatalogs.size > 1) {
    return {
      ...base,
      status: 'REVIEW',
      decisionCode: 'cross_generation_ambiguous',
      reason: '현행·구형 같은 번호 후보가 모두 가까워 세대를 자동 확정할 수 없습니다.',
    };
  }
  const best = allowedStrong[0];
  const conflictingReference = allowed.some((candidate) => (
    candidate.catalogId === best.catalogId && candidate.referenceState !== 'single'
  ));
  if (conflictingReference) {
    return {
      ...base,
      status: 'REVIEW',
      decisionCode: 'body_reference_ambiguous',
      matchedCatalog: publicCandidate(best),
      expected: publicCandidate(best),
      reason: '같은 catalog key에 복수 reference 후보가 있어 자동으로 하나를 선택하지 않습니다.',
    };
  }
  const bestAlternative = allowed.find((candidate) => candidate !== best);
  if (bestAlternative && bestAlternative.deltaE - best.deltaE < 3) {
    return {
      ...base,
      status: 'REVIEW',
      decisionCode: 'body_candidate_margin_small',
      matchedCatalog: publicCandidate(best),
      expected: publicCandidate(best),
      reason: '허용 후보 사이 색차 margin이 작아 사람 확인이 필요합니다.',
    };
  }
  const match = publicCandidate(best);
  return {
    ...base,
    status: 'PASS',
    decisionCode: requestedGeneration ? 'explicit_generation_match' : 'single_catalog_match',
    matchedCatalog: match,
    expected: match,
    reason: `${best.generation === 'legacy' ? '구형' : '현행'} catalog의 표기 원단·번호와 시안 몸통색이 강하게 일치합니다.`,
  };
}

function sleeveCandidates(registry, observedRgb, filter = () => true) {
  return registry.catalogs
    .filter((catalog) => catalog.role === 'sleeve-material')
    .flatMap((catalog) => catalog.entries.flatMap((entry) => (
      filter(entry)
        ? entry.candidates.map((candidate) => catalogCandidate(catalog, entry, candidate, observedRgb))
        : []
    )))
    .sort((left, right) => left.deltaE - right.deltaE);
}

export function evaluateSleeveMaterial(observedRgb, specification, registry) {
  const all = sleeveCandidates(registry, observedRgb);
  const genericColorRgb = specification.colorName === '흰색'
    ? [255, 255, 255]
    : specification.colorName === '검정' ? [0, 0, 0] : null;
  let expected = [];
  if (specification.specificity === 'exact') {
    expected = sleeveCandidates(registry, observedRgb, (entry) => (
      (!specification.supplier || entry.supplier === specification.supplier)
      && (!specification.family || entry.family === specification.family)
      && (!specification.finish || (entry.finish && (
        entry.finish === specification.finish
        || entry.finish.includes(specification.finish)
        || specification.finish.includes(entry.finish)
      )))
      && (!specification.number || entry.number === specification.number)
      && (!specification.colorName || !entry.colorName || entry.colorName === specification.colorName)
    ));
  } else if (specification.family && genericColorRgb) {
    expected = sleeveCandidates(registry, observedRgb, (entry) => (
      entry.family === specification.family
      && (!entry.colorName || entry.colorName === specification.colorName)
    ));
  }
  if (specification.specificity === 'generic' && specification.family === '니플레자' && genericColorRgb) {
    expected.push({
      catalogId: 'generic-nippleather-compatibility',
      role: 'sleeve-material',
      generation: 'compatibility',
      sourceSha256: 'compatibility',
      key: `니플레자|${specification.colorName}`,
      material: null,
      supplier: null,
      family: '니플레자',
      finish: null,
      number: null,
      colorName: specification.colorName,
      referenceState: 'single',
      rgb: genericColorRgb,
      hex: rgbToHex(genericColorRgb),
      explicitHex: null,
      label: `니플레자 ${specification.colorName} 호환 기준`,
      deltaE: Number(materialDeltaE(observedRgb, genericColorRgb).toFixed(2)),
    });
  }
  const nearest = all.slice(0, 5).map(publicCandidate);
  const base = {
    specification,
    expected: expected.map(publicCandidate),
    nearest,
    candidates: expected.map(publicCandidate),
    matchedCatalog: null,
    limitation: '디자인의 소매 사양표와 렌더 대표색을 대조하며 실제 봉제품의 조성·촉감·무늬·공급처 진품을 인증하지 않습니다.',
  };
  if (!specification.family && !specification.supplier) {
    return { ...base, status: 'REVIEW', decisionCode: 'sleeve_specification_incomplete', reason: '소매 원단 family 또는 공급처를 읽지 못했습니다.' };
  }
  if (!expected.length) {
    const other = all.find((candidate) => candidate.deltaE <= 5);
    return {
      ...base,
      status: other ? 'FAIL' : 'REVIEW',
      decisionCode: other ? 'sleeve_other_reference_match' : 'sleeve_reference_missing',
      matchedCatalog: other ? publicCandidate(other) : null,
      reason: other
        ? '표의 구체 소매 key는 미등록인데 시안색은 다른 등록 key에 명확히 일치합니다.'
        : '등록 catalog에서 표의 구체 소매 key를 찾지 못해 사람 확인이 필요합니다.',
    };
  }
  const strong = expected.filter((candidate) => candidate.deltaE <= 12);
  if (!strong.length) {
    const other = all.find((candidate) => candidate.deltaE <= 5 && !expected.includes(candidate));
    return {
      ...base,
      status: 'FAIL',
      decisionCode: other ? 'sleeve_other_reference_match' : 'sleeve_color_mismatch',
      matchedCatalog: other ? publicCandidate(other) : null,
      reason: other
        ? '시안 소매색이 표기 key보다 다른 등록 소매 key에 명확히 가깝습니다.'
        : '시안 소매 대표색이 표기된 승인 후보와 허용 범위로 일치하지 않습니다.',
    };
  }
  const best = strong[0];
  const conflicting = specification.specificity === 'exact'
    && strong.length > 1
    && strong[1].deltaE - best.deltaE < 3;
  if (best.referenceState !== 'single' || conflicting) {
    return {
      ...base,
      status: 'REVIEW',
      decisionCode: 'sleeve_reference_ambiguous',
      matchedCatalog: publicCandidate(best),
      reason: '복수 소매 reference 후보가 비슷해 자동으로 하나를 확정하지 않습니다.',
    };
  }
  return {
    ...base,
    status: 'PASS',
    decisionCode: specification.specificity === 'generic' ? 'sleeve_generic_family_match' : 'sleeve_exact_key_match',
    matchedCatalog: publicCandidate(best),
    reason: '시안의 소매 사양 key와 렌더 대표색이 승인 catalog 후보에 일치합니다.',
  };
}

export function catalogProvenance(registry) {
  return {
    coverage: registry.coverage,
    catalogs: registry.catalogs.map((catalog) => ({
      catalogId: catalog.catalogId,
      role: catalog.role,
      generation: catalog.generation,
      sourceSha256: catalog.source.sha256,
      extractorVersion: catalog.extractorVersion,
      referenceState: catalog.referenceState,
      entryCount: catalog.entries.length,
    })),
  };
}
