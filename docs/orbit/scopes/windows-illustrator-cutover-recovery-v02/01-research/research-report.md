# Research report — Windows Illustrator UNC 및 rollback 복구 전환

상태: ready

## 조사 질문과 결론

1. 실제 활성화 실패는 AI 내용이 아니라 Windows UNC를 Linux path로 바꾸는 경계에서 발생했다.
2. 두 WSL UNC 표기 모두 현재 `wslpath -u` 직접 호출로는 재현 가능하게 실패했다.
3. 이미 Windows에서 존재성과 package identity를 검증한 UNC는 strict parser로 distribution/share/path를 분리해 Linux 절대경로로 바꿀 수 있다.
4. rollback의 nonzero는 복원 실패가 아니라 이미 pre-state인 보호 JSX를 불필요하게 다시 쓴 데서 발생했다.

## 확인된 사실

- main `869e23d…`와 v01 Quality/Trust/post-Quality는 유효하다.
- Windows 대상 9개는 backup manifest의 pre-state로 돌아왔다.
- legacy launcher가 다시 설치되어 현재 운영 경로는 새 저장소가 아니다.
- 기존 Illustrator 문서는 닫히거나 저장되지 않았으며 active는 미저장이다.
- 지정 AI 20개 중 첫 파일은 source root 변환 전에 차단되어 AI processing이 시작되지 않았다.

## 반대근거·제약·불확실성

- 일반 `C:\...` runtime path는 계속 `wslpath` fallback이 필요하다.
- UNC parser가 임의 server/share를 허용하면 잘못된 배포판이나 경로를 실행할 수 있으므로 server, distribution, non-empty path를 검증해야 한다.
- rollback skip은 current hash가 pre-state와 정확히 같을 때만 허용해야 하며 expected post guard를 약화하면 안 된다.
- saved active readiness가 없으므로 실제 AI·shortcut·hotkey 재회귀는 지금 실행할 수 없다.
- parent Git status의 추가 lock은 외부 동시 작업으로 보이며 이 작업이 삭제하거나 정상화하면 안 된다.

## 설계에 미치는 영향

- source/runtime root resolution 결과에 Linux root를 추가하거나 launcher conversion 함수에서 validated UNC만 직접 변환한다.
- distribution mismatch는 stable `inspector_root_invalid`로 실패시킨다.
- rollback은 전체 current-vs-post 검증을 먼저 유지하고, 복원 루프에서 current-vs-pre equality인 entry만 no-op 처리한다.
- unit/locked validation에 두 UNC positive, distribution mismatch negative, protected identical rollback no-write를 추가한다.

## 남은 검증과 중단 조건

- 새 Gate 승인 전 구현·재설치 금지.
- 설치 직전 Program JSX hash/mtime이 새 candidate expected bytes와 다르면 BLOCKED.
- saved active readiness 확인 전 실제 AI 실행 금지.
- actual output의 schema/status/document preservation 또는 rollback guard가 실패하면 즉시 BLOCKED/rollback.
