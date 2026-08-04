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

## 수행하지 않은 검증

- 실제 지정 AI/컬러판 검사: Windows external validation에서 별도 수행
- Illustrator 2025 설치·단축키 확인: Windows backup과 Gate 승인 뒤 별도 수행
- 독립 환경 성능 재측정: Git 밖 runtime에서 cold/warm으로 별도 수행
- parent 애플리케이션 연결: `out_of_scope`
- remote/push/PR/deploy/API: `out_of_scope`, 0건
