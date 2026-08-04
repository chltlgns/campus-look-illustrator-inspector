# Validation

## 한 번에 실행

```bash
npm run check && npm test && npm run migration:verify
```

검증 항목:

- Node `.mjs` 문법과 정적 금지 의존성
- Bash `-n` 문법과 CLI help/safe failure
- Windows PowerShell parser를 이용한 `.ps1` 문법
- 환경변수/sidecar root 선택과 필수 파일 fail-closed 계약
- source/runtime 독립 경로, schema 2 sidecar와 repository-inside runtime 거부
- Windows cutover preflight·backup manifest·hash-guarded rollback temp fixture
- `\\wsl.localhost`·`\\wsl$` direct conversion, distribution mismatch/빈 path fail-closed
- pre-state와 이미 같은 보호 target의 rollback write 0과 changed target 복원
- migration source/target SHA-256과 source-only allowlist
- 금지 경로·확장자·1MB 초과 artifact·secret-like fixture 거부
- `report.json` schema version 3, PASS/REVIEW/FAIL 의미와 integration 문서
- 독립 Git/ORBIT 경계와 기존 parent/source pre-state 불변성

PowerShell 문법 검사는 WSL에서 `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe` 또는 `POWERSHELL_EXE`를 사용합니다. 실제 Illustrator COM, 설치기, 단축키, 네트워크는 실행하지 않습니다.

## ORBIT locked validation

candidate commit이 clean한 상태에서 다음 명령은 정확히 8개 locked ID를 실행합니다.

```bash
python3 /mnt/d/AI-Workflow/cli/orbit.py validation run \
  --repo . \
  --profile quality/orbit-validation-inspector-split-v01.json \
  --json
```

ID는 `CI-P01`~`CI-P04`, `CI-N01`~`CI-N03`, `CI-R01`입니다. 테스트는 임시 폴더만 쓰며 저장소를 변경하지 않습니다.

Windows 전환 candidate는 `quality/orbit-validation-windows-cutover-v01.json`의 `CW-P01`~`CW-P06`, `CW-N01`~`CW-N05`, `CW-R01` 12개를 추가로 실행합니다. backup/rollback 검증은 temp fixture만 사용하며 실제 LocalAppData, shortcut, Illustrator를 변경하지 않습니다.

실제 활성화 복구 candidate는 `quality/orbit-validation-windows-cutover-recovery-v02.json`의 `RC-P01`~`RC-P03`, `RC-N01`~`RC-N02`, `RC-R01` 6개를 더 실행합니다. 두 WSL UNC 형식, distribution/path negative, 보호 파일 no-op rollback과 실제 변경 복원을 각각 고정합니다. 전체 locked validation 수는 8 + 12 + 6 = 26개입니다.

drive-path 실제 활성화 복구 candidate는 `quality/orbit-validation-windows-drive-path-recovery-v03.json`의 `DP-P01`, `DP-P02`, `DP-N01`, `DP-R01` 4개를 추가합니다. 공백 없는 LocalAppData drive path, 공백·Unicode drive path, drive-relative fail-closed, 기존 UNC·resolver·rollback 회귀를 고정합니다. 전체 locked validation 수는 8 + 12 + 6 + 4 = 30개입니다.

## 수행하지 않은 검증

- 실제 지정 AI/컬러판 검사: Windows external validation에서 별도 수행
- Illustrator 2025 설치·단축키 확인: Windows backup과 Gate 승인 뒤 별도 수행
- 독립 환경 성능 재측정: Git 밖 runtime에서 cold/warm으로 별도 수행
- parent 애플리케이션 연결: `out_of_scope`
- remote/push/PR/deploy/API: `out_of_scope`, 0건
