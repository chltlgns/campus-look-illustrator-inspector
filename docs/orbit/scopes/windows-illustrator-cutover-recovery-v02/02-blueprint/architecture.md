# Architecture — Windows Illustrator UNC 및 rollback 복구 전환

상태: ready

## 컨텍스트와 데이터 흐름

`installed launcher → schema2 sidecar → Resolve-InspectorRoot → Convert-ToWslPath → WSL checker` 흐름은 유지한다. source Windows root가 WSL UNC이면 launcher가 server/share를 strict parse하고 configured distribution과 일치할 때만 `/<relative path>`를 반환한다. 그 외 Windows drive path는 기존 `wslpath` fallback을 사용한다.

## 모듈 경계와 소유 데이터

- `illustrator/run-proof-check.ps1`: Windows→WSL path 변환과 stable failure.
- `illustrator/windows-cutover.ps1`: 9개 target backup/post/rollback 및 pre-equal no-op.
- `illustrator/inspector-root.ps1`: source/runtime 존재성·identity·분리 검증은 그대로 유지.
- LocalAppData runtime: AI staging, palette cache, reports; Git 밖 caller-owned output.
- ORBIT artifacts: Gate/Quality/Trust/blocker만 저장하며 raw AI/output/backup은 저장하지 않는다.

## 실패·복구·관측성

- UNC parser 실패·distribution mismatch: `inspector_root_invalid`, AI open 전 종료.
- actual contract 실패: manifest current=expected post 전체 검증 후 rollback.
- pre-equal protected file: no-op; changed file만 backup copy.
- copy 실패: helper nonzero, 각 target을 pre manifest와 재대조하고 임의 retry/elevation 금지.
- 모든 실제 실행 전후 document count, active identity hash, Saved 상태를 비교한다.

## 보안·비밀·외부 작업 경계

- 네트워크 호출과 유료 API는 없다. `\\wsl.localhost`는 같은 호스트의 WSL transport다.
- source root는 package identity와 required files 검증 뒤에만 사용한다.
- Program Files는 expected staged hash와 현재 JSX가 같을 때 write 0; 다르면 재승인 없이 진행하지 않는다.
- existing Illustrator 문서는 저장·종료하지 않는다.

## 이동·업그레이드 전략

- main `869e23d…`에서 isolated successor candidate를 만든다.
- migration manifest의 변경 target hash를 갱신한다.
- Quality/Trust/post-Quality 뒤에만 fresh Windows backup과 install을 반복한다.
- 실패 v01과 old backup은 immutable 보존한다.
