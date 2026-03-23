-- ============================================================
-- Phase 2: transactions 테이블 DB 제약 강화
-- 앱 레벨 검증(Zod)과 이중 보호로 데이터 정합성 보장
-- ============================================================

-- transfer 거래는 category_id가 NULL이어야 함
ALTER TABLE transactions
  ADD CONSTRAINT transactions_transfer_no_category
    CHECK (type != 'transfer' OR category_id IS NULL);

-- income/expense 거래는 transfer_to_account_id가 NULL이어야 함
ALTER TABLE transactions
  ADD CONSTRAINT transactions_non_transfer_no_destination
    CHECK (type = 'transfer' OR transfer_to_account_id IS NULL);

-- 자기 자신으로 이체 불가
ALTER TABLE transactions
  ADD CONSTRAINT transactions_no_self_transfer
    CHECK (account_id != transfer_to_account_id);

-- transaction_date 기본값: 오늘
ALTER TABLE transactions
  ALTER COLUMN transaction_date SET DEFAULT CURRENT_DATE;