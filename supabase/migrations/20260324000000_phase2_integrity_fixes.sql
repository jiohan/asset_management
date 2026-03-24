-- ============================================================
-- Phase 2 integrity fixes
--
-- 1. 카드 계좌 transfer 송신 DB 레벨 차단
--    (트리거 업데이트: card+transfer source 추가)
--
-- 2. transfer → transfer_to_account_id NOT NULL 강제
-- 3. income/expense → category_id NOT NULL 강제
--    (앱 레벨 Zod 검증과 이중 보호)
-- ============================================================

-- 1. 트리거 함수 재정의: card+transfer source 차단 추가
--    (CREATE OR REPLACE는 기존 트리거 DROP 없이 안전하게 교체)
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

  -- 카드 계좌는 이체 출발 불가.
  -- balance-calculator에서 card account의 transfer 송신(account_id = card)을 처리하지 않아
  -- card→일반 이체 시 카드 부채가 줄지 않고 도착 계좌만 증가하여 총자산이 부풀려짐.
  IF acc_type = 'card' AND NEW.type = 'transfer' THEN
    RAISE EXCEPTION '카드 계좌에서는 이체할 수 없습니다';
  END IF;

  IF acc_type = 'investment' AND NEW.type != 'transfer' THEN
    RAISE EXCEPTION '투자 계좌에는 이체만 등록할 수 있습니다';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. transfer는 도착 계좌가 반드시 있어야 함
ALTER TABLE transactions
  ADD CONSTRAINT transactions_transfer_requires_destination
    CHECK (type != 'transfer' OR transfer_to_account_id IS NOT NULL);

-- 3. income/expense는 카테고리가 반드시 있어야 함
ALTER TABLE transactions
  ADD CONSTRAINT transactions_non_transfer_requires_category
    CHECK (type = 'transfer' OR category_id IS NOT NULL);
