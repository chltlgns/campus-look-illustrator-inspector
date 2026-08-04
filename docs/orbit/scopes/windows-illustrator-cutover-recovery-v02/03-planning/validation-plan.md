# Validation plan — Windows Illustrator UNC 및 rollback 복구 전환

상태: ready

## 요구사항 추적표

| 요구사항 | 검증 방법 | 명령·절차 | 기대 결과 | 증거 위치 |
|---|---|---|---|---|
| REQ-R2-001 | test | installed/source launcher에 localhost·dollar UNC를 입력 | 정확한 Linux root, external command 경계 통과 | recovery locked matrix + actual Quiet |
| REQ-R2-002 | test | mismatched distribution, empty UNC path | `inspector_root_invalid`, AI open 0 | recovery negative matrix |
| REQ-R2-003 | test/demonstration | protected pre-equal fixture rollback + actual old backup manifest | exit 0, write 0, 전체 pre-state 일치 | recovery matrix + Windows manifest |
| REQ-R2-004 | inspection/test | Quality/Trust/integration 후 fresh backup/install hash 대조 | 6 installed hashes, schema2, shortcut, Program JSX mtime/hash, document state PASS | ORBIT receipts + Git 밖 manifest |
| REQ-R2-005 | demonstration | saved readiness 뒤 지정 input으로 Quiet cold/warm, batch/multi, active, Start Menu, hotkey | exit/JSON/schema/status/output/document preservation/성능 PASS 또는 BLOCKED | Git 밖 runtime summary + sanitized ORBIT evidence |
| REQ-R2-006 | inspection | remote/tracked artifact/parent/legacy/process 경계 전후 대조 | 이 작업의 금지 write 0; 외부 drift 분리 | final Trust evidence |

## 실패·복구·보안 시험

- UNC server/share/path malformed 및 distribution mismatch.
- source missing files/identity, sidecar missing/schema invalid, runtime nested in source.
- rollback current-vs-post unrelated drift 거부.
- rollback protected current=pre no-op 및 changed current=post restore.
- actual failure 시 current=post일 때만 fresh backup으로 rollback.

## Release 기준

- 기존 locked validation 8/8와 v01 12/12 PASS.
- 신규 recovery ordered matrix 전부 PASS.
- migration verifier, lint/syntax/node/python, diff/ancestry PASS.
- candidate Quality, independent clean Trust, post-integration Quality PASS.
- installed structural contract PASS.
- saved readiness 뒤 actual contract PASS 또는 정확한 BLOCKED/rollback.

## 외부 설정·사용자 검증

- 새 Gate가 base `869e23dafe42da1c87fa4d38b19c60f771d30444`와 외부 Windows actions를 승인해야 한다.
- Program JSX가 expected installed hash와 다르면 설치 전 BLOCKED.
- 사용자는 실제 회귀 전에 지정 test AI를 active로 열고 저장 완료 상태를 알려야 한다.
- Windows backup/output은 Git 밖에 두고 raw 이름·내용을 ORBIT 문서에 기록하지 않는다.
