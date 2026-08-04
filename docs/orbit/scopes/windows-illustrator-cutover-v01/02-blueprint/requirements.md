# Requirements — Windows Illustrator cutover v01

상태: complete

## 기능 요구사항

| ID | 요구사항 | 인수 기준 | 근거 |
|---|---|---|---|
| CR-001 | 설치 전 baseline | main OID, target/parent status digest, remote 0, legacy 12-source digest, LocalAppData files, sidecar/env, shortcut, program JSX, Illustrator process/document count·saved-state를 raw 고객 경로 없이 기록한다. | EV-C01~C08, EV-C13 |
| CR-002 | 복구 가능한 backup | Windows write 전에 LocalAppData 설치 폴더, shortcut, program JSX의 존재/부재와 bytes를 timestamped Git 밖 backup에 보존하고 SHA-256 manifest를 만든다. backup 검증 실패 시 installer를 실행하지 않는다. | EV-C09 |
| CR-003 | 외부 runtime root | launcher는 parameter → environment → sidecar 순으로 Git 밖 runtime root를 얻고 cache/report/PNG/document JSON을 그 아래에만 쓴다. repo 내부·누락·잘못된 runtime root는 `inspector_root_invalid`로 거부한다. | EV-C10, EV-C11 |
| CR-004 | 새 저장소 root 설치 | installer sidecar는 schema 2, 새 저장소 Windows UNC root, Ubuntu, LocalAppData runtime root를 기록한다. installed launcher/resolver/source normalized SHA는 승인 candidate와 같아야 한다. | EV-C03, EV-C04, EV-C09 |
| CR-005 | shortcut·JSX 운영 경로 | shortcut은 installed active checker와 LocalAppData working directory, Ctrl+Shift+Q를 유지한다. program JSX는 candidate와 hash가 다를 때만 복사하며 현재 실행 중 Illustrator를 종료하지 않는다. | EV-C05, EV-C06, EV-C14 |
| CR-006 | installed fail-closed | installed resolver copy로 missing sidecar, malformed sidecar, wrong/legacy root, missing required file, repo-inside runtime root를 temp fixture에서 검사하고 모두 external spawn 전 `inspector_root_invalid` nonzero로 실패시킨다. | EV-C11 |
| CR-007 | 실제 AI 출력 계약 | 사용자 지정 AI와 configured palette로 Git 밖 timestamped output에 report JSON/Markdown, material reference JSON/CSV, document JSON과 proof PNG를 생성한다. schema 3, 파일명, designCount, PASS/REVIEW/FAIL 결합 규칙과 exit/status 분리를 확인한다. | EV-C01, EV-C08, EV-C16 |
| CR-008 | 운영 진입 경로 회귀 | explicit-path Quiet JSON, saved designated active document, 다중 시안, Start Menu shortcut, 실제 Ctrl+Shift+Q를 단계적으로 확인한다. test fixture가 다중 시안을 포함하지 않으면 해당 항목을 PASS로 만들지 않고 BLOCKED로 기록한다. | EV-C05, EV-C07, EV-C15, EV-C16 |
| CR-009 | 새 성능 측정 | fresh runtime root의 cold 1회와 같은 cache의 warm 최소 3회를 측정해 total, palette cache, Illustrator, analyzer timing과 표본 수를 기록한다. historical 0.82초와 직접 합치지 않는다. | EV-C01, EV-C12 |
| CR-010 | rollback | structural post-install, installed root, shortcut, contract, document-preservation 검증 실패 시 새 launcher 실행을 중단하고 pre-backup의 expected hashes가 맞을 때만 LocalAppData/shortcut/변경된 JSX를 복원한다. 원래 없던 resolver/sidecar는 manifest에 따라 제거한다. | EV-C09, EV-C13~C15 |
| CR-011 | 최종 증거 | candidate Quality, locked validation, clean independent Trust, ff-only integration, post-Quality, Windows post-state, actual regression, rollback readiness, parent/legacy pre-post digest를 scope 증거에 결속한다. | EV-C02, EV-C12, EV-C13 |

## 비기능 요구사항

| ID | 품질 속성 | 측정 가능한 목표 | 검증 방법 |
|---|---|---|---|
| CNR-001 | 데이터 격리 | tracked AI/PDF/PNG/report/cache/backup 0; 실제 입력·원시 출력·Windows backup은 Git 밖에만 존재 | `git status`, tracked deny 검사, runtime canonical path assertion |
| CNR-002 | parent/legacy 보존 | parent HEAD/status digest와 legacy 12-source digest가 baseline과 동일하고 write command 0 | sanitized pre/post digest, migration verifier |
| CNR-003 | 열린 문서 보존 | 검사 전 존재한 document count와 active saved-state fingerprint에 의도치 않은 drift 0; 기존 문서 save/close 0 | pre/post COM metadata와 runner record; 이름/path 미수집 |
| CNR-004 | fail-closed | backup/root/runtime/sidecar/shortcut/contract precondition 실패 시 후속 외부 action 0 또는 즉시 rollback | ordered validation receipt와 spawn/install counter |
| CNR-005 | 복구성 | backup manifest의 모든 present file hash가 실제 backup과 같고 absent 항목이 구분되며 rollback 절차가 deterministic | temp fixture rollback test + post-backup verification |
| CNR-006 | 호환성 | Windows PowerShell 5.1, WSL Ubuntu, Node 24, Illustrator 2025; network dependency 추가 0 | parser, local Quality, installed version inspection |
| CNR-007 | 성능 증거 | cold 1 + warm >=3, phase timing과 median/min/max 기록; 0.82초는 historical label 유지 | actual Quiet JSON timing summary |
| CNR-008 | 비밀·개인정보 최소화 | ORBIT/Git 증거에 고객 파일명, raw report body, AI contents 0; path는 user-provided locator로만 일시 사용 | evidence review와 secret/data scanner |
| CNR-009 | 비용·외부 경계 | remote/push/PR/deploy/network install/API/paid call 0; 추가 비용 0원 | command ledger, `git remote -v`, network action inventory |
| CNR-010 | 승인 경계 | Gate approval 전 product source/Windows writes 0; 승인 scope/base 밖 변경 0 | Git diff, Gate attestation, Windows pre-state timestamps/hashes |

## 실행 전 필수 사용자 입력

- 비민감 실제 회귀 AI의 exact Windows 또는 WSL path
- 그 AI가 단일/다중 시안 중 무엇인지와 예상 design count; 다중 시안 확인용이 아니면 별도 지정 파일
- active/hotkey 단계 직전 해당 test AI가 저장된 활성 문서이며 기존 미저장 작업을 건드리지 않아도 된다는 사용자 확인

## 명시적 제외

- parent app integration과 parent source/test/ORBIT 변경
- 기존 검사기 source 폴더 수정·삭제·symlink
- 사용자가 지정하지 않은 고객 데이터 탐색
- 기존 열린 Illustrator 문서의 save/close 또는 Illustrator process restart
- remote/push/PR/deploy/network install/API/paid operation
- 모든 검증 전 legacy 검사기 제거
