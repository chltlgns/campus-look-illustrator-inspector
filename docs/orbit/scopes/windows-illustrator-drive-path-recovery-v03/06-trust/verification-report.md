# Verification report — Windows Illustrator drive-path 실제 활성화 복구

상태: completed

## 환경과 범위

검증 대상은 base `756e554ea8239fdbb3f32935875707b6a41d392c`에서 candidate/main
`98d40da5bf7ea9ea00305e4027b1fa7aa499e83a`까지의 승인된 변경과 통합 후 Windows
설치·실제 Illustrator 동작이다. 고객 파일명과 raw output은 Git 밖에만 보존했다.

## 요구사항별 증거

| 요구사항 | 방법 | 명령·절차 | 결과 | 증거·한계 |
|---|---|---|---|---|
| REQ-DP-001 | test/demonstration | DP-P01 및 installed drive conversion, actual Quiet | pass | 기본 runtime exact `/mnt/c/...`; launcher exit 0 |
| REQ-DP-002 | test/demonstration | DP-P02/DP-N01과 installed positive/negative | pass | Unicode exact, malformed/relative stable `inspector_root_invalid` |
| REQ-DP-003 | test/inspection | 30 locked, Quality/Trust/integration, fresh backup/install | pass | main exact candidate; 9 entries; installed/source equality; post drift 0 |
| REQ-DP-004 | demonstration | cold/warm, report artifacts, active, 20 batch, Start Menu, actual hotkey | pass | 20/20 execution, multi-design 2, document/input preservation |
| REQ-DP-005 | inspection/recovery | manifest guard, boundary state, input hashes | pass | rollback eligible; prohibited writes/calls 0; source/data drift 0 |

## 회귀·실패·복구·보안 결과

- locked normalized result digests: legacy 8
  `4c0ca46cc319fb577132285c2256969915deb614835b5d3d98b567c5fa6f8342`,
  cutover 12 `abb1009defe094f7ea517c9e16119dc88bea9205c949b247f279aa85bd652ca3`,
  recovery 6 `e42072f8259846d24279b04aa983633e9f0eaefcae5acdbd887dc6acc8a19ced`,
  drive 4 `35c266c8863b1cb40a21e8e1e156ae1098408aea1673f309873b64599c1a7f0b`.
- clean Trust verdict PASS, verifier `orbit-clean-drive-path-replay`, verification worktree
  `removed_after_pass`; post-Quality receipt SHA-256
  `cda9fa1fcd0689b5c93fe94a4f4494c755e5122b3c9fe3fd45702d556142845d`.
- installed source/runtime resolver positives와 모든 negative가 기대 계약대로 동작했다.
- report는 schemaVersion 3, design/status 결합, JSON/Markdown/material/PNG 계약을 만족했다.
- batch는 20/20 실행, errors 0, contract errors 0, original document preserved true였다.
  내용 판정 PASS 15/REVIEW 3/FAIL 2와 multi-design 2는 원시 report와 일치한다.
- cold outer/internal 30.987/29.8초, warm outer 평균 3.349초/internal 평균 2.233초였다.
  과거 0.82초는 환경·cache 조건을 혼합하지 않고 참고값으로만 분리했다.
- 사후 input/palette/staging hash drift 0, manifest post drift 0, Program JSX hash/mtime
  drift 0, process/document/saved-state drift 0이다.
- rollback은 failure가 없어서 쓰지 않았으며 fresh manifest current=post 9/9와 기존
  recovery matrix로 eligibility와 guard 의미를 확인했다.

## 미검증·차단·사용자 확인 항목

없음. 내용 판정 REVIEW 3개와 FAIL 2개는 사람이 확인·수정할 운영 결과이며 소프트웨어
회귀 실패나 미검증 항목이 아니다. external API·유료 호출·network install은 0이다.
