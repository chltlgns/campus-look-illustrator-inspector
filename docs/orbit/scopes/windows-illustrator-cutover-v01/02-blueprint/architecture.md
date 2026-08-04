# Architecture — Windows Illustrator cutover v01

상태: complete

## 전환 구조

```text
approved candidate d93a015... + runtime-root patch
  ├─ local Quality + locked validation
  └─ clean independent Trust
             │
             ▼
Git-outside Windows backup + SHA manifest
  ├─ LocalAppData/Campuslook/IllustratorProofCheck
  ├─ Start Menu/Campuslook/Illustrator Proof Check.lnk
  └─ Illustrator .../Scripts/Campuslook Proof Check.jsx
             │ verified backup only
             ▼
new installer
  ├─ installed launcher/checker/collector/resolver
  ├─ sidecar schema 2
  │    ├─ inspectorRoot = new repository UNC
  │    ├─ wslDistribution = Ubuntu
  │    └─ runtimeRoot = LocalAppData .../runtime
  ├─ shortcut = installed active checker + Ctrl+Shift+Q
  └─ JSX copy only on hash drift
             │
             ▼
installed resolver → WSL/new repository source
             │
             ▼
Git-outside runtime root
  ├─ cache/palette/<digest>
  ├─ reports/illustrator/<sanitized-stem>
  └─ regression/<run-id>/evidence
```

## Sidecar와 root 계약

새 installer는 다음 의미의 schema 2 sidecar를 UTF-8로 기록한다.

```json
{
  "schemaVersion": 2,
  "inspectorRoot": "<Windows UNC path to /home/doggabiya/campus-look-illustrator-inspector>",
  "wslDistribution": "Ubuntu",
  "runtimeRoot": "<LOCALAPPDATA>/Campuslook/IllustratorProofCheck/runtime"
}
```

source root precedence는 `-InspectorRoot` → `CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT` → sidecar다. runtime root precedence는 `-RuntimeRoot` → `CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT` → sidecar다. 어느 한쪽이라도 선택된 값이 없거나 malformed이면 `inspector_root_invalid`로 종료한다.

source root는 directory, package identity, 5개 required file을 확인한다. runtime root는 canonical Windows path로 정규화하고 source root와 같거나 그 하위이면 거부한다. installer가 runtime directory를 만들고 resolver는 존재하는 directory만 수락한다. WSL 변환 후 cache/report 경로는 runtime root 하위인지 다시 확인한다.

## 설치 변경 집합

| 대상 | 현재 | 승인 후 기대 | rollback |
|---|---|---|---|
| LocalAppData `run-proof-check.ps1` | legacy hardcode SHA | candidate portable/runtime SHA | old bytes 복원 |
| `check-active-illustrator.ps1` | candidate와 동일 | candidate와 동일 또는 runtime arg passthrough | old bytes 복원 |
| `FastProofInspector.jsx` | candidate와 동일 | candidate와 동일 | old bytes 복원 |
| `batch-check-ai.ps1` | candidate와 동일 | candidate/runtime output-aware | old bytes 복원 |
| staged `CampuslookProofCheck.jsx` | candidate와 동일 | candidate와 동일 | old bytes 복원 |
| `inspector-root.ps1` | absent | candidate schema-2 resolver | manifest absent면 제거 |
| `inspector-root.json` | absent | new repo + Ubuntu + runtime root | manifest absent면 제거 |
| Start Menu `.lnk` | installed checker + Ctrl+Shift+Q | 동일 structure, refreshed bytes | old `.lnk` bytes 복원 |
| program `Campuslook Proof Check.jsx` | candidate hash-equal | no write if still equal | changed only if installer actually copied |

installer가 순차 write이므로 backup은 installer 외부 선행 transaction이다. install 중 실패하면 그 시점의 후속 검증을 실행하지 않고 rollback precondition으로 이동한다.

## 회귀 실행 순서와 격리

1. installed resolver만 dot-source해 positive sidecar resolution을 확인한다.
2. temp roots/sidecars로 negative matrix를 실행한다. 실제 installed sidecar는 rename/delete하지 않는다.
3. user-provided AI를 explicit path, `-Quiet -NoOpen`으로 실행해 JSON/outputs/schema를 확인한다.
4. 같은 AI/runtime으로 warm run을 최소 3회 실행해 performance를 측정한다.
5. 사용자가 저장된 test AI를 active document로 준비했다고 확인한 뒤 `-UseActiveDocument -Quiet -NoOpen`을 실행한다.
6. designCount가 2 이상인 user-designated AI로 multi-design mapping을 확인한다.
7. Start Menu shortcut direct invocation을 확인한 뒤 사용자가 실제 Ctrl+Shift+Q를 한 번 입력해 end-to-end 결과를 확인한다.

각 단계는 이전 단계 PASS가 다음 단계의 precondition이다. analyzer가 정상 실행되어 `overallStatus=REVIEW/FAIL`을 반환하는 것은 제품 판정이며 process/contract failure와 구분한다. validation PASS는 status 의미·출력 계약이 보존됐다는 뜻이지 실제 디자인 품질을 PASS로 바꾸는 뜻이 아니다.

## 문서·프로세스 보존

- pre-existing Illustrator document의 이름·경로·내용은 증거에 남기지 않는다.
- pre/post에는 process count, document count, active saved flag와 test runner의 `originalDocumentPreserved`만 기록한다.
- 현재 active document가 unsaved인 동안 active/shortcut/hotkey 단계는 실행 금지다.
- automation은 pre-existing documents를 save/close하지 않는다. batch가 자신이 연 designated test document만 `DoNotSaveChanges`로 닫을 수 있다.
- program JSX가 hash-equal이면 Illustrator process를 재시작하지 않는다. drift면 사용자에게 별도 확인하기 전 overwrite/restart하지 않고 BLOCKED 처리한다.

## 성능 측정

fresh external runtime root로 palette cache가 없는 cold 1회를 측정한다. 같은 runtime root와 input으로 warm 3회 이상 실행한다. 각 Quiet JSON의 `elapsedSeconds`, `phaseTimings.paletteCacheMilliseconds`, `illustratorMilliseconds`, `analyzerMilliseconds`와 report performance를 요약해 count/median/min/max를 기록한다. 원시 파일명과 report body는 증거에 넣지 않는다. historical 0.82초는 이전 환경 참고값으로만 병기한다.

## 실패와 rollback

rollback trigger는 backup 검증 이후의 partial install, source/runtime resolution 실패, shortcut mismatch, contract/process failure, pre-existing document drift다. 디자인 자체의 REVIEW/FAIL은 contract가 정상이라면 자동 rollback trigger가 아니다.

복원은 backup manifest의 `pre_sha256`, 현재 `expected_post_sha256`, path identity가 모두 맞을 때만 수행한다. 다른 프로세스/사용자에 의한 drift가 있으면 overwrite하지 않고 BLOCKED다. 원래 absent였던 resolver/sidecar만 제거하며 legacy source repository에는 어떤 write도 하지 않는다.

## Git·ORBIT 경계

제품 변경은 승인 base `d93a015...`의 isolated candidate에서만 수행한다. 기존 dirty ORBIT control-plane과 보존 candidate worktree는 reset/clean/delete하지 않는다. 새 candidate Quality/locked validation과 clean Trust 후 ff-only integration하고, Windows external action과 actual regression evidence는 이 scope의 Trust 문서에 digest로 기록한다. remote/network/API/paid action은 없다.
