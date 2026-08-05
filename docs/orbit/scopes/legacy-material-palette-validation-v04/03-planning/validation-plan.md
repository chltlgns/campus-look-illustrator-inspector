# Validation plan — 현행·구형 원단 및 소매 원단 혼용 검사

상태: ready

## 요구사항 추적표

| 요구사항 | 검증 방법 | 명령·절차 | 기대 결과 | 증거 위치 |
|---|---|---|---|---|
| REQ-MP-001~004 | test/inspection | MP-P01/MP-P02/MP-N02와 synthetic current/legacy catalog builder | role/generation 분리, source hash, irregular label containment, duplicate/missing 보존 | 신규 validation receipt + catalog fixture summary |
| REQ-MP-005 | test/demonstration | MP-R01 source resolution/cache matrix와 installed three-source cache build | exact role/hash/schema, warm reuse, missing/drift fail-closed | validation + Git 밖 installed cache receipt |
| REQ-MP-006~007 | test | MP-P01~P03, MP-N01~N02 analyzer replay | current/legacy PASS, explicit mismatch FAIL, ambiguity REVIEW, neither/other-number FAIL | per-ID normalized receipt |
| REQ-SL-001~004 | test | SL-P01/SL-P02/SL-N01 parser·decision fixture | exact 동인 회색 34, generic 니플레자 흰/검정, 미등록/충돌과 한계 문구 | per-ID receipt + report fixture |
| REQ-RP-001~002 | test/inspection | MP-R02 schema/CLI/Markdown/dialog contract | schema 4 additive, schema 3 핵심 필드·status/exit 유지, provenance 한국어 표시 | test output + schema inspection |
| REQ-NFR-001 | analysis | 기존 8+12+6+4와 신규 10 locked profile, candidate/Trust/post-Quality | 40/40 ordered ID와 모든 always quality check PASS | ORBIT receipts |
| REQ-NFR-002~003 | demonstration | palette 원본/active document pre/post, cold build/warm reuse, retry fresh marker | hash·saved-state drift 0, warm Illustrator palette open 0 | Git 밖 activation receipt |
| REQ-NFR-004~006 | inspection/recovery | tracked extension/secret/raw scan, path portability, fresh backup·rollback eligibility | forbidden tracked 0, external/API/cost 0, current=post guard와 pre-state mismatch 0 | boundary snapshot + backup manifest |

## 신규 locked validation inventory

| ID | selector | exit/code/write/assertion 계약 |
|---|---|---|
| MP-P01 | `test_current_body_match_reports_current_catalog` | exit 0, PASS, `matchedCatalog=current-body`, legacy candidate가 current를 덮어쓰지 않음, temp fixture write만 |
| MP-P02 | `test_legacy_body_match_is_not_failed_by_current_palette` | exit 0, PASS, `matchedCatalog=legacy-body`, current mismatch가 false FAIL을 만들지 않음 |
| MP-P03 | `test_explicit_generation_mismatch_fails` | exit 0인 test 안에서 analyzer 결과 FAIL/`generation_mismatch`, 외부 write 0 |
| SL-P01 | `test_exact_supplier_finish_sleeve_match` | 동인 민무늬 회색 34 parser key와 registered candidate가 PASS, 디자인 검수 한계 존재 |
| SL-P02 | `test_generic_nippleather_black_white_remains_compatible` | 공백 별칭 포함 흰색·검정 fixture가 family candidate로 PASS/허용 REVIEW 계약, 기존 상수보다 정보 축소 없음 |
| MP-N01 | `test_cross_generation_close_match_is_review` | 양 catalog 허용 범위·margin 부족은 REVIEW/`cross_generation_ambiguous`, PASS 금지 |
| MP-N02 | `test_duplicate_legacy_reference_is_review` | 동일 legacy key의 충돌 후보가 candidates로 보존되고 REVIEW, first/average 자동 선택 금지 |
| SL-N01 | `test_unregistered_or_conflicting_sleeve_is_not_pass` | 미등록 구체 key는 REVIEW, 다른 등록 key 명확 우세는 FAIL, PASS 금지 |
| MP-R01 | `test_catalog_cache_role_hash_retry_and_source_boundaries` | 세 role/hash/schema, warm reuse, missing/drift/fresh marker negative, 원본·tracked raw write 0 |
| MP-R02 | `test_schema_cli_and_prior_locked_regression_contract` | schema 4 additive, 기존 CLI/status/exit, prior 30 profile references와 migration/source policy 유지 |

