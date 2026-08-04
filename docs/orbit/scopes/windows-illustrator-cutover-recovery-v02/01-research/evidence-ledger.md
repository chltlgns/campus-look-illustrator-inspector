# Evidence ledger — Windows Illustrator UNC 및 rollback 복구 전환

상태: ready  
기준일: 2026-08-04

| ID | 구분 | 주장 | 출처·위치 | 확인일 | 한계·반대근거 | 연결 결정 |
|---|---|---|---|---|---|---|
| EV-001 | fact | v01 candidate 869e23d는 candidate Quality, clean Trust, ff-only integration, post-Quality를 PASS했다. | `.orbit/scopes/windows-illustrator-cutover-v01/{trust,quality,changes}` | 2026-08-04 | 실제 활성화 전 로컬·구조 검증이며 UNC runtime 실행은 포함하지 않았다. | ADR-001, REQ-R2-001 |
| EV-002 | fact | schema-2 설치·파일 해시·sidecar·shortcut·negative resolver·Program JSX 불변은 PASS했다. | `.orbit/scopes/windows-illustrator-cutover-v01/blockers/actual-activation-20260804T0505Z.json` | 2026-08-04 | 설치 후 첫 Quiet 실행에서 차단됐다. | REQ-R2-004 |
| EV-003 | fact | `wslpath -u`는 `\\wsl.localhost`와 `\\wsl$` 인자를 모두 실패시켰고 백슬래시가 소실됐다. | 같은 blocker와 2026-08-04 read-only PowerShell 재현 | 2026-08-04 | 다른 WSL/Windows 버전의 동작은 다를 수 있다. | ADR-001, REQ-R2-001 |
| EV-004 | fact | PowerShell regex는 두 UNC 형식에서 distribution `Ubuntu`와 Linux `/home/...`를 정확히 분리했다. | read-only regex 재현 | 2026-08-04 | UNC server/share/path 형식을 엄격히 제한해야 한다. | ADR-001, REQ-R2-001/002 |
| EV-005 | fact | rollback helper는 expected post 검증 후 LocalAppData/shortcut을 복원했으나 동일한 보호 JSX 복사에서 Access denied로 exit 1했다. | blocker `rollback` | 2026-08-04 | 결과 대조는 9개 모두 pre-state mismatch 0이었다. | ADR-002, REQ-R2-003 |
| EV-006 | fact | 실패 뒤 legacy launcher root, sidecar/resolver 부재, runtime file 0, 기존 문서 3개·Saved=false가 확인됐다. | blocker 및 manifest 대조 | 2026-08-04 | 빈 runtime directory는 남아 있다. | REQ-R2-004/005 |
| EV-007 | user_statement | 테스트 입력은 지정된 Desktop 폴더만 사용하며 다중 시안 여부는 모른다. | 현재 대화 | 2026-08-04 | 파일별 designCount는 실행 전 미확정이다. | REQ-R2-005 |
| EV-008 | counterevidence | saved active readiness는 아직 false다. | COM read-only 관측 | 2026-08-04 | 사용자가 저장된 test AI를 active로 준비하면 해소된다. | REQ-R2-005 |
| EV-009 | fact | campus-look-ops HEAD는 유지됐으나 후속 관측에서 외부 `.orbit/control-plane.lock`이 추가돼 status digest가 변했다. | parent read-only Git status | 2026-08-04 | 이 작업은 parent를 쓰지 않았고 lock을 삭제하지 않는다. 최종 Trust에는 동시 외부 drift로 분리 기록한다. | REQ-R2-006 |

구분은 `fact`, `user_statement`, `inference`, `assumption`, `counterevidence` 중 하나로 기록한다.
