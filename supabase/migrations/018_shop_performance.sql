-- =============================================================
-- 018: 상점 성능 개선 — 통합 구매 RPC + 인덱스 추가
--
-- 변경 사항:
--  1) user_inventory(user_id) 단독 인덱스 추가
--     → fetchInventoryAction()의 WHERE user_id = ? 조회 가속
--  2) chip_logs(user_id, created_at DESC) 인덱스 추가
--     → 칩 로그 최신순 조회 가속
--  3) purchase_item_atomic() 통합 RPC 생성
--     → 기존 deduct_chips + user_inventory INSERT 를 단일 트랜잭션으로 통합
--     → DB 왕복 4회 → 2회로 절감 (Server Action 기준)
--
-- ⚠️ 기존 deduct_chips / add_chips RPC는 삭제하지 않음 (가챠 등에서 계속 사용)
-- =============================================================

-- 1. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id
  ON public.user_inventory(user_id);

CREATE INDEX IF NOT EXISTS idx_chip_logs_user_id
  ON public.chip_logs(user_id, created_at DESC);

-- 2. 통합 구매 RPC
--    칩 차감 + 인벤토리 삽입을 하나의 PostgreSQL 함수로 묶어
--    단일 RPC 호출로 처리. Row Lock(FOR UPDATE)으로 동시성 안전 보장.
CREATE OR REPLACE FUNCTION public.purchase_item_atomic(
  p_user_id UUID,
  p_amount BIGINT,
  p_reason TEXT,
  p_item_type VARCHAR,
  p_item_code VARCHAR
)
RETURNS BIGINT AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  -- 입력 검증
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- 1. Row Lock 획득 + 잔액 확인
  SELECT chips_balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient chips_balance. Has: %, Needs: %', v_balance, p_amount;
  END IF;

  -- 2. 중복 구매 방지 (이미 보유 중인 아이템)
  IF EXISTS (
    SELECT 1 FROM public.user_inventory
    WHERE user_id = p_user_id AND item_code = p_item_code
  ) THEN
    RAISE EXCEPTION 'Item already owned: %', p_item_code;
  END IF;

  -- 3. 칩 차감 + 프로필 업데이트
  UPDATE public.profiles
  SET chips_balance = chips_balance - p_amount,
      total_spent_chips = total_spent_chips + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING chips_balance INTO v_balance;

  -- 4. 칩 로그 기록
  INSERT INTO public.chip_logs (user_id, amount, reason)
  VALUES (p_user_id, -p_amount, p_reason);

  -- 5. 인벤토리에 아이템 추가
  INSERT INTO public.user_inventory (user_id, item_type, item_code)
  VALUES (p_user_id, p_item_type, p_item_code);

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
