# Research report — Windows Illustrator cutover v01

상태: complete

## 결론

현재 Windows 운영 경로는 아직 legacy 검사기다. Ctrl+Shift+Q shortcut과 Illustrator 메뉴 JSX는 설치돼 있지만, 실제 실행 launcher는 legacy parent 절대경로 SHA와 일치하고 새 root resolver/sidecar가 없다. 새 저장소 생성만으로 운영 전환되지 않았다는 기존 위험이 실제 설치 상태에서 확인됐다.

새 installer를 그대로 실행하면 launcher와 sidecar 전환은 가능하지만 두 가지 보완이 필요하다.

1. installer가 LocalAppData 파일을 순차 덮어쓰고 자동 backup이 없으므로, 실행 전 exact file/shortcut/JSX byte backup과 digest manifest를 별도로 만들어야 한다.
2. 현재 launcher의 cache/report 경로는 repository 아래다. 테스트 입력·출력을 Git 밖에 둔다는 이번 범위를 만족하도록 installer-generated sidecar에 외부 runtime root를 기록하고 launcher가 그 위치만 사용하도록 candidate에서 먼저 보완해야 한다.

## 현재 설치 증거

- 설치 root: `C:/Users/GOLD/AppData/Local/Campuslook/IllustratorProofCheck`
- installed launcher: legacy SHA `20292592...`, legacy parent hardcode 존재
- 새 root resolver: 없음
- 새 sidecar: 없음
- root 관련 환경변수: 없음
- shortcut: 존재, installed active checker 대상, `Ctrl+Shift+Q`
- program JSX: 존재, 새 source와 hash-equal
- Illustrator: 실행 중 1 process, 3 documents, active document unsaved
- configured palette: 존재; 실제 test AI: 미지정

따라서 program JSX는 설치 시점 hash가 유지되면 복사·재시작 없이 그대로 사용할 수 있다. installer의 `restartIllustratorRequired` 출력은 동일 파일에서도 true이므로 hash와 실제 copy 여부로 판단한다.

## 정확한 전환 대상

승인 뒤 installer는 다음 Windows 상태를 대상으로 한다.

- LocalAppData overwrite: `run-proof-check.ps1`, `check-active-illustrator.ps1`, `FastProofInspector.jsx`, `batch-check-ai.ps1`, `CampuslookProofCheck.jsx`
- LocalAppData create/update: `inspector-root.ps1`, `inspector-root.json`
- Start Menu overwrite: `Illustrator Proof Check.lnk`
- Illustrator program JSX: `Campuslook Proof Check.jsx`; pre-install hash가 candidate와 다를 때만 copy하며 같으면 무변경
- 새 runtime root: LocalAppData 아래 별도 `runtime` 디렉터리; cache, report, PNG, 회귀 결과를 Git 밖에 보존

shortcut의 target/arguments/working directory/hotkey 구조는 현재와 같고, 실제 차이는 shortcut이 호출하는 installed source와 sidecar가 새 저장소를 선택한다는 점이다.

## 안전 전환·rollback 방향

Windows write 전에 다음을 하나의 timestamped backup root에 보존한다.

- LocalAppData 설치 폴더 전체 byte copy
- Start Menu `.lnk` byte copy
- program JSX byte copy
- 원본 path, 존재 여부, size, last-write UTC, SHA-256을 담은 manifest
- 새 저장소/parent/legacy source와 Windows process/document의 sanitized pre-state

설치 또는 검증 실패 시 새 launcher를 더 실행하지 않고 backup manifest와 현재 hash를 비교한다. backup 대상이 설치 이후 예상 hash일 때만 원래 bytes를 복사해 복원하고, 원래 없던 sidecar/root resolver는 backup manifest의 `absent` 기록에 따라 제거한다. program JSX가 설치 중 바뀌지 않았다면 건드리지 않는다. shortcut과 LocalAppData를 복원한 뒤 legacy launcher SHA와 Ctrl+Shift+Q properties를 다시 확인한다. 기존 legacy source 폴더 자체는 rollback 대상이 아니라 불변 기준이다.

## 실제 회귀 중단 조건

- 현재 active document가 unsaved이므로 지금 active/hotkey test는 금지한다.
- 사용자가 지정한 test AI exact path가 없으면 file, multi-design, active, hotkey 회귀는 `BLOCKED`다.
- 사용자가 test AI를 활성 문서로 준비했다고 확인하기 전에는 Ctrl+Shift+Q나 menu entry를 실행하지 않는다.
- 기존 document count/saved-state fingerprint가 의도치 않게 바뀌면 즉시 중단하고 설치 rollback 여부를 판정한다.
- 원시 AI, palette, PNG, JSON/Markdown report, performance raw output은 Git 밖에 두며 ORBIT에는 status/count/timing/digest만 기록한다.

## 설계에 미치는 영향

1. 기존 완료 scope는 immutable dependency로 유지하고 `windows-illustrator-cutover-v01`만 변경한다.
2. candidate는 external runtime root와 installer sidecar 확장, backup/cutover 검증 도구와 새 locked validation을 포함한다.
3. product candidate Quality/Trust PASS 후에만 Windows backup과 installer external action을 실행한다.
4. installed root resolution은 sidecar를 직접 로드해 확인하고 negative matrix는 temp fixture로 수행해 실제 sidecar를 훼손하지 않는다.
5. 실제 회귀는 explicit-path Quiet JSON, active document, multi-design, shortcut hotkey 순으로 위험을 단계적으로 높인다.
6. historical 0.82초와 새 cold/warm total/Illustrator/analyzer/cache timing을 분리한다.
7. parent status는 raw filenames 없이 digest/count로만 pre/post 비교한다.

연구는 로컬 primary evidence로 결정을 내릴 수 있는 수준에 도달했으며, 남은 실제 test AI path는 Gate 승인과 별도로 실행 전 사용자가 제공해야 하는 명시적 prerequisite다.
