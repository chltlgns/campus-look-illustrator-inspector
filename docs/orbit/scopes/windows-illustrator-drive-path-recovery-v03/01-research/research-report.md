# Research report — Windows Illustrator drive-path 실제 활성화 복구

상태: ready

## 결론

v02의 UNC parser가 아니라 non-UNC drive-letter fallback의 argument representation이 실패 원인이다.
공백 없는 `C:\...`는 현재 `wsl.exe` 경계에서 백슬래시가 shell escape처럼 제거되지만,
`C:/...` 형태는 같은 `wslpath`에 손실 없이 도달한다. 따라서 configured distribution과
`wslpath`를 유지하면서 rooted drive-letter path만 forward slash로 정규화하는 최소 수정이 적합하다.

## 핵심 관찰

1. 실제 Quiet failure는 0.863초에 root/runtime setup 단계에서 발생했고 AI open·collector·report
   생성은 시작되지 않았다.
2. source `\\wsl.localhost` direct conversion은 통과했으므로 v02 UNC logic을 되돌릴 근거가 없다.
3. raw no-space runtime은 exit 1, normalized runtime은 exit 0이었다. 이 대조는 input bytes 표현만
   바뀌고 distribution·command·target은 같다.
4. raw palette는 공백이 있어 우연히 quoting이 보존됐다. 특정 path shape에 의존하는 성공은
   안정된 계약이 아니므로 drive-letter path를 일관되게 정규화해야 한다.
5. rollback은 v02 no-op 수정 덕분에 보호 Program JSX를 쓰지 않고 성공했다. 기존 rollback
   구현은 후속 scope에서 변경할 필요가 없다.

## 안전 경계와 실패 모델

- `^[A-Za-z]:[\\/].*` rooted drive path만 normalize하고 `C:relative` 같은 drive-relative 입력은
  `inspector_root_invalid`로 거부한다.
- validated WSL UNC direct parser와 distribution exact-match는 그대로 유지한다.
- normalization 뒤에도 `wslpath` nonzero/empty output이면 외부 analyzer 전에
  `inspector_root_invalid`로 실패한다.
- source/runtime existence, identity, required files, source-outside-runtime 검증은 약화하지 않는다.
- Windows 재설치는 새 Gate, clean candidate evidence, fresh backup 뒤에만 수행한다.

## 제한과 미확정

- current WSL/Ubuntu host에서 재현했으므로 다른 host 동작을 일반화하지 않는다. locked test와
  installed demonstration이 이 운영 환경의 release evidence다.
- console의 한글 표시가 깨질 수 있으므로 palette 변환 성공만으로 충분하지 않다. 실제 cache와
  report material reference 생성까지 검증해야 한다.
- 20개 중 multi-design 존재 여부는 실제 report `designCount`에서만 확정할 수 있다.

## 결정 영향

- source change는 resolver 한 곳과 필요한 문서/migration hash/validation profile로 제한한다.
- 최소 신규 validation은 no-space drive positive, space·한글 drive positive, drive-relative negative,
  normalized converter를 사용하는 installed launcher demonstration이다.
- 실제 activation은 기본 C-drive LocalAppData sidecar를 유지해 workaround가 아니라 documented
  default contract를 검증한다.
