# Validation plan — Windows Illustrator cutover v01

상태: complete

## Candidate locked validation

- planned profile: `quality/orbit-validation-windows-cutover-v01.json`
- locked ID count: `12`
- ordered IDs: `CW-P01`, `CW-P02`, `CW-P03`, `CW-P04`, `CW-P05`, `CW-P06`, `CW-N01`, `CW-N02`, `CW-N03`, `CW-N04`, `CW-N05`, `CW-R01`
- candidate test runner는 temp directory와 synthetic fixture만 쓰며 installed Windows state, actual Illustrator, customer data를 변경하지 않는다.

| ID | 요구사항 | 시나리오 | 기대 결과 | 허용 write |
|---|---|---|---|---|
| CW-P01 | CR-003~004 | sidecar schema 2의 source/runtime positive resolution | new repo identity, Ubuntu, external runtime canonical path 반환 | temp fixture only |
| CW-P02 | CR-003~004 | parameter/environment/sidecar precedence | 각 source/runtime pair가 지정 우선순위대로 동일 contract 반환 | temp fixture only |
| CW-P03 | CR-002 | Windows preflight inventory와 backup manifest fixture | present/absent, SHA-256, source/destination path가 deterministic | temp backup only |
| CW-P04 | CR-010 | hash-guarded rollback positive fixture | expected post hash일 때 old bytes/absence가 정확히 복원 | temp fixture only |
| CW-P05 | CR-003, CR-007 | launcher output/cache path calculation | 모든 runtime output이 external runtime 하위이고 repo writes 0 | temp runtime only |
| CW-P06 | CR-007~009 | CLI/schema/status/Quiet/performance contract regression | schema 3, output names, status/exit 분리, timing field 유지 | synthetic temp output only |
| CW-N01 | CR-006 | missing/malformed/legacy/incomplete source root matrix | 각 case `inspector_root_invalid`, external spawn 0 | temp fixture only |
| CW-N02 | CR-003, CR-006 | missing/malformed/repo-equal/repo-child runtime root | 각 case `inspector_root_invalid`, repo writes 0 | temp fixture only |
| CW-N03 | CR-010 | rollback current-hash drift | unrelated drift를 overwrite/delete하지 않고 stable nonzero | temp fixture only |
| CW-N04 | CR-002, CNR-010 | helper default/preflight mode | explicit apply/rollback flag 없이는 Windows destination write 0 | temp fixture only |
| CW-N05 | CR-011, CNR-001~002, CNR-008~009 | tracked data/secret/parent/remote boundary | forbidden artifacts·secrets·parent drift·remote 모두 0 | zero |
| CW-R01 | CR-011 | legacy 8 validation + lint/check/test/migration replay | 기존 8/8와 새 suite 모두 PASS | temp fixtures only |

각 validation receipt는 ID, selector, exact command, expected exit/code/write/assertion과 candidate OID를 포함해야 한다. row count나 prose만으로 PASS하지 않는다.

## Windows external validation

Windows external action은 candidate clean Trust와 main integration/post-Quality 뒤 순서대로 실행한다.

| ID | 요구사항 | 절차 | PASS 기준 | 실패 시 |
|---|---|---|---|---|
| WX-01 | CR-001~002 | preflight 재확인 후 timestamped backup과 manifest 생성·재해시 | 모든 present bytes hash match, absent entries 기록, parent/doc baseline 고정 | installer 실행 금지 |
| WX-02 | CR-004~005 | installer를 explicit new UNC root/Ubuntu/external runtime으로 실행 | installed 6 source/sidecar/shortcut hash·fields 일치; equal program JSX write 0 | 즉시 structural rollback |
| WX-03 | CR-003~006 | installed resolver positive + temp negative matrix | source=new repo, runtime=Git 밖; 5 negative case spawn 0 `inspector_root_invalid` | rollback |
| WX-04 | CR-007 | 지정 AI explicit Quiet cold run | exit 0, one-line JSON ok, required output files, schema/status contract PASS | process/contract failure면 rollback; design status는 별도 기록 |
| WX-05 | CR-009 | same input/runtime warm 최소 3회 | 각 실행 contract PASS, phase timings와 median/min/max 기록 | exact BLOCKED/FAIL 원인 기록 |
| WX-06 | CR-008 | saved designated active document Quiet run | expected designCount/status mapping, pre-existing doc state drift 0 | 중단; document drift면 rollback 판정 |
| WX-07 | CR-008 | designated multi-design AI run | designCount>=2 또는 사용자 기대 count, 각 design label/status/artboard valid | 적합 fixture 없으면 BLOCKED |
| WX-08 | CR-005, CR-008 | `.lnk` direct invocation 후 실제 Ctrl+Shift+Q | installed active checker를 통해 결과가 한 번 생성되고 hotkey property 유지 | BLOCKED 후 shortcut/launcher 판정 |
| WX-09 | CR-010~011 | post source/parent/legacy/remote/document/backup 비교 | 예상 Windows delta만 존재, parent/legacy/remote/doc drift 0, rollback preconditions valid | drift를 덮어쓰지 않고 BLOCKED |

## 출력 계약 검사

실제 run마다 원시 output은 Git 밖 timestamped directory에 두고 다음만 검증한다.

- `result/report.json`, `result/report.md`
- `result/material-color-reference.json`, `.csv`
- `proof/document.json`, `proof/artboard-*.png`
- report `schemaVersion=3`, `designCount=designs.length`
- `overallStatus`와 designs status가 PASS/REVIEW/FAIL 집합이며 FAIL 우선, 다음 REVIEW 결합 규칙을 만족
- exit 0은 report 생성 성공이며 content FAIL과 분리
- Quiet stdout 마지막 JSON이 `ok`, `status`, `designCount`, `designs`, `report`, `phaseTimings`를 제공

ORBIT/Git에는 raw AI/report/PNG를 복사하지 않고 sanitized status/count/timing과 directory manifest digest만 기록한다.

## 성능 계획

- cold: fresh external runtime root, palette cache 없음, 1회
- warm: same input, palette, runtime root, 최소 3회
- 기록: total seconds, palette cache ms, Illustrator ms, analyzer ms, report performance, sample count, median/min/max
- historical 0.82초는 2026-08-03 legacy reference로만 표시하고 새 평균·median과 합치지 않는다.

## 사용자 handoff와 중단 조건

Gate 승인 답변과 별도로 test AI exact path, expected design count, active readiness가 필요하다. 현재 Illustrator에는 unsaved active document가 있으므로 사용자가 test document를 준비하기 전 WX-06~08은 실행하지 않는다. test AI가 없으면 WX-04~08을 임의 데이터로 대체하지 않고 scope를 정확히 BLOCKED로 남긴다.

## Release 기준

- 12/12 candidate locked validation, Quality, clean independent Trust, ff-only integration/post-Quality PASS
- WX-01~03 structural cutover PASS
- 실제 test AI가 제공되면 WX-04~09 PASS; 제공되지 않거나 fixture가 요구 시나리오를 충족하지 않으면 exact BLOCKED
- installed launcher/sidecar/shortcut이 새 source/runtime root를 사용
- parent/legacy/open documents/remote 불변
- backup rollback readiness PASS
- network/API/paid operation 0, 예상 추가비용 0원
