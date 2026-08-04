# Implementation log — Windows Illustrator drive-path 실제 활성화 복구

상태: completed

## 승인된 범위

Gate `gate-20260804T061128Z-d03b40a3cc1b`가 승인한 base
`756e554ea8239fdbb3f32935875707b6a41d392c`의 drive-path recovery와 Windows
재전환·실제 회귀 범위만 수행했다. remote, parent, legacy source, 기존 열린 3개 문서,
Program JSX, 외부 API는 변경하지 않았다.

## 구현된 요구사항

| 요구사항 | 변경 파일·구성요소 | 검증 | 결과 |
|---|---|---|---|
| REQ-DP-001 | `illustrator/inspector-root.ps1` rooted drive normalization | DP-P01, installed default runtime, explicit Quiet | pass |
| REQ-DP-002 | 공백·Unicode 보존과 relative/malformed fail-closed | DP-P02/DP-N01, installed positive/negative | pass |
| REQ-DP-003 | 문서·manifest·Quality profile·ff-only integration·Windows 재설치 | 30 locked, Quality/clean Trust/post-Quality, 9-entry backup, installed hash/sidecar/shortcut | pass |
| REQ-DP-004 | 실제 Quiet/active/batch/multi/shortcut/hotkey | 지정 20개 입력과 명시 palette, report contract, document/input preservation | pass |
| REQ-DP-005 | rollback·경계 보존 | current=post eligibility, recovery matrix, parent/legacy/remote/API/input drift 검사 | pass |

## 실행 명령과 결과

- candidate `98d40da5bf7ea9ea00305e4027b1fa7aa499e83a`: source lint/check,
  Node regression, migration verifier, legacy 8 + cutover 12 + recovery 6 + drive 4가 PASS했다.
- 다른 verifier clean Trust와 ff-only integration 뒤 post-Quality가 같은 OID에서 PASS했다.
- legacy 설치 상태를 Git 밖 fresh 9-entry backup으로 보존했다. pre-state는 7 present/2 absent,
  backup hash 오류 0이며 post-state manifest의 current drift는 0이다.
- installer는 6개 BOM file, schema-2 sidecar, Start Menu shortcut을 새 source UNC와 기본
  LocalAppData runtime으로 전환했다. Program JSX SHA-256은 `e0ed0de80902444470941e2804c88844e3e6535caada9e1e066a96dbe5f027e4`,
  mtime은 `2026-08-03T06:37:12.1186567Z`로 전후 동일했다.
- installed resolver는 localhost/dollar UNC, 기본 C-drive runtime, 공백·Unicode drive path를
  통과시켰고 mismatch, empty/malformed UNC, drive-relative, wrong/missing root·sidecar,
  nested runtime을 모두 `inspector_root_invalid`로 fail-closed했다.
- saved active readiness 뒤 explicit Quiet cold는 outer 30.987초/내부 29.8초였다.
  palette cache 26.442초, Illustrator 2.991초, analyzer 0.235초였다.
- warm 3회 outer는 4.605/2.210/3.233초(평균 3.349초), 내부는 3.5/1.1/2.1초
  (평균 2.233초)였다. 과거 0.82초와는 별도 측정으로 기록한다.
- report schema 3, JSON/Markdown/material JSON·CSV/PNG, status 결합과
  `designCount=designs.length` 계약이 PASS했다.
- 20-file batch는 20 success/0 error, report contract error 0,
  `originalDocumentPreserved=true`였다. 내용 판정은 PASS 15, REVIEW 3, FAIL 2이며
  multi-design 2 files, 최대 designCount 2였다.
- installed active checker, Start Menu shortcut, 실제 `Ctrl+Shift+Q`가 모두 report를
  갱신하고 결과 dialog를 생성했다. dialog는 No로 닫았고 Notepad는 열지 않았다.
- 입력 20개, palette, byte-identical staging의 사후 SHA-256 drift는 0이었다.
  Illustrator는 1 process/4 documents, saved-state fingerprint `[true,false,false,false]`,
  active designated test document `Saved=true`를 유지했다.

## 편차·남은 작업·외부 게이트

구조·계약·문서·입력 보존 실패가 없어 실제 rollback은 수행하지 않았다. fresh manifest의
모든 entry가 current=expected-post임을 확인했고, 기존 recovery locked matrix가 guarded
restore와 pre-equal no-op을 재검증했다. 내용 판정 REVIEW 3/FAIL 2는 검사기 실행 회귀가
아니라 사용자가 확인할 실제 시안 검사 결과이며 release blocker로 숨기지 않는다.

Git 밖 원시 증거는 LocalAppData runtime의 `validation/20260804T0635Z`에 있고, backup은
`IllustratorProofCheck.rollback/20260804T063200Z-98d40da`에 있다. 어느 것도 Git에
추가하지 않았다.
