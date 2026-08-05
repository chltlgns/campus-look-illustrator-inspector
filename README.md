# Campuslook Illustrator Inspector

캠퍼스룩 야구점퍼 시안의 표·원단 번호·대표색을 로컬에서 검사하는 독립 source-only 프로젝트입니다. 현행 몸통 TR, 구형 몸통 TR, 소매 가죽 원단을 서로 다른 catalog provenance로 대조합니다. 고객 AI, 컬러판, 렌더, 보고서, 메일 첨부와 자격증명은 저장소에 포함하지 않습니다. 분석은 Windows Illustrator 2025와 WSL의 Bash/Node를 사용하며 외부 API나 유료 서비스를 호출하지 않습니다.

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

- `result/report.json`: schema version 4 구조화 결과
- `result/report.md`: 사람이 읽는 검사 보고서
- `result/material-color-reference.json`
- `result/material-color-reference.csv`
- `proof/artboard-*.png`와 `proof/document.json`

`PASS`, `REVIEW`, `FAIL`은 검사 결과의 의미이며 프로세스 성공 여부와 구분됩니다. 정상적으로 보고서를 만든 실행은 결과 상태가 `FAIL`이어도 exit 0입니다. 상세 계약은 [docs/integration.md](docs/integration.md), JSON 구조는 [contracts/inspector-result.schema.json](contracts/inspector-result.schema.json)을 참고하세요.

## 하단 사양표 기준과 색상 참고정보

설치 모드는 `material-palettes.json`에 current-body, legacy-body, sleeve-material 세 원본 경로를 기록하고 role+source SHA-256별 immutable runtime cache를 만듭니다. 현행판은 기존 fixed grid를 유지하며, 불규칙한 구형 TR·소매판은 label 중심을 포함하는 filled vector swatch와 Illustrator-rendered 중심색으로 추출합니다. 원본 AI와 열린 시안은 저장하지 않습니다.

- 원단 종류·번호·세대는 하단 사양표 표기를 최종 기준으로 사용합니다.
- 고객명·제품명·겉감·시보리·안감·단추·소매·주머니 중 하나라도 비었거나 읽지 못하면 `REVIEW`입니다.
- 겉감과 소매 표기가 있으면 해당 원단 판정은 `PASS`이며, 색상·Delta E·catalog 근접 결과는 `visualComparison` 참고정보로만 보존합니다.
- 검정·흰색처럼 서로 다른 원단이 같은 화면색으로 표현될 수 있으므로 색상 비교의 `PASS`/`REVIEW`/`FAIL`은 종합 판정에 영향을 주지 않습니다.

이 검사는 디자인의 하단 사양표 누락을 확인하고 렌더색 비교를 참고로 제공합니다. 실제 봉제품의 원단 조성, 촉감, 무늬, 공급처 진품을 인증하지 않습니다.

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

검증된 source root가 `\\wsl.localhost\<distribution>\...` 또는 `\\wsl$\<distribution>\...` 형식이면 launcher는 UNC를 직접 Linux 절대경로로 변환합니다. UNC의 distribution이 선택된 WSL distribution과 다르거나 상대경로가 비정상이면 `wslpath`로 우회하지 않고 `inspector_root_invalid`로 중단합니다. rooted Windows drive path는 백슬래시를 forward slash로 정규화한 뒤 configured distribution의 `wslpath`를 사용하며, `C:relative` 같은 drive-relative path는 `inspector_root_invalid`로 거부합니다.

cache와 보고서·PNG는 source repository에 쓰지 않습니다. runtime root는 다음 순서로 선택하며 source root와 같거나 그 하위이면 `inspector_root_invalid`로 거부합니다.

1. `-RuntimeRoot` 매개변수
2. `CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT` 환경변수
3. schema 2 sidecar의 `runtimeRoot`

기본 설치 runtime은 `%LOCALAPPDATA%\Campuslook\IllustratorProofCheck\runtime`입니다.

설치기는 다음 세 인자를 함께 받으면 설치 폴더에 schema 1 `material-palettes.json`을 생성합니다. 하나라도 빠지면 full mode를 만들지 않습니다.

```powershell
.\illustrator\install-illustrator-script.ps1 `
  -CurrentPaletteFile '<현행 TR.ai>' `
  -LegacyPaletteFile '<구형 TR.ai>' `
  -SleevePaletteFile '<소매 가죽.ai>'
```

launcher 인자 `-PaletteFile`은 current-body alias로 유지됩니다. portable CLI는 legacy/sleeve가 없을 때 기존 current-only 모드로 동작하고 보고서에 `catalogCoverage=current-only`를 남깁니다. 설치 sidecar가 존재하는 full mode는 세 role 중 하나라도 없으면 `palette_registry_invalid`로 분석 전에 중단합니다.

설치기는 source tree의 `illustrator/install-illustrator-script.ps1`입니다. `illustrator/windows-cutover.ps1`은 기본 `Preflight` 모드에서 쓰기 없이 설치 대상을 조사하고, 명시적 `Backup`, `RecordPostState`, `Rollback` 모드에서 Git 밖 backup과 hash-guarded 복구를 수행합니다. rollback은 먼저 모든 current hash가 recorded post-state인지 확인하고, 이미 pre-state와 같은 보호 파일은 쓰지 않으며 나머지 실제 변경만 복원합니다. Windows write 전에는 별도 ORBIT Gate와 byte backup이 필요합니다.

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
- 기존 공개 `origin`은 보존합니다. Git remote 생성·변경, push, PR, 배포는 이 작업 범위가 아닙니다.

기존 0.82초 평균은 과거 운영 측정치일 뿐입니다. 새 운영 환경 성능은 Git 밖 fresh runtime의 cold 1회와 warm 반복을 별도로 기록해야 하며 실제 전환 증거 전 상태는 `not_run`입니다.
