# Verification report — Campuslook Illustrator Inspector

상태: complete

## 환경과 범위

- 승인 base: `d68d1fc65606fe9ae62c3655ea643f90d8c3ee3a`
- 검증·통합 OID: `d93a0157d8e7d757ed99f0cf7ba74a9af1c35300`
- implementer: `codex`; verifier: `orbit-clean-replay` (process-asserted identity, cryptographic proof 아님)
- Trust receipt: `.orbit/trust/inspector-source-split-v01-d93a0157d8e7.json`
- post-Quality receipt: `.orbit/quality/post-integration-recovery-inspector-source-split-v01-d93a0157d8e7.json`
- detached clean worktree에서 같은 committed Quality profile과 8개 locked selector를 replay했다.

## 요구사항별 증거

| 요구사항 | 방법 | 명령·절차 | 결과 | 증거·한계 |
|---|---|---|---|---|
| FR-001 | 독립 Git·ORBIT root 검사 | `CI-P01` | pass | parent와 다른 top-level |
| FR-002 | migration·tracked policy | `CI-P02`, `CI-N01` | pass | 12 source SHA, 금지 artifact 0 |
| FR-003 | 실제 PowerShell fixture | `CI-P03`, `CI-N02` | pass | env/sidecar 성공, 4개 failure matrix |
| FR-004 | CLI·schema·status 검사 | `CI-P04`, Node test | pass | report schema 3, PASS/REVIEW/FAIL 보존 |
| FR-005 | committed local harness | Quality source/check/test | pass | Node/Bash/PowerShell parser |
| FR-006 | integration contract | `docs/integration.md` inspection | pass | input, timeout, exit, ownership 명시 |
| FR-007 | parent/source 불변 | `CI-N03` | pass | parent HEAD/status와 12 source hash 동일 |
| NFR-001~008 | policy·회귀·외부경계 | `CI-N01`, `CI-R01`, Quality | pass | remote/network/API/유료 호출 0 |

## 회귀·실패·복구·보안 결과

- 8/8 locked validation ID가 clean candidate와 최종 main OID에서 PASS했다.
- source lint, Node/Bash/PowerShell syntax, Node regression, migration verifier, ancestry, patch hygiene, post-Quality가 PASS했다.
- missing/malformed/incomplete/legacy-parent root는 `inspector_root_invalid`로 analyzer 실행 전에 거부됐다.
- reports/downloads/samples/cache/memory/NUL, 금지 확장자, 1 MiB 초과, secret-like fixture가 거부됐다.
- typed rebind는 승인된 2개 control-plane 변경을 overwrite/delete/stage/commit하지 않고 보존했다.
- 첫 rebind 요청은 request artifact self-drift 때문에 fail-closed됐고 immutable supersede 후 fresh approval로 복구했다.

## 미검증·차단·사용자 확인 항목

- 실제 Illustrator 2025 재설치, 단축키, 고객 AI/컬러판 기능·성능: `NOT_RUN`.
- parent 애플리케이션 연결: `OUT_OF_SCOPE`.
- 과거 0.82초는 historical baseline이며 현재 성능 PASS 근거가 아니다.
- cleanup은 `candidate_preserved_after_recovery`; candidate worktree 보존은 제품 판정에 영향 없는 경고다.
- 기존 parent와 원본 검사기, Windows 설치, 실행 프로세스, remote, 외부 API는 변경하지 않았다.
