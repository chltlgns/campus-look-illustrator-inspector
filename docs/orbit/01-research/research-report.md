# Research report — Campuslook Illustrator Inspector

상태: complete

## 조사 질문과 결론

### 하위 폴더를 그대로 사용해도 독립 개발이 가능한가

불가능하다. 기존 폴더는 상위 Git·ORBIT 프로젝트에 속한다. 독립 개발을 위해서는 상위 내부의 nested Git이 아니라 형제 경로의 별도 Git·ORBIT 프로젝트가 필요하다.

### 무엇을 새 프로젝트로 옮겨야 하는가

검사 실행과 결과 생성에 필요한 Node/Bash/PowerShell/JSX 소스, 정제된 README·검증 계약, 재현 가능한 비민감 smoke fixture만 포함한다. 메일 다운로드 도구, 실제 AI/JPG/PNG, 고객 파일명, 생성 보고서·캐시·Memory Bank 상태는 제외한다.

### 기존 운영을 중단하지 않고 분리할 수 있는가

가능하다. 첫 단계는 copy-and-verify이며 기존 폴더를 이동·삭제·수정하지 않는다. 새 저장소의 CLI 계약과 경로 이동성을 검증한 뒤, parent 웹앱 연결과 Windows 런처 재설치는 각각 별도 범위에서 수행한다.

## 확인된 사실

- 기존 폴더는 175MB지만 핵심 소스는 수백 KB 수준이다. 대부분은 실제 시안·렌더·보고서다.
- 핵심 분석·보고서 Node 스크립트는 외부 npm 패키지를 사용하지 않는다.
- PowerShell 런처의 기존 저장소 절대경로가 독립성의 직접 장애다.
- 네이버 메일 첨부 다운로드는 parent 저장소의 자격증명·IMAP 구현에 의존해 검사기 핵심과 분리해야 한다.
- parent tracked 소스에는 아직 검사기 파일 경로 참조가 없어 새 저장소 생성 자체는 parent 빌드를 바꾸지 않는다.
- 기존 설치된 Windows 런처는 새 저장소 생성만으로 자동 갱신되지 않는다.

## 반대근거·제약·불확실성

- 기존 성능·실전 결과는 유용한 baseline이지만 새 저장소 commit에 결속된 검증 증거는 아니다.
- 실제 Illustrator/COM 실행 검증은 Windows 애플리케이션 상태를 건드릴 수 있어 이번 source-only 분리 Gate에서는 수행하지 않는다.
- 새 저장소만 만들어도 parent 웹앱 통합은 완료되지 않는다. 웹앱 버튼·API·`proofRevisionId` 테스트는 parent의 후속 ORBIT 범위다.
- 기존 README·보고서에는 기관명과 실제 시안 결과가 있어 문서를 그대로 복사하지 않고 집계 수준으로 정제해야 한다.
- JSX에 대한 완전한 정적 분석기는 현재 없으므로 최소 구문·금지 경로 검사와 기존 실행 구조 검토를 결합해야 한다.

## 설계에 미치는 영향

1. 새 프로젝트는 `/home/doggabiya/campus-look-illustrator-inspector`에 둔다.
2. 초기 migration은 source-only allowlist를 사용하고 denylist 확장자·경로 검사를 품질 Gate로 고정한다.
3. 실행 경로는 저장소 절대경로 상수가 아니라 설치 시 전달되는 root 또는 스크립트 위치에서 계산한다.
4. 기존 폴더는 parent 통합 전환이 끝날 때까지 읽기 전용 기준본으로 유지한다.
5. 새 저장소는 CLI 결과 JSON 계약을 소유하고 parent는 그 계약의 소비자다.
6. 실제 AI·색상판·메일 수집은 Git 밖의 사용자 제공 경로로만 받는다.

## 남은 검증과 중단 조건

- Gate 승인 뒤 source allowlist를 복제하기 전 원본 digest inventory를 생성한다.
- 추적 후보에 금지 디렉터리, 고객 원본 확장자, 1MB 초과 artifact, 비밀 패턴이 하나라도 있으면 commit 전 중단한다.
- 기존 절대경로가 소스에 남거나 새 CLI가 parent 모듈을 import하면 분리 실패로 처리한다.
- parent 저장소의 사전·사후 Git status와 기존 source-only digest가 달라지면 즉시 중단한다.
- 새 저장소 smoke 검증이 PASS해도 실제 Illustrator 재설치·운영 전환은 완료로 선언하지 않는다.
