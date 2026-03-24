-- ============================================================
-- Phase 2 integrity: accounts 불변 필드 보호
--
-- opening_balance: 잔액 계산의 기준값.
--   변경 시 해당 계좌의 모든 과거/현재 잔액과 총자산 히스토리가
--   통째로 바뀌므로 계좌 생성 후 절대 변경 불가.
--
-- account_type: 잔액 계산 모델(일반/카드/투자)과 직접 연동.
--   변경 시 기존 거래의 잔액 기여 방향(+ / -)이 달라져 총자산이 오염됨.
--   예) checking → card 로 변경 시 기존 income 거래가 부채로 잘못 계산됨.
--
-- 앱 레벨(updateAccount 액션)이 name만 수정하도록 막고 있지만,
-- anon key로 직접 Supabase UPDATE를 보내면 RLS(FOR ALL)가 허용하므로
-- DB 트리거로 이중 차단.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_account_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.opening_balance IS DISTINCT FROM OLD.opening_balance THEN
    RAISE EXCEPTION 'opening_balance는 계좌 생성 후 변경할 수 없습니다';
  END IF;

  IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    RAISE EXCEPTION 'account_type은 계좌 생성 후 변경할 수 없습니다';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_account_immutable_fields
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_account_immutable_fields();
