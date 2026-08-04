# Validation plan — Campuslook Illustrator Inspector

상태: complete

## 잠글 validation 집합

- planned profile: `quality/orbit-validation-inspector-split-v01.json`
- locked ID count: `8`
- ordered IDs: `CI-P01`, `CI-P02`, `CI-P03`, `CI-P04`, `CI-N01`, `CI-N02`, `CI-N03`, `CI-R01`
- selector runner contract: `tests/inspector-split-validation.test.mjs`
- 입력은 committed synthetic fixture와 read-only 원본 source root·parent root이며 실제 AI·Illustrator·네트워크를 사용하지 않는다.

## 요구사항 추적표

| ID | 요구사항 | 검증 방법 | 명령·절차 | 기대 결과 | 증거 위치 |
|---|---|---|---|---|---|
| CI-P01 | FR-001, NFR-004 | 독립 경계 검사 | 새 candidate에서 Git top-level, ORBIT root, parent ancestry를 assertion | 새 저장소가 parent와 다른 Git·ORBIT root이고 nested repo가 아님 | validation receipt |
| CI-P02 | FR-002, NFR-001 | allowlist·manifest 검사 | tracked 경로/확장자/크기, source manifest SHA-256, forbidden directory를 검사 | 허용 source만 존재; 금지/1MB 초과/manifest mismatch 0 | migration report + validation receipt |
| CI-P03 | FR-003, NFR-003 | portable root positive fixture | 환경변수 root와 sidecar root 각각을 PowerShell parser/fixture로 해석 | 필수 파일 검증 뒤 같은 새 repo root 선택, parent 절대경로 0 | validation receipt |
| CI-P04 | FR-004~006, NFR-004, NFR-006~007 | CLI·계약·문서 smoke | Node/Bash/PowerShell 문법, CLI help/safe failure, JSON schema fixture, README 계약 검사 | 모두 exit 0; current 성능은 not_run, historical만 표시 | npm test/check + validation receipt |
| CI-N01 | FR-002, NFR-001, NFR-008 | 데이터·비밀·외부경계 negative | forbidden extensions/paths/secret-like fixture/remote 설정을 주입한 verifier unit test | 각 fixture를 stable nonzero로 거부; 실제 network/remote 0 | validation receipt |
| CI-N02 | FR-003, NFR-005 | root·launcher failure matrix | missing env/sidecar, malformed sidecar, missing required file, parent root 입력 | 외부 프로세스 실행 전 `inspector_root_invalid` 계열로 실패 | validation receipt |
| CI-N03 | FR-007, NFR-002 | parent·원본 불변 검사 | Gate 전후 parent porcelain-v2 digest와 기존 allowlist SHA-256 비교 | parent status와 원본 bytes 동일; parent commit/ORBIT write 0 | sanitized pre/post evidence |
| CI-R01 | 전 요구사항 | clean regression·quality replay | `npm test`, `npm run check`, locked 8-ID runner, `git diff --check`, ORBIT Quality | 모두 exit 0, 외부 호출·실제 Illustrator·push 0, 같은 candidate OID | Quality/Trust receipts |

## 실패·복구·보안 시험

- 원본 allowlist에 없는 파일을 migration 도구에 전달하면 복사 전 거부한다.
- `downloads`, `reports`, `samples`, `.cache`, `.memory-bank`, `NUL`, AI/PDF/EPS/JPG/PNG와 1MB 초과 파일 fixture를 각각 거부한다.
- sidecar가 없거나 malformed이거나 필수 실행 파일이 빠지면 Illustrator/WSL/Node spawn counter 0으로 실패한다.
- 환경변수가 parent 기존 폴더를 가리키면 새 repo identity marker가 없어 실패한다.
- JSON 결과 fixture에서 status, designs, checks, version 필수 필드가 누락되면 consumer contract가 실패한다.
- source manifest hash mismatch와 parent/source pre-post digest drift는 commit·integration 전 BLOCKED다.
- 검사 스크립트는 원격 Git, network fetch, API, 실제 Illustrator 설치·실행을 하지 않는다.

## 실행 순서

1. Gate base와 parent/source pre-state를 기록한다.
2. 승인 base의 isolated candidate worktree를 만든다.
3. allowlist source를 복제하고 migration manifest를 생성한다.
4. portable root와 sidecar contract를 구현한다.
5. 정제 README·integration contract·result schema·검증 harness를 작성한다.
6. 8개 validation, npm test/check, diff/secret/data 검사를 실행한다.
7. candidate commit에 Quality receipt를 결속한다.
8. 별도 verifier가 clean checkout에서 8개 ID를 replay한다.
9. 새 저장소 main이 Gate base와 unchanged clean 상태일 때만 ff-only integrate/post-Quality한다.
10. parent와 기존 폴더 pre/post 불변을 다시 확인한다.

## Release 기준

- CI-P01~CI-P04, CI-N01~CI-N03, CI-R01이 같은 candidate OID에서 PASS해야 한다.
- tracked 금지 데이터·1MB 초과 파일·parent import·기존 parent 절대경로·Git remote가 모두 0이어야 한다.
- parent Git status와 기존 source-only bytes가 Gate pre-state와 같아야 한다.
- 새 저장소 main은 clean이어야 하며 local commit 외 push/PR/remote 생성이 없어야 한다.
- source-only split 완료만 선언한다. Windows 설치, 실제 Illustrator 기능·성능, parent 웹앱 integration은 `NOT_RUN / OUT_OF_SCOPE`로 명시한다.

## 외부 설정·사용자 검증

- 유료 API, 메일/Google/광고 호출, npm network install, 원격 저장소, push/PR, 배포: 0건.
- Windows Illustrator 설치·단축키·시작 메뉴 변경: 0건.
- parent `campus-look-ops` 제품·tests·ORBIT 변경: 0건.
- 무료 대안: 새 저장소를 만들지 않고 기존 하위 폴더에서 계속 작업하는 방법이 있으나 병렬 Git·ORBIT 격리 목표를 충족하지 못한다.