profile은 위 ordered ID 10개와 exact Python unittest selector를 hash-lock한다. 기존 legacy 8, cutover 12, UNC/rollback 6, drive-path 4를 별도 profile로 그대로 재실행한다.

## 실패·복구·보안 시험

- legacy source 같은 번호에 서로 다른 색 후보를 주입해 first-wins/average가 금지되는지 확인.
- current/legacy same-key가 모두 가까운 fixture와 explicit current인데 legacy만 가까운 fixture를 분리.
- missing role, duplicate role, wrong source hash, wrong schema, empty candidates, stale marker를 analyzer 전에 거부.
- sleeve supplier/finish/number 위치 변형, 일반 흰/검정, 미등록 supplier, exact key와 다른 색을 각각 재생.
- catalog path에 공백·한글이 있어도 sidecar/env/param 경로가 보존되고 source root 안 runtime은 계속 거부.
- 실제 palette build 전후 세 원본 hash와 Illustrator active document path/saved fingerprint 비교.
- installed failure 시 fresh manifest의 모든 current=post를 먼저 확인하고 실제 변경 target만 byte rollback.
- Git tracked 파일에서 AI/PDF/EPS/JPG/PNG, raw report, customer filename, secret-like data와 1 MiB 초과 artifact 0 확인.

## Release 기준

- 기존 locked 30/30 + 신규 10/10 PASS.
- source lint, PowerShell/Bash/JSX syntax, Node/Python regression, migration verifier, ancestry, patch hygiene PASS.
- candidate Quality, 다른 verifier clean Trust, main ff-only integration, integrated OID post-Quality PASS.
- schema 4가 기존 schema 3 핵심 필드와 정상 결과 exit 0/입력 오류 exit 2 의미를 보존.
- current·legacy body, explicit mismatch, ambiguity, duplicate reference, neither-match, exact/generic/unregistered sleeve decision code가 기대와 일치.
- installed three-role cache source digest가 조사 hash와 같고 cold build/warm reuse가 PASS.
- palette 원본·Program JSX·열린 문서·synthetic fixture drift 0, prohibited external/API/paid 0.
- failure가 없으면 rollback을 실행하지 않고 eligibility만 검증; 실패하면 guarded rollback 후 pre-state mismatch 0.

## 외부 설정·사용자 검증

- 구현 Gate는 exact Git base, source candidate, clean Trust/integration, Windows backup/install/config/cache와 synthetic actual replay를 모두 명시해야 한다.
- 승인 source는 현행 `29b1c40c...`, 구형 TR `e78cbc4a...`, 소매 가죽 `962014d8...` exact SHA-256이다. 하나라도 바뀌면 actual 전 BLOCKED한다.
- source 구현에는 raw palette 색값을 손으로 베껴 넣지 않는다. release catalog는 local Illustrator collector가 source hash에서 재현한다.
- installed 기본은 세 role 필수다. portable CLI는 legacy/sleeve 미설정 시 current-only 호환이 가능하지만 coverage를 명시한다.
- 별도 지정 없는 고객 AI는 actual validation에 사용하지 않는다. synthetic 비민감 inspection/PNG fixture와 제공 palette 세 개만 사용한다.
- remote·push·PR·network install·외부 API·유료 호출은 0건이다.
