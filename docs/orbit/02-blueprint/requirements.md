# Requirements — Campuslook Illustrator Inspector

상태: complete

## 제품 약속

Campuslook Illustrator Inspector는 상위 `campus-look-ops` 저장소와 독립된 로컬 Git·ORBIT 프로젝트로 유지된다. 검사기는 사용자 지정 AI·컬러판을 읽기 전용으로 분석하고 기존 `report.json`·`report.md` 계약을 제공하며, 고객 원본·메일·렌더·캐시를 소스 저장소에 포함하지 않는다. 기존 운영 폴더와 설치된 런처는 별도 전환 승인 전까지 보존한다.

## 기능 요구사항

| ID | 요구사항 | 인수 기준 | 근거 |
|---|---|---|---|
| FR-001 | 독립 프로젝트 경계 | `/home/doggabiya/campus-look-illustrator-inspector`가 자체 `.git`과 `.orbit`을 가지며 parent와 다른 Git top-level·ORBIT state를 반환한다. | EV-001, EV-002, EV-010 |
| FR-002 | source-only allowlist migration | 승인된 Node/Bash/PowerShell/JSX 소스와 정제 문서만 포함한다. 포함 파일의 원본 SHA-256, 대상 SHA-256, 변경 사유를 manifest에 기록하고 금지 경로·확장자는 추적하지 않는다. | EV-003~005, EV-012 |
| FR-003 | 이동 가능한 실행 경로 | `run-proof-check.ps1`은 기존 사용자·저장소 절대경로를 포함하지 않는다. 환경변수 override 또는 설치기가 만든 sidecar root를 검증해 Node·Bash 경로를 결정하고, 없거나 불일치하면 외부 실행 전에 stable 오류로 중단한다. | EV-006, EV-011 |
| FR-004 | 기존 CLI 결과 계약 보존 | `check-proof.sh <proof> [palette] [output]` 입력 형태와 `report.json`, `report.md`, `material-color-reference.json/csv`, `proof/artboard-*.png` 결과 명칭 및 PASS/REVIEW/FAIL 의미를 보존한다. | EV-004, EV-008 |
| FR-005 | 정제된 로컬 검증 harness | Node 문법, Bash 문법, PowerShell parser, migration allowlist, 금지 데이터, parent 의존 import, 기존 절대경로, CLI help/failure 경로를 한 명령으로 검증한다. | EV-004~006, EV-008, EV-012 |
| FR-006 | parent integration 계약 | 별도 문서에 실행 명령, 입력 경로 소유권, timeout/exit code, 결과 JSON 필수 필드, 버전 식별자, 동시 실행 직렬화 책임과 실패 코드를 정의한다. parent 구현은 포함하지 않는다. | EV-007, EV-011 |
| FR-007 | 무중단 공존 | migration 중 기존 폴더의 파일과 parent Git status를 변경하지 않는다. 새 저장소 검증 후에도 Windows 재설치와 parent cutover 전에는 옛 폴더를 제거하지 않는다. | EV-009, EV-011 |

## 비기능 요구사항

| ID | 품질 속성 | 측정 가능한 목표 | 검증 방법 |
|---|---|---|---|
| NFR-001 | 개인정보·데이터 최소화 | tracked AI/PDF/EPS/JPG/PNG, `downloads`, `reports`, `samples`, `.cache`, `.memory-bank`, `NUL` 수가 0이며 1MB 초과 tracked 파일도 0이다. | `git ls-files`, 확장자·크기·경로 검사 |
| NFR-002 | parent 보존 | parent tracked/untracked typed status와 기존 source-only SHA inventory가 migration 전후 동일하다. parent commit, stash, reset, clean, branch 이동, ORBIT 쓰기는 0건이다. | pre/post digest·Git status 비교 |
| NFR-003 | 이동성 | 소스에 `/home/doggabiya/campus-look-ops`, `\\wsl.localhost\\Ubuntu\\home\\doggabiya\\campus-look-ops`가 0건이며 root 설정은 존재·디렉터리·필수 파일을 검증한다. | 정적 검색 + PowerShell fixture 검사 |
| NFR-004 | 재현성 | clean checkout에서 네트워크·외부 API·실제 Illustrator 없이 정적·migration smoke 검증이 exit 0이다. | package script/validation replay |
| NFR-005 | 안전 실패 | root 설정 누락, 잘못된 input 확장자, Illustrator 부재, analyzer 실패에서 원본 저장·수정 0건이고 stable nonzero exit와 사람이 이해할 오류를 반환한다. | negative fixture 및 source inspection |
| NFR-006 | 호환성 | Node 24, Bash/WSL, Windows PowerShell 5.1, Illustrator 2025 한국어판 전제를 문서화하고 새로운 유료 dependency·네트워크 런타임 의존성을 추가하지 않는다. | manifest·source·문서 검사 |
| NFR-007 | 성능 회귀 경계 | 기존 0.82초 평균은 historical baseline으로만 표시한다. source-only 분리에서는 새로운 성능 PASS를 주장하지 않고 실제 재설치 후 후속 검증 전까지 상태를 `not_run`으로 유지한다. | 문서·release gate 검사 |
| NFR-008 | 비용·외부 작업 | 유료 API, 메일/Google/광고 호출, 원격 저장소, push/PR, 배포, 실제 Illustrator 설치 변경이 모두 0건이다. | 명령 ledger·Git remote·process action 검사 |

## 제외 범위

- `campus-look-ops` 웹앱 버튼·서버 endpoint·`proofRevisionId` 테스트
- Windows Illustrator 런처 재설치와 시작 메뉴/단축키 변경
- 실제 고객 AI·컬러판을 이용한 재검사와 새 성능 측정
- 메일 첨부 다운로드·네이버 자격증명·IMAP 코드
- 기존 폴더 삭제·이름 변경·symlink 전환
- 원격 저장소 생성, push, PR, 배포, 외부 API 호출
