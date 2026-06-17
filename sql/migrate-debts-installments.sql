-- Ejecutar en el SQL Editor del panel de Supabase (https://supabase.com/dashboard/project/pgpeezodvulzeduhwtuw/sql/new)

-- Agregar columnas para el sistema de cuotas
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS installments integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS installments_paid integer DEFAULT 0;

-- Actualizar datos existentes: total_amount = amount para registros previos
UPDATE debts SET total_amount = amount WHERE total_amount = 0 OR total_amount IS NULL;

-- Marcar cuotas pagadas en deudas ya cobradas/pagadas
UPDATE debts SET installments_paid = installments WHERE status IN ('cobrado','pagado') AND installments_paid = 0;

-- Para deudas con 1 cuota que están pendientes, el amount es el total
UPDATE debts SET total_amount = amount WHERE installments = 1 AND total_amount = 0;
