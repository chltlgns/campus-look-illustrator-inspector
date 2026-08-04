# Architecture — Windows Illustrator drive-path 실제 활성화 복구

상태: ready

## 컨텍스트와 데이터 흐름

```text
installed launcher
→ schema-2 sidecar (source UNC, runtime C-drive)
→ Resolve-InspectorRoot existence/identity/outside-source checks
→ Convert-InspectorWindowsPathToWsl
   ├─ validated WSL UNC → direct /path
   ├─ rooted drive path → backslash-to-slash normalization → configured wslpath
   └─ malformed drive-looking path → inspector_root_invalid
→ WSL checker/analyzer
→ Git 밖 LocalAppData runtime report/cache/PNG
```

변경은 Windows→WSL converter 경계에 국한한다. `run-proof-check.ps1`은 계속 resolver 함수를
호출하고 installer는 documented default `C:\Users\GOLD\AppData\Local\...\runtime`을 sidecar에
기록한다.

## 모듈 경계와 소유 데이터

- `illustrator/inspector-root.ps1`: UNC/drive 분류, drive representation normalization,
  `wslpath` exit/output validation, root/runtime contract.
- `illustrator/run-proof-check.ps1`: installed source/runtime를 변환하고 mutex·palette cache·collector·analyzer를 조정.
- `illustrator/install-illustrator-script.ps1`: LocalAppData installed files, schema-2 sidecar,
  Start Menu shortcut 소유. 기본 runtime semantics는 유지한다.
- `illustrator/windows-cutover.ps1`: 9 targets의 Git 밖 backup/post/rollback. v03에서 logic 변경 없음.
- Git은 source/tests/docs/profiles만 소유한다. AI, palette, cache, PNG, report, batch summary,
  backup은 Git 밖 Windows 경로에만 둔다.

## 실패·복구·관측성

- drive-relative `C:foo`, empty conversion, `wslpath` nonzero/empty는 `inspector_root_invalid`로
  external analyzer 전에 실패한다.
- candidate validation은 no-space runtime, space·한글 palette, malformed drive input을 별도 ID로 고정한다.
- actual은 readiness, input/palette hash, Program JSX hash, document snapshot을 먼저 기록한다.
- fresh backup 뒤 install/post-state를 기록하고, structural·contract·document failure이면 모든
  current=expected-post를 먼저 확인한 뒤 helper rollback을 실행한다.
- Quiet cold/warm은 launcher JSON `elapsedSeconds`, `phaseTimings`와 outer timing을 모두 보존한다.
  batch는 per-file execution/status/designCount와 originalDocumentPreserved를 기록한다.

## 보안·비밀·외부 작업 경계

- network/API/paid service가 필요하지 않으며 호출하지 않는다.
- customer/test filenames와 raw report는 ORBIT docs에 넣지 않고 sanitized counts·hash·status만 기록한다.
- 기존 3개 문서는 저장·종료하지 않는다. user-authorized test document도 검사기가 저장하지 않는다.
- Program JSX current hash가 expected installed hash와 다르면 installer 전에 BLOCKED한다.
- parent Git/legacy source/remote/preserved worktree에 write, reset, clean, delete를 수행하지 않는다.

## 이동·업그레이드 전략

- base는 main `756e554ea8239fdbb3f32935875707b6a41d392c`이고 isolated candidate만 편집한다.
- source UNC와 configured `Ubuntu`는 portable root 계약을 유지한다.
- drive normalization은 mount root를 하드코딩하지 않고 `wslpath`를 계속 사용하므로 현재
  distribution의 automount configuration을 따른다.
- clean Trust와 ff-only/post-Quality 없이는 Windows 재설치를 하지 않는다.
- failure 시 legacy pre-state와 fresh backup을 유지하며 새 코드와 legacy source를 symlink로 대체하지 않는다.
