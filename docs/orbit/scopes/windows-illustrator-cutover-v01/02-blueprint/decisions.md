# Architecture decisions — Windows Illustrator cutover v01

상태: complete

## ADR-C01 — 기존 scope를 dependency로 둔 successor cutover

- 상태: accepted
- 결정: 완료된 source split은 `inspector-source-split-v01` immutable scope로 보존하고 새 `windows-illustrator-cutover-v01`에서만 계획·Gate·구현·외부 전환을 수행한다.
- 이유: 이전 PASS 증거를 재해석하거나 덮어쓰지 않고 Windows NOT_RUN 항목만 후속 검증한다.
- 대안: 기존 v1 문서 재사용·수정, 일반 승인 재사용.
- 결과: 새 Gate와 base-bound approval가 필요하다.

## ADR-C02 — 설치 전 byte backup과 hash-guarded rollback

- 상태: accepted
- 결정: installer 실행 전 LocalAppData 설치본, `.lnk`, program JSX를 Git 밖에 byte-copy하고 presence/hash manifest를 검증한다. 복원은 current hash가 expected post-state일 때만 한다.
- 이유: installer가 순차 overwrite하며 자동 transaction/backup이 없다.
- 대안: 즉시 installer 실행, source 폴더를 rollback으로 간주, Windows restore point.
- 결과: 설치 전 단계가 늘지만 partial install과 unrelated drift를 안전하게 구분한다.

## ADR-C03 — sidecar schema 2가 source와 runtime root를 함께 소유

- 상태: accepted
- 결정: sidecar를 schema 2로 올려 `inspectorRoot`, `wslDistribution`, `runtimeRoot`를 필수화하고 parameter/environment override도 같은 검증을 적용한다.
- 이유: source root만 portable하게 만들어서는 runtime 결과가 Git repository 아래에 남는다.
- 대안: repo `.gitignore`에 의존, runtime symlink, shortcut에 긴 output argument 하드코딩.
- 결과: resolver/launcher/installer/tests/docs 변경이 필요하지만 데이터 경계가 명시적이고 fail-closed가 된다.

## ADR-C04 — runtime은 LocalAppData, source는 WSL repository

- 상태: accepted
- 결정: installed default runtime은 `C:/Users/GOLD/AppData/Local/Campuslook/IllustratorProofCheck/runtime`, source는 새 WSL repository UNC로 분리한다.
- 이유: shortcut과 Windows 프로세스가 안정적으로 쓸 수 있고 Git 밖이라는 조건을 만족한다.
- 대안: repository reports/.cache, Desktop, TEMP-only, legacy 폴더.
- 결과: runtime은 backup 대상 제품 source가 아니라 재생성 가능한 output이며 Git에 넣지 않는다.

## ADR-C05 — 실제 회귀는 사용자 지정 test AI와 단계 상승 방식

- 상태: accepted
- 결정: explicit Quiet → cold/warm → saved active → multi-design → shortcut → 실제 hotkey 순으로 수행한다. 현재 unsaved active document 상태에서는 중단한다.
- 이유: 임의 고객 파일 사용과 열린 작업 문서 간섭을 막으면서 각 실패 지점을 분리한다.
- 대안: legacy samples 자동 탐색, 현재 active customer document 즉시 사용, batch 전체 실행.
- 결과: test AI path·expected design count·active readiness가 없으면 실제 회귀 일부 또는 전체가 BLOCKED다.

## ADR-C06 — parent/legacy는 digest 관찰만 수행

- 상태: accepted
- 결정: parent의 raw dirty filenames/content를 수집하지 않고 HEAD, porcelain-v2 digest/count와 legacy manifest digest만 pre/post 비교한다.
- 이유: 다른 동시 작업과 고객 데이터 노출을 피하면서 불변성을 확인한다.
- 대안: parent clean 강제, stash/reset, raw status를 ORBIT에 기록.
- 결과: baseline과 다른 drift는 원인을 추측하지 않고 BLOCKED다.

## ADR-C07 — hash-equal program JSX에는 write/restart 없음

- 상태: accepted
- 결정: pre-install program JSX가 candidate와 같으면 copy와 Illustrator restart를 건너뛴다. drift면 자동 overwrite하지 않고 별도 판정한다.
- 이유: 현재 실행 중 Illustrator와 열린 문서에 대한 위험을 최소화한다.
- 대안: installer 결과의 restart flag를 그대로 따름, Illustrator 강제 restart.
- 결과: installer 결과만이 아니라 before/after hash와 실제 copy 여부를 증거로 사용한다.
