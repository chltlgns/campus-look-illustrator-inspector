# Architecture decisions — 현행·구형 원단 및 소매 원단 혼용 검사

상태: ready

## ADR-001 — 세대별 catalog를 합치지 않는다

- 상태: accepted
- 맥락: 현행과 구형의 같은 번호가 대부분 다른 색이고, 과거 재주문 시안도 유효하다.
- 결정: current-body와 legacy-body를 독립 catalog로 유지하고 auto 판정에서 동시에 검색한다. 결과에 matched generation을 기록한다.
- 대안: 두 표를 번호 기준으로 merge; 현행만 검사; 사용자가 매번 세대를 선택. 각각 번호 충돌, 재주문 false FAIL, 운영 누락 위험으로 기각한다.
- 결과·위험: default auto는 주문 이력을 증명하지 않는다. 양쪽 근접은 REVIEW다.
- 근거: EV-001, EV-006, EV-011~012

## ADR-002 — 불규칙 보드는 vector-label geometry와 rendered color로 추출한다

- 상태: accepted
- 맥락: 구형 TR과 소매 보드는 현행 576×2789 fixed grid와 구조가 다르다.
- 결정: text center를 포함하는 최소 filled path를 swatch로 연결하고 full-artwork bounds를 기준으로 Illustrator-rendered PNG의 중심을 샘플한다.
- 대안: CMYK 수치 직접 변환; OCR; 새 fixed 좌표. color profile, 불필요한 의존성, 보드 편집 drift 위험으로 기각한다.
- 결과·위험: label이 path 밖에 있으면 자동 연결되지 않으며 missing/ambiguous로 남는다.
- 근거: EV-003, EV-006~008

## ADR-003 — reference 충돌은 REVIEW로 보존한다

- 상태: accepted
- 맥락: 구형 같은 번호의 복수 후보가 최대 ΔE 86.30까지 벌어진다.
- 결정: 명시 HEX/name으로 결정 가능한 경우에만 curated candidate를 선택하고, 나머지는 candidates와 conflict를 report해 REVIEW한다.
- 대안: 첫 항목/가장 가까운 항목 자동 선택; 평균색. 근거 없는 확정과 존재하지 않는 색 생성 때문에 기각한다.
- 결과·위험: 일부 과거 번호는 사람이 정리하기 전 자동 PASS 비율이 낮다. false confidence보다 안전을 우선한다.
- 근거: EV-004

## ADR-004 — catalog cache는 role+source hash로 식별한다

- 상태: accepted
- 맥락: 현재 identity.json은 palette 한 장만 표현하며 파일 path/mtime 재사용 위험이 있다.
- 결정: role별 source SHA-256 아래 immutable catalog cache를 만들고 registry receipt가 exact three-role set을 참조한다. 기존 current-only CLI cache는 호환 경로로 유지한다.
- 대안: 하나의 mutable combined JSON; 매 실행 Illustrator 재오픈. provenance 소실과 성능 비용으로 기각한다.
- 결과·위험: source가 바뀌면 의도적으로 새 cache가 생성되며 installed three-role 모드에서 누락은 BLOCK이다.
- 근거: EV-005, EV-008, EV-013

## ADR-005 — 소매 key는 supplier/family/finish/number를 보존한다

- 상태: accepted
- 맥락: 소매 보드에는 여러 공급처와 민무늬·엠보·습식·양피·PU가 있고 번호만 충돌할 수 있다.
- 결정: 구체 표기는 full material key로 exact 대조하고, 일반 니플레자 흰색/검정은 family 후보 집합과 대조한다.
- 대안: 색명만 비교; 번호만 비교; RGB 상수 유지. 등록색 확장과 공급처 구분을 못해 기각한다.
- 결과·위험: 시안 표기가 일반적이면 물성/공급처 확정이 아니라 허용 family 색 대조로 제한된다.
- 근거: EV-007, EV-009~010

## ADR-006 — 기존 launcher·report 계약을 additive하게 확장한다

- 상태: accepted
- 맥락: 설치된 단축키, current palette, schema 3 소비자와 30개 locked validation이 운영 중이다.
- 결정: 기존 `-PaletteFile`, root fields, status/exit를 유지하고 optional role sources와 schema 4 provenance를 추가한다. source candidate와 installed 변경은 backup/Trust 뒤 순차 적용한다.
- 대안: CLI 교체; schema 3 파괴; 설치 파일 직접 편집. 운영 중단·복구 불가 위험으로 기각한다.
- 결과·위험: 구현량은 늘지만 회귀와 rollback을 명시적으로 검증할 수 있다.
- 근거: EV-008~009, EV-013
