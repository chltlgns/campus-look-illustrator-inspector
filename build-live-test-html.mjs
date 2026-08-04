#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

if (!process.argv[2]) {
  console.error('Usage: node build-live-test-html.mjs <sanitized-result-directory>');
  process.exit(2);
}
const root = path.resolve(process.argv[2]);
const inputPath = path.join(root, '실전검사_상세결과.json');
const outputPath = path.join(root, '실전검사_결과보고서.html');
const report = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatKoreanDate(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function statusBadge(status, compact = false) {
  const label = status === 'PASS' ? '통과' : status === 'REVIEW' ? '확인 필요' : '불일치';
  return `<span class="status status--${status.toLowerCase()}${compact ? ' status--compact' : ''}"><span class="status__mark" aria-hidden="true"></span>${label}<span class="status__code">${status}</span></span>`;
}

function miniStatus(label, status) {
  const korean = status === 'PASS' ? '통과' : status === 'REVIEW' ? '확인' : '불일치';
  return `<span class="mini mini--${status.toLowerCase()}" title="${escapeHtml(label)}: ${korean}"><span>${escapeHtml(label)}</span><strong>${korean}</strong></span>`;
}

function colorChips(value) {
  const colors = String(value || '').split('|').map((part) => part.trim()).filter((part) => /^#[0-9A-F]{6}$/i.test(part));
  return colors.map((color) => `<span class="color-chip" title="${escapeHtml(color)}"><span class="color-chip__sample" style="--chip:${escapeHtml(color)}"></span><span>${escapeHtml(color)}</span></span>`).join('');
}

const rows = report.rows;
const failRows = rows.filter((row) => row.status === 'FAIL');
const reviewRows = rows.filter((row) => row.status === 'REVIEW');
const passRate = Math.round((report.result.PASS / report.execution.files) * 100);
const extractRate = Math.round((report.result.fullyExtractedTables / report.execution.files) * 100);
const datePeriod = `${report.source.dateFrom.replaceAll('-', '.')} — ${report.source.dateTo.replaceAll('-', '.')}`;

const rowHtml = rows.map((row) => {
  const searchText = [row.labels, row.file, row.shell, row.reason, row.status].join(' ').toLocaleLowerCase('ko-KR');
  return `
            <tr data-result-row data-status="${escapeHtml(row.status)}" data-search="${escapeHtml(searchText)}">
              <td data-label="번호"><span class="rank">${row.rank}</span><span class="date">${escapeHtml(row.date)}</span></td>
              <td data-label="시안">
                <strong class="proof-name">${escapeHtml(row.labels)}</strong>
                <span class="file-name" title="${escapeHtml(row.file)}">${escapeHtml(row.file)}</span>
              </td>
              <td data-label="판정">${statusBadge(row.status)}</td>
              <td data-label="대지"><span class="count">${row.designCount}</span>개</td>
              <td data-label="표 원단 / 채취색">
                <span class="material-text">${escapeHtml(row.shell)}</span>
                <span class="color-line"><span class="color-label">몸통</span>${colorChips(row.body)}</span>
                <span class="color-line"><span class="color-label">소매</span>${colorChips(row.sleeve)}</span>
              </td>
              <td data-label="세부 판정">
                <span class="mini-group">
                  ${miniStatus('표', row.tableStatus)}
                  ${miniStatus('원단', row.materialStatus)}
                  ${miniStatus('소매', row.sleeveStatus)}
                </span>
              </td>
              <td data-label="검사 시간"><strong class="time">${Number(row.checkSeconds).toFixed(1)}초</strong><span class="open-time">열기 ${Number(row.openSeconds).toFixed(2)}초</span></td>
              <td data-label="판정 사유"><span class="reason">${escapeHtml(row.reason)}</span></td>
            </tr>`;
}).join('');

const failHtml = failRows.map((row) => `
              <li>
                <span class="finding-index">${row.rank}</span>
                <span><strong>${escapeHtml(row.labels)}</strong><small>${escapeHtml(row.reason)}</small></span>
              </li>`).join('');

const reviewHtml = reviewRows.map((row) => `
              <li>
                <span class="finding-index">${row.rank}</span>
                <span><strong>${escapeHtml(row.labels)}</strong><small>${escapeHtml(row.reason)}</small></span>
              </li>`).join('');

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>야구점퍼 시안 실전 검사 보고서 | CAMPUSLOOK</title>
  <style>
    :root {
      --bg: #070d1a;
      --surface: #0d1627;
      --surface-raised: #121e32;
      --surface-soft: #101a2b;
      --text: #f4f7fb;
      --text-soft: #aebbd0;
      --muted: #7f8ca3;
      --border: #2b3850;
      --border-strong: #3a4965;
      --blue: #62a5ff;
      --blue-soft: #172c4c;
      --pass: #54d69b;
      --pass-bg: #102d25;
      --review: #ffc766;
      --review-bg: #342510;
      --fail: #ff7b72;
      --fail-bg: #3c191c;
      --radius: 12px;
      --shadow: 0 18px 46px rgba(0, 0, 0, .22);
      --z-sticky: 10;
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-width: 320px;
      background:
        radial-gradient(circle at 88% -10%, rgba(44, 102, 179, .28), transparent 32rem),
        var(--bg);
      color: var(--text);
      font-family: "Noto Sans KR", "Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif;
      font-size: 16px;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }
    button, input, a { font: inherit; }
    button, .download { touch-action: manipulation; }
    a { color: inherit; }
    .skip-link {
      position: fixed;
      left: 12px;
      top: 8px;
      z-index: 100;
      padding: 10px 14px;
      border-radius: 8px;
      background: #fff;
      color: #08101f;
      transform: translateY(-150%);
    }
    .skip-link:focus { transform: translateY(0); }
    :focus-visible { outline: 3px solid #9cc7ff; outline-offset: 3px; }

    .shell { width: min(1480px, calc(100% - 40px)); margin: 0 auto; }
    .topbar {
      border-bottom: 1px solid rgba(103, 130, 169, .28);
      background: rgba(7, 13, 26, .84);
      backdrop-filter: blur(14px);
    }
    .topbar__inner {
      min-height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .brand { display: flex; align-items: center; gap: 12px; letter-spacing: .04em; }
    .brand__mark {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border: 1px solid var(--border-strong);
      border-radius: 9px;
      background: var(--surface-raised);
    }
    .brand__mark svg { width: 20px; height: 20px; color: var(--blue); }
    .brand strong { display: block; font-size: .92rem; letter-spacing: .12em; }
    .brand span { display: block; color: var(--muted); font-size: .7rem; font-weight: 700; letter-spacing: .14em; }
    .topbar__meta { color: var(--text-soft); font-size: .82rem; font-variant-numeric: tabular-nums; }

    main { padding: 54px 0 72px; }
    .eyebrow {
      margin: 0 0 10px;
      color: var(--blue);
      font-size: .78rem;
      font-weight: 800;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 { max-width: 830px; margin-bottom: 14px; font-size: clamp(2rem, 4vw, 3.8rem); line-height: 1.12; letter-spacing: -.045em; }
    h2 { margin-bottom: 8px; font-size: clamp(1.35rem, 2vw, 1.8rem); letter-spacing: -.025em; }
    h3 { margin-bottom: 6px; font-size: 1rem; }
    .hero { padding-bottom: 34px; }
    .hero__lead { max-width: 780px; color: var(--text-soft); font-size: 1.05rem; }
    .hero__tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
    .hero__tag {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 32px;
      padding: 5px 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(18, 30, 50, .7);
      color: var(--text-soft);
      font-size: .78rem;
      font-weight: 700;
    }
    .hero__tag svg { width: 15px; height: 15px; color: var(--pass); }

    .kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
    .kpi {
      min-height: 140px;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: linear-gradient(145deg, rgba(18, 30, 50, .98), rgba(13, 22, 39, .98));
    }
    .kpi--pass { border-top: 3px solid var(--pass); }
    .kpi--review { border-top: 3px solid var(--review); }
    .kpi--fail { border-top: 3px solid var(--fail); }
    .kpi--speed { border-top: 3px solid var(--blue); }
    .kpi__label { display: block; min-height: 40px; color: var(--text-soft); font-size: .8rem; font-weight: 700; }
    .kpi__value { display: flex; align-items: baseline; gap: 4px; margin-top: 7px; font-size: 2rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
    .kpi__value small { color: var(--muted); font-size: .76rem; font-weight: 700; }
    .kpi__foot { display: block; margin-top: 10px; color: var(--muted); font-size: .72rem; }

    .section { margin-top: 52px; }
    .section-head { display: flex; justify-content: space-between; align-items: end; gap: 20px; margin-bottom: 18px; }
    .section-head p { margin: 0; color: var(--text-soft); font-size: .9rem; }
    .grid-2 { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr); gap: 14px; }
    .panel { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
    .panel__head { display: flex; justify-content: space-between; gap: 12px; padding: 20px 22px 14px; border-bottom: 1px solid var(--border); }
    .panel__head p { margin: 0; color: var(--muted); font-size: .78rem; }
    .panel__body { padding: 20px 22px 22px; }
    .finding-list { display: grid; gap: 9px; margin: 0; padding: 0; list-style: none; }
    .finding-list li { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 11px; padding: 13px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-soft); }
    .finding-list--fail li { border-left: 3px solid var(--fail); }
    .finding-list--review li { border-left: 3px solid var(--review); }
    .finding-index { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 7px; background: var(--surface-raised); color: var(--text-soft); font-size: .76rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .finding-list strong, .finding-list small { display: block; }
    .finding-list strong { font-size: .88rem; line-height: 1.4; }
    .finding-list small { margin-top: 4px; color: var(--text-soft); font-size: .75rem; line-height: 1.5; }

    .status { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 4px 9px; border: 1px solid; border-radius: 999px; white-space: nowrap; font-size: .75rem; font-weight: 800; }
    .status__mark { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 3px rgba(255, 255, 255, .07); }
    .status__code { color: currentColor; opacity: .72; font-size: .61rem; letter-spacing: .05em; }
    .status--pass { color: var(--pass); background: var(--pass-bg); border-color: #246f55; }
    .status--review { color: var(--review); background: var(--review-bg); border-color: #79551f; }
    .status--fail { color: var(--fail); background: var(--fail-bg); border-color: #814045; }
    .status--compact { min-height: 27px; padding-block: 3px; }

    .distribution { display: grid; gap: 16px; }
    .distribution__track { display: flex; height: 18px; overflow: hidden; border-radius: 5px; background: var(--surface-raised); }
    .distribution__track span { min-width: 5px; }
    .distribution__pass { width: ${report.result.PASS / report.execution.files * 100}%; background: var(--pass); }
    .distribution__review { width: ${report.result.REVIEW / report.execution.files * 100}%; background: var(--review); }
    .distribution__fail { width: ${report.result.FAIL / report.execution.files * 100}%; background: var(--fail); }
    .legend { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .legend__item { padding: 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-soft); }
    .legend__item span { display: block; color: var(--text-soft); font-size: .72rem; }
    .legend__item strong { display: block; margin-top: 3px; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .legend__item--pass { border-top: 3px solid var(--pass); }
    .legend__item--review { border-top: 3px solid var(--review); }
    .legend__item--fail { border-top: 3px solid var(--fail); }

    .timing { display: grid; gap: 18px; }
    .timing__row { display: grid; grid-template-columns: 118px minmax(0, 1fr) 78px; align-items: center; gap: 12px; }
    .timing__name { color: var(--text-soft); font-size: .78rem; font-weight: 700; }
    .timing__value { text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }
    .timing__track { position: relative; height: 12px; border-radius: 4px; background: #1e2a3e; }
    .timing__track::after { content: ""; position: absolute; left: 40%; top: -5px; bottom: -5px; width: 1px; border-left: 1px dashed #91a2bb; }
    .timing__bar { height: 100%; border-radius: inherit; background: var(--blue); }
    .timing__bar--stress { background: var(--review); }
    .timing__bar--max { background: var(--fail); }
    .timing__axis { display: flex; justify-content: space-between; margin: -7px 77px 0 130px; color: var(--muted); font-size: .67rem; font-variant-numeric: tabular-nums; }
    .timing__note { display: grid; grid-template-columns: 18px 1fr; gap: 9px; margin-top: 4px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; color: var(--text-soft); background: var(--surface-soft); font-size: .76rem; }
    .timing__note svg { width: 18px; height: 18px; color: var(--review); }

    .coverage { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .coverage__item { padding: 16px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-soft); }
    .coverage__item strong { display: block; font-size: 1.35rem; font-variant-numeric: tabular-nums; }
    .coverage__item span { display: block; margin-top: 4px; color: var(--text-soft); font-size: .76rem; }

    .toolbar { display: grid; grid-template-columns: minmax(240px, 1fr) auto auto; gap: 10px; margin-bottom: 14px; }
    .search { position: relative; }
    .search svg { position: absolute; left: 14px; top: 50%; width: 18px; height: 18px; color: var(--muted); transform: translateY(-50%); pointer-events: none; }
    .search label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .search input {
      width: 100%;
      min-height: 46px;
      padding: 10px 14px 10px 43px;
      border: 1px solid var(--border-strong);
      border-radius: 9px;
      background: var(--surface);
      color: var(--text);
      font-size: .88rem;
    }
    .search input::placeholder { color: var(--muted); }
    .filters { display: flex; gap: 6px; padding: 4px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); }
    .filter {
      min-height: 38px;
      padding: 7px 12px;
      border: 1px solid transparent;
      border-radius: 7px;
      background: transparent;
      color: var(--text-soft);
      cursor: pointer;
      font-size: .76rem;
      font-weight: 800;
      transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease;
    }
    .filter:hover { color: var(--text); background: var(--surface-raised); }
    .filter[aria-pressed="true"] { border-color: var(--border-strong); background: var(--surface-raised); color: var(--text); }
    .actions { display: flex; gap: 6px; }
    .download, .print {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 9px 12px;
      border: 1px solid var(--border-strong);
      border-radius: 9px;
      background: var(--surface);
      color: var(--text-soft);
      cursor: pointer;
      text-decoration: none;
      font-size: .76rem;
      font-weight: 800;
      transition: background-color 180ms ease, color 180ms ease;
    }
    .download:hover, .print:hover { background: var(--surface-raised); color: var(--text); }
    .download svg, .print svg { width: 17px; height: 17px; }
    .result-count { min-height: 24px; margin: 0 0 8px; color: var(--text-soft); font-size: .78rem; }
    .result-count strong { color: var(--text); font-variant-numeric: tabular-nums; }

    .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
    table { width: 100%; min-width: 1260px; border-collapse: collapse; font-size: .79rem; }
    caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    th { position: sticky; top: 0; z-index: var(--z-sticky); padding: 12px 11px; border-bottom: 1px solid var(--border-strong); background: #142137; color: #c8d3e4; text-align: left; font-size: .71rem; letter-spacing: .02em; white-space: nowrap; }
    td { padding: 13px 11px; border-bottom: 1px solid var(--border); vertical-align: top; }
    tbody tr { transition: background-color 160ms ease; }
    tbody tr:hover { background: rgba(98, 165, 255, .055); }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr[hidden] { display: none; }
    th:nth-child(1) { width: 72px; }
    th:nth-child(2) { min-width: 245px; }
    th:nth-child(3) { width: 118px; }
    th:nth-child(4) { width: 58px; }
    th:nth-child(5) { min-width: 210px; }
    th:nth-child(6) { width: 170px; }
    th:nth-child(7) { width: 90px; }
    th:nth-child(8) { min-width: 250px; }
    .rank, .date, .proof-name, .file-name, .material-text, .color-line, .open-time { display: block; }
    .rank { font-size: .9rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .date { margin-top: 3px; color: var(--muted); font-size: .66rem; font-variant-numeric: tabular-nums; }
    .proof-name { color: var(--text); line-height: 1.45; }
    .file-name { max-width: 290px; margin-top: 4px; overflow: hidden; color: var(--muted); font-size: .66rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
    .count, .time { font-variant-numeric: tabular-nums; }
    .material-text { color: var(--text-soft); line-height: 1.45; }
    .color-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 7px; }
    .color-label { min-width: 27px; color: var(--muted); font-size: .65rem; }
    .color-chip { display: inline-flex; align-items: center; gap: 5px; color: var(--text-soft); font-size: .65rem; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .color-chip__sample { width: 15px; height: 15px; border: 1px solid rgba(255,255,255,.45); border-radius: 4px; background: var(--chip); }
    .mini-group { display: flex; flex-wrap: wrap; gap: 5px; }
    .mini { display: inline-flex; align-items: center; gap: 4px; min-height: 25px; padding: 3px 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-soft); font-size: .62rem; }
    .mini span { color: var(--muted); }
    .mini strong { font-size: .62rem; }
    .mini--pass strong { color: var(--pass); }
    .mini--review strong { color: var(--review); }
    .mini--fail strong { color: var(--fail); }
    .time { font-size: .86rem; }
    .open-time { margin-top: 3px; color: var(--muted); font-size: .65rem; }
    .reason { display: block; color: var(--text-soft); line-height: 1.55; }

    .empty { display: none; padding: 44px 20px; border: 1px solid var(--border); border-radius: var(--radius); color: var(--text-soft); text-align: center; background: var(--surface); }
    .empty[aria-hidden="false"] { display: block; }
    .method-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .method { padding: 20px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
    .method__index { display: inline-grid; width: 28px; height: 28px; place-items: center; margin-bottom: 14px; border-radius: 7px; background: var(--blue-soft); color: var(--blue); font-size: .75rem; font-weight: 800; }
    .method p { margin-bottom: 0; color: var(--text-soft); font-size: .8rem; }
    .caveat { margin-top: 12px; padding: 16px 18px; border: 1px solid #6b5228; border-radius: var(--radius); background: #251d11; color: #efd9ac; font-size: .8rem; }
    .caveat strong { color: var(--review); }
    footer { padding: 24px 0 36px; border-top: 1px solid var(--border); color: var(--muted); font-size: .75rem; }
    .footer__inner { display: flex; justify-content: space-between; gap: 18px; }

    @media (max-width: 1180px) {
      .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .grid-2 { grid-template-columns: 1fr; }
      .toolbar { grid-template-columns: 1fr; }
      .actions { justify-content: flex-start; }
    }
    @media (max-width: 760px) {
      .shell { width: min(100% - 24px, 1480px); }
      .topbar__inner { min-height: 64px; }
      .topbar__meta { display: none; }
      main { padding-top: 36px; }
      h1 { font-size: 2.2rem; }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .kpi { min-height: 126px; padding: 16px; }
      .section { margin-top: 40px; }
      .section-head { display: block; }
      .section-head p { margin-top: 6px; }
      .legend, .coverage, .method-grid { grid-template-columns: 1fr; }
      .timing__row { grid-template-columns: 90px minmax(0, 1fr) 62px; gap: 8px; }
      .timing__axis { margin-left: 98px; margin-right: 62px; }
      .filters { overflow-x: auto; }
      .filter { flex: 0 0 auto; min-height: 44px; }
      .actions { display: grid; grid-template-columns: repeat(3, 1fr); }
      .download, .print { min-width: 0; }
      .table-wrap { overflow: visible; border: 0; background: transparent; box-shadow: none; }
      table, tbody, tr, td { display: block; width: 100%; min-width: 0; }
      thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      tbody { display: grid; gap: 10px; }
      tbody tr { padding: 14px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
      tbody tr:hover { background: var(--surface); }
      td { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border); }
      td::before { content: attr(data-label); color: var(--muted); font-size: .7rem; font-weight: 700; }
      td:last-child { border-bottom: 0; }
      .file-name { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
      .footer__inner { display: block; }
    }
    @media (max-width: 430px) {
      .kpis { grid-template-columns: 1fr 1fr; }
      .kpi__label { min-height: 36px; }
      .kpi__value { font-size: 1.7rem; }
      .actions { grid-template-columns: 1fr; }
      td { grid-template-columns: 78px minmax(0, 1fr); }
      .timing__row { grid-template-columns: 1fr 60px; }
      .timing__name { grid-column: 1 / -1; }
      .timing__axis { margin: -7px 62px 0 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
    }
    @media print {
      :root { --bg: #fff; --surface: #fff; --surface-raised: #f4f6f9; --surface-soft: #f7f8fa; --text: #121826; --text-soft: #3f4a5c; --muted: #667085; --border: #cbd2dc; --border-strong: #9aa4b2; }
      body { background: #fff; color: #121826; font-size: 10pt; }
      .shell { width: 100%; }
      .topbar { background: #fff; }
      .skip-link, .toolbar, .result-count { display: none !important; }
      main { padding: 22px 0; }
      .hero { padding-bottom: 18px; }
      .kpi, .panel, .method, .table-wrap { box-shadow: none; break-inside: avoid; }
      .section { margin-top: 28px; }
      .table-wrap { overflow: visible; }
      table { min-width: 0; font-size: 7pt; }
      th { position: static; background: #e9edf3; color: #121826; }
      th:nth-child(5), td:nth-child(5), th:nth-child(6), td:nth-child(6) { display: none; }
      .status--pass { color: #08663d; background: #e7f7ef; border-color: #7eb99a; }
      .status--review { color: #855100; background: #fff4da; border-color: #d1aa5b; }
      .status--fail { color: #a3221c; background: #ffeded; border-color: #d48a86; }
      footer { padding-bottom: 0; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#main">본문으로 바로가기</a>
  <header class="topbar">
    <div class="shell topbar__inner">
      <div class="brand" aria-label="캠퍼스룩 시안 품질 검사">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4.5h14v15H5z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/></svg>
        </span>
        <span><strong>CAMPUSLOOK</strong><span>PROOF QUALITY REPORT</span></span>
      </div>
      <div class="topbar__meta">보고서 생성 ${escapeHtml(formatKoreanDate(report.generatedAt))}</div>
    </div>
  </header>

  <main id="main" class="shell">
    <section class="hero" aria-labelledby="report-title">
      <p class="eyebrow">Illustrator automation · field test</p>
      <h1 id="report-title">야구점퍼 시안<br>실전 검사 결과</h1>
      <p class="hero__lead">최근 보낸메일에서 기존 10개를 제외하고 수집한 신규 시안 20개를 실제 Illustrator 환경에서 검사했습니다. 표의 원단 표기, 시안 몸통색·소매색, 복수 대지 구분과 처리 시간을 함께 확인한 결과입니다.</p>
      <div class="hero__tags" aria-label="검사 조건">
        <span class="hero__tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/></svg>메일 읽기 전용</span>
        <span class="hero__tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/></svg>원본 AI 보존</span>
        <span class="hero__tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/></svg>검사 오류 0건</span>
        <span class="hero__tag">${escapeHtml(datePeriod)}</span>
      </div>
    </section>

    <section class="kpis" aria-label="핵심 결과">
      <article class="kpi"><span class="kpi__label">검사 완료</span><span class="kpi__value">${report.execution.success}<small>/ ${report.execution.files}개</small></span><span class="kpi__foot">실행 성공률 100%</span></article>
      <article class="kpi kpi--pass"><span class="kpi__label">자동 통과</span><span class="kpi__value">${report.result.PASS}<small>개 · ${passRate}%</small></span><span class="kpi__foot">표와 시안이 일치</span></article>
      <article class="kpi kpi--review"><span class="kpi__label">사람 확인 필요</span><span class="kpi__value">${report.result.REVIEW}<small>개</small></span><span class="kpi__foot">번호·경계값·윤곽선</span></article>
      <article class="kpi kpi--fail"><span class="kpi__label">명확한 불일치</span><span class="kpi__value">${report.result.FAIL}<small>개</small></span><span class="kpi__foot">31번 표기 ↔ 32번 색상</span></article>
      <article class="kpi kpi--speed"><span class="kpi__label">평균 검사 시간</span><span class="kpi__value">${report.readyHotkeyTiming.averageSeconds}<small>초</small></span><span class="kpi__foot">중앙 ${report.readyHotkeyTiming.medianSeconds}초 · p95 ${report.readyHotkeyTiming.p95Seconds}초</span></article>
      <article class="kpi kpi--speed"><span class="kpi__label">2초 목표 달성</span><span class="kpi__value">${report.readyHotkeyTiming.withinTwoSeconds}<small>/ ${report.execution.files}개</small></span><span class="kpi__foot">준비된 화면에서 단축키 기준</span></article>
    </section>

    <section class="section" aria-labelledby="findings-title">
      <div class="section-head"><div><p class="eyebrow">Decision summary</p><h2 id="findings-title">바로 확인할 결과</h2></div><p>FAIL 2건은 색상번호 불일치가 명확하며, REVIEW 4건은 사람 판단이 필요합니다.</p></div>
      <div class="grid-2">
        <article class="panel">
          <div class="panel__head"><div><h3>명확한 불일치</h3><p>표는 31번, 시안 채취색은 32번과 ΔE 0.38</p></div>${statusBadge('FAIL', true)}</div>
          <div class="panel__body"><ul class="finding-list finding-list--fail">${failHtml}</ul></div>
        </article>
        <article class="panel">
          <div class="panel__head"><div><h3>사람 확인 필요</h3><p>자동 FAIL로 단정하지 않은 경계·추출 제한</p></div>${statusBadge('REVIEW', true)}</div>
          <div class="panel__body"><ul class="finding-list finding-list--review">${reviewHtml}</ul></div>
        </article>
      </div>
    </section>

    <section class="section" aria-labelledby="metrics-title">
      <div class="section-head"><div><p class="eyebrow">Performance & coverage</p><h2 id="metrics-title">속도와 검증 범위</h2></div><p>파일 열기 시간은 단축키 검사 시간과 분리했습니다.</p></div>
      <div class="grid-2">
        <article class="panel">
          <div class="panel__head"><div><h3>판정 분포</h3><p>20개 파일 기준</p></div><span class="status status--pass status--compact"><span class="status__mark" aria-hidden="true"></span>통과율 ${passRate}%</span></div>
          <div class="panel__body distribution">
            <div class="distribution__track" role="img" aria-label="통과 ${report.result.PASS}개, 확인 필요 ${report.result.REVIEW}개, 불일치 ${report.result.FAIL}개">
              <span class="distribution__pass" title="PASS ${report.result.PASS}"></span><span class="distribution__review" title="REVIEW ${report.result.REVIEW}"></span><span class="distribution__fail" title="FAIL ${report.result.FAIL}"></span>
            </div>
            <div class="legend">
              <div class="legend__item legend__item--pass"><span>PASS · 통과</span><strong>${report.result.PASS}</strong></div>
              <div class="legend__item legend__item--review"><span>REVIEW · 확인</span><strong>${report.result.REVIEW}</strong></div>
              <div class="legend__item legend__item--fail"><span>FAIL · 불일치</span><strong>${report.result.FAIL}</strong></div>
            </div>
            <div class="coverage" aria-label="검증 범위">
              <div class="coverage__item"><strong>${report.result.fullyExtractedTables}/${report.execution.files}</strong><span>표 8개 항목 전부 추출 (${extractRate}%)</span></div>
              <div class="coverage__item"><strong>${report.result.singleDesignFiles}/${report.execution.files}</strong><span>단일 시안 파일</span></div>
              <div class="coverage__item"><strong>${report.result.multiDesignFiles}/${report.execution.files}</strong><span>복수 시안 파일 · 각 2개</span></div>
            </div>
          </div>
        </article>
        <article class="panel">
          <div class="panel__head"><div><h3>처리 시간</h3><p>가로축 0–5초 · 점선은 2초 목표</p></div><span class="status status--pass status--compact"><span class="status__mark" aria-hidden="true"></span>${report.readyHotkeyTiming.withinTwoSeconds}/${report.execution.files} 달성</span></div>
          <div class="panel__body timing">
            <div class="timing__row"><span class="timing__name">일반 평균</span><span class="timing__track"><span class="timing__bar" style="display:block;width:${report.readyHotkeyTiming.averageSeconds / 5 * 100}%"></span></span><span class="timing__value">${report.readyHotkeyTiming.averageSeconds}초</span></div>
            <div class="timing__row"><span class="timing__name">일반 최대</span><span class="timing__track"><span class="timing__bar" style="display:block;width:${report.readyHotkeyTiming.maximumSeconds / 5 * 100}%"></span></span><span class="timing__value">${report.readyHotkeyTiming.maximumSeconds}초</span></div>
            <div class="timing__row"><span class="timing__name">연속 사용 평균</span><span class="timing__track"><span class="timing__bar timing__bar--stress" style="display:block;width:${report.repeatedStressTiming.averageSeconds / 5 * 100}%"></span></span><span class="timing__value">${report.repeatedStressTiming.averageSeconds}초</span></div>
            <div class="timing__row"><span class="timing__name">연속 사용 최대</span><span class="timing__track"><span class="timing__bar timing__bar--max" style="display:block;width:${report.repeatedStressTiming.maximumSeconds / 5 * 100}%"></span></span><span class="timing__value">${report.repeatedStressTiming.maximumSeconds}초</span></div>
            <div class="timing__axis"><span>0초</span><span>2초 목표</span><span>5초</span></div>
            <div class="timing__note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg><span><strong>일반 단축키 검사는 목표를 충족했습니다.</strong> 연속 사용 수치는 약 80개 문서를 반복해서 연 뒤 Illustrator의 이미지 캡처가 누적 저하된 스트레스 조건이며, 평상시 결과와 분리해 해석해야 합니다.</span></div>
          </div>
        </article>
      </div>
    </section>

    <section class="section" aria-labelledby="detail-title">
      <div class="section-head"><div><p class="eyebrow">File-level evidence</p><h2 id="detail-title">파일별 상세 결과</h2></div><p>상태 버튼과 검색으로 필요한 시안만 빠르게 확인할 수 있습니다.</p></div>
      <div class="toolbar" aria-label="상세 결과 도구">
        <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg><label for="result-search">시안명, 파일명, 원단, 판정 사유 검색</label><input id="result-search" type="search" placeholder="시안명, 파일명, 원단, 사유 검색" autocomplete="off"></div>
        <div class="filters" role="group" aria-label="판정 상태 필터">
          <button class="filter" type="button" data-filter="ALL" aria-pressed="true">전체 ${report.execution.files}</button>
          <button class="filter" type="button" data-filter="PASS" aria-pressed="false">PASS ${report.result.PASS}</button>
          <button class="filter" type="button" data-filter="REVIEW" aria-pressed="false">REVIEW ${report.result.REVIEW}</button>
          <button class="filter" type="button" data-filter="FAIL" aria-pressed="false">FAIL ${report.result.FAIL}</button>
        </div>
        <div class="actions">
          <a class="download" href="실전검사_상세결과.csv" download><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>CSV</a>
          <a class="download" href="실전검사_상세결과.json" download><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>JSON</a>
          <button class="print" type="button" id="print-report"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z"/></svg>인쇄</button>
        </div>
      </div>
      <p class="result-count" id="result-count" aria-live="polite"><strong>${report.execution.files}</strong>개 결과 표시</p>
      <div class="table-wrap" id="result-table-wrap">
        <table>
          <caption>야구점퍼 시안 20개 파일별 검사 결과</caption>
          <thead><tr><th scope="col">번호 / 날짜</th><th scope="col">시안</th><th scope="col">판정</th><th scope="col">대지</th><th scope="col">표 원단 / 채취색</th><th scope="col">세부 판정</th><th scope="col">시간</th><th scope="col">판정 사유</th></tr></thead>
          <tbody>${rowHtml}
          </tbody>
        </table>
      </div>
      <div class="empty" id="empty-state" aria-hidden="true"><strong>검색 조건에 맞는 결과가 없습니다.</strong><br>검색어를 지우거나 다른 상태 필터를 선택해 주세요.</div>
      <noscript><p class="caveat">JavaScript가 꺼져 있어 필터와 검색만 비활성화되었습니다. 전체 결과는 그대로 표시됩니다.</p></noscript>
    </section>

    <section class="section" aria-labelledby="method-title">
      <div class="section-head"><div><p class="eyebrow">Method & limits</p><h2 id="method-title">검사 방식과 해석 기준</h2></div><p>자동 판정이 확실하지 않은 경우 FAIL 대신 REVIEW로 남겼습니다.</p></div>
      <div class="method-grid">
        <article class="method"><span class="method__index">01</span><h3>시안 대지 자동 탐색</h3><p>고정 좌표가 아니라 표의 텍스트 단서와 대지 구성을 사용해 시안 대지를 찾습니다. 이번 테스트에서는 단일 파일 18개와 복수 파일 2개를 처리했습니다.</p></article>
        <article class="method"><span class="method__index">02</span><h3>표와 시안 색상 비교</h3><p>표의 원단 종류·색상번호를 추출하고, 시안 몸통과 소매의 채취색을 컬러판 기준값과 비교했습니다. 명확한 다른 칩 일치만 FAIL로 판정했습니다.</p></article>
        <article class="method"><span class="method__index">03</span><h3>빠른 검사 교차검증</h3><p>빠른 검사와 전체 검사에서 시안 수·표 항목·몸통색이 20/20 일치했습니다. 지원되는 흑·백 소매는 19/19 일치했습니다.</p></article>
      </div>
      <p class="caveat"><strong>현재 제한:</strong> 회색 소매 1건은 #484949로 채취했지만 소매 원단 컬러판 기준이 없어 REVIEW로 유지했습니다. 표의 글자가 윤곽선으로 변환된 파일은 텍스트 항목 일부를 읽지 못할 수 있습니다.</p>
    </section>
  </main>

  <footer>
    <div class="shell footer__inner"><span>검사 환경: Adobe Illustrator · Ctrl+Shift+Q 검사 스크립트</span><span>메일 읽기 전용 · 기존 10개 UID/해시 제외 · 원본 문서 보존 확인</span></div>
  </footer>

  <script>
    (() => {
      const rows = [...document.querySelectorAll('[data-result-row]')];
      const buttons = [...document.querySelectorAll('[data-filter]')];
      const search = document.querySelector('#result-search');
      const count = document.querySelector('#result-count');
      const table = document.querySelector('#result-table-wrap');
      const empty = document.querySelector('#empty-state');
      let active = 'ALL';

      function applyFilters() {
        const query = search.value.trim().toLocaleLowerCase('ko-KR');
        let visible = 0;
        rows.forEach((row) => {
          const statusMatch = active === 'ALL' || row.dataset.status === active;
          const queryMatch = !query || row.dataset.search.includes(query);
          row.hidden = !(statusMatch && queryMatch);
          if (!row.hidden) visible += 1;
        });
        count.innerHTML = '<strong>' + visible + '</strong>개 결과 표시';
        table.hidden = visible === 0;
        empty.setAttribute('aria-hidden', visible === 0 ? 'false' : 'true');
      }

      buttons.forEach((button) => button.addEventListener('click', () => {
        active = button.dataset.filter;
        buttons.forEach((candidate) => candidate.setAttribute('aria-pressed', candidate === button ? 'true' : 'false'));
        applyFilters();
      }));
      search.addEventListener('input', applyFilters);
      document.querySelector('#print-report').addEventListener('click', () => window.print());
    })();
  </script>
</body>
</html>
`;

fs.writeFileSync(outputPath, html, 'utf8');
console.log(JSON.stringify({ ok: true, inputPath, outputPath, files: rows.length, bytes: Buffer.byteLength(html) }, null, 2));
