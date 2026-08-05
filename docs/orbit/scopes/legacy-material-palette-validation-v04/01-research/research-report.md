# Research report — 현행·구형 원단 및 소매 원단 혼용 검사

상태: ready

## 조사 질문과 결론

질문은 세 가지였다. (1) 구형 TR과 현행 TR을 같은 번호표로 합쳐도 되는가, (2) 소매 원단을 흰색·검정 외에도 자동 대조할 수 있는가, (3) 신규/재주문을 시안 자체에서 정확히 구분할 수 있는가.

결론은 catalog를 합치면 안 된다는 것이다. 현행·구형은 동일 번호의 색이 크게 다르고 구형 보드 내부에도 충돌 후보가 있다. 기본 검사는 두 세대를 동시에 검색하되 결과에 `catalogId/generation/sourceHash`를 남긴다. 한 승인 catalog가 명확히 우세하면 그 catalog 기준으로 판정하고, 두 catalog가 비슷하거나 구형 번호 후보가 충돌하면 REVIEW로 멈춘다. 표나 caller가 세대를 명시했을 때만 그 세대를 강제하며, 다른 세대만 강하게 맞으면 FAIL한다.

소매는 단순 흰색·검정이 아니라 supplier + finish + number/name을 material key로 써야 한다. 시안 표기가 구체적이면 exact key와 렌더색을 함께 대조하고, `니플레자 / 흰색`처럼 일반 표기이면 해당 family의 허용 후보 집합과 대조한다.

## 확인된 사실

- 제공 AI 두 개는 원본 불변으로 구조·렌더·vector fill을 읽을 수 있다.
- 구형 TR은 정규 격자가 아닌 작업 보드다. 고유 번호 49개, 누락 4개, 충돌 번호 15개가 관찰됐다.
- 구형/현행 동일 번호는 대체로 같은 색이 아니다. 비교 중앙값 ΔE 19.03이며 25/49가 ΔE 18을 넘는다.
- 소매 보드는 24개 유효 swatch를 supplier/finish/number가 포함된 라벨과 연결할 수 있다.
- 현재 제품 코드는 현행 palette 한 장의 고정 좌표와 소매 흰색·검정만 지원한다.
- 실제 회귀 표본에도 자동 범위를 벗어난 `동인 민무늬 회색 34번`이 존재한다.
- 원본 AI hash drift, 외부 API, 유료 호출은 모두 0이다.

## 반대근거·제약·불확실성

- 구형 TR 보드는 중복 후보와 누락 번호가 있으므로 “legacy 53색 완성표”로 간주할 수 없다. 충돌을 숨기지 않는 curated/ambiguous 상태가 필요하다.
- 연구용 CMYK 근사 RGB는 설계 결정을 위한 비교다. 실제 기준 JSON은 Illustrator가 export한 PNG에서 vector bounds 중심을 샘플해 현 analyzer와 같은 color-managed 경로를 써야 한다.
- 시안의 file mtime이나 색만으로 주문 이력을 증명할 수 없다. `matchedCatalog=legacy`는 재주문 증명이 아니라 승인된 legacy 색 기준과의 일치다.
- 시안 렌더와 표기는 디자인 검수 근거다. 실제 봉제된 소매가 해당 supplier 원단인지, 물성·표면 grain이 맞는지는 실물/발주 데이터 없이는 확정할 수 없다.
- 첫 COM 수집이 일시 실패했으므로 cache build는 fresh marker, 최대 재시도, 원본·활성 문서 불변 확인을 유지해야 한다.

## 설계에 미치는 영향

1. `palette registry`를 도입해 current-body, legacy-body, sleeve-material catalog를 별도 source hash와 역할로 등록한다.
2. 현행 고정 격자 extractor는 유지하고, 구형/소매용 vector-label containment extractor를 추가한다. path 중심색은 Illustrator-rendered full artwork에서 샘플한다.
3. 구형 동일 번호 충돌은 후보 배열로 보존한다. 명시 HEX/색상명으로 안전하게 단일 후보가 정해지는 경우만 curated로 승격하고 나머지는 REVIEW한다.
4. body 판정은 `expected catalog가 명시됨`과 `세대 미명시 auto`를 분리한다. auto에서는 승인 catalog 하나와 강하게 일치하면 PASS, 양쪽 근접/후보 충돌이면 REVIEW, 어느 쪽에도 맞지 않으면 FAIL한다.
5. sleeve parser는 supplier·family·finish·number·color name을 추출한다. 정확한 key가 있으면 exact 대조, 일반 흰색/검정은 family candidate set 대조, 미등록 표기는 REVIEW한다.
6. report schema는 catalog provenance, candidate list, ambiguity reason을 추가하되 기존 root fields와 PASS/REVIEW/FAIL/exit 의미를 보존한다.
7. 원본 palette AI와 파생 PNG/raw document JSON은 Git 밖 cache에만 두고, source에는 schema·fixture·비민감 synthetic reference만 둔다.

## 남은 검증과 중단 조건

- 구형 TR 충돌 번호를 사람이 최종 단일 기준으로 승인하지 않는 동안 해당 번호는 후보 집합과 REVIEW로 유지한다.
- 신규 테스트는 current match, legacy match, explicit generation mismatch, cross-generation ambiguity, duplicate legacy number, missing legacy number, exact sleeve supplier/finish, generic white/black, unregistered sleeve를 포함해야 한다.
- 기존 30개 locked validation이 하나라도 깨지거나 report schema 후방 호환이 깨지면 구현을 통합하지 않는다.
- 설치 전 세 palette source hash가 조사값과 달라지면 cache/실제 회귀를 중단하고 새 source로 재연구한다.
- actual 검증은 원본 AI·기존 열린 문서·지정 test input의 hash/saved-state drift가 0일 때만 PASS다.
