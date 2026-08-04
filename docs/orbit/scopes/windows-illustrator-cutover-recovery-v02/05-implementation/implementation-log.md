# Implementation log — Windows Illustrator UNC 및 rollback 복구 전환

상태: terminal_blocked — runtime drive-path actual activation 실패 후 rollback 완료

## 승인된 범위

Gate `gate-20260804T051300Z-8e29e5716b1c`가 승인한 base
`869e23dafe42da1c87fa4d38b19c60f771d30444`, UNC direct conversion,
fail-closed resolver, pre-equal rollback no-op, 26개 locked validation,
Quality/clean Trust/ff-only integration, fresh Windows backup·재설치와 지정 AI
실제 회귀 범위만 수행했다. remote·parent·legacy source·열린 Illustrator 문서·외부 API는
변경하지 않았다.

## 구현된 요구사항

| 요구사항 | 변경 파일·구성요소 | 검증 | 결과 |
|---|---|---|---|
| REQ-R2-001 | `illustrator/inspector-root.ps1`, `illustrator/run-proof-check.ps1` | RC-P01/RC-P02 및 installed `\\wsl.localhost`/`\\wsl$` direct conversion | pass |
| REQ-R2-002 | `illustrator/inspector-root.ps1` | RC-N01/RC-N02 및 installed mismatch·empty·missing-sidecar·missing-file·nested-runtime negative | pass |
| REQ-R2-003 | `illustrator/windows-cutover.ps1` | RC-P03/RC-R01 및 fresh manifest 실제 rollback | pass |
| REQ-R2-004 | 문서, migration manifest, Quality profiles, Windows installer | candidate/Trust/post-Quality, 9-entry backup, installed hashes·sidecar·shortcut·Program JSX·문서 상태 | pass |
| REQ-R2-005 | Git 밖 LocalAppData runtime | saved readiness 뒤 explicit Quiet cold 실행 | blocked |
| REQ-R2-006 | 작업 경계 전후 관찰 | remote 0, parent HEAD 불변, legacy source write 0, preserved worktree 유지, API 0 | pass_so_far |

## 실행 명령과 결과

- candidate commit: `756e554ea8239fdbb3f32935875707b6a41d392c`
- locked validation: legacy 8/8, cutover 12/12, recovery 6/6 PASS.
  normalized result SHA-256은 각각 `b35c248d185de5adab75ef9322f82c7b700f4fe93a46162dbc2c9b6e3f1f3f9d`,
  `0b1c29b12003e8ac7a5ba27487da24cd7fe8a03db8cc42e9126cd213e2f9a32e`,
  `83b4fe2bc7358dd2202ae3b48ccd8d76592c8859b92321fe9f21d1f60e3d8111`이다.
- candidate Quality PASS:
  `.orbit/scopes/windows-illustrator-cutover-recovery-v02/quality/manual-6a9fc2c20d3e8a54.json`.
- 다른 verifier clean Trust PASS:
  `.orbit/scopes/windows-illustrator-cutover-recovery-v02/trust/windows-illustrator-cutover-recovery-v02-756e554ea823.json`.
- ff-only integration과 integrated OID post-Quality PASS:
  `.orbit/scopes/windows-illustrator-cutover-recovery-v02/quality/post-integration-windows-illustrator-cutover-recovery-v02-756e554ea823.json`.
- Windows read-only preflight는 legacy 7 present/2 absent와 Program JSX hash equality를 확인했다.
- Git 밖 fresh backup ID `20260804T054037Z-756e554`는 9 entries이고 backup/current pre-state
  mismatch가 0이었다. 최초 manifest SHA-256은
  `0b891ec87d3f2aa2de6501bbd6f4b1a1a7af2e128f896bd4dbf8548e172e7b55`이다.
- integrated installer는 schema-2 sidecar와 새 repository UNC root, 외부 LocalAppData runtime,
  Ctrl+Shift+Q shortcut을 설치했다. 6개 installed source 파일 hash mismatch는 0이다.
- actual rollback은 전체 current=post guard 뒤 exit 0,
  `writesPerformed=3`, `preEqualSkipped=6`이었고 9개 pre-state mismatch가 0이었다.
  같은 installer로 최종 재설치하고 post-state를 다시 기록했다. 최종 manifest SHA-256은
  `d3602cec694fb28974e9746a378c67094458164daa536a698d3156da394ce905`이다.
- Program JSX는 전 과정에서 SHA-256
  `e0ed0de80902444470941e2804c88844e3e6535caada9e1e066a96dbe5f027e4`,
  mtime `2026-08-03T06:37:12.1186567Z`로 불변이었다. Illustrator process 1개와 열린 문서
  3개도 설치 전후 동일했다.

## 편차·남은 작업·외부 게이트

- 2026-08-04T05:44:22Z 최초 readiness는 지정 폴더 밖의 `Saved=false` active document 때문에
  false였다. 이후 사용자가 테스트 AI 준비를 직접 수행하라고 지시해 아래와 같이 재개했다.
- installer 결과의 `restartIllustratorRequired` 필드는 기존 의미대로 `true`를 출력했지만,
  process·Program JSX hash/mtime 관찰상 Program Files write와 Illustrator restart는 모두 0이었다.
- 사용자의 직접 지시로 지정 폴더의 테스트 AI 1개를 기존 문서를 저장·종료하지 않고 새로 열었다.
  readiness는 active-in-designated-root 및 `Saved=true`로 PASS했고 document count는 3에서 4가 됐다.
- 첫 explicit Quiet cold active-document 실행은 0.863초 후 exit 1로 실패했다. source UNC는
  통과했지만 공백 없는 `C:\Users\...\runtime` argument가 WSL 쪽에서
  `C:Users...runtime`으로 전달되어 `wslpath`가 실패했다. AI collector는 시작되지 않았고
  report와 runtime file은 생성되지 않았으며 active document는 보존됐다.
- 읽기 전용 재현에서 raw drive argument는 exit 1, 백슬래시를 forward slash로 바꾼 동일
  runtime은 exit 0과 `/mnt/c/Users/GOLD/AppData/Local/Campuslook/IllustratorProofCheck/runtime`을
  반환했다. 공백·한글 palette path도 normalized input에서 exit 0이었다.
- 승인된 실패 절차로 fresh manifest current=post guard 뒤 rollback했다. exit 0,
  `writesPerformed=3`, `preEqualSkipped=6`, 9-entry pre-state mismatch 0이다. 현재 Windows
  설치는 legacy pre-state이고 resolver·sidecar는 없으며 runtime file count는 0이다.
- blocker evidence:
  `.orbit/scopes/windows-illustrator-cutover-recovery-v02/blockers/actual-activation-20260804T060247Z.json`
  (SHA-256 `f7cea615371763e1a1bf6fd814090629fcebfc314d9308514119509ba6c4352e`).
- drive-letter normalization은 승인된 v02 구현 범위를 넘으므로 새 recovery scope와 Gate가 필요하다.
