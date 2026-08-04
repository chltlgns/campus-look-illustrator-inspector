# Validation plan — Windows Illustrator drive-path 실제 활성화 복구

상태: ready

## 요구사항 추적표

| 요구사항 | 검증 방법 | 명령·절차 | 기대 결과 | 증거 위치 |
|---|---|---|---|---|
| REQ-DP-001 | test/demonstration | DP-P01 no-space C-drive converter + installed default runtime Quiet | exact `/mnt/c/...`, root setup 통과 | drive-path matrix + Quiet JSON |
| REQ-DP-002 | test | DP-P02 space·한글 drive positive, DP-N01 `C:relative` negative | content preserved; negative `inspector_root_invalid`, write 0 | drive-path matrix |
| REQ-DP-003 | test/inspection | DP-R01 기존 UNC·resolver·rollback preservation, 기존 26 matrix, Quality/Trust/integration, backup/install hash 대조 | 30/30 locked, clean receipts, 9 targets와 installed contract PASS | ORBIT receipts + Git 밖 manifest |
| REQ-DP-004 | demonstration | saved readiness 뒤 explicit Quiet cold/warm, report artifact/schema/status, 20 AI batch/designCount, active, Start Menu, hotkey | execution/report/document/input preservation PASS; cold/warm timings 기록 | Git 밖 runtime/batch summary + sanitized ORBIT evidence |
| REQ-DP-005 | inspection/recovery | parent/legacy/remote/tracked binary/document/input hash 대조; failure 시 manifest rollback | prohibited writes/calls 0; guarded restore mismatch 0 | boundary snapshot + blocker/rollback receipt |

## 신규 locked validation inventory

| ID | selector | exit/code/write/assertion 계약 |
|---|---|---|
| DP-P01 | `test_no_space_drive_path_is_normalized_before_wslpath` | exit 0, stdout exact `/mnt/c/Users/GOLD/AppData/Local/Campuslook/IllustratorProofCheck/runtime`, write 0 |
| DP-P02 | `test_space_and_unicode_drive_path_is_preserved` | exit 0, normalized output retains space/Unicode path segments, write 0 |
| DP-N01 | `test_drive_relative_path_is_fail_closed` | stable nonzero, stderr contains `inspector_root_invalid`, external write 0 |
| DP-R01 | `test_unc_and_non_drive_regressions_remain_locked` | localhost/dollar positives, mismatch negative, resolver ordering and rollback profile references unchanged |

profile은 ordered ID `DP-P01`, `DP-P02`, `DP-N01`, `DP-R01`과 exact selector를 hash-lock한다.
기존 legacy 8, cutover 12, UNC/rollback recovery 6을 별도 profile로 그대로 재실행한다.

## 실패·복구·보안 시험

- no-space drive path backslash loss 재현이 candidate에서 제거됐는지 확인.
- drive-relative/malformed drive input이 external WSL analyzer 전에 fail-closed하는지 확인.
- WSL UNC localhost/dollar와 distribution mismatch 회귀.
- missing sidecar/files, runtime-inside-source 회귀.
- rollback current=post 전체 guard와 pre-equal no-op 회귀.
- actual 전 Program JSX hash+mtime, Illustrator process/docs, 20 input와 palette hash snapshot.
- actual failure 시 current=post hash가 맞는 target만 fresh backup으로 rollback하고 pre-state mismatch 0 확인.

## Release 기준

- 기존 locked 8/8 + 12/12 + 6/6, 신규 drive-path 4/4 PASS.
- migration verifier, lint, syntax, Node tests, diff/ancestry PASS.
- candidate Quality, 다른 verifier clean Trust, ff-only integration, integrated OID post-Quality PASS.
- fresh 9-entry backup, default C-drive runtime installed positive/negative, Program JSX/document preservation PASS.
- explicit Quiet cold/warm와 report JSON/MD/material/PNG 계약 PASS.
- 20-file batch executionSuccessCount=20, input hash 변화 0, originalDocumentPreserved=true.
- multi-design은 designCount>1 file count를 사실대로 기록한다. 0이면 기능 실패로 꾸미지 않고 dataset observation으로 기록한다.
- active checker, Start Menu shortcut, actual Ctrl+Shift+Q의 report timestamp/status와 document preservation PASS.
- cold/warm performance를 과거 0.82초와 별도 기록.

## 외부 설정·사용자 검증

- 새 Gate가 base `756e554ea8239fdbb3f32935875707b6a41d392c`, source 구현·integration,
  fresh Windows backup/install/rollback 및 실제 Illustrator actions를 승인해야 한다.
- 현재 active designated test AI와 default palette가 존재하지만 actual 직전에 다시 Saved/path/hash를 확인한다.
- Windows backup/runtime/output은 Git 밖이며 raw customer filename/content를 ORBIT 문서에 기록하지 않는다.
- 기존 열린 3개 문서는 save/close하지 않는다. test AI를 batch가 원본 active state로 보존하지 못하면 즉시 BLOCKED한다.
- network install, external API, paid calls는 0이다.
