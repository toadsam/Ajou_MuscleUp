-- 홈 헬스장 방명록 신고(GYM_GUESTBOOK): Hibernate 가 만든 "신고 대상은 이 값들만" 검사 제약을 지운다.
-- 없으면 아무 일도 안 한다(여러 번 돌아도 됨). 값 검사는 코드(ReportTargetType)가 한다.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'content_reports'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE content_reports DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
