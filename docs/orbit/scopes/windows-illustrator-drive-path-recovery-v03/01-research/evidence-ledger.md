# Evidence ledger — Windows Illustrator drive-path 실제 활성화 복구

상태: ready

| ID | 유형 | 주장 | 근거 위치 | 확인일 | 한계 | 설계 영향 |
|---|---|---|---|---|---|---|
| EV-D01 | fact | saved active readiness 뒤 첫 explicit Quiet는 source UNC를 통과한 후 LocalAppData runtime 변환에서 exit 1이었다. | `.orbit/scopes/windows-illustrator-cutover-recovery-v02/blockers/actual-activation-20260804T060247Z.json` | 2026-08-04 | AI collector 이전 실패라 report 내용은 검증하지 못함 | REQ-DP-001, REQ-DP-004 |
| EV-D02 | fact | 현재 resolver의 non-UNC fallback은 raw Windows string을 `wsl.exe ... wslpath` argv로 전달한다. | `illustrator/inspector-root.ps1`의 `Convert-InspectorWindowsPathToWsl` | 2026-08-04 | host별 quoting 차이가 있을 수 있음 | ADR-DP-001 |
| EV-D03 | fact | 공백 없는 raw `C:\Users\...\runtime`은 백슬래시가 사라져 exit 1, 동일 값을 `C:/Users/.../runtime`으로 바꾸면 exit 0과 정확한 `/mnt/c/.../runtime`을 반환했다. | 2026-08-04 Windows PowerShell read-only reproduction; EV-D01 | 2026-08-04 | Ubuntu와 현재 WSL host에서 관찰 | REQ-DP-001, VAL-DP-P01 |
| EV-D04 | fact | integrated installer의 기본 external runtime은 `%LOCALAPPDATA%\Campuslook\IllustratorProofCheck\runtime`이며 sidecar에는 drive-letter Windows path가 기록된다. | `illustrator/install-illustrator-script.ps1`, README | 2026-08-04 | custom runtime은 별도 입력 가능 | REQ-DP-001, REQ-DP-003 |
| EV-D05 | counterevidence | 공백·한글 palette raw path는 현재도 exit 0이었다. 공백 때문에 Windows가 argument quoting을 보존한 것으로 보이며 no-space path와 동작이 일관되지 않다. | 2026-08-04 raw/normalized wslpath 대조 | 2026-08-04 | 출력 콘솔 encoding은 깨져 보여 실제 file open에서 재검증 필요 | REQ-DP-002, VAL-DP-P02 |
| EV-D06 | fact | actual failure 뒤 fresh manifest rollback은 exit 0, writes 3, pre-equal skips 6, 9-entry mismatch 0이었다. 현재 legacy install, resolver/sidecar absent, runtime file 0이다. | EV-D01 rollback/currentState | 2026-08-04 | 후속 설치 전 다시 preflight 필요 | REQ-DP-003, REQ-DP-005 |
| EV-D07 | fact | 사용자의 직접 지시로 지정 test AI를 새로 열었고 active-in-designated-root=true, Saved=true이다. 기존 3개 문서는 저장·종료하지 않았다. | EV-D01 readiness/currentState | 2026-08-04 | 사용자 UI 조작으로 state가 바뀔 수 있어 actual 직전 재확인 | REQ-DP-004 |
| EV-D08 | fact | main은 `756e554ea8239fdbb3f32935875707b6a41d392c`, remote 0이며 parent HEAD와 legacy source, preserved worktree는 이 작업에서 변경하지 않았다. | Git/read-only boundary observations | 2026-08-04 | 외부 user dirt는 분리해서 보존 | REQ-DP-005 |

유료 API·network install·외부 API는 조사에 사용하지 않았다. 현재 host의 실제 executable과
blocker receipt가 가장 직접적인 근거이므로 웹 자료는 필요하지 않았다.
