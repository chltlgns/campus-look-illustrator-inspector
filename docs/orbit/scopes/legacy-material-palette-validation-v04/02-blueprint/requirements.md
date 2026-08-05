# Requirements — 현행·구형 원단 및 소매 원단 혼용 검사

상태: ready

## 제품 약속

검사기는 현행 시안과 과거 재주문 시안을 같은 작업 흐름에서 안전하게 검사한다. 현행·구형 몸통 TR과 소매 가죽 catalog를 분리 보존하고, 시안 표기와 렌더가 지지하는 catalog provenance·후보·모호성을 보고한다. 승인된 어느 세대 하나와 일치하는 재주문 시안을 현행 컬러판 불일치만으로 실패시키지 않는다.

## 기능 요구사항

| ID | 요구사항 | 인수 기준 | 근거 |
|---|---|---|---|
| REQ-MP-001 | 다중 catalog registry | current-body, legacy-body, sleeve-material을 서로 다른 `catalogId`, role, generation으로 등록하며 같은 번호를 catalog 사이에서 덮어쓰지 않는다. | EV-001, EV-006, EV-011 |
| REQ-MP-002 | source provenance·원본 불변 | 각 catalog는 source SHA-256, extractor version, source role을 기록한다. 두 제공 AI와 현행 AI는 읽기 전후 hash가 같고 raw AI/PNG/document JSON은 Git에 들어가지 않는다. | EV-002, EV-013 |
| REQ-MP-003 | 불규칙 palette 추출 | legacy-body와 sleeve-material은 text label 중심이 포함된 filled vector path를 연결하고 Illustrator full-artwork render에서 path 중심색을 추출한다. 고정 행·열 좌표를 사용하지 않는다. | EV-003, EV-007, EV-008 |
| REQ-MP-004 | 중복·누락 reference 보존 | 같은 catalog/material key의 복수 색 후보, 누락 번호, 명시 HEX/색상명 근거를 숨기지 않고 `referenceState`와 candidates로 보존한다. 안전한 단일 선택 근거가 없으면 REVIEW다. | EV-004 |
| REQ-MP-005 | hash-bound runtime cache | Windows launcher는 세 source를 역할별로 hash하고 catalog cache를 분리 생성한다. 동일 hash는 warm reuse하고 source hash/role/schema 불일치·필수 source 누락은 분석 전에 fail-closed한다. | EV-005, EV-008, EV-013 |
| REQ-MP-006 | 세대 미명시 몸통 판정 | 표의 material/number에 대해 current·legacy same-key 후보를 모두 비교한다. 한 승인 catalog가 허용 ΔE와 margin을 만족하면 PASS와 matched catalog를 보고하고, 양쪽 근접·reference 충돌은 REVIEW, 어느 승인 후보에도 맞지 않거나 다른 번호가 명확히 우세하면 FAIL한다. | EV-006, EV-011 |
| REQ-MP-007 | 명시 세대 판정·주문 이력 한계 | caller 또는 표가 generation을 명시하면 해당 catalog를 기대값으로 강제하고 다른 generation만 강하게 일치하면 FAIL한다. auto 결과는 주문 이력 증명으로 표현하지 않는다. | EV-012 |
| REQ-SL-001 | 소매 사양 파싱 | sleeve field에서 supplier/family, finish, number, color name을 정규화한다. 공백·슬래시·번호 위치 변형과 기존 `니플 레자` 별칭을 처리한다. | EV-007, EV-009 |
| REQ-SL-002 | 소매 catalog 대조 | 구체 supplier/family+number가 있으면 exact key 후보와, 일반 흰색/검정이면 해당 family 허용 후보 집합과 시안 sleeve 대표색을 대조한다. 흰색·검정 외 등록색도 자동 판정한다. | EV-007~009 |
| REQ-SL-003 | 소매 모호·미등록 처리 | supplier/finish/number 충돌, catalog 복수 근접, 미등록 구체 표기는 REVIEW 또는 명확한 mismatch의 FAIL로 보고하며 임의 material key를 생성하지 않는다. | EV-007, EV-010 |
| REQ-SL-004 | 소매 판정 표현 한계 | 보고서는 디자인의 소매 사양표·대표색 일치를 판정하며 실제 봉제품의 조성·촉감·grain·공급처 진품을 인증한다고 표현하지 않는다. | EV-010 |
| REQ-RP-001 | report/CLI 후방 호환 | schema 4에 catalog provenance, candidates, ambiguity를 추가하되 기존 schema 3 소비자가 쓰는 document/designs/fields/visual/materialCheck/sleeveCheck/overallStatus와 exit 의미를 유지한다. | EV-008 |
| REQ-RP-002 | 운영 설명 | Markdown·dialog에 current/legacy matched catalog, reference conflict, 소매 material key와 디자인 검수 한계를 한국어로 표시한다. | EV-001, EV-010~012 |

## 비기능 요구사항

| ID | 품질 속성 | 측정 가능한 목표 | 검증 방법 |
|---|---|---|---|
| REQ-NFR-001 | 회귀 | 기존 locked 30개와 신규 10개가 candidate/clean Trust/post-Quality에서 모두 PASS한다. | test/analysis |
| REQ-NFR-002 | 문서·COM 안전 | palette build는 ASCII staging, no-save close, 이전 active document 복원, fresh-output marker, 최대 2회 retry를 유지하며 원본/active hash·saved-state drift 0이다. | test/demonstration |
| REQ-NFR-003 | 성능 | 세 catalog hash가 같을 때 warm run은 Illustrator palette 재오픈 없이 cache JSON을 재사용한다. | test/inspection |
| REQ-NFR-004 | 데이터·비용 경계 | 고객명·원시 report·AI/PNG를 Git에 추가하지 않고 network/API/유료 호출 0건이다. | inspection |
| REQ-NFR-005 | 이동성 | source code에는 사용자 홈 절대경로를 필수값으로 고정하지 않는다. Windows params/env/installed sidecar가 catalog source를 주입하고 Linux analyzer는 역할별 JSON만 받는다. | test/inspection |
| REQ-NFR-006 | 설치·복구 | installed launcher/cache config 변경 전에 Git 밖 byte backup과 manifest를 만들고, 실패 시 current=expected-post 대상만 hash-guarded rollback한다. Program JSX와 기존 열린 문서는 변경하지 않는다. | demonstration/recovery |

## 제외 범위

- 개별 구형 TR 충돌 번호의 최종 단일 swatch를 사용자 대신 선택
- file mtime·이름·색만으로 신규 주문/재주문 여부 확정
- 실물 봉제품의 원단 조성·촉감·공급처 진품 인증
- 원본 AI 정리·재배치·저장 또는 새 컬러판 제작
- 고객 주문 DB·메일·가격 데이터 연결
- remote 재구성·push·PR, network install, 외부 API·유료 호출
