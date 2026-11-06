-- Preserve the products, quantities, and unit prices attached to each deal.
CREATE TABLE IF NOT EXISTS deal_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_value NUMERIC(12, 2) NOT NULL CHECK (unit_value >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_products_deal
  ON deal_products(deal_id);

ALTER TABLE deal_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can view deal products" ON deal_products;
CREATE POLICY "Account members can view deal products" ON deal_products
  FOR SELECT
  USING (
    is_account_member(account_id, 'viewer')
    AND EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = deal_products.deal_id
        AND deals.account_id = deal_products.account_id
    )
  );

DROP POLICY IF EXISTS "Account agents can manage deal products" ON deal_products;
CREATE POLICY "Account agents can manage deal products" ON deal_products
  FOR ALL
  USING (
    is_account_member(account_id, 'agent')
    AND EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = deal_products.deal_id
        AND deals.account_id = deal_products.account_id
    )
  )
  WITH CHECK (
    is_account_member(account_id, 'agent')
    AND EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = deal_products.deal_id
        AND deals.account_id = deal_products.account_id
    )
    AND (
      product_id IS NULL
      OR EXISTS (
        SELECT 1 FROM products
        WHERE products.id = deal_products.product_id
          AND products.account_id = deal_products.account_id
      )
    )
  );

CREATE OR REPLACE FUNCTION save_deal_products(
  p_deal_id UUID,
  p_items JSONB,
  p_value NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_items_total NUMERIC;
BEGIN
  IF p_items IS NULL
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR p_value IS NULL
     OR p_value < 0
     OR EXISTS (
       SELECT 1
       FROM jsonb_to_recordset(p_items) AS item(
         product_id UUID,
         product_name TEXT,
         quantity INTEGER,
         unit_value NUMERIC
       )
       WHERE item.product_name IS NULL
          OR length(trim(item.product_name)) = 0
          OR item.quantity IS NULL
          OR item.quantity <= 0
          OR item.unit_value IS NULL
          OR item.unit_value < 0
     )
  THEN
    RAISE EXCEPTION 'Invalid deal products or value';
  END IF;

  SELECT COALESCE(SUM(item.quantity * item.unit_value), 0)
    INTO v_items_total
  FROM jsonb_to_recordset(p_items) AS item(
    product_id UUID,
    product_name TEXT,
    quantity INTEGER,
    unit_value NUMERIC
  );

  IF jsonb_array_length(p_items) > 0 AND p_value <> v_items_total THEN
    RAISE EXCEPTION 'Deal value must equal the sum of its products';
  END IF;

  UPDATE deals
  SET value = p_value
  WHERE id = p_deal_id
  RETURNING account_id INTO v_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found or not accessible';
  END IF;

  DELETE FROM deal_products
  WHERE deal_id = p_deal_id;

  INSERT INTO deal_products (
    deal_id,
    account_id,
    product_id,
    product_name,
    quantity,
    unit_value
  )
  SELECT
    p_deal_id,
    v_account_id,
    item.product_id,
    item.product_name,
    item.quantity,
    item.unit_value
  FROM jsonb_to_recordset(p_items) AS item(
    product_id UUID,
    product_name TEXT,
    quantity INTEGER,
    unit_value NUMERIC
  );
END;
$$;

REVOKE ALL ON FUNCTION save_deal_products(UUID, JSONB, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_deal_products(UUID, JSONB, NUMERIC) TO authenticated, service_role;
