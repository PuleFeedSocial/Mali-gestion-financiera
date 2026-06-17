import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pgpeezodvulzeduhwtuw.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_90CvIn-1QRJGviXuD_fSyw_Yh6pPeVC'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function migrate() {
  const { data: { session } } = await supabase.auth.signInWithPassword({
    email: 'victoraramirezp@gmail.com',
    password: 'Admin123!'
  })

  if (!session) {
    console.error('No se pudo autenticar. Usá el SQL manual.')
    return
  }

  const sql = `
    ALTER TABLE debts 
    ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS installments integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS installments_paid integer DEFAULT 0;

    UPDATE debts SET total_amount = amount WHERE total_amount = 0;
    UPDATE debts SET installments_paid = 1 WHERE status IN ('cobrado','pagado') AND installments_paid = 0;
  `

  const { error } = await supabase.rpc('exec_sql', { query: sql })
  if (error) {
    console.error('Error ejecutando SQL. Ejecutalo manualmente desde el panel de Supabase:', error.message)
    console.log('\n--- SQL a ejecutar ---')
    console.log(sql)
  } else {
    console.log('Migración completada.')
  }
}

migrate()
