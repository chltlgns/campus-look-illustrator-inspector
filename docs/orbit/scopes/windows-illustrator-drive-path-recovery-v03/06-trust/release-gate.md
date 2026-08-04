# Release gate — Windows Illustrator drive-path 실제 활성화 복구

- 상태: completed
- 판정일: 2026-08-04

## 판정

PASS

## 필수 기준

- [x] 승인 범위의 요구사항이 검증 증거와 연결된다.
- [x] 관련 자동 테스트가 통과한다.
- [x] 비밀·유료 API·외부 변경 경계를 위반하지 않았다.
- [x] 실패·복구·이동 경로를 위험에 비례해 확인했다.
- [x] 남은 제한과 외부 게이트를 완료로 숨기지 않았다.

## 승인된 예외와 후속 작업

없음. 실제 시안 내용 결과 PASS 15/REVIEW 3/FAIL 2는 운영 검토 대상으로 별도 보고한다.
기존 legacy 설치본은 삭제·symlink 전환하지 않았고 fresh 9-entry rollback backup을 유지한다.
