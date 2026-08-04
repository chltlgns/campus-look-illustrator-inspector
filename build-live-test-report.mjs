#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

if (!process.argv[2]) {
  console.error('Usage: node build-live-test-report.mjs <sanitized-result-directory> [batch-result.json]');
  process.exit(2);
}
const root = path.resolve(process.argv[2]);
const finalFullName = process.argv[3] || 'batch-final-full-ready.json';
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const manifest = read('메일_다운로드_출처.json');
const timing = read('batch-fast-ready.json');
const finalFull = read(finalFullName);
const stress = read('batch-final-fast-ready.json');
const timingByFile = new Map(timing.results.map((entry) => [entry.file, entry]));

function combined(values) {
  if (values.includes('FAIL')) return 'FAIL';
  if (values.includes('REVIEW')) return 'REVIEW';
  return 'PASS';
}

function average(values) {
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const rows = finalFull.results.map((entry, index) => {
  const detail = entry.reportData;
  const designs = detail.designs;
  const timed = timingByFile.get(entry.file);
  const origin = manifest.files.find((item) => path.basename(item.outputPath) === entry.file);
  return {
    rank: index + 1,
    date: origin?.receivedAt?.slice(0, 10) || '',
    uid: origin?.uid || '',
    file: entry.file,
    designCount: detail.designCount,
    labels: designs.map((design) => design.label).join(' | '),
    status: detail.overallStatus,
    tableStatus: combined(designs.map((design) => design.tableCheck.status)),
    materialStatus: combined(designs.map((design) => design.materialCheck.status)),
    sleeveStatus: combined(designs.map((design) => design.sleeveCheck.status)),
    shell: designs.map((design) => design.fields.shell).join(' | '),
    body: designs.map((design) => design.visual.body.hex).join(' | '),
    sleeve: designs.map((design) => design.visual.sleeve.hex).join(' | '),
    reason: designs.map((design) => {
      if (design.overallStatus === 'PASS') return '일치';
      if (design.tableCheck.status !== 'PASS') return design.tableCheck.reason;
      if (design.materialCheck.status !== 'PASS') return design.materialCheck.reason;
      return design.sleeveCheck.reason;
    }).join(' | '),
    openSeconds: timed?.openSeconds ?? null,
    checkSeconds: timed?.checkSeconds ?? null,
    illustratorMilliseconds: timed?.phaseTimings?.illustratorMilliseconds ?? null,
    analyzerMilliseconds: timed?.phaseTimings?.analyzerMilliseconds ?? null,
    executionOk: entry.executionOk,
  };
});

const checkTimes = rows.map((row) => row.checkSeconds);
const openTimes = rows.map((row) => row.openSeconds);
const stressChecks = stress.results.map((row) => row.checkSeconds);
const statusCounts = Object.fromEntries(['PASS', 'REVIEW', 'FAIL'].map((status) => [status, rows.filter((row) => row.status === status).length]));
const summary = {
  generatedAt: new Date().toISOString(),
  source: {
    readOnly: manifest.readOnly,
    downloaded: manifest.downloaded,
    excludedOrigins: manifest.excludedOrigins,
    excludedHashes: manifest.excludedHashes,
    duplicatesSkipped: manifest.duplicatesSkipped.length,
    dateFrom: rows.at(-1).date,
    dateTo: rows[0].date,
  },
  execution: {
    files: rows.length,
    success: finalFull.executionSuccessCount,
    errors: finalFull.executionErrorCount,
    originalDocumentPreserved: finalFull.originalDocumentPreserved && timing.originalDocumentPreserved,
  },
  result: {
    ...statusCounts,
    singleDesignFiles: rows.filter((row) => row.designCount === 1).length,
    multiDesignFiles: rows.filter((row) => row.designCount > 1).length,
    fullyExtractedTables: rows.filter((row) => row.tableStatus === 'PASS').length,
  },
  readyHotkeyTiming: {
    averageSeconds: Number(average(checkTimes).toFixed(2)),
    minimumSeconds: Math.min(...checkTimes),
    medianSeconds: percentile(checkTimes, 0.5),
    p95Seconds: percentile(checkTimes, 0.95),
    maximumSeconds: Math.max(...checkTimes),
    withinTwoSeconds: checkTimes.filter((value) => value <= 2).length,
    openAverageSeconds: Number(average(openTimes).toFixed(2)),
  },
  repeatedStressTiming: {
    note: 'Illustrator에서 약 80개 문서를 연속 열기·캡처한 후의 누적 저하 측정',
    averageSeconds: Number(average(stressChecks).toFixed(2)),
    maximumSeconds: Math.max(...stressChecks),
    withinTwoSeconds: stressChecks.filter((value) => value <= 2).length,
  },
  rows,
};

fs.writeFileSync(path.join(root, '실전검사_상세결과.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
const columns = Object.keys(rows[0]);
fs.writeFileSync(
  path.join(root, '실전검사_상세결과.csv'),
  `${columns.join(',')}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')).join('\n')}\n`,
  'utf8',
);

const lines = [
  '# 추가 야구점퍼 시안 20개 실전 검사',
  '',
  `- 메일: 보낸메일 ${summary.source.dateFrom} ~ ${summary.source.dateTo}, 읽기 전용, 기존 10개 UID·해시 제외`,
  `- 실행: ${summary.execution.success}/${summary.execution.files} 성공, 오류 ${summary.execution.errors}, 원본 문서 보존 ${summary.execution.originalDocumentPreserved ? '성공' : '실패'}`,
  `- 판정: PASS ${statusCounts.PASS}, REVIEW ${statusCounts.REVIEW}, FAIL ${statusCounts.FAIL}`,
  `- 시안 수: 단일 ${summary.result.singleDesignFiles}개, 복수 ${summary.result.multiDesignFiles}개`,
  `- 표 8개 항목 전부 추출: ${summary.result.fullyExtractedTables}/20`,
  `- 화면 준비 후 단축키 검사: 평균 ${summary.readyHotkeyTiming.averageSeconds}초, 중앙 ${summary.readyHotkeyTiming.medianSeconds}초, p95 ${summary.readyHotkeyTiming.p95Seconds}초, 범위 ${summary.readyHotkeyTiming.minimumSeconds}~${summary.readyHotkeyTiming.maximumSeconds}초, 2초 이내 ${summary.readyHotkeyTiming.withinTwoSeconds}/20`,
  `- 파일 열기: 평균 ${summary.readyHotkeyTiming.openAverageSeconds}초 (단축키 검사 시간과 분리)`,
  `- 연속 스트레스: 평균 ${summary.repeatedStressTiming.averageSeconds}초, 최대 ${summary.repeatedStressTiming.maximumSeconds}초 (약 80개 문서 반복 후 Illustrator 캡처 누적 저하)`,
  '',
  '## 파일별 결과',
  '',
  '| # | 시안 | 수 | 결과 | 열기 | 검사 | 핵심 사유 |',
  '| ---: | --- | ---: | --- | ---: | ---: | --- |',
  ...rows.map((row) => `| ${row.rank} | ${row.labels.replaceAll('|', '\\|')} | ${row.designCount} | ${row.status} | ${row.openSeconds}초 | ${row.checkSeconds}초 | ${row.reason.replaceAll('|', '\\|')} |`),
  '',
  '## 판정 해석',
  '',
  '- FAIL 2건: 표는 TR하이미어 31번이지만 시안 몸통색은 32번과 ΔE 0.38로 명확히 일치.',
  `- REVIEW ${statusCounts.REVIEW}건: 컬러판 경계값, 지원 소매색 기준 부재, 윤곽선화된 표 항목처럼 자동 확정할 수 없는 사유를 사람 확인 대상으로 유지.`,
  '- 회색 소매 1건은 #484949로 올바르게 채취했지만 소매 원단 컬러판 기준이 없어 REVIEW로 유지.',
  '',
];
fs.writeFileSync(path.join(root, '실전검사_결과보고서.md'), `${lines.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, root, statusCounts, timing: summary.readyHotkeyTiming }, null, 2));
