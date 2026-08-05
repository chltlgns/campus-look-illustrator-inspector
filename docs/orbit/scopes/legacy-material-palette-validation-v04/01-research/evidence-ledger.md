# Evidence ledger — 현행·구형 원단 및 소매 원단 혼용 검사

상태: ready  
기준일: 2026-08-05

| ID | 구분 | 주장 | 출처·위치 | 확인일 | 한계·반대근거 | 연결 결정 |
|---|---|---|---|---|---|---|
| EV-001 | user_statement | `옛날 TR.ai`는 과거 몸통 원단 컬러판이고 `가죽원단.ai`는 소매 원단 컬러판이며, 현행 컬러판으로 만든 신규 시안과 과거 시안을 재주문에서 혼용한다. | 현재 사용자 요청 | 2026-08-05 | 주문 시점이나 개별 시안의 세대 표기가 파일에 항상 있는지는 별도 확인이 필요하다. | ADR-001, REQ-MP-001 |
| EV-002 | fact | 제공 파일은 PDF-compatible Illustrator 1페이지 문서다. 구형 TR SHA-256은 `e78cbc4afab48c90470c3946fe3db4a62fc32e5c3466573d87445905a8a7a4f8`, 소매 가죽은 `962014d8b8ab603bf09979fc41ae242432a29c68840374cc177c766f6da887c4`이며 읽기 전후 동일했다. | 사용자 지정 Desktop 파일의 `file`, `stat`, `sha256sum`; Git 밖 Windows Temp staging | 2026-08-05 | 경로·mtime은 provenance 보조값일 뿐 내용 identity는 SHA-256으로 고정해야 한다. | ADR-002, REQ-MP-002 |
| EV-003 | fact | 구형 TR 문서는 path 72개, text 79개, raster/placed 0개다. 채움 사각형 안의 라벨을 기하학적으로 연결하면 색 라벨 71개, TR 번호 entry 66개, 고유 번호 49개를 얻으며 11·34·48·49번은 명확한 대응이 없다. | no-save `inspect-illustrator.ps1` 구조 수집과 Git 밖 ExtendScript path/text containment 관찰 | 2026-08-05 | 작업 보드가 정규 표가 아니며 대지 밖 보조 swatch도 포함한다. 고정 행·열 샘플링은 사용할 수 없다. | ADR-002, REQ-MP-003 |
| EV-004 | counterevidence | 구형 TR에는 같은 번호의 복수 후보가 있다. 2번 후보 간 최대 ΔE 33.27, 23번 21.63, 40번 18.07, 47번 86.30 등으로 단순 중복 제거가 불가능하다. | EV-003 파생 후보의 CIELAB 비교 | 2026-08-05 | 일부 라벨의 명시 HEX·색상명으로 후보를 좁힐 수 있지만 모든 충돌을 자동 해결하지는 못한다. | ADR-003, REQ-MP-004 |
| EV-005 | fact | 현행 기본 컬러판 SHA-256은 `29b1c40c39024e7b1d6c4f4fc6b0cf2c27270b547cef6b9283e80ea3dab99b2b`이며 기존 cache는 TR하이미어 53색과 `(고급)하이미어` 57색을 보유한다. | installed runtime `cache/palette/<sha>/material-color-reference.json`; 기본 Desktop AI hash | 2026-08-05 | 기존 cache schema 1은 catalog generation·source role·복수 후보를 표현하지 않는다. | ADR-001, ADR-004, REQ-MP-005 |
| EV-006 | fact | 구형 TR의 동일 번호 후보와 현행 TR 53색을 비교한 49개 번호 중 ΔE 3 이하는 0개, ΔE 12 이하는 14개, ΔE 18 초과는 25개이며 최소 후보 기준 중앙값은 ΔE 19.03이다. | EV-003/EV-005 파생 CIELAB 비교 | 2026-08-05 | 연구용 CMYK→RGB 근사는 충돌 탐지에는 충분하지만 release 기준색은 Illustrator-rendered PNG 중심 샘플로 다시 고정해야 한다. | ADR-001, ADR-002, REQ-MP-006 |
| EV-007 | fact | 소매 원단 문서는 path 25개, text 25개, raster/placed 0개이며 제목을 제외한 24개 swatch가 라벨과 1:1 연결된다. 라벨은 니플레자·동인·화성·신라·세성 및 민무늬·엠보·습식·양피·PU 같은 supplier/finish 정보를 포함한다. | no-save Illustrator 구조·vector containment 관찰 | 2026-08-05 | `번호`만으로는 공급처·표면가공이 충돌할 수 있으므로 전체 material key가 필요하다. | ADR-005, REQ-SL-001~003 |
| EV-008 | fact | 현재 analyzer는 현행 컬러판 한 장의 고정 576×2789 좌표를 샘플하고, 소매는 흰색·검정만 RGB 상수와 비교한다. Windows cache identity도 단일 palette 파일 하나만 가리킨다. | `analyze-proof.mjs`, `illustrator/run-proof-check.ps1` | 2026-08-05 | 불규칙한 구형 보드와 supplier별 소매 swatch를 그대로 추가할 수 없는 구조다. | ADR-002, ADR-004, REQ-MP-005, REQ-SL-002 |
| EV-009 | fact | 기존 비식별 실제 회귀 집계는 20파일·22시안이다. 겉감 표기는 TR 번호/색상명 변형이 있고, 소매는 흰색·검정 외 `동인 민무늬 회색 34번` 1건이 있어 현재 자동 판정 범위를 벗어난다. | Git 밖 v03 `batch-summary.json`의 fields.shell/fields.sleeve 값만 집계 | 2026-08-05 | 이 표본이 모든 과거 표기 형식을 포괄하지는 않는다. 고객명·파일명·raw report는 기록하지 않았다. | ADR-005, REQ-SL-001, VAL-MP-R01 |
| EV-010 | fact | 현재 material rule은 TR 몸통과 fine-pebbled synthetic-leather sleeve를 물성상 별도 재료로 취급하며 supplier/product specification이 일반 기본값보다 우선한다. | `campuslook-varsity-jacket/references/materials.md`의 TR highmere·Synthetic-leather sleeves | 2026-08-05 | 시안 렌더만으로 실제 납품 원단의 촉감·조성·진품 여부는 증명할 수 없다. | ADR-005, REQ-SL-004 |
| EV-011 | inference | 정확한 기본 정책은 현행/구형을 하나로 합치지 않고 catalog별로 유지한 뒤, 시안 표기와 렌더가 한 catalog를 강하게 지지하면 그 provenance를 보고하는 것이다. | EV-003~010 종합 | 2026-08-05 | 두 catalog가 비슷하거나 구형 reference 자체가 충돌하면 자동 확정을 중단해야 한다. | ADR-001, ADR-003 |
| EV-012 | counterevidence | 파일명·mtime·렌더색만으로 신규 주문과 재주문을 항상 구분할 수 없다. 과거 파일이 복사·수정될 수 있고 양 catalog의 일부 색은 근접할 수 있다. | 사용자 운영 설명과 EV-004/006 | 2026-08-05 | 명시적 세대/주문모드가 없으면 `matchedCatalog`는 색상 대조 결과이지 주문 이력 증명이 아니다. | ADR-001, REQ-MP-007 |
| EV-013 | fact | no-save 수집은 임시 ASCII 복사본만 열고 닫았으며 원본 두 파일의 SHA-256은 전후 동일했다. 첫 COM 호출 하나는 collection `Count` 오류로 출력 없이 종료됐고 재시도에서 구조·렌더를 생성했다. | Windows Temp research output과 원본 hash 재검사 | 2026-08-05 | 실제 cache 생성 경로에도 bounded retry와 fresh-output 검증이 필요하다. | ADR-006, REQ-NFR-002 |
| EV-014 | fact | 조사 중 외부 API·유료 호출·network install은 0건이다. | 실행 기록 | 2026-08-05 | 없음. | REQ-NFR-004 |

구분은 `fact`, `user_statement`, `inference`, `assumption`, `counterevidence` 중 하나로 기록한다.
