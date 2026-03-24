-- ============================================================
-- Phase 2: account_type 기반 거래 타입 제약 (DB 레벨)
--
-- 앱 레벨 검증만으로는 서버 액션 우회 시 잘못된 데이터 삽입 가능.
-- PostgreSQL CHECK 제약은 타 테이블 참조 불가이므로 트리거 사용.
--
-- 규칙:
--   1. 카드 계좌 → income 거래 불가
--   2. 투자 계좌 → transfer 이외의 거래 불가
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_transaction_account_type()
RETURNS TRIGGER AS $$
DECLARE
  acc_type TEXT;
BEGIN
  SELECT account_type INTO acc_type
  FROM accounts
  WHERE id = NEW.account_id;

  IF acc_type = 'card' AND NEW.type = 'income' THEN
    RAISE EXCEPTION '카드 계좌에는 수입을 등록할 수 없습니다';
  END IF;

  IF acc_type = 'investment' AND NEW.type != 'transfer' THEN
    RAISE EXCEPTION '투자 계좌에는 이체만 등록할 수 있습니다';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_transaction_account_type
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_transaction_account_type();
