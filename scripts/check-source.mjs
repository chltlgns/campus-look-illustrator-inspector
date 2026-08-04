#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lintOnly = process.argv.includes('--lint');
const productSources = [
  'analyze-proof.mjs',
  'build-live-test-html.mjs',
  'build-live-test-report.mjs',
  'check-illustrator.sh',
  'check-proof.sh',
  'inspect-illustrator.ps1',
  'illustrator/CampuslookProofCheck.jsx',
  'illustrator/FastProofInspector.jsx',
  'illustrator/batch-check-ai.ps1',
  'illustrator/check-active-illustrator.ps1',
  'illustrator/inspector-root.ps1',
  'illustrator/install-illustrator-script.ps1',
  'illustrator/run-proof-check.ps1',
];

function fail(message) {
  console.error(`source_check_failed: ${message}`);
  process.exitCode = 1;
}

function run(command, args, label, environment = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout || `exit ${result.status}`;
    fail(`${label}: ${detail.trim()}`);
  }
}

for (const relativePath of productSources) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`missing product source: ${relativePath}`);
    continue;
  }
  const text = fs.readFileSync(absolutePath, 'utf8');
  if (/[ \t]+$/m.test(text)) fail(`trailing whitespace: ${relativePath}`);
  if (/\/home\/[^/]+\/campus-look-ops(?:\/|$)/.test(text)) {
    fail(`legacy parent absolute path: ${relativePath}`);
  }
  if (/\.\.\/lib\/(?:naver-credentials|naver-imap)\.mjs/.test(text)) {
    fail(`parent credential dependency: ${relativePath}`);
  }
}

if (!lintOnly) {
  for (const relativePath of productSources.filter((entry) => entry.endsWith('.mjs'))) {
    run(process.execPath, ['--check', relativePath], `node syntax ${relativePath}`);
  }
  for (const relativePath of productSources.filter((entry) => entry.endsWith('.sh'))) {
    run('bash', ['-n', relativePath], `bash syntax ${relativePath}`);
  }

  const powershellCandidates = [
    process.env.POWERSHELL_EXE,
    '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    'powershell.exe',
  ].filter(Boolean);
  let powershell = null;
  for (const candidate of powershellCandidates) {
    const probe = spawnSync(candidate, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'exit 0']);
    if (!probe.error && probe.status === 0) {
      powershell = candidate;
      break;
    }
  }
  if (!powershell) {
    fail('Windows PowerShell 5.1 parser is unavailable');
  } else {
    for (const relativePath of productSources.filter((entry) => entry.endsWith('.ps1'))) {
      const linuxPath = path.join(root, relativePath);
      const converted = spawnSync('wslpath', ['-a', '-w', linuxPath], { encoding: 'utf8' });
      if (converted.error || converted.status !== 0) {
        fail(`wslpath conversion ${relativePath}`);
        continue;
      }
      const windowsPath = converted.stdout.trim().replaceAll("'", "''");
      const parserCommand = [
        '$tokens = $null',
        '$parseErrors = $null',
        `$sourceText = [IO.File]::ReadAllText('${windowsPath}', [Text.UTF8Encoding]::new($false))`,
        `[Management.Automation.Language.Parser]::ParseInput($sourceText, '${windowsPath}', [ref]$tokens, [ref]$parseErrors) | Out-Null`,
        'if ($parseErrors.Count -gt 0) { $parseErrors | ForEach-Object { [Console]::Error.WriteLine($_.Message) }; exit 1 }',
      ].join('; ');
      run(
        powershell,
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', parserCommand],
        `PowerShell syntax ${relativePath}`,
      );
    }
  }
}

if (!process.exitCode) {
  console.log(lintOnly ? 'source lint: PASS' : 'source syntax and lint: PASS');
}
