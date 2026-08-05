# CLI and JSON integration contract

계약 버전: `campuslook-inspector-integration/v1`

## 실행 경계

consumer는 검사기 저장소를 import하지 않고 별도 프로세스로 호출합니다.

```text
check-proof.sh <proof.ai> [palette.ai] [output-directory]
```

- `proof.ai`와 `palette.ai`의 소유권은 caller에게 있습니다. 검사기는 읽기만 하고 output 아래에 staging 복사본을 만듭니다.
- `output-directory`의 생성·보존·삭제 책임은 caller에게 있습니다.
- 권장 timeout은 단일 파일 180초입니다. timeout 시 caller가 process tree를 종료하고 output을 불완전 결과로 취급합니다.
- 동시에 한 Illustrator 인스턴스를 공유하는 호출은 caller가 직렬화합니다. Windows launcher는 `Local\CampuslookIllustratorProofCheck` mutex로 중복 실행을 거부합니다.

## exit code

| code | 의미 |
|---|---|
| `0` | 보고서 생성 성공. `overallStatus`는 별도로 확인합니다. |
| `1` | Illustrator, analyzer 또는 예상 출력 생성 실패 |
| `2` | 사용법, 입력 파일, 컬러판 또는 경로 검증 실패 |
| `3` | Windows launcher mutex 충돌 |

Windows launcher의 `-Quiet` 성공 출력은 한 줄 JSON입니다.

```json
{
  "ok": true,
  "status": "REVIEW",
  "designCount": 1,
  "elapsedSeconds": 1.2,
  "designs": [{ "label": "A", "status": "REVIEW", "artboard": 1 }],
  "report": "<windows-path-to-report.md>",
  "phaseTimings": {}
}
```

실패는 `{"ok":false,"error":"..."}`와 nonzero exit로 반환합니다. root 설정 오류는 `inspector_root_invalid` prefix를 포함합니다.

## Installed source와 runtime root

installed launcher는 source와 runtime을 분리합니다. source root는 `-InspectorRoot`, `CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT`, schema 2 sidecar 순서로 선택합니다. runtime root는 `-RuntimeRoot`, `CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT`, sidecar 순서입니다.

source root가 `\\wsl.localhost\<distribution>\...` 또는 `\\wsl$\<distribution>\...`이면 검증된 UNC share와 configured distribution이 정확히 일치할 때만 Linux `/<path>`로 직접 변환합니다. distribution mismatch, 비어 있거나 비정상인 UNC path는 외부 process 실행 전에 `inspector_root_invalid`로 거부합니다. rooted drive-letter path는 `\`를 `/`로 정규화한 뒤 `wslpath` fallback을 사용하고 drive-relative path는 fail-closed합니다.

runtime root에는 palette cache와 `reports/illustrator`, proof PNG, report JSON/Markdown이 생성됩니다. source repository와 같거나 그 하위인 runtime은 외부 process 실행 전에 `inspector_root_invalid`로 거부합니다. 설치 기본값은 `%LOCALAPPDATA%\Campuslook\IllustratorProofCheck\runtime`이며 Git이 소유하지 않습니다.

installed `material-palettes.json`은 schema `campuslook-material-palettes/v1`이며 `currentBody`, `legacyBody`, `sleeveMaterial` Windows 경로를 가집니다. launcher는 매 실행 원본 SHA-256을 계산하고 `cache/material-catalog/<role>/<sha256>/catalog.json`만 재사용합니다. cache의 schema/role/catalogId/source hash가 registry와 다르거나 installed full mode의 role이 빠지면 `palette_registry_invalid`로 proof 분석 전에 중단합니다. 실제 경로와 raw catalog cache는 runtime 소유이며 Git에 포함하지 않습니다.

## report.json

- `schemaVersion`: 현재 `4`; consumer는 지원하지 않는 major 값을 거부합니다.
- `document`: 원본 표시 파일명
- `designCount`: `designs.length`와 같은 시안 수
- `overallStatus`: `PASS`, `REVIEW`, `FAIL` 중 하나
- `designs[]`: 시안별 `proofArtboard`, `fields`, `visual`, `materialCheck`, `sleeveCheck`, `tableCheck`, `overallStatus`
- `performance`: Illustrator collector가 제공한 선택적 진단 데이터 또는 `null`
- `catalogProvenance`: coverage와 role/generation/source SHA-256/extractor/reference 상태
- `limitations`: 자동 판정 한계 설명

각 design의 `materialCheck`와 `sleeveCheck`는 `authority.source=bottom_specification_table`로 하단 사양표를 최종 기준으로 표시합니다. 표기가 있으면 `table_spec_authoritative` `PASS`, 없으면 `table_field_missing` `REVIEW`입니다. 기존 색상 evaluator의 `status`, `decisionCode`, `reason`, `expected`, `matchedCatalog`, `candidates`, `nearest`, Delta E 값은 `visualComparison` 아래에 그대로 보존되며 `affectsOverallStatus=false`입니다. `sleeveSpecification`은 supplier/family/finish/number/color 파싱값입니다. schema version은 4, 정상 처리 exit는 0으로 유지됩니다.

몸통 색상 evaluator는 세대가 명시되지 않으면 current/legacy 같은 key를 함께 비교하며 기존 `PASS`/`REVIEW`/`FAIL`과 decision code를 `visualComparison`에 기록합니다. 이 값은 채색 확인용 참고일 뿐 원단 종류·번호·세대나 종합 상태를 바꾸지 않습니다. 이 결과로 주문 이력이나 재주문 여부를 증명하지 않습니다.

소매 색상 evaluator도 구체 supplier/family/finish/number 또는 일반 니플레자 후보와 비교한 값을 `visualComparison` 참고정보로만 제공합니다. 검정·흰색 등 화면색이 같다는 사실은 원단 동일성을 뜻하지 않습니다.

정식 JSON Schema는 `contracts/inspector-result.schema.json`입니다. 단일 시안 보고서는 하위 호환을 위해 첫 design의 일부 필드를 root에도 복제합니다.

## 상태 결합 규칙

8개 하단 사양표 필수값 중 하나라도 비었거나 추출에 실패하면 해당 design과 전체가 `REVIEW`, 모두 있으면 `PASS`입니다. 겉감·소매 색상 비교 상태는 결합 대상이 아닙니다. 상태는 디자인 사양표 완전성 판정이고 프로세스 exit와 독립적입니다.

## 출력 원자성·실패 처리

현재 구현은 output 내부 파일을 순차 작성하므로 디렉터리 단위 원자성을 보장하지 않습니다. caller는 exit 0과 `result/report.json`의 schema/status를 모두 확인한 뒤 결과를 게시해야 합니다. 실패하거나 timeout이면 기존 결과와 섞지 말고 해당 output을 격리합니다.
