# Architecture decisions — Campuslook Illustrator Inspector

상태: complete

## ADR-001 — 상위 내부가 아닌 형제 독립 저장소

- 상태: accepted
- 맥락: 기존 하위 폴더는 parent Git·ORBIT를 공유해 병렬 범위가 충돌한다.
- 결정: `/home/doggabiya/campus-look-illustrator-inspector`에 별도 Git·ORBIT 프로젝트를 둔다.
- 대안: 기존 하위 폴더 유지, nested Git, parent worktree만 사용.
- 결과·위험: 검사기 자체는 독립되지만 parent 연동은 별도 범위가 필요하다. nested repository의 index 혼동을 피한다.
- 근거: EV-001, EV-002, EV-009, EV-010

## ADR-002 — move가 아닌 source-only copy-and-verify

- 상태: accepted
- 맥락: 기존 폴더에는 175MB의 고객 AI·렌더·보고서가 있고 설치된 런처가 옛 경로를 참조할 수 있다.
- 결정: 승인된 소스만 격리 candidate로 복제하고 실제/생성 데이터는 제외한다. 기존 폴더는 그대로 보존한다.
- 대안: 폴더 전체 이동, `cp -a` 전체 복제, Git history filter/import.
- 결과·위험: 운영 중단과 개인정보 Git 유입을 막지만 두 사본이 잠시 공존한다. manifest와 후속 cutover가 필요하다.
- 근거: EV-003, EV-005, EV-008, EV-011, EV-012

## ADR-003 — 설치 sidecar와 명시적 환경변수로 root 결정

- 상태: accepted
- 맥락: installed PowerShell launcher의 `$PSScriptRoot`는 LocalAppData이며 repo root가 아니다. 기존 코드는 사용자별 절대경로를 사용한다.
- 결정: 명시적 환경변수 override와 installer-generated sidecar만 신뢰하고 필수 파일을 검증한다.
- 대안: 현재 절대경로 유지, 홈 전체 검색, parent repo 상대경로 추측, 심볼릭 링크.
- 결과·위험: 이동성이 생기고 fail-closed하지만 실제 설치 전환은 후속 작업이다. sidecar schema와 오류코드를 문서화해야 한다.
- 근거: EV-006, EV-011

## ADR-004 — parent는 CLI/JSON 소비자

- 상태: accepted
- 맥락: parent가 검사기 내부 모듈을 import하면 다시 저장소 경계가 결합된다.
- 결정: 검사기가 버전된 CLI·JSON 계약을 소유하고 parent는 파일 경로 대신 승인된 revision ID를 서버에서 해석한 뒤 CLI를 호출한다.
- 대안: parent의 상대 import, 코드 복사, 브라우저 직접 PowerShell 실행.
- 결과·위험: 독립 배포·테스트가 가능하지만 양쪽 계약 테스트와 버전 협상이 필요하다.
- 근거: EV-004, EV-007

## ADR-005 — 실제 Illustrator 전환은 후속 범위

- 상태: accepted
- 맥락: 현재 parent 통합과 다른 Codex 세션이 실행 중이고 Windows 런처 재설치는 외부 로컬 상태를 바꾼다.
- 결정: 이번 범위는 source-only repository split과 offline verification까지만 수행한다.
- 대안: 분리와 동시에 재설치·parent 연결·실제 시안 성능 측정.
- 결과·위험: 현재 운영을 방해하지 않지만 새 저장소가 즉시 운영 경로가 되지는 않는다. release 판정은 이를 명시해야 한다.
- 근거: EV-008, EV-009, EV-011

## ADR-006 — 메일 수집은 별도 acquisition 책임

- 상태: accepted
- 맥락: 다운로드 도구는 parent 네이버 자격증명·IMAP 모듈에 의존하고 검사 기능과 보안 경계가 다르다.
- 결정: 초기 독립 검사기에서 다운로드 도구를 제외하고 입력 AI는 호출자가 명시 경로로 제공한다.
- 대안: parent 모듈까지 vendor, 자격증명 adapter 재구현, submodule 의존.
- 결과·위험: 저장소가 작고 안전해지지만 메일 샘플 자동 수집은 별도 도구가 필요하다.
- 근거: EV-005
