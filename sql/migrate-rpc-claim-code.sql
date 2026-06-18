-- Crear función RPC para reclamar un código de activación de forma atómica
-- Esto garantiza que cada código sea de un solo uso, incluso bajo concurrencia.
-- La función usa SECURITY DEFINER para operar con privilegios elevados (bypassea RLS).

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
