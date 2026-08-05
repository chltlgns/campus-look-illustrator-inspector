# Implementation log — 현행·구형 원단 및 소매 원단 혼용 검사

상태: candidate-ready

## 승인된 범위

- Gate request: `gate-20260805T015023Z-97b10736ee82`
- request SHA-256: `e44b51913720cd10e04449d2ea2992e9bdabc2dc3ff390e1931e308196db5c6b`
- approved base: `09245e629800aff12fc64bae026dd96e4abc6dc1`
- change: `legacy-material-palette-validation-v04`
- 작업 위치: ORBIT가 기록한 isolated candidate worktree만 사용했다. main의 dirty Gate/lifecycle 상태와 기존 remote는 수정하지 않았다.
- 금지 경계: palette AI/PNG/raw observation/customer report Git 반입, remote 변경, push/PR, network install, 외부 API, 유료 호출 0건.

## 구현된 요구사항

| 요구사항 | 변경 파일·구성요소 | 검증 | 결과 |
|---|---|---|---|
| REQ-MP-001~004 | `material-catalog.mjs`, `inspect-illustrator.ps1`, `analyze-proof.mjs` | MP-P01/P02/N02, 실제 Git 밖 palette collector 재생 | PASS — current 110 entries, legacy 49 keys/66 candidates, legacy 중복 15 keys·누락 11/34/48/49 보존 |
| REQ-MP-005 | `illustrator/run-proof-check.ps1`, installed `material-palettes.json` 계약 | MP-R01, PowerShell syntax, source hash/cache drift negative | PASS — role+source SHA immutable cache, full-role fail-closed, fresh marker와 최대 2회 retry |
| REQ-MP-006~007 | generation-aware body evaluator | MP-P01~P03, MP-N01~N02 | PASS — 단일 current/legacy match PASS, cross-generation/reference ambiguity REVIEW, explicit mismatch FAIL |
| REQ-SL-001~004 | sleeve parser/evaluator와 irregular sleeve catalog | SL-P01/P02/N01, 실제 Git 밖 sleeve collector | PASS — 24 entries/candidates, supplier/family/finish/number/color 보존, exact/generic/미등록 판정과 실물 인증 한계 |
| REQ-RP-001~002 | schema 4, Markdown, launcher dialog, README/integration | MP-R02와 end-to-end synthetic analyzer | PASS — 기존 핵심 fields/status/exit 유지, catalog provenance/candidates/decisionCode additive |
| REQ-NFR-001~006 | migration/source policy, Quality profiles, backup allowlist | 기존 30+신규 10 직접 suite, lint/check/migration, diff check | PASS candidate pre-commit; commit-bound Quality/Trust는 change record에서 후속 실행 |

## 실행 명령과 결과

사전·구현 검증 명령:

```text
npm run lint
npm run check
npm test
npm run migration:verify
python3 -m unittest -v tests.test_inspector_split_validation \
  tests.test_windows_cutover_validation \
  tests.test_windows_cutover_recovery_validation \
  tests.test_windows_drive_path_recovery_validation \
  tests.test_material_palette_validation
git diff --check 09245e629800aff12fc64bae026dd96e4abc6dc1
```

실제 source collector는 Git 밖 ASCII staging 복사본에만 실행했다. 전후 원본/복사본 SHA-256은 다음과 같이 일치했다.

| role | source SHA-256 | catalog 결과 |
|---|---|---|
| current-body | `29b1c40c39024e7b1d6c4f4fc6b0cf2c27270b547cef6b9283e80ea3dab99b2b` | 110 entries/candidates; TR 53, premium 57 |
| legacy-body | `e78cbc4afab48c90470c3946fe3db4a62fc32e5c3466573d87445905a8a7a4f8` | 49 keys, 66 candidates, duplicate/missing/explicit HEX evidence |
| sleeve-material | `962014d8b8ab603bf09979fc41ae242432a29c68840374cc177c766f6da887c4` | 24 exact entries/candidates, unmatched label 0 |

synthetic report replay는 schema 4, `overallStatus=PASS`, `coverage=full`, `matchedCatalog=current-body`, `sleeve_exact_key_match`, 기존 root 핵심 field와 CLI exit 0을 확인했다.

## 편차·남은 작업·외부 게이트

- 승인 범위 편차 없음. 기존 공개 `origin`은 삭제하거나 변경하지 않았고 network access를 실행하지 않았다. migration receipt의 `remotes: 0`은 이 작업의 remote mutation 수이며 `configuredRemotes: [origin]`은 보존된 사전 상태다.
- palette 원본과 collector output은 runtime/temp에만 있으며 Git tracked artifact가 아니다.
- 실제 설치 변경은 candidate Quality, 다른 verifier clean Trust, main ff-only integration, post-Quality 이후에만 수행한다.
- 설치 전 fresh Git 밖 backup을 만들고 LocalAppData launcher/root sidecar/material sidecar/runtime cache만 변경한다. Program JSX와 열린 Illustrator 문서는 변경하지 않으며 failure가 있을 때만 current=recorded-post eligibility를 확인한 뒤 guarded rollback한다.
