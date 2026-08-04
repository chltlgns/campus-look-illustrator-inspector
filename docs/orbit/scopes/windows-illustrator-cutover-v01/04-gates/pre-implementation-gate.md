# Pre-implementation gate — Windows Illustrator 운영 전환 및 실제 AI 회귀

- 상태: APPROVED_FOR_IMPLEMENTATION
- 생성일: 2026-08-04
- 프로필: strict
- lifecycle scope: `windows-illustrator-cutover-v01`
- dependency: completed `inspector-source-split-v01`
- 승인 Git base: `d93a0157d8e7d757ed99f0cf7ba74a9af1c35300`

## 현재 설치 판정

- installed launcher SHA는 legacy source와 같고 `/home/doggabiya/campus-look-ops/일러스트 확인용 스크립트`를 하드코딩한다.
- installed `inspector-root.ps1`과 `inspector-root.json`은 없다.
- Start Menu shortcut은 installed active checker, LocalAppData working directory, Ctrl+Shift+Q로 정상 등록돼 있다.
- Illustrator 2025는 1 process, 3 documents이며 active document는 unsaved다. 지금 active/hotkey test는 금지한다.
- program `Campuslook Proof Check.jsx`는 새 source와 hash-equal이므로 install 시점에도 같으면 write/restart하지 않는다.
- configured palette는 존재하지만 실제 regression AI exact path는 아직 사용자 입력이 필요하다.

## 승인할 구현 범위

1. base `d93a015...`의 isolated candidate에서 source/runtime root를 분리한다.
2. sidecar schema 2에 new repository UNC root, Ubuntu, Git 밖 LocalAppData runtime root를 필수 기록한다.
3. resolver/launcher/installer가 parameter → environment → sidecar precedence, required source identity, external runtime canonical path를 fail-closed 검증하도록 변경한다.
4. cache, report, material reference, PNG, document JSON, regression output을 external runtime root 아래에만 생성한다.
5. Windows 설치 대상의 read-only preflight, byte backup manifest와 current-hash guarded rollback을 제공하는 local helper를 구현한다.
6. migration target hashes, README/VALIDATION/integration contract와 source parser를 갱신한다.
7. `CW-P01~P06`, `CW-N01~N05`, `CW-R01` 12개 locked local validation과 기존 8개 regression을 candidate OID에 결속한다.
8. candidate Quality와 다른 verifier의 clean Trust PASS 뒤 main에만 ff-only integrate/post-Quality한다. 기존 dirty ORBIT control-plane과 보존 worktree는 reset/clean/delete하지 않는다.

## 승인할 Windows external action

1. 설치 직전 LocalAppData installed folder, Start Menu shortcut, program JSX의 path/presence/bytes를 Git 밖 timestamped backup에 저장하고 SHA-256 manifest를 재검증한다.
2. 승인·통합된 새 repository installer를 explicit new UNC root, Ubuntu, external runtime root로 실행한다.
3. LocalAppData의 launcher, active checker, Fast inspector, batch checker, staged JSX, root resolver를 create/update하고 schema-2 sidecar를 생성한다.
4. Start Menu `Illustrator Proof Check.lnk`를 installed active checker + Ctrl+Shift+Q로 refresh한다.
5. program JSX가 candidate와 hash-equal이면 write/restart 0건으로 유지한다. drift면 자동 overwrite·restart하지 않고 BLOCKED다.
6. installed resolver의 positive resolution과 temp fixture negative matrix를 실행한다. 실제 sidecar를 rename/delete하지 않는다.
7. user-designated test AI가 제공되면 Git 밖 runtime에서 explicit Quiet, cold/warm, saved active, multi-design, shortcut, 실제 Ctrl+Shift+Q 회귀를 수행한다.
8. structural/contract/document-preservation 실패 시 다른 drift가 없음을 hash로 확인한 뒤 backup에서 LocalAppData/shortcut/실제로 변경된 JSX만 복원한다.

## 변경될 정확한 Windows 대상

- `C:/Users/GOLD/AppData/Local/Campuslook/IllustratorProofCheck/run-proof-check.ps1`
- 같은 폴더의 `check-active-illustrator.ps1`, `FastProofInspector.jsx`, `batch-check-ai.ps1`, `CampuslookProofCheck.jsx`
- 같은 폴더의 `inspector-root.ps1`, `inspector-root.json`
- `C:/Users/GOLD/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Campuslook/Illustrator Proof Check.lnk`
- runtime create: `C:/Users/GOLD/AppData/Local/Campuslook/IllustratorProofCheck/runtime`
- program JSX는 현재 hash-equal이므로 write 대상이 아니다. install 직전 drift면 중단한다.

## 검증과 rollback

- candidate: 12/12 new locked validation, legacy 8/8, lint/check/test/migration, Quality, clean Trust, post-Quality
- installed: source/runtime/sidecar/shortcut hashes와 properties, negative root/runtime matrix, external spawn 0
- actual: output filenames, schema 3, designCount, status combination, Quiet JSON, active/multi/hotkey, cold 1 + warm >=3 timing
- invariance: parent HEAD/status digest, legacy 12-source digest, remote 0, pre-existing Illustrator document state
- rollback: manifest의 pre hash와 current expected-post hash가 모두 맞을 때만 old bytes/absence 복원; unrelated drift는 overwrite하지 않고 BLOCKED

