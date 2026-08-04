# Pre-implementation gate — Campuslook Illustrator Inspector

- 상태: APPROVED_FOR_IMPLEMENTATION
- 생성일: 2026-08-04
- 프로필: strict

## 구현 청사진

- 새 독립 저장소: `/home/doggabiya/campus-look-illustrator-inspector`
- 승인 Git base: `d68d1fc65606fe9ae62c3655ea643f90d8c3ee3a`
- 구현 위치: 승인 base에서 ORBIT가 만드는 isolated candidate worktree
- 제품 범위: 검사기 source-only 복제, portable root, CLI/JSON contract, 정제 문서, migration verifier와 8개 locked validation
- 공존 원칙: 기존 `/home/doggabiya/campus-look-ops/일러스트 확인용 스크립트`는 이동·삭제·수정하지 않는다.

## 포함 범위

1. 승인된 Node/Bash/PowerShell/JSX 소스의 경로·크기·SHA-256 inventory를 만든다.
2. 핵심 검사·보고서 소스만 새 candidate에 복제한다.
3. `run-proof-check.ps1`의 기존 parent 절대경로를 제거한다.
4. 환경변수 override 또는 installer-generated sidecar root를 필수 파일과 함께 fail-closed 검증한다.
5. 기존 `check-proof.sh` 입력과 report 파일명·PASS/REVIEW/FAIL 의미를 보존한다.
6. result schema, parent integration contract, 정제 README, migration 검증 harness를 추가한다.
7. `CI-P01~CI-P04`, `CI-N01~CI-N03`, `CI-R01`을 candidate commit과 Trust clean replay에 결속한다.
8. Quality·Trust PASS 뒤 새 저장소 `main`에만 ff-only 통합한다.

## 명시적 제외

- `campus-look-ops`의 app.js, server.mjs, styles.css, tests, Git, ORBIT 변경
- 기존 검사기 폴더의 이동·삭제·수정·symlink 전환
- reports, downloads, samples, .cache, .memory-bank, NUL
- AI/PDF/EPS/JPG/PNG, 고객 파일명·메일 첨부, 1MB 초과 artifact
- `download-recent-ai-attachments.mjs`와 네이버 credentials/IMAP 의존성
- Windows Illustrator 재설치, 단축키·시작 메뉴 변경, 실제 AI 검사·성능 측정
- remote 생성, push, PR, 배포, network package install, 외부 API·유료 호출

## 주요 위험과 대응

| 위험 | 대응 |
|---|---|
| 고객 AI·렌더가 Git 객체로 유입 | allowlist copy와 tracked 확장자·경로·크기 deny 검사를 모두 통과해야 commit 허용 |
| 설치된 런처가 옛 경로에 묶임 | 기존 폴더를 보존하고 새 source는 sidecar/env root를 검증; 실제 재설치는 후속 범위 |
| parent 통합 세션과 파일 충돌 | parent에 쓰기 0건, 새 저장소 isolated worktree에서만 구현, pre/post parent digest 비교 |
| 단순 복사 후 기능 계약 변형 | CLI·result schema·negative root fixtures와 source digest manifest를 locked validation으로 실행 |
| 기존 0.82초 수치를 새 결과로 오인 | historical baseline으로만 문서화하고 현재 성능을 NOT_RUN으로 표시 |
| ORBIT control-plane dirt로 통합 차단 | candidate를 보존하고 exact typed rebind가 필요하면 별도 request/approval 없이 우회하지 않음 |

## 검증 계획

- CI-P01: 독립 Git·ORBIT 경계
- CI-P02: allowlist·manifest·금지 데이터
- CI-P03: env/sidecar portable root positive 경로
- CI-P04: 문법·CLI·JSON·문서 계약
- CI-N01: 금지 데이터·비밀·remote negative fixture
- CI-N02: root·launcher fail-closed matrix
- CI-N03: parent·기존 source 불변
- CI-R01: npm test/check, diff, ORBIT Quality·Trust clean replay

실제 Illustrator, 고객 AI, 네트워크, 외부 API는 검증에 사용하지 않는다.

## 외부 작업과 비용

- 로컬 external action: 새 저장소의 격리 worktree·candidate branch, source-only 로컬 복제·수정, 로컬 테스트·커밋, 독립 Trust, 새 저장소 main ff-only 통합.
- parent/기존 폴더/Windows 설치/실데이터 외부쓰기: 0건.
- 유료 API 또는 과금 가능 호출: 0건, 예상 추가비용 `$0`.
- 무료 대안: 기존 하위 폴더 유지. 다만 독립 Git·ORBIT 병렬성 목표는 충족하지 못한다.

## 승인 전 점검

- [x] 목표·범위·성공 기준이 사용자의 독립 프로젝트 분리 요청과 일치한다.
- [x] 고객 데이터, installed launcher, parent 동시작업 위험과 반대근거가 추적된다.
- [x] FR-001~007, NFR-001~008과 TASK-001~006, 8개 validation이 연결된다.
- [x] 외부 변경·유료 API·보안 경계가 명시된다.
- [x] source-only split과 parent integration/Windows cutover가 분리된다.

## 승인 기록

digest-bound request를 먼저 생성하고 현재 대화에서 사용자가 request ID·digest와 전체 scope를 명시적으로 승인한 뒤에만 구현을 시작한다. `conversation-process`에는 signed platform event가 없으므로 cryptographic user proof가 아니다.

## 실행 승인 증거 — gate-20260804T021917Z-71d54ce764de

- 승인시각(UTC): 2026-08-04T02:25:09+00:00
- 승인자: user
- 승인 문구: 요청 ID gate-20260804T021917Z-71d54ce764de, 요청 SHA-256 a8a3437f3e4e1b3c98c479ff90f99d9e8ea3705aab0d46da14a6bdba6bb281a4의 다음 전체 범위를 승인합니다: 기준 커밋 d68d1fc65606fe9ae62c3655ea643f90d8c3ee3a의 isolated candidate에서 Campuslook Illustrator 검사기를 독립 저장소로 source-only 분리한다: 기존 /home/doggabiya/campus-look-ops/일러스트 확인용 스크립트의 승인된 Node/Bash/PowerShell/JSX 소스만 복제하고 원본·대상 SHA-256 migration manifest를 남긴다. reports, downloads, samples, .cache, .memory-bank, NUL, AI/PDF/EPS/JPG/PNG, 1MB 초과 artifact, 메일 다운로드·자격증명 의존 코드는 포함하지 않는다. PowerShell launcher의 기존 parent 절대경로를 제거하고 explicit environment override 또는 installer-generated sidecar root를 필수 파일과 함께 fail-closed 검증한다. 기존 check-proof.sh 입력과 report.json/report.md/material reference 출력 및 PASS/REVIEW/FAIL 의미를 보존하고, CLI/JSON integration contract·정제 README·result schema·migration verifier·8개 locked local validation을 추가한다. 기존 campus-look-ops와 기존 검사기 폴더, 실행 중인 프로세스, Windows Illustrator 설치·단축키는 변경하지 않는다. candidate Quality와 clean independent Trust PASS 뒤 새 저장소 main에만 ff-only 통합하며 remote 생성, push, PR, 배포, network install, 외부 API와 유료 호출은 0건이다.
- request ID: gate-20260804T021917Z-71d54ce764de
- request digest: a8a3437f3e4e1b3c98c479ff90f99d9e8ea3705aab0d46da14a6bdba6bb281a4
- attestation mode: conversation-process
- cryptographic user proof: false
- warning: conversation-process는 signed platform event가 없어 agent self-entry를 기술적으로 방지하지 못합니다.
