# Requirements — Windows Illustrator UNC 및 rollback 복구 전환

상태: ready

## 제품 약속

v01의 출력·상태 계약을 바꾸지 않고 Windows WSL UNC와 rollback 실제 활성화 결함만 복구한다.

## 기능 요구사항

| ID | 요구사항 | 인수 기준 | 근거 |
|---|---|---|---|
| REQ-R2-001 | validated `\\wsl.localhost\<distro>\<path>`와 `\\wsl$\<distro>\<path>` source root를 Linux 절대경로로 직접 변환한다. | 두 형식이 `/home/doggabiya/campus-look-illustrator-inspector`로 변환되고 실제 launcher가 root conversion을 통과한다. | EV-003, EV-004 |
| REQ-R2-002 | UNC distribution이 configured distribution과 다르거나 path가 비면 fail-closed한다. | 외부 process·AI open 전에 stable `inspector_root_invalid` nonzero. | EV-004 |
| REQ-R2-003 | rollback 전체 post-state guard를 유지하면서 이미 pre-state인 entry는 쓰지 않는다. | 보호 JSX가 read-only/권한 제한이어도 current hash=pre hash이면 rollback exit 0, 9개 pre-state 일치. | EV-005 |
| REQ-R2-004 | 새 candidate를 Quality/clean Trust/ff-only/post-Quality 뒤 fresh backup으로 재설치하고 구조 계약을 보존한다. | 6개 file hash, schema2 sidecar, shortcut/hotkey, negative root, Program JSX hash+mtime, 열린 문서 상태가 모두 기대값과 일치. | EV-001, EV-002, EV-006 |
| REQ-R2-005 | saved active readiness 뒤 지정 AI만으로 실제 계약과 성능을 검증한다. | Quiet cold/warm, report JSON/MD/material/PNG, designCount, active, batch/multi, Start Menu, Ctrl+Shift+Q가 PASS하거나 정확한 BLOCKED. | EV-007, EV-008 |
| REQ-R2-006 | parent·legacy·customer data·remote/API 경계를 보존한다. | 이 작업의 parent/legacy write 0, tracked binary 0, remote 0, 외부 API 0; 외부 parent lock drift는 분리 기록. | EV-009 |

## 비기능 요구사항

| ID | 품질 속성 | 측정 가능한 목표 | 검증 방법 |
|---|---|---|---|
| NFR-R2-001 | 회귀 안정성 | 기존 8 + v01 12 locked validation과 신규 recovery validation 전부 PASS | clean detached Quality/Trust |
| NFR-R2-002 | 실패 폐쇄성 | invalid UNC, mismatch distribution, missing sidecar/files가 외부 process 전에 차단 | negative test + installed demonstration |
| NFR-R2-003 | 복구 안전성 | rollback은 current=post 전체 검증 후 pre-equal no-op 또는 backup 복원만 수행 | fixture + actual manifest replay |
| NFR-R2-004 | 성능 관측 | 새 cold/warm 값을 각각 측정하고 과거 0.82초와 별도 기록 | actual launcher timings |

## 제외 범위

- analyzer·schema 의미 변경, UI 개선, 다른 garment category.
- legacy/parent 정리, symlink 전환, 기존 검사기 삭제.
- 지정되지 않은 AI나 고객 파일 탐색.
- 원격 저장소·네트워크 설치·외부 API·유료 호출.