## 중단 조건

- backup/manifest 불일치
- candidate/Quality/Trust/integration 실패
- program JSX install-time drift
- current unsaved active document 또는 user-designated test AI/expected design count/active readiness 부재
- installed source/runtime/shortcut mismatch 또는 `inspector_root_invalid` negative matrix 실패
- parent/legacy/open-document drift

test AI가 없으면 임의 고객 파일을 찾지 않고 실제 AI 단계만 정확히 BLOCKED로 남긴다. 디자인 `overallStatus=REVIEW/FAIL`은 정상 report contract가 유지되는 한 process failure와 구분한다.

## 명시적 제외와 비용

- campus-look-ops source/Git/ORBIT/process write 0
- legacy 검사기 source folder 수정·삭제·symlink 0
- pre-existing Illustrator document save/close, process restart 0
- raw AI/palette/report/PNG/cache/backup의 Git·ORBIT 첨부 0
- remote/push/PR/deploy/network install/API/paid call 0
- 예상 추가비용: 0원

## 승인 전 점검

- [x] 목표·범위·성공 기준이 사용자 의도와 일치한다.
- [x] legacy launcher, missing sidecar, non-atomic installer, repo-inside runtime, unsaved active document, missing test AI가 추적된다.
- [x] CR-001~011/CNR-001~010, CUT-T01~09, 12 locked + 9 external validation이 연결된다.
- [x] Git candidate, Windows external writes, rollback, 외부/비용 경계가 명시된다.
- [x] actual AI path가 없을 때 임의 데이터 대신 BLOCKED 처리한다.

## 승인 기록

`orbit gate request`의 request ID, digest, full scope text를 사용자가 현재 대화에서 명시적으로 승인한 뒤에만 구현과 Windows write를 시작한다. `conversation-process`에는 signed platform event가 없어 cryptographic user proof가 아니다. 이전 source-split 승인이나 일반적인 “진행”은 이 Gate 승인으로 재사용하지 않는다.

## 실행 승인 증거 — gate-20260804T041337Z-e1483663bd19

- 승인시각(UTC): 2026-08-04T04:40:00+00:00
- 승인자: user
- 승인 문구: 요청 ID gate-20260804T041337Z-e1483663bd19, 요청 SHA-256 fba52beff089aafac8dea1537d9d219e73db725e2056edfd810e54854e70c155의 다음 전체 범위를 승인합니다: 기준 커밋 d93a0157d8e7d757ed99f0cf7ba74a9af1c35300의 isolated candidate에서 Campuslook Illustrator 검사기의 external runtime root와 sidecar schema 2, fail-closed source/runtime resolver, Windows preflight·byte-backup·hash-guarded rollback 도구, 문서·migration target hash·12개 locked validation을 구현한다. candidate Quality와 다른 verifier의 clean Trust PASS 뒤 기존 ORBIT control-plane 변경과 보존 worktree를 reset·clean·삭제하지 않고 새 저장소 main에만 ff-only 통합/post-Quality한다. 그 뒤 설치 직전 기존 LocalAppData 설치 폴더, Start Menu shortcut, program JSX를 Git 밖 timestamped backup과 SHA-256 manifest로 보존하고, 통합된 새 installer로 LocalAppData launcher·checker·collector·resolver·schema-2 sidecar와 Ctrl+Shift+Q shortcut을 새 저장소 UNC root, Ubuntu, Git 밖 LocalAppData runtime root 기준으로 전환한다. program JSX가 install 시점에도 candidate와 hash-equal이면 쓰거나 Illustrator를 재시작하지 않고, drift면 BLOCKED한다. installed positive/negative root 검증 후 사용자가 지정한 비민감 test AI가 제공되고 saved active readiness가 확인된 경우에만 Git 밖 runtime에서 explicit Quiet, cold/warm 성능, active document, multi-design, Start Menu shortcut과 실제 Ctrl+Shift+Q 회귀를 수행한다. structural·contract·document-preservation 실패 시 current hash가 expected post-state와 일치할 때만 backup에서 실제 변경 대상을 rollback한다. campus-look-ops와 legacy 검사기 source, 기존 열린 Illustrator 문서, remote·push·PR·배포·network install·외부 API·유료 호출은 변경하지 않으며 고객 입력·원시 출력·backup을 Git에 추가하지 않는다. 테스트 디렉터리: /mnt/c/Users/GOLD/Desktop/추가_야구점퍼_시안_실전검사_20260803. 다중 시안 포함 여부는 모름.
- request ID: gate-20260804T041337Z-e1483663bd19
- request digest: fba52beff089aafac8dea1537d9d219e73db725e2056edfd810e54854e70c155
- attestation mode: conversation-process
- cryptographic user proof: false
- warning: conversation-process는 signed platform event가 없어 agent self-entry를 기술적으로 방지하지 못합니다.
