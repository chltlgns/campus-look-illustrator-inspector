# Architecture decisions — Windows Illustrator UNC 및 rollback 복구 전환

상태: ready

## ADR-001 — validated WSL UNC를 직접 변환

- 상태: accepted
- 맥락: 현재 Windows→WSL 호출에서 두 UNC 표기가 모두 `wslpath -u`에 실패한다.
- 결정: `\\wsl.localhost` 또는 `\\wsl$`만 case-insensitive 허용하고 share distribution이 configured distribution과 같으며 path가 non-empty일 때 직접 `/...`로 변환한다.
- 대안: sidecar에 Linux root를 별도 저장하는 schema 3은 계약 변경 범위가 더 크므로 채택하지 않는다. UNC를 드라이브에 매핑하는 host 설정도 portability가 낮다.
- 결과·위험: parser test가 필수이며 일반 drive path fallback은 유지한다.
- 근거: EV-003, EV-004

## ADR-002 — 전체 post guard 뒤 entry-level pre-equal no-op

- 상태: accepted
- 맥락: Program JSX는 설치 전후 동일했지만 rollback이 불필요한 보호 경로 복사를 시도했다.
- 결정: rollback 시작 전 모든 current=post 검증은 그대로 수행하고, 각 pre-existing entry의 current hash가 pre hash면 Copy-Item을 생략한다.
- 대안: 항상 관리자 elevation은 불필요한 권한 확대이며, Program JSX를 manifest에서 제외하면 drift 보호가 약해진다.
- 결과·위험: no-op 여부와 최종 전체 pre-state를 모두 검증해야 한다.
- 근거: EV-005

## ADR-003 — 실제 AI는 saved active readiness 뒤에만 재개

- 상태: accepted
- 맥락: active 문서가 미저장이고 v01 Gate가 saved readiness를 실제 실행 조건으로 정했다.
- 결정: 재설치·구조 검증까지만 자동 진행하고 Saved=true인 지정 test AI active 상태를 확인한 뒤 actual Quiet/batch/shortcut/hotkey를 실행한다.
- 대안: 미저장 문서를 둔 채 explicit path만 재실행하는 것은 승인 조건을 약화하므로 채택하지 않는다.
- 결과·위험: 사용자 준비가 없으면 실제 회귀는 정확히 BLOCKED로 남는다.
- 근거: EV-008
