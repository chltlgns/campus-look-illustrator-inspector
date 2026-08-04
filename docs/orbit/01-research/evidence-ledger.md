# Evidence ledger — Campuslook Illustrator Inspector

상태: complete  
기준일: 2026-08-04

| ID | 구분 | 주장 | 출처·위치 | 확인일 | 한계·반대근거 | 연결 결정 |
|---|---|---|---|---|---|---|
| EV-001 | user_statement | 사용자는 `campus-look-ops` 통합 작업과 병행할 수 있도록 Illustrator 검사기를 독립 프로젝트로 분리하기로 했다. | 현재 대화, 2026-08-04 | 독립 프로젝트의 exact 경로는 사용자가 직접 지정하지 않았지만 형제 저장소 방식을 앞서 설명했고 이번 요청에서 분리를 선택했다. | ADR-001, REQ-001 |
| EV-002 | fact | 기존 `일러스트 확인용 스크립트`의 Git top-level은 하위 폴더가 아니라 `/home/doggabiya/campus-look-ops`다. 별도 `.git`은 없다. | `git rev-parse --show-toplevel`, `find ... -name .git` | 2026-08-04 | 물리 폴더 분리는 Git·ORBIT 격리가 아니다. | ADR-001, REQ-001 |
| EV-003 | fact | 기존 폴더는 약 175MB이며 `reports` 93MB, `downloads` 56MB, `samples` 26MB, `.cache` 756KB가 대부분을 차지한다. | `du -sh`와 `find -printf` 감사 | 2026-08-04 | 크기뿐 아니라 고객 AI·렌더·메일 출처 파일명이 포함되어 Git migration 대상으로 부적절하다. | ADR-002, REQ-002 |
| EV-004 | fact | source-only 후보는 Node/Bash/PowerShell/JSX 실행기와 문서이며 핵심 분석기는 Node 내장 모듈만 import한다. | 기존 `analyze-proof.mjs`, `build-live-test-*.mjs`, `check-*.sh`, `inspect-illustrator.ps1`, `illustrator/*` import 감사 | 2026-08-04 | Windows Adobe Illustrator와 WSL은 런타임 외부 의존성이다. | ADR-003, REQ-003~004 |
| EV-005 | fact | `download-recent-ai-attachments.mjs`는 상위 `../lib/naver-credentials.mjs`, `../lib/naver-imap.mjs`에 의존한다. | 기존 `download-recent-ai-attachments.mjs:9-10` | 2026-08-04 | 포함하면 새 프로젝트가 다시 상위 저장소에 결합되고 메일 자격증명 경계까지 넓어진다. | ADR-002, REQ-002 |
| EV-006 | fact | `illustrator/run-proof-check.ps1`에는 기존 Linux·Windows WSL 절대경로가 하드코딩돼 있다. | 기존 `illustrator/run-proof-check.ps1:18-20` | 2026-08-04 | 파일을 복사만 하면 설치된 런처와 새 저장소가 계속 옛 경로를 사용한다. | ADR-003, REQ-003 |
| EV-007 | fact | 상위 tracked 제품 소스에서 검사기 파일명을 참조하는 결과는 없었고 현재 참조는 기존 하위 폴더 내부에만 있었다. | 상위 루트 `rg` 결과 | 2026-08-04 | 실행 중인 별도 통합 세션의 아직 저장되지 않은 설계 의도는 관측할 수 없다. | ADR-004, REQ-006 |
| EV-008 | fact | 기존 README는 준비된 단일 시안 평균 0.82초와 20개 실전 검사 성공을 기록하지만 이는 2026-08-03 기존 환경의 결과다. | 기존 `README.md`, `VALIDATION.md`, `reports/performance-budget-2s.md` | 2026-08-04 | 새 위치에서 실제 Illustrator 검사를 다시 실행한 증거가 아니므로 migration PASS로 재사용할 수 없다. | REQ-005, VAL-005 |
| EV-009 | fact | 현재 상위 루트, `광고관리자`, 기존 검사기 폴더에서 별도 Codex 세션과 로컬 서버가 동시에 실행 중이다. | `ps -eo pid,etimes,cmd` | 2026-08-04 | 프로세스 존재만으로 각 대화의 exact 작업 파일은 알 수 없다. | ADR-001, REQ-007 |
| EV-010 | fact | `/home/doggabiya/campus-look-illustrator-inspector`는 사용 전 존재하지 않았고, 현재 자체 Git root commit과 ORBIT strict 0.4.2 제어면만 초기화됐다. | `git init`, `orbit init`, `orbit status` | 2026-08-04 | 제품 소스는 Gate 전이므로 아직 0건이다. | REQ-001 |
| EV-011 | counterevidence | 기존 Windows 설치 스크립트는 런처를 `%LOCALAPPDATA%/Campuslook/IllustratorProofCheck`에 복사하므로 새 저장소 생성만으로 설치된 런처가 자동 전환되지는 않는다. | 기존 `illustrator/install-illustrator-script.ps1`, `CampuslookProofCheck.jsx` | 2026-08-04 | 무중단 분리를 위해 옛 폴더를 유지하고 실제 재설치는 후속 명시 범위로 둬야 한다. | ADR-004, REQ-006 |
| EV-012 | assumption | 소스에서 `api key/secret/token/password` 계열 문자열을 찾지 못했다. | source-only 후보 대상 `rg -l` | 2026-08-04 | 키워드 부재는 비밀정보 부재의 충분조건이 아니므로 추적 파일 확정 후 패턴·확장자·크기 검사를 다시 해야 한다. | REQ-002, VAL-002 |

`fact`, `user_statement`, `assumption`, `counterevidence`를 구분했으며 외부 웹·API는 사용하지 않았다.
