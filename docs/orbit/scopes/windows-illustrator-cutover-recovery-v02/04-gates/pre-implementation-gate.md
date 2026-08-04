# Pre-implementation gate — Windows Illustrator UNC 및 rollback 복구 전환

- 상태: APPROVED_FOR_IMPLEMENTATION
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

## 실행 승인 증거 — gate-20260804T051300Z-8e29e5716b1c

- 승인시각(UTC): 2026-08-04T05:14:48+00:00
- 승인자: user
- 승인 문구: 요청 ID gate-20260804T051300Z-8e29e5716b1c, 요청 SHA-256 b5e316ac5bab8a2b131eab02f6630c4afef4b4303211fbde7b72904dbf4652a3 의 다음 전체 범위를 승인합니다: 기준 커밋 869e23dafe42da1c87fa4d38b19c60f771d30444의 isolated recovery candidate에서 Windows launcher가 검증된 \\wsl.localhost 및 \\wsl$ source UNC를 configured distribution과 일치할 때만 Linux 절대경로로 직접 변환하고 mismatch·빈 경로를 inspector_root_invalid로 fail-closed하도록 수정한다. Windows rollback은 전체 current=expected-post guard를 유지하면서 current=pre인 entry를 write 없이 건너뛰도록 수정한다. 문서와 migration target hash, 기존 locked validation 20개와 신규 recovery validation 6개, Quality profile을 갱신하고 candidate Quality·다른 verifier clean Trust PASS 뒤 기존 ORBIT/user dirt와 보존 worktree를 reset·clean·삭제하지 않고 main에 ff-only 통합/post-Quality한다. 그 뒤 현재 복원된 legacy 설치본을 새 Git 밖 timestamped 9-entry byte backup과 SHA-256 manifest로 다시 보존하고, integrated installer로 LocalAppData launcher·checker·collector·resolver·schema-2 sidecar와 Ctrl+Shift+Q shortcut을 새 저장소 UNC root 및 외부 LocalAppData runtime root로 재전환한다. Program JSX가 expected installed hash와 같을 때만 Program Files write와 Illustrator restart 없이 진행하고 drift면 BLOCKED한다. installed positive/negative/UNC/rollback 검증 뒤 active document가 사용자가 준비한 saved test AI임이 확인된 경우에만 지정된 20개 AI 폴더 범위에서 explicit Quiet cold/warm, report 계약, batch/multi-design, active document, Start Menu shortcut과 실제 Ctrl+Shift+Q 회귀 및 새 성능을 측정한다. 구조·계약·문서보존 실패 시 current=expected-post인 실제 변경 대상만 fresh backup으로 rollback한다. campus-look-ops·legacy source·기존 열린 문서·remote·push·PR·배포·network install·외부 API·유료 호출은 변경하지 않고 AI·원시 output·backup은 Git에 추가하지 않는다.
- request ID: gate-20260804T051300Z-8e29e5716b1c
- request digest: b5e316ac5bab8a2b131eab02f6630c4afef4b4303211fbde7b72904dbf4652a3
- attestation mode: conversation-process
- cryptographic user proof: false
- warning: conversation-process는 signed platform event가 없어 agent self-entry를 기술적으로 방지하지 못합니다.
