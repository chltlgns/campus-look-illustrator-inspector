#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {
  buildIrregularCatalog,
  catalogProvenance,
  createCatalog,
  evaluateBodyMaterial,
  evaluateSleeveMaterial,
  loadCatalogRegistry,
  parseBodySpecification,
  parseSleeveSpecification,
  registryFromCatalogs,
} from './material-catalog.mjs';

function usage() {
  console.error('사용법: node analyze-proof.mjs --inspection <document.json> (--catalog-registry <registry.json> | --palette <current.png|json>) --output <폴더>');
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      usage();
      process.exit(2);
    }
    args[key.slice(2)] = value;
  }
  if (args['palette-output']) {
    if (!args.palette) {
      usage();
      process.exit(2);
    }
    return args;
  }
  if (!args.palette && !args['catalog-registry']) {
    usage();
    process.exit(2);
  }
  for (const required of ['inspection', 'output']) {
    if (!args[required]) {
      usage();
      process.exit(2);
    }
  }
  return args;
}

function readPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) {
    throw new Error(`PNG 파일이 아닙니다: ${filePath}`);
  }

  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || interlace !== 0 || ![0, 2, 4, 6].includes(colorType)) {
    throw new Error(`지원하지 않는 PNG 형식입니다: bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const bytesPerPixel = channels;
  const stride = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * channels);
  let sourceOffset = 0;

  function paeth(a, b, c) {
    const prediction = a + b - c;
    const distanceA = Math.abs(prediction - a);
    const distanceB = Math.abs(prediction - b);
    const distanceC = Math.abs(prediction - c);
    if (distanceA <= distanceB && distanceA <= distanceC) return a;
    if (distanceB <= distanceC) return b;
    return c;
  }

  for (let row = 0; row < height; row += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowOffset = row * stride;
    const previousOffset = (row - 1) * stride;
    for (let column = 0; column < stride; column += 1) {
      const raw = inflated[sourceOffset + column];
      const left = column >= bytesPerPixel ? pixels[rowOffset + column - bytesPerPixel] : 0;
      const up = row > 0 ? pixels[previousOffset + column] : 0;
      const upLeft = row > 0 && column >= bytesPerPixel
        ? pixels[previousOffset + column - bytesPerPixel]
        : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = (raw + left) & 255;
      else if (filter === 2) value = (raw + up) & 255;
      else if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (raw + paeth(left, up, upLeft)) & 255;
      else throw new Error(`알 수 없는 PNG 필터입니다: ${filter}`);
      pixels[rowOffset + column] = value;
    }
    sourceOffset += stride;
  }

  function rgbAt(x, y) {
    const clampedX = Math.max(0, Math.min(width - 1, Math.round(x)));
    const clampedY = Math.max(0, Math.min(height - 1, Math.round(y)));
    const pixelOffset = (clampedY * width + clampedX) * channels;
    if (colorType === 0 || colorType === 4) {
      const gray = pixels[pixelOffset];
      return [gray, gray, gray];
    }
    return [pixels[pixelOffset], pixels[pixelOffset + 1], pixels[pixelOffset + 2]];
  }

  return { width, height, rgbAt };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function samplePatch(image, normalizedX, normalizedY, radiusX = 0.018, radiusY = 0.008) {
  const centerX = normalizedX * image.width;
  const centerY = normalizedY * image.height;
  const xRadius = Math.max(2, Math.round(radiusX * image.width));
  const yRadius = Math.max(2, Math.round(radiusY * image.height));
  const red = [];
  const green = [];
  const blue = [];
  for (let y = centerY - yRadius; y <= centerY + yRadius; y += 1) {
    for (let x = centerX - xRadius; x <= centerX + xRadius; x += 1) {
      const [r, g, b] = image.rgbAt(x, y);
      red.push(r);
      green.push(g);
      blue.push(b);
    }
  }
  return [median(red), median(green), median(blue)];
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
  const f = (value) => (value > 0.008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(rgbA, rgbB) {
  const labA = rgbToLab(rgbA);
  const labB = rgbToLab(rgbB);
  return Math.sqrt(labA.reduce((sum, value, index) => sum + (value - labB[index]) ** 2, 0));
}

function buildPalette(image) {
  // 각 색상칩의 왼쪽은 실제 원단 질감 사진이고, 오른쪽은 Illustrator에서
  // 사용할 평면 대표색이다. 색상 대조에는 오른쪽 절반의 중앙만 사용한다.
  const flatColorXCenters = [83, 171, 259, 348, 436, 524].map((value) => value / 576);
  const definitions = [
    {
      material: 'TR하이미어',
      count: 53,
      yCenters: [345, 457, 569, 681, 793, 905, 1017, 1129, 1241].map((value) => value / 2789),
    },
    {
      material: '(고급)하이미어',
      count: 57,
      yCenters: [1529, 1641, 1753, 1865, 1977, 2089, 2201, 2313, 2425, 2537].map((value) => value / 2789),
    },
  ];

  const entries = [];
  for (const definition of definitions) {
    let number = 1;
    for (const y of definition.yCenters) {
      for (const x of flatColorXCenters) {
        if (number > definition.count) break;
        const rgb = samplePatch(image, x, y, 0.010, 0.0075);
        entries.push({
          material: definition.material,
          number,
          rgb,
          hex: rgbToHex(rgb),
        });
        number += 1;
      }
    }
  }
  return entries;
}

function loadPalette(filePath) {
  if (path.extname(filePath).toLowerCase() === '.json') {
    const reference = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const palette = [];
    for (const [material, details] of Object.entries(reference.materials ?? {})) {
      for (const color of details.colors ?? []) {
        palette.push({
          material,
          number: Number(color.number),
          rgb: color.rgb.map(Number),
          hex: color.hex || rgbToHex(color.rgb.map(Number)),
        });
      }
    }
    if (!palette.length) throw new Error(`컬러판 캐시가 비어 있습니다: ${filePath}`);
    return { palette, reference };
  }

  const image = readPng(filePath);
  const palette = buildPalette(image);
  return { palette, reference: buildPaletteReference(palette, image) };
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function currentCatalogFromPalette(palette, sourceSha256, sourceDisplayName = '') {
  return createCatalog({
    catalogId: 'current-body-tr',
    role: 'current-body',
    generation: 'current',
    sourceSha256,
    sourceDisplayName,
    entries: palette.map((entry) => ({
      material: entry.material,
      number: entry.number,
      candidates: [{
        label: `${entry.material} ${entry.number}번`,
        rgb: entry.rgb,
        hex: entry.hex,
        evidence: { rule: 'current-fixed-grid/right-flat-center' },
      }],
    })),
  });
}

function paletteFromRegistry(registry) {
  return registry.catalogs
    .filter((catalog) => ['current-body', 'legacy-body'].includes(catalog.role))
    .flatMap((catalog) => catalog.entries.flatMap((entry) => entry.candidates.map((candidate) => ({
      material: entry.material,
      number: entry.number,
      rgb: candidate.rgb,
      hex: candidate.hex,
      catalogId: catalog.catalogId,
      role: catalog.role,
    }))));
}

function referenceFromRegistry(registry) {
  return {
    schemaVersion: 2,
    ...catalogProvenance(registry),
  };
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\r\n?|\n/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectProofArtboards(inspection, maximumProofs = 6) {
  const scores = inspection.artboards.map((artboard) => ({
    index: artboard.index,
    score: 0,
    textCount: 0,
  }));
  const weightedKeywords = [
    ['야구점퍼', 8],
    ['하이미어', 6],
    ['니플레자', 4],
    ['쌍입술주머니', 4],
    ['시안 제작', 3],
    ['상담자', 2],
  ];
  for (const text of inspection.texts ?? []) {
    if (!Number.isInteger(text.artboardIndex) || text.artboardIndex < 0) continue;
    const score = scores.find((candidate) => candidate.index === text.artboardIndex);
    if (!score) continue;
    score.textCount += 1;
    const contents = normalizeText(text.contents);
    for (const [keyword, weight] of weightedKeywords) {
      if (contents.includes(keyword)) score.score += weight;
    }
  }
  const candidates = scores
    .filter((candidate) => candidate.score >= 8)
    .sort((a, b) => b.score - a.score || b.textCount - a.textCount || a.index - b.index)
    .slice(0, maximumProofs)
    .sort((a, b) => a.index - b.index);
  if (!candidates.length) {
    throw new Error('하단 사양표가 있는 야구점퍼 시안 대지를 찾지 못했습니다.');
  }
  return candidates;
}

function extractFields(inspection, artboardIndex) {
  const texts = (inspection.texts ?? [])
    .filter((text) => text.artboardIndex === artboardIndex && text.normalized)
    .map((text) => ({
      x: Number(text.normalized.x),
      y: Number(text.normalized.y),
      contents: normalizeText(text.contents),
    }))
    .filter((text) => text.contents && Number.isFinite(text.x) && Number.isFinite(text.y));

  const byPattern = (pattern) => texts.filter((text) => pattern.test(text.contents));
  const nearest = (candidates, score) => candidates
    .map((candidate) => ({ candidate, score: score(candidate) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score || left.candidate.y - right.candidate.y || left.candidate.x - right.candidate.x)[0]?.candidate ?? null;

  const product = nearest(byPattern(/야구점퍼/), (text) => (
    /캠퍼스룩\s*야구점퍼/.test(text.contents) ? text.y : text.y + 0.05
  ));
  const shell = nearest(byPattern(/하이미어/), (text) => {
    if (!product) return text.y;
    if (text.y <= product.y + 0.008 || text.y - product.y > 0.12) return Infinity;
    return (text.y - product.y) + Math.max(0, text.x - product.x) * 2;
  });
  const lining = nearest(byPattern(/퀄팅|온스/), (text) => {
    if (!shell) return text.y;
    if (text.y <= shell.y + 0.008 || text.y - shell.y > 0.09) return Infinity;
    return (text.y - shell.y) + Math.abs(text.x - shell.x) * 0.2;
  });
  let sleeve = nearest(byPattern(/니플레자|인조가죽|합성피혁|천연가죽|레자|동인|화성|신라|세성/), (text) => {
    if (!lining) return text.y;
    if (text.y <= lining.y + 0.008 || text.y - lining.y > 0.09) return Infinity;
    return (text.y - lining.y) + Math.abs(text.x - lining.x) * 0.2;
  });

  const gaps = [
    product && shell ? shell.y - product.y : null,
    shell && lining ? lining.y - shell.y : null,
    lining && sleeve ? sleeve.y - lining.y : null,
  ].filter((gap) => Number.isFinite(gap) && gap >= 0.015 && gap <= 0.08);
  const rowGap = gaps.length ? median(gaps) : 0.04;
  const rowTolerance = Math.max(0.012, Math.min(0.022, rowGap * 0.46));

  const ribAnchor = nearest(byPattern(/2\s*by\s*2|시보리/i), (text) => (
    shell && Math.abs(text.y - shell.y) <= rowTolerance * 1.5
      ? Math.abs(text.y - shell.y)
      : Infinity
  ));
  const pocketAnchor = nearest(byPattern(/주머니/), (text) => (
    sleeve && Math.abs(text.y - sleeve.y) <= rowTolerance * 1.5
      ? Math.abs(text.y - sleeve.y)
      : Infinity
  ));

  const leftXs = [shell, lining, sleeve].filter(Boolean).map((text) => text.x);
  const rightXs = [product, ribAnchor, pocketAnchor].filter(Boolean).map((text) => text.x);
  const leftX = leftXs.length ? median(leftXs) : 0.18;
  const rightX = rightXs.length ? median(rightXs) : 0.4;
  const columnSplit = (leftX + rightX) / 2;
  const excluded = new Set([product, shell, lining, sleeve, ribAnchor, pocketAnchor].filter(Boolean));

  const pickCell = (targetY, side) => nearest(
    texts.filter((text) => (
      !excluded.has(text)
      && Math.abs(text.y - targetY) <= rowTolerance
      && (side === 'left' ? text.x < columnSplit : text.x >= columnSplit)
    )),
    (text) => Math.abs(text.y - targetY) * 10 + Math.abs(text.x - (side === 'left' ? leftX : rightX)),
  );

  if (!sleeve && lining) {
    sleeve = pickCell(lining.y + rowGap, 'left');
    if (sleeve) excluded.add(sleeve);
  }
  const customerRowY = product?.y ?? (shell ? shell.y - rowGap : null);
  const customer = Number.isFinite(customerRowY) ? pickCell(customerRowY, 'left') : null;
  const rib = ribAnchor || (shell ? pickCell(shell.y, 'right') : null);
  const button = lining ? pickCell(lining.y, 'right') : null;
  const pocket = pocketAnchor || (sleeve ? pickCell(sleeve.y, 'right') : null);

  const fields = {
    customer: customer?.contents ?? '',
    product: product?.contents ?? '',
    shell: shell?.contents ?? '',
    rib: rib?.contents ?? '',
    lining: lining?.contents ?? '',
    button: button?.contents ?? '',
    sleeve: sleeve?.contents ?? '',
    pocket: pocket?.contents ?? '',
  };
  return {
    fields,
    extraction: {
      strategy: 'semantic-table-anchors',
      rowGap: Number(rowGap.toFixed(5)),
      rowTolerance: Number(rowTolerance.toFixed(5)),
      columnSplit: Number(columnSplit.toFixed(5)),
      anchorsFound: {
        product: Boolean(product),
        shell: Boolean(shell),
        lining: Boolean(lining),
        sleeve: Boolean(sleeve),
        rib: Boolean(ribAnchor),
        pocket: Boolean(pocketAnchor),
      },
    },
  };
}

function colorDistance(rgbA, rgbB) {
  return Math.sqrt(rgbA.reduce((sum, value, index) => sum + (value - rgbB[index]) ** 2, 0));
}

function normalizeRenderBounds(proofArtboard) {
  const bounds = proofArtboard?.renderBounds;
  if (!bounds) return { left: 0, top: 0, right: 1, bottom: 1 };
  const normalized = {
    left: Number(bounds.left),
    top: Number(bounds.top),
    right: Number(bounds.right),
    bottom: Number(bounds.bottom),
  };
  if (
    !Object.values(normalized).every(Number.isFinite)
    || normalized.right <= normalized.left
    || normalized.bottom <= normalized.top
  ) {
    throw new Error('시안 렌더 범위 정보가 올바르지 않습니다.');
  }
  return normalized;
}

function sampleArtboardPatch(image, renderBounds, x, y, radiusX, radiusY) {
  const width = renderBounds.right - renderBounds.left;
  const height = renderBounds.bottom - renderBounds.top;
  return samplePatch(
    image,
    (x - renderBounds.left) / width,
    (y - renderBounds.top) / height,
    radiusX / width,
    radiusY / height,
  );
}

function dominantBodyColor(image, renderBounds) {
  const points = [
    [0.14, 0.22],
    [0.14, 0.30],
    [0.15, 0.38],
    [0.36, 0.20],
    [0.34, 0.37],
    [0.40, 0.39],
  ];
  const samples = points.map(([x, y]) => ({
    x,
    y,
    rgb: sampleArtboardPatch(image, renderBounds, x, y, 0.004, 0.006),
  }));
  let best = null;
  for (const sample of samples) {
    const members = samples.filter((candidate) => colorDistance(sample.rgb, candidate.rgb) <= 18);
    if (!best || members.length > best.members.length) {
      best = { rgb: sample.rgb, members };
    }
  }
  const rgb = [0, 1, 2].map((channel) => median(best.members.map((member) => member.rgb[channel])));
  return {
    rgb,
    hex: rgbToHex(rgb),
    agreeingSamples: best.members.length,
    totalSamples: samples.length,
    samples: samples.map((sample) => ({ ...sample, hex: rgbToHex(sample.rgb) })),
  };
}

function dominantSleeveColor(image, renderBounds) {
  const points = [
    [0.460, 0.30], [0.465, 0.34], [0.470, 0.38],
    [0.475, 0.30], [0.475, 0.34], [0.480, 0.38],
  ];
  const samples = points.map(([x, y]) => ({
    x,
    y,
    rgb: sampleArtboardPatch(image, renderBounds, x, y, 0.0035, 0.005),
  }));
  let best = null;
  for (const sample of samples) {
    const members = samples.filter((candidate) => colorDistance(sample.rgb, candidate.rgb) <= 18);
    if (!best || members.length > best.members.length) best = { rgb: sample.rgb, members };
  }
  const rgb = [0, 1, 2].map((channel) => median(best.members.map((member) => member.rgb[channel])));
  return {
    rgb,
    hex: rgbToHex(rgb),
    agreeingSamples: best.members.length,
    totalSamples: samples.length,
    samples: samples.map((sample) => ({ ...sample, hex: rgbToHex(sample.rgb) })),
  };
}

function checkTableExtraction(fields) {
  const required = ['customer', 'product', 'shell', 'rib', 'lining', 'button', 'sleeve', 'pocket'];
  const missing = required.filter((key) => !normalizeText(fields[key]));
  return missing.length
    ? { status: 'REVIEW', missing, reason: `표 항목 ${missing.join(', ')}을(를) 읽지 못했습니다.` }
    : { status: 'PASS', missing: [], reason: '표의 8개 필수 항목을 모두 읽었습니다.' };
}

function applyTableAuthority(rawCheck, fieldKey, fieldLabel, fieldValue) {
  const visualComparison = {
    ...rawCheck,
    advisory: true,
    affectsOverallStatus: false,
  };
  const hasTableValue = Boolean(normalizeText(fieldValue));
  const authority = {
    source: 'bottom_specification_table',
    field: fieldKey,
    fieldLabel,
    hasValue: hasTableValue,
    affectsOverallStatus: true,
  };
  if (!hasTableValue) {
    return {
      ...rawCheck,
      status: 'REVIEW',
      decisionCode: 'table_field_missing',
      reason: `하단 사양표의 ${fieldLabel} 항목이 비어 있어 확인이 필요합니다.`,
      authority,
      visualComparison,
    };
  }
  return {
    ...rawCheck,
    status: 'PASS',
    decisionCode: 'table_spec_authoritative',
    reason: `하단 사양표의 ${fieldLabel} 표기를 원단 판정 기준으로 사용합니다.`,
    authority,
    visualComparison,
  };
}

function combineStatuses(statuses) {
  if (statuses.includes('FAIL')) return 'FAIL';
  if (statuses.includes('REVIEW')) return 'REVIEW';
  return 'PASS';
}

function assignDesignLabels(designs) {
  const counts = new Map();
  for (const design of designs) {
    const customer = design.fields.customer || '고객명 미추출';
    const color = design.shellSpecification.colorName
      || (design.shellSpecification.number ? `${design.shellSpecification.number}번` : '색상 미추출');
    design.baseLabel = `${customer} ${color}`.replace(/\s+/g, ' ').trim();
    counts.set(design.baseLabel, (counts.get(design.baseLabel) ?? 0) + 1);
  }
  const seen = new Map();
  for (const design of designs) {
    if (counts.get(design.baseLabel) > 1) {
      const sequence = (seen.get(design.baseLabel) ?? 0) + 1;
      seen.set(design.baseLabel, sequence);
      design.label = `${design.baseLabel} ${sequence}`;
    } else {
      design.label = design.baseLabel;
    }
  }
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function buildMarkdown(report) {
  const lines = [];
  lines.push(`# Illustrator 야구점퍼 시안 검사`);
  lines.push('');
  lines.push(`- 파일: ${report.document}`);
  lines.push(`- 검사 시안: ${report.designCount}개`);
  if (report.performance?.detectedProofs > report.designCount) {
    lines.push(`- 탐지 시안 후보: ${report.performance.detectedProofs}개 중 최대 ${report.performance.maximumProofs}개 검사`);
  }
  lines.push(`- 종합 결과: **${report.overallStatus}**`);
  lines.push('');
  if (report.designCount > 1) {
    lines.push('## 결과 요약');
    lines.push('');
    lines.push('| 시안 구분 | 대지 | 하단 사양표 | 누락 항목 | 색상 비교(참고) | 결과 |');
    lines.push('| --- | ---: | --- | --- | --- | --- |');
    for (const design of report.designs) {
      const missing = design.tableCheck.missing.length ? design.tableCheck.missing.join(', ') : '없음';
      const visualStatus = `${design.materialCheck.visualComparison.status}/${design.sleeveCheck.visualComparison.status}`;
      lines.push(`| ${markdownCell(design.label)} | ${design.proofArtboard.index + 1} | ${design.tableCheck.status} | ${markdownCell(missing)} | ${visualStatus} | **${design.overallStatus}** |`);
    }
    lines.push('');
  }

  const labels = {
    customer: '고객명',
    product: '제품명',
    shell: '겉감',
    rib: '시보리',
    lining: '안감',
    button: '단추',
    sleeve: '소매',
    pocket: '주머니',
  };
  for (const design of report.designs) {
    const detailHeading = report.designCount > 1 ? `## ${design.label}` : '## 시안 검사 결과';
    const subsection = report.designCount > 1 ? '###' : '###';
    lines.push(detailHeading);
    lines.push('');
    lines.push(`- 시안 대지: ${design.proofArtboard.index + 1} (${design.proofArtboard.name})`);
    lines.push(`- 시안 결과: **${design.overallStatus}**`);
    lines.push('');
    lines.push(`${subsection} 하단 표 추출`);
    lines.push('');
    lines.push('| 항목 | 추출값 |');
    lines.push('| --- | --- |');
    for (const [key, label] of Object.entries(labels)) {
      lines.push(`| ${label} | ${markdownCell(design.fields[key] || '추출 실패')} |`);
    }
    lines.push('');
    lines.push(`${subsection} 하단 사양표 판정`);
    lines.push('');
    lines.push(`- 최종 기준: **하단 사양표**`);
    lines.push(`- 표 필수값 판정: **${design.tableCheck.status}** — ${design.tableCheck.reason}`);
    lines.push(`- 겉감 표기 판정: **${design.materialCheck.status}** (${design.materialCheck.decisionCode}) — ${design.materialCheck.reason}`);
    lines.push(`- 소매 표기 판정: **${design.sleeveCheck.status}** (${design.sleeveCheck.decisionCode}) — ${design.sleeveCheck.reason}`);
    lines.push('');
    lines.push(`${subsection} 색상 비교 — 판정 미반영 참고`);
    lines.push('');
    lines.push(`- 몸통 대표색: ${design.visual.body.hex} (${design.visual.body.agreeingSamples}/${design.visual.body.totalSamples}개 표본 일치)`);
    lines.push(`- 표의 겉감: ${design.shellSpecification.raw || '추출 실패'}`);
    if (design.materialCheck.expected) {
      lines.push(`- 컬러판 기대값: ${design.materialCheck.expected.material} ${String(design.materialCheck.expected.number).padStart(2, '0')}번 ${design.materialCheck.expected.hex}`);
      lines.push(`- 기대값과 색차: ΔE ${design.materialCheck.expected.deltaE}`);
    }
    if (design.materialCheck.matchedCatalog) {
      lines.push(`- 몸통 근접 catalog(참고): ${design.materialCheck.matchedCatalog.role} / ${design.materialCheck.matchedCatalog.catalogId} / ${design.materialCheck.matchedCatalog.sourceSha256}`);
    }
    lines.push(`- 몸통 색상 비교(참고): **${design.materialCheck.visualComparison.status}** (${design.materialCheck.visualComparison.decisionCode}) — ${design.materialCheck.visualComparison.reason}`);
    if (design.sleeveCheck.matchedCatalog) {
      lines.push(`- 소매 근접 catalog(참고): ${design.sleeveCheck.matchedCatalog.catalogId} / ${design.sleeveCheck.matchedCatalog.key}`);
    }
    lines.push(`- 소매 색상 비교(참고): **${design.sleeveCheck.visualComparison.status}** (${design.sleeveCheck.visualComparison.decisionCode}) — ${design.sleeveCheck.visualComparison.reason}`);
    lines.push('');
    lines.push(`${subsection} 색상 근접 후보`);
    lines.push('');
    lines.push('| 순위 | 원단 | 번호 | 컬러판 색 | ΔE |');
    lines.push('| ---: | --- | ---: | --- | ---: |');
    design.materialCheck.nearest.forEach((entry, index) => {
      lines.push(`| ${index + 1} | ${entry.material} | ${entry.number} | ${entry.hex} | ${entry.deltaE} |`);
    });
    lines.push('');
  }
  lines.push('## 자동 판정 범위');
  lines.push('');
  lines.push('- 원단 종류·번호·세대의 최종 기준은 하단 사양표입니다. 8개 필수 항목의 빈칸이나 추출 실패만 REVIEW에 반영합니다.');
  lines.push(`- catalog 범위: ${report.catalogProvenance.coverage}. 현행·구형과 소매 catalog 비교는 색상 참고정보이며 종합 판정에 반영하지 않습니다.`);
  lines.push('- 현행판은 고정 grid의 오른쪽 평면색, 구형 TR·소매판은 label을 포함하는 vector swatch의 Illustrator 렌더 중심색을 사용합니다.');
  lines.push('- 소매는 공급처·family·가공·번호·색명과 시안의 다중 표본 대표색을 대조합니다.');
  lines.push('- 이 결과는 디자인 검수이며 실제 봉제품의 원단 조성·촉감·무늬·공급처 진품 인증이 아닙니다.');
  lines.push('- 안감은 외관 시안에 보이지 않으므로 표기만 추출하며 시각 판정하지 않습니다.');
  lines.push('- 시보리 줄 수, 단추 수·색, 주머니 형태는 다음 단계의 객체/형상 검사 대상입니다.');
  lines.push('- 검정·흰색처럼 서로 다른 원단이 같은 화면색으로 표현될 수 있고 렌더링 색상 프로파일 차이도 있으므로 색상 비교는 판정 미반영 참고로 남깁니다.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildPaletteReference(palette, image) {
  const materials = {};
  for (const entry of palette) {
    if (!materials[entry.material]) {
      materials[entry.material] = {
        count: 0,
        colors: [],
      };
    }
    materials[entry.material].colors.push({
      number: entry.number,
      rgb: entry.rgb,
      hex: entry.hex,
    });
    materials[entry.material].count += 1;
  }
  return {
    schemaVersion: 1,
    extractionRule: '각 색상칩의 오른쪽 Illustrator용 평면색 중앙 영역',
    sourceImage: {
      width: image.width,
      height: image.height,
    },
    materials,
  };
}

function buildPaletteCsv(palette) {
  const rows = ['material,number,hex,red,green,blue,catalogId,role'];
  for (const entry of palette) {
    const escapedMaterial = `"${entry.material.replaceAll('"', '""')}"`;
    rows.push([
      escapedMaterial,
      entry.number,
      entry.hex,
      entry.rgb[0],
      entry.rgb[1],
      entry.rgb[2],
      entry.catalogId ?? '',
      entry.role ?? '',
    ].join(','));
  }
  return `${rows.join('\n')}\n`;
}

const args = parseArgs(process.argv.slice(2));
if (args['palette-output']) {
  const paletteImage = readPng(args.palette);
  const palette = buildPalette(paletteImage);
  let paletteReference;
  if (args['catalog-role']) {
    const sourceSha256 = args['source-sha256'];
    if (!/^[0-9a-f]{64}$/i.test(sourceSha256 ?? '')) {
      throw new Error('palette_registry_invalid: --source-sha256가 필요합니다.');
    }
    if (args['catalog-role'] === 'current-body') {
      paletteReference = currentCatalogFromPalette(
        palette,
        sourceSha256,
        args['source-display-name'] ?? path.basename(args.palette),
      );
      paletteReference.catalogId = args['catalog-id'] ?? paletteReference.catalogId;
    } else {
      if (!args.observation) throw new Error('palette_registry_invalid: irregular catalog observation이 필요합니다.');
      const observation = JSON.parse(fs.readFileSync(args.observation, 'utf8'));
      paletteReference = buildIrregularCatalog({
        observation,
        image: paletteImage,
        catalogId: args['catalog-id'] ?? args['catalog-role'],
        role: args['catalog-role'],
        generation: args['catalog-generation'] ?? (args['catalog-role'] === 'legacy-body' ? 'legacy' : 'reference'),
        sourceSha256,
        sourceDisplayName: args['source-display-name'] ?? path.basename(args.palette),
        samplePatch,
      });
    }
  } else {
    paletteReference = buildPaletteReference(palette, paletteImage);
  }
  const paletteOutput = path.resolve(args['palette-output']);
  fs.mkdirSync(path.dirname(paletteOutput), { recursive: true });
  fs.writeFileSync(paletteOutput, `${JSON.stringify(paletteReference, null, 2)}\n`, 'utf8');
  const candidateCount = paletteReference.entries
    ? paletteReference.entries.reduce((sum, entry) => sum + entry.candidates.length, 0)
    : palette.length;
  console.log(JSON.stringify({
    ok: true,
    entries: paletteReference.entries?.length ?? palette.length,
    candidates: candidateCount,
    output: paletteOutput,
  }));
  process.exit(0);
}
const inspection = JSON.parse(fs.readFileSync(args.inspection, 'utf8'));
const proofScores = detectProofArtboards(inspection, 6);
let catalogRegistry;
let paletteReference;
if (args['catalog-registry']) {
  catalogRegistry = loadCatalogRegistry(args['catalog-registry']);
  paletteReference = referenceFromRegistry(catalogRegistry);
} else {
  const { palette: currentPalette } = loadPalette(args.palette);
  const sourceSha256 = sha256File(args.palette);
  catalogRegistry = registryFromCatalogs([
    currentCatalogFromPalette(currentPalette, sourceSha256, path.basename(args.palette)),
  ], 'current-only');
  paletteReference = referenceFromRegistry(catalogRegistry);
}
const palette = paletteFromRegistry(catalogRegistry);
const designs = proofScores.map((proofScore, designIndex) => {
  const proofArtboard = inspection.artboards.find((artboard) => artboard.index === proofScore.index);
  if (!proofArtboard?.render) {
    throw new Error(`시안 대지 ${proofScore.index + 1}번의 렌더 파일 정보가 없습니다.`);
  }
  const proofImagePath = path.resolve(path.dirname(args.inspection), proofArtboard.render);
  if (!fs.existsSync(proofImagePath)) {
    throw new Error(`시안 대지 ${proofScore.index + 1}번의 렌더를 찾을 수 없습니다: ${proofImagePath}`);
  }
  const proofImage = readPng(proofImagePath);
  const renderBounds = normalizeRenderBounds(proofArtboard);
  const { fields, extraction } = extractFields(inspection, proofArtboard.index);
  const shellSpecification = parseBodySpecification(fields.shell);
  const sleeveSpecification = parseSleeveSpecification(fields.sleeve);
  const body = dominantBodyColor(proofImage, renderBounds);
  const sleeve = dominantSleeveColor(proofImage, renderBounds);
  const rawMaterialCheck = evaluateBodyMaterial(body.rgb, shellSpecification, catalogRegistry);
  const rawSleeveCheck = evaluateSleeveMaterial(sleeve.rgb, sleeveSpecification, catalogRegistry);
  const materialCheck = applyTableAuthority(rawMaterialCheck, 'shell', '겉감', fields.shell);
  const sleeveCheck = applyTableAuthority(rawSleeveCheck, 'sleeve', '소매', fields.sleeve);
  const tableCheck = checkTableExtraction(fields);
  return {
    id: `design-${designIndex + 1}`,
    proofArtboard: {
      index: proofArtboard.index,
      name: proofArtboard.name,
      score: proofScore.score,
      render: proofImagePath,
      renderBounds,
    },
    fields,
    extraction,
    shellSpecification,
    sleeveSpecification,
    visual: { body, sleeve },
    materialCheck,
    sleeveCheck,
    tableCheck,
    overallStatus: combineStatuses([tableCheck.status, materialCheck.status, sleeveCheck.status]),
  };
});
assignDesignLabels(designs);
const overallStatus = combineStatuses(designs.map((design) => design.overallStatus));
const report = {
  schemaVersion: 4,
  document: inspection.document.name,
  designCount: designs.length,
  overallStatus,
  designs,
  performance: inspection.performance ?? null,
  catalogProvenance: catalogProvenance(catalogRegistry),
  limitations: {
    lining: '외관 시안에서 보이지 않아 표기만 추출',
    shapeChecks: '시보리 줄 수, 단추, 주머니 형상 자동 검사는 후속 단계',
    colorProfiles: 'Illustrator 렌더링과 포함 이미지의 색상 프로파일 차이로 색차가 발생할 수 있음',
    materialAuthentication: '디자인의 사양표와 렌더색만 검사하며 실제 봉제품 원단을 인증하지 않음',
  },
};
if (designs.length === 1) {
  const [design] = designs;
  Object.assign(report, {
    proofArtboard: design.proofArtboard,
    fields: design.fields,
    shellSpecification: design.shellSpecification,
    sleeveSpecification: design.sleeveSpecification,
    visual: design.visual,
    materialCheck: design.materialCheck,
    sleeveCheck: design.sleeveCheck,
    tableCheck: design.tableCheck,
  });
}

fs.mkdirSync(args.output, { recursive: true });
fs.writeFileSync(path.join(args.output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(args.output, 'report.md'), buildMarkdown(report), 'utf8');
fs.writeFileSync(
  path.join(args.output, 'material-color-reference.json'),
  `${JSON.stringify(paletteReference, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(args.output, 'material-color-reference.csv'),
  buildPaletteCsv(palette),
  'utf8',
);
console.log(JSON.stringify({
  ok: true,
  overallStatus,
  designCount: designs.length,
  designs: designs.map((design) => ({ label: design.label, status: design.overallStatus })),
  report: path.join(args.output, 'report.md'),
  json: path.join(args.output, 'report.json'),
  paletteJson: path.join(args.output, 'material-color-reference.json'),
  paletteCsv: path.join(args.output, 'material-color-reference.csv'),
}, null, 2));
