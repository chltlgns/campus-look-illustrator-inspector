# Requirements — Windows Illustrator drive-path 실제 활성화 복구

상태: ready

## 제품 약속

UNC·rollback·report 계약을 바꾸지 않고 Windows rooted drive-letter argument를 안정적으로
`wslpath`에 전달해 documented default LocalAppData runtime으로 실제 Illustrator 검사를 완료한다.

## 기능 요구사항

| ID | 요구사항 | 인수 기준 | 근거 |
|---|---|---|---|
| REQ-DP-001 | rooted drive-letter path를 forward slash로 정규화한 뒤 configured distribution의 `wslpath`로 변환한다. | no-space `C:\Users\...\runtime`이 정확한 `/mnt/c/.../runtime`을 반환하고 source/runtime resolver와 actual launcher가 통과한다. | EV-D01, EV-D02, EV-D03 |
| REQ-DP-002 | 공백·한글 drive path를 보존하고 drive-relative/malformed path는 fail-closed한다. | palette path positive와 `C:relative` negative가 각각 exit 0, `inspector_root_invalid` nonzero이며 외부 analyzer write 0이다. | EV-D05 |
| REQ-DP-003 | source 변경을 locked regression·Quality·clean Trust·ff-only/post-Quality 뒤 fresh backup으로 기본 C-drive runtime sidecar에 재설치한다. | 기존 26 + 신규 matrix PASS, main exact candidate, 9-entry backup, 6 installed hash, schema2/shortcut/Program JSX/document contract PASS. | EV-D04, EV-D06, EV-D08 |
| REQ-DP-004 | saved designated active AI와 명시적 palette로 실제 운영 계약을 검증한다. | Quiet cold/warm, report JSON/MD/material/PNG, 20-file batch/multi-design, active, Start Menu, actual Ctrl+Shift+Q가 PASS하며 cold/warm 성능이 기록된다. | EV-D01, EV-D05, EV-D07 |
| REQ-DP-005 | 실패 복구와 parent·legacy·customer data·remote/API 경계를 보존한다. | structural/contract/document failure는 current=post target만 rollback; 기존 문서 save/close 0, parent/legacy write 0, remote/API 0, inputs/outputs/backups Git add 0. | EV-D06, EV-D08 |

## 비기능 요구사항

| ID | 품질 속성 | 측정 가능한 목표 | 검증 방법 |
|---|---|---|---|
| NFR-DP-001 | 회귀 안정성 | 기존 26개와 신규 drive-path validation 전부 PASS | commit-bound locked matrices |
| NFR-DP-002 | 실패 폐쇄성 | malformed/relative drive path가 WSL/analyzer 전에 stable error로 종료 | negative test + installed demonstration |
| NFR-DP-003 | 호환성 | UNC direct parser, schema 2, report schema/status, rollback guard 의미 변화 0 | legacy matrices + diff review + actual report validation |
| NFR-DP-004 | 성능 관측 | cold 1회와 warm 반복을 과거 0.82초와 별도 기록 | Quiet JSON phase timings 및 outer timing |
| NFR-DP-005 | 데이터 보존 | 지정 AI·palette 원본 hash와 기존 active/saved document state 변화 0 | before/after SHA-256 및 COM observations |

## 제외 범위

- analyzer·collector 판정 규칙, report schema, PASS/REVIEW/FAIL 의미 변경.
- UNC parser·rollback 알고리즘 재설계, legacy/parent 정리, symlink 전환.
- 지정 폴더 밖 AI 탐색, 기존 열린 문서 저장·종료, Illustrator restart.
- remote·push·PR·배포·network install·외부 API·유료 호출.
