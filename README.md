# Campuslook Illustrator Inspector

캠퍼스룩 야구점퍼 시안의 표·원단 번호·대표색을 로컬에서 검사하는 독립 source-only 프로젝트입니다. 고객 AI, 컬러판, 렌더, 보고서, 메일 첨부와 자격증명은 저장소에 포함하지 않습니다. 분석은 Windows Illustrator 2025와 WSL의 Bash/Node를 사용하며 외부 API나 유료 서비스를 호출하지 않습니다.

## 지원 환경

- Node.js 24 이상
- Bash와 WSL
- Windows PowerShell 5.1
- Adobe Illustrator 2025 한국어판

Node 패키지 의존성은 없습니다. 이 저장소의 검증에는 네트워크 설치가 필요하지 않습니다.

## CLI

```bash
./check-proof.sh <proof.ai> [palette.ai] [output-directory]
```

컬러판 인자를 생략할 때는 `CAMPUSLOOK_MATERIAL_PALETTE`에 WSL 경로를 지정합니다. 출력 폴더를 생략하면 저장소의 ignored `reports/` 아래에 결과가 생성됩니다. 원본 AI는 저장하거나 수정하지 않고 출력 폴더에 분석용 복사본을 만듭니다.

주요 출력은 다음과 같습니다.

- `result/report.json`: schema version 3 구조화 결과
- `result/report.md`: 사람이 읽는 검사 보고서
- `result/material-color-reference.json`
- `result/material-color-reference.csv`
- `proof/artboard-*.png`와 `proof/document.json`

`PASS`, `REVIEW`, `FAIL`은 검사 결과의 의미이며 프로세스 성공 여부와 구분됩니다. 정상적으로 보고서를 만든 실행은 결과 상태가 `FAIL`이어도 exit 0입니다. 상세 계약은 [docs/integration.md](docs/integration.md), JSON 구조는 [contracts/inspector-result.schema.json](contracts/inspector-result.schema.json)을 참고하세요.

기본 형식만 빠르게 확인하려면 다음 명령을 사용합니다.

```bash
./check-illustrator.sh <file-or-directory>
```

## Windows 런처 root 설정

설치된 `run-proof-check.ps1`은 저장소 위치를 추측하지 않습니다. 다음 순서로 Windows에서 읽을 수 있는 저장소 root를 선택합니다.

1. `-InspectorRoot` 매개변수
2. `CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT` 환경변수
3. 설치기가 생성한 schema 2 `inspector-root.json` sidecar

선택한 root에서 `package.json` identity와 필수 실행 파일을 모두 확인하지 못하면 `inspector_root_invalid`로 외부 분석 실행 전에 중단합니다. WSL 배포판은 `-WslDistribution`, `CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_WSL_DISTRIBUTION`, sidecar 순서로 받고 기본값은 `Ubuntu`입니다.

cache와 보고서·PNG는 source repository에 쓰지 않습니다. runtime root는 다음 순서로 선택하며 source root와 같거나 그 하위이면 `inspector_root_invalid`로 거부합니다.

1. `-RuntimeRoot` 매개변수
2. `CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT` 환경변수
3. schema 2 sidecar의 `runtimeRoot`

기본 설치 runtime은 `%LOCALAPPDATA%\Campuslook\IllustratorProofCheck\runtime`입니다.

설치기는 source tree의 `illustrator/install-illustrator-script.ps1`입니다. `illustrator/windows-cutover.ps1`은 기본 `Preflight` 모드에서 쓰기 없이 설치 대상을 조사하고, 명시적 `Backup`, `RecordPostState`, `Rollback` 모드에서 Git 밖 backup과 hash-guarded 복구를 수행합니다. Windows write 전에는 별도 ORBIT Gate와 byte backup이 필요합니다.

## 로컬 검증

```bash
npm run lint
npm run check
npm test
npm run migration:verify
```

검증은 실제 AI, Illustrator COM, 네트워크, 외부 API를 사용하지 않습니다. 자세한 범위는 [VALIDATION.md](VALIDATION.md)를 참고하세요.

## 보안·데이터 경계

- `reports`, `downloads`, `samples`, `.cache`, `.memory-bank`, `NUL`은 추적하지 않습니다.
- AI/PDF/EPS/JPG/PNG와 1MB 초과 artifact는 migration verifier가 거부합니다.
- 메일 다운로드, IMAP, 자격증명 코드는 이 프로젝트에 없습니다.
- Git remote 생성, push, PR, 배포는 source-only 분리 범위가 아닙니다.

기존 0.82초 평균은 과거 운영 측정치일 뿐입니다. 새 운영 환경 성능은 Git 밖 fresh runtime의 cold 1회와 warm 반복을 별도로 기록해야 하며 실제 전환 증거 전 상태는 `not_run`입니다.
