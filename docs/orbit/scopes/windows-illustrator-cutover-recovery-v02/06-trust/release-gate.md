# Release gate — Windows Illustrator UNC 및 rollback 복구 전환

- 상태: terminal_blocked
- 판정일: 2026-08-04

## 판정

BLOCKED

source 구현·26개 locked validation·Quality·clean Trust·ff-only integration·post-Quality와
Windows 구조·rollback 검증은 PASS했다. saved active readiness도 PASS했지만 첫 explicit Quiet가
LocalAppData drive-path conversion에서 exit 1이었다. report는 생성되지 않았고 recorded post-state
guard 뒤 legacy 설치로 rollback했다.

## 필수 기준

- [ ] 승인 범위의 요구사항이 검증 증거와 연결된다. REQ-R2-005 actual contract 미충족.
- [x] 관련 자동 테스트가 통과한다.
- [x] 비밀·유료 API·외부 변경 경계를 위반하지 않았다.
- [x] 실패·복구·이동 경로를 위험에 비례해 확인했다.
- [x] 남은 제한과 외부 게이트를 완료로 숨기지 않았다.

## 승인된 예외와 후속 작업

- 승인된 예외 없음.
- blocker: `.orbit/scopes/windows-illustrator-cutover-recovery-v02/blockers/actual-activation-20260804T060247Z.json`, SHA-256
  `f7cea615371763e1a1bf6fd814090629fcebfc314d9308514119509ba6c4352e`.
- 현재 Windows 설치는 legacy pre-state이고 Program JSX·Illustrator·기존 문서는 보존됐다.
- successor에서 validated drive-letter path를 forward slash로 정규화한 뒤 `wslpath`에 전달하고
  no-space runtime 및 공백·한글 palette regression을 고정해야 한다.
- 새 candidate Quality·clean Trust·ff-only integration·post-Quality와 새 Windows backup/install을
  거친 뒤에만 actual Quiet cold/warm부터 다시 시작한다.
