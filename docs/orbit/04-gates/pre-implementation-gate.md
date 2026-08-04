# Pre-implementation gate — Campuslook Illustrator Inspector

- 상태: PENDING_USER_APPROVAL
- 생성일: 2026-08-04
- 프로필: strict

## 승인 전 점검

- [ ] 목표·범위·성공 기준이 사용자 의도와 일치한다.
- [ ] 중대한 가정과 반대근거가 추적된다.
- [ ] 요구사항·아키텍처·백로그·검증 계획이 연결된다.
- [ ] 외부 변경·유료 API·보안 경계가 명시된다.
- [ ] 구현 범위와 제외 범위를 사용자가 이해했다.

## 승인 기록

먼저 다음을 고정한다.

- scope와 명시적 제외 범위
- Planning evidence digest
- Git repository와 approved base commit
- 생성·통합·설치·외부 작업
- attestation mode와 비암호학적 한계

`orbit gate request`로 immutable request를 만든다. 현재 대화에서 사용자가 그 request의
구체적인 범위를 승인한 뒤에만 `orbit gate approve --request-id ...`가 request ID 전용 구역을
기록한다. 과거의 일반 승인 heading은 현재 request의 승인으로 재사용하지 않는다. 중단된 정확한
prefix는 같은 actor/note의 `orbit gate recover`로만 재개하고, 교체는 승인 전 `gate supersede`로만 한다.
`conversation-process`에는 signed platform event가 없으므로 cryptographic user proof가
아니라는 warning을 숨기지 않는다.
