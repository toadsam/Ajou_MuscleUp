-- 홈 헬스장 방명록 신고(GYM_GUESTBOOK): Hibernate 가 MySQL 에 enum(...) 으로 만든 신고 대상 칸을 문자열로 바꾼다.
-- 이미 문자열이면 같은 결과(여러 번 돌아도 됨). 값 검사는 코드(ReportTargetType)가 한다.
ALTER TABLE content_reports MODIFY target_type VARCHAR(20) NOT NULL;
