# Verification report — Windows Illustrator UNC 및 rollback 복구 전환

상태: blocked — runtime drive-path actual activation 실패, rollback 완료

## 환경과 범위

검증 기준은 승인 base `869e23dafe42da1c87fa4d38b19c60f771d30444`와 integrated commit
`756e554ea8239fdbb3f32935875707b6a41d392c`이다. source 검증은 clean candidate,
다른 verifier clean worktree, post-integration clean worktree에서 수행했다. Windows 검증은
실제 LocalAppData 설치와 Start Menu shortcut을 대상으로 했고 backup·runtime·입출력은 Git 밖에
유지했다. 사용자의 직접 지시로 지정 test AI 1개를 새 active document로 열어 saved readiness를
충족한 뒤 첫 explicit Quiet cold를 실행했다.

## 요구사항별 증거

| 요구사항 | 방법 | 명령·절차 | 결과 | 증거·한계 |
|---|---|---|---|---|
| REQ-R2-001 | test/demonstration | recovery RC-P01/RC-P02 + installed resolver 두 UNC 변환 | pass | 두 형식 모두 `/home/doggabiya/campus-look-illustrator-inspector`; actual Quiet은 readiness 뒤 실행 |
| REQ-R2-002 | test/demonstration | mismatch·empty·missing sidecar/files·nested runtime | pass | 모든 installed negative가 `inspector_root_invalid`; AI open 전 실행 |
| REQ-R2-003 | test/demonstration | fixture + fresh 9-entry manifest 실제 rollback | pass | exit 0, writes 3, pre-equal skip 6, pre-state mismatch 0 |
| REQ-R2-004 | inspection/test | Quality/Trust/integration, backup/install, hash·sidecar·shortcut·document 대조 | pass | 6 file hash mismatch 0, schema 2, UNC root, Ctrl+Shift+Q, Program JSX 및 1 process/3 docs 불변 |
| REQ-R2-005 | readiness/demonstration | 지정 AI active/saved 확인 후 explicit Quiet cold | blocked | readiness PASS 뒤 runtime drive path `wslpath` failure; AI processing/report 0 |
| REQ-R2-006 | inspection | repo/parent/legacy/worktree/remote/API 경계 대조 | pass_so_far | main exact integrated OID, remote 0, parent HEAD `094f192be8fb4289ee549ede92bff19ff715bc06` 불변, preserved worktree 유지 |

## 회귀·실패·복구·보안 결과

- 회귀: 기존 8, v01 12, recovery 6의 ordered locked validation이 모두 PASS했다.
- Quality: candidate, 다른 verifier clean Trust, integrated OID post-Quality가 모두 PASS했다.
- 실패 폐쇄: UNC distribution mismatch, empty UNC, sidecar 누락, 필수 파일 누락,
  source 내부 runtime이 모두 `inspector_root_invalid`로 차단됐다.
- 복구: actual post-state에서 fresh backup rollback이 성공했고 Program JSX를 포함한 pre-equal
  6 entries는 write 없이 건너뛰었다. 9 entries를 pre-state와 독립 대조한 mismatch는 0이었다.
- actual failure: source UNC conversion 이후 LocalAppData `C:\...` runtime argument의 백슬래시가
  소실되어 `wslpath` exit 1이었다. 첫 Quiet는 0.863초에 종료됐고 AI collector/report/runtime
  output은 0이었다.
- 실제 복구: recorded final post-state와 current가 모두 일치한 뒤 rollback exit 0,
  writes 3, pre-equal skips 6이었다. 독립 pre-state mismatch는 0이며 현재 설치는 legacy다.
- 문서 보존: failure 전후 active designated test AI와 `Saved=true`가 유지됐다. 기존 3개 문서는
  저장·종료하지 않았고 user-authorized test AI open으로 document count만 4가 됐다. Program JSX
  hash와 mtime은 불변이었다.
- 보안/경계: network install, remote, push, PR, 배포, 외부 API, 유료 호출은 0이다.
  AI·원시 output·backup은 Git에 추가하지 않았다.

## 미검증·차단·사용자 확인 항목

- saved active readiness는 PASS했다. explicit Quiet cold는 runtime drive-path conversion에서
  BLOCKED됐고 warm/report/batch/multi/shortcut/hotkey/성능은 NOT_RUN이다.
- blocker evidence는
  `.orbit/scopes/windows-illustrator-cutover-recovery-v02/blockers/actual-activation-20260804T060247Z.json`, SHA-256
  `f7cea615371763e1a1bf6fd814090629fcebfc314d9308514119509ba6c4352e`이다.
- raw drive path와 forward-slash normalized input의 읽기 전용 대조로 다음 수정 방향은 확인했지만,
  v02 Gate는 그 source 변경을 승인하지 않았다. 이 scope는 성공이 아니며 fresh successor가 필요하다.
