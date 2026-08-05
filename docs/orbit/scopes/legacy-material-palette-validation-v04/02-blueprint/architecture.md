# Architecture — 현행·구형 원단 및 소매 원단 혼용 검사

상태: ready

## 컨텍스트와 데이터 흐름

```text
Windows installed sidecar/params/env
  ├─ current-body AI ─ existing fixed-grid collector ─┐
  ├─ legacy-body AI ─ vector-label collector ─────────┼─ hash-bound catalog JSONs
  └─ sleeve-material AI ─ vector-label collector ─────┘
                                                        │
proof document ─ FastProofInspector JSX ─ proof JSON/PNG│
                                                        ▼
                                           multi-catalog analyzer
                                                        │
                              schema-4 JSON + Markdown + dialog summary
```

source와 runtime을 계속 분리한다. palette AI, staging, full-artwork PNG, vector observation, catalog cache, 실제 report는 `%LOCALAPPDATA%` runtime에만 둔다. Git에는 parser/cache schema, synthetic fixture, test와 문서만 둔다.

## 모듈 경계와 소유 데이터

- `illustrator/run-proof-check.ps1`: 세 역할별 source resolution, hash identity, cache build/reuse, analyzer 인자 조합을 소유한다. 기존 `-PaletteFile`은 current-body alias로 유지한다.
- installed `material-palettes.json`: current/legacy/sleeve Windows source path와 catalog role만 소유한다. source repo에 실제 사용자 경로 파일을 저장하지 않는다.
- palette collector: current-body는 기존 검증된 fixed-grid PNG sampler를 유지한다. legacy/sleeve는 Illustrator text/path geometry와 full-artwork bounds를 관찰하고, label center를 포함하는 최소 filled path를 후보 swatch로 낸다.
- catalog builder: label parser, candidate grouping, explicit HEX/name provenance, rendered PNG 중심 샘플을 catalog schema 2로 정규화한다. source hash와 extractor version이 identity다.
- `analyze-proof.mjs`: body/sleeve specification parser, catalog lookup, ΔE/margin decision, report 생성만 담당한다. Windows path·AI COM을 알지 않는다.
- `contracts/inspector-result.schema.json`: schema 4 additive fields와 기존 필수 계약을 소유한다.
- 원본 AI와 현재 열린 Illustrator 문서는 caller 소유이며 검사기는 저장·종료하지 않는다.

## 실패·복구·관측성

- source missing/hash drift/schema mismatch/empty catalog/role duplicate: `palette_registry_invalid`로 proof 분석 전에 중단한다.
- vector label에 filled path가 없거나 같은 key 후보가 충돌: catalog build 자체는 성공하되 해당 key를 `ambiguous` 또는 `missing`으로 기록한다. 시안에서 그 key를 사용하면 REVIEW한다.
- current/legacy same-key가 둘 다 허용 범위이고 margin이 부족: `cross_generation_ambiguous` REVIEW다.
- 명시 generation과 다른 catalog만 강하게 일치: `generation_mismatch` FAIL다.
- sleeve exact key 미등록: `sleeve_reference_missing` REVIEW; exact key가 있는데 렌더가 다른 등록색에 명확히 가까우면 FAIL다.
- cache build는 marker보다 새롭고 nonempty인 output만 채택하고 최대 2회 시도한다. 실패 cache는 활성 pointer로 승격하지 않는다.
- report는 catalogId, generation, source digest prefix, expected candidates, nearest candidates, decision code와 ΔE/margin을 남긴다.
- 설치 후 failure는 fresh manifest의 current=expected-post 전체 eligibility를 먼저 확인한 뒤 실제 변경 파일만 rollback한다.

## 보안·비밀·외부 작업 경계

- 외부 API·network install·유료 호출은 0건이다.
- AI/PNG/raw JSON, 고객 파일명·보고서 본문·가격은 Git에 포함하지 않는다.
- installed sidecar는 로컬 경로만 가지며 source hash를 cache receipt에 고정한다. 경로만으로 신뢰하지 않는다.
- catalog 파일은 allowlisted role 세 개와 schema/version/hash/count를 검증한다. 임의 code나 command를 포함하지 않는다.
- actual validation은 사용자가 제공한 palette 세 개와 synthetic 비민감 proof fixture만 사용한다. 별도 지정 없는 고객 AI는 열지 않는다.
- remote는 읽거나 변경하지 않으며 push/PR도 수행하지 않는다.

## 이동·업그레이드 전략

- legacy/sleeve source path는 `-LegacyPaletteFile`/`-SleevePaletteFile`, 환경변수, installed sidecar 순으로 주입하고 source code 절대경로를 요구하지 않는다.
- catalog schema는 `schemaVersion`, `role`, `generation`, `source.sha256`, `extractorVersion`을 필수로 해 다른 PC cache의 의미를 재검증한다.
- 기존 single current palette CLI는 그대로 동작하며 추가 catalog가 구성되지 않은 portable source run은 기존 동작을 유지하되 `catalogCoverage=current-only`를 보고한다.
- installed Campuslook 기본 구성은 세 catalog를 모두 필수로 한다. 누락 시 조용히 current-only로 축소하지 않고 fail-closed한다.
- 향후 컬러판 교체는 source hash가 새 cache를 만들게 하며 이전 cache는 rollback/비교를 위해 덮어쓰지 않는다.
