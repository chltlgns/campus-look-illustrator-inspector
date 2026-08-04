# Architecture decisions — Windows Illustrator drive-path 실제 활성화 복구

상태: ready

## ADR-DP-001 — rooted drive path를 forward slash로 정규화한 뒤 wslpath 유지

- 상태: accepted
- 맥락: 공백 없는 raw `C:\...` argument는 WSL 경계에서 백슬래시가 제거되지만 `C:/...`는 정확히 변환된다.
- 결정: rooted drive-letter input의 `\`를 `/`로 바꾼 뒤 configured distribution의 `wslpath -a -u`를 호출한다.
- 대안: `/mnt/<drive>`를 직접 조립하거나 runtime sidecar를 UNC workaround로 바꾼다.
- 결과·위험: configured automount를 계속 존중하고 default sidecar를 검증할 수 있다. host `wslpath` behavior는 locked/installed evidence로 제한한다.
- 근거: EV-D02, EV-D03, EV-D04

## ADR-DP-002 — drive-relative path fail-closed

- 상태: accepted
- 맥락: `C:foo`는 current-drive-relative semantics라 source/runtime identity와 재현성을 약화한다.
- 결정: drive prefix가 있으나 separator로 root되지 않은 input은 `inspector_root_invalid`로 거부한다.
- 대안: raw fallback에 맡기거나 Windows current directory를 해석한다.
- 결과·위험: ambiguous input을 외부 process 전에 차단하며 existing GetItem.FullName 기반 caller에는 영향이 없다.
- 근거: EV-D01, EV-D02

## ADR-DP-003 — 기본 C-drive sidecar로 실제 회귀

- 상태: accepted
- 맥락: runtime UNC를 주면 현 결함을 우회할 수 있지만 documented installer default가 계속 깨진다.
- 결정: 재설치 sidecar는 원래 기본 LocalAppData drive path를 유지하고 converter fix를 실제로 통과시킨다.
- 대안: source/runtime 모두 WSL UNC로 구성하는 운영 workaround.
- 결과·위험: 실질 원인을 검증하고 기본 계약을 보존한다. source change라 새 Gate와 full replay가 필요하다.
- 근거: EV-D01, EV-D04, EV-D06

## ADR-DP-004 — actual failure scope 보존과 fresh successor

- 상태: accepted
- 맥락: v02 source Quality는 PASS했지만 실제 activation은 실패해 완료로 바꿀 수 없다.
- 결정: v02를 terminal_blocked로 보존하고 v03 isolated candidate에서 최소 수정·재검증한다.
- 대안: v02 artifact를 덮어쓰거나 installed sidecar만 수동 수정한다.
- 결과·위험: failure evidence와 approval boundary가 보존되며 한 차례 더 Gate/Quality/Trust/install이 필요하다.
- 근거: EV-D01, EV-D06, EV-D08
