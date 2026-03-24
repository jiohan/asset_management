-- ============================================================
-- Phase 2 integrity: 거래 교차 테이블 소유권 + 카테고리 타입 강제
--
-- RLS는 transactions.user_id = auth.uid()를 보장하지만,
-- account_id / transfer_to_account_id / category_id가
-- 다른 사용자 소유 레코드를 가리키는 것은 막지 않는다.
-- anon key로 직접 INSERT/UPDATE 시 타인의 계좌나 카테고리를
-- 거래에 연결해 잔액 오염 or 데이터 탈취를 시도할 수 있으므로
-- DB 트리거로 강제.
--
-- 검증 항목:
--   1. account_id         → accounts.user_id = transaction.user_id
--   2. transfer_to_account_id (not null) → accounts.user_id = transaction.user_id
--   3. category_id (not null) → categories.user_id = transaction.user_id
--                             AND categories.type = transaction.type
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_transaction_references()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_cat_type TEXT;
BEGIN
  -- 1. account_id: 같은 사용자 소유여야 함
  SELECT user_id INTO v_user_id
  FROM accounts
  WHERE id = NEW.account_id;

  IF v_user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION '계좌가 사용자 소유가 아닙니다';
  END IF;

  -- 2. transfer_to_account_id: 설정된 경우 같은 사용자 소유여야 함
  IF NEW.transfer_to_account_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id
    FROM accounts
    WHERE id = NEW.transfer_to_account_id;

    IF v_user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION '도착 계좌가 사용자 소유가 아닙니다';
    END IF;
  END IF;

  -- 3. category_id: 설정된 경우 같은 사용자 소유 + 거래 타입과 일치해야 함
  IF NEW.category_id IS NOT NULL THEN
    SELECT user_id, type INTO v_user_id, v_cat_type
    FROM categories
    WHERE id = NEW.category_id;

    IF v_user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION '카테고리가 사용자 소유가 아닙니다';
    END IF;

    IF v_cat_type IS DISTINCT FROM NEW.type THEN
      RAISE EXCEPTION '카테고리 유형이 거래 유형과 일치하지 않습니다';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_transaction_references
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_transaction_references();
