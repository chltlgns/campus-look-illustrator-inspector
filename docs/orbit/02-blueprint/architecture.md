# Architecture — Campuslook Illustrator Inspector

상태: complete

## 컨텍스트와 데이터 흐름

```text
User/parent service
  └─ check-proof.sh <proof.ai> [palette.ai] [output-dir]
       │ input/output paths are runtime data outside Git
       ▼
Portable launcher boundary
  ├─ Bash CLI
  ├─ Windows PowerShell launcher
  └─ validated repo-root sidecar or explicit environment override
       ▼
Illustrator JSX bridge (read-only source document)
  ├─ FastProofInspector.jsx
  ├─ text/geometry extraction
  └─ cropped PNG + document.json
       ▼
Node analyzer
  ├─ material palette extraction/cache
  ├─ table/body/sleeve comparison
  └─ report.json/report.md/reference csv/json

campus-look-ops ── future consumer of versioned CLI/JSON contract; not imported here
```

Git 저장소는 실행 코드·문서·합성 검증 fixture만 소유한다. 고객 AI, 컬러판, 렌더, 보고서는 호출자가 지정한 Git 밖 경로에 남는다.

## 모듈 경계와 소유 데이터

### `bin`/root CLI

- `check-proof.sh`: 공개 CLI와 WSL↔Windows bridge.
- `check-illustrator.sh`: 기본 파일 헤더·형식 검사.
- `inspect-illustrator.ps1`: Illustrator에서 문서·대지를 읽어 JSON/PNG로 내보내는 bridge.

### `illustrator/`

- `FastProofInspector.jsx`: 활성 문서 고속 텍스트·캡처 추출.
- `CampuslookProofCheck.jsx`: Illustrator 메뉴 진입점.
- `run-proof-check.ps1`: installed launcher. 검증된 root config로 새 저장소를 호출한다.
- `install-illustrator-script.ps1`: 향후 명시 설치 시 source root sidecar를 함께 배치한다.
- `check-active-illustrator.ps1`, `batch-check-ai.ps1`: 수동·배치 실행 보조.

### Node 분석·보고서

- `analyze-proof.mjs`: 표·몸통·소매·원단 색상 판정의 단일 소유자.
- `build-live-test-report.mjs`, `build-live-test-html.mjs`: 검사 결과 집계·오프라인 표현.
- 외부 npm package 없이 Node 내장 모듈만 사용한다.

### `contracts/`와 `scripts/`

- `contracts/inspector-result.schema.json`: parent가 소비할 최소 결과 계약.
- `docs/integration.md`: 호출·timeout·동시성·오류·버전 계약.
- `scripts/create-migration-manifest.mjs`: 승인 allowlist의 digest manifest 생성.
- `scripts/verify-migration.mjs`: tracked 데이터·경로·의존성·manifest 검증.

## 경로 해석

설치된 `run-proof-check.ps1`은 다음 순서로 root를 결정한다.

1. 명시적 `CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT`가 있으면 사용한다.
2. 없으면 설치 시 생성된 sidecar config의 Windows/WSL root를 읽는다.
3. root가 존재하고 `check-proof.sh`, `analyze-proof.mjs`, `illustrator/FastProofInspector.jsx`를 포함하는지 검증한다.
4. 검증 실패 시 Illustrator/Node를 호출하기 전에 stable `inspector_root_invalid` 오류로 종료한다.

사용자 홈이나 배포 경로를 검색해 추측하지 않는다. 브라우저나 parent가 임의 셸 조각을 전달하지 않으며 파일 경로는 인자 배열로 취급한다.

## 실패·복구·관측성

- migration은 copy-and-verify다. 원본은 수정하지 않으므로 대상 실패 시 새 후보 worktree만 보존·폐기하면 된다.
- manifest mismatch, 금지 파일, hardcoded parent path, parent Git drift는 commit 전 BLOCKED다.
- root config 오류는 외부 실행 전 실패한다.
- Illustrator/분석기 오류는 stable code와 stderr를 반환하되 customer contents·전체 경로를 ORBIT 증거에 남기지 않는다.
- runtime output은 호출자가 지정한 ignored/Git 밖 폴더에만 쓴다.
- 성능은 source-only migration에서 측정하지 않으며 historical과 current evidence를 구분한다.

## 보안·비밀·외부 작업 경계

- 실제 메일·고객 AI·컬러판·렌더·보고서·cache·Memory Bank를 commit하지 않는다.
- tracked file allowlist와 deny 확장자/경로/크기 검사를 모두 적용한다.
- 다운로드·IMAP·credentials 코드는 제외한다.
- Git remote 생성, network install, 외부 API, Windows 설치 변경, parent 프로세스 재시작은 하지 않는다.
- 원본 Illustrator 문서는 저장·수정하지 않는 기존 계약을 유지한다.

## 이동·업그레이드 전략

1. 새 독립 저장소를 빈 base에서 Gate 승인된 candidate worktree로 구현한다.
2. source allowlist를 복제하고 원본·대상 digest를 기록한다.
3. portable root, 계약, 검증 harness를 추가한다.
4. clean candidate Quality와 독립 Trust 뒤 새 저장소 `main`에 ff-only 통합한다.
5. 기존 폴더는 유지한다.
6. 후속 `campus-look-ops` 범위에서 새 CLI 경로를 연결하고 통합 검증한다.
7. 별도 승인 뒤 Windows 런처를 재설치한다.
8. 두 경로의 결과가 일치하고 rollback 경로가 확인된 후에만 기존 폴더 제거 여부를 결정한다.
