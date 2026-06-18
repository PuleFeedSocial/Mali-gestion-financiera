-- ============================================================
-- Fix: Activation codes — RPC, RLS policies, foreign key
-- ============================================================

-- 1. Asegurar foreign key de used_by -> profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activation_codes_used_by_fkey'
  ) THEN
    ALTER TABLE activation_codes
      ADD CONSTRAINT activation_codes_used_by_fkey
      FOREIGN KEY (used_by) REFERENCES profiles(id);
  END IF;
END $$;

-- 2. RLS: permitir a anónimos SELECT (necesario para la verificación fallback)
DROP POLICY IF EXISTS "anon_select" ON activation_codes;
CREATE POLICY "anon_select" ON activation_codes
  FOR SELECT TO anon
  USING (true);

-- 3. RLS: permitir a usuarios autenticados UPDATE y DELETE (admin y marcado used_by)
DROP POLICY IF EXISTS "auth_update" ON activation_codes;
CREATE POLICY "auth_update" ON activation_codes
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete" ON activation_codes;
CREATE POLICY "auth_delete" ON activation_codes
  FOR DELETE TO authenticated
  USING (true);

-- 4. Función RPC: claim_activation_code (marca used=true, atómico, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION claim_activation_code(code_to_claim text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_id bigint;
BEGIN
  UPDATE activation_codes
  SET used = true
  WHERE code = code_to_claim AND used = false
  RETURNING id INTO code_id;

  IF code_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Código inválido o ya utilizado.');
  END IF;

  RETURN json_build_object('success', true, 'code_id', code_id);
END;
$$;

GRANT EXECUTE ON FUNCTION claim_activation_code(text) TO anon;
GRANT EXECUTE ON FUNCTION claim_activation_code(text) TO authenticated;

-- 5. Función RPC: set_code_used_by (marca quién usó el código, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION set_code_used_by(code_id bigint, user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE activation_codes
  SET used_by = user_id
  WHERE id = code_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION set_code_used_by(bigint, uuid) TO authenticated;

-- 6. Opcional: corregir códigos que ya están used=true pero sin used_by
--    (ejecutar si hay códigos huérfanos)
-- UPDATE activation_codes SET used = false WHERE used = true AND used_by IS NULL;
