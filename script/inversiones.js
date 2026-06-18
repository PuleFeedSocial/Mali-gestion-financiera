import { supabase, getSession } from './auth.js'

export async function getInvestments({ status } = {}) {
  const session = await getSession()
  if (!session) return []

  let query = supabase
    .from('investments')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function addInvestment({ name, type, capital, interestRate, startDate, endDate }) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { error } = await supabase.from('investments').insert({
    user_id: session.user.id,
    name, type,
    capital: capital,
    interest_rate: interestRate,
    start_date: startDate,
    end_date: endDate,
    status: 'activo',
    accumulated_interest: 0
  })
  if (error) throw error
}

export async function liquidateInvestment(id) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { data: inv, error: fetchError } = await supabase
    .from('investments')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()
  if (fetchError) throw fetchError
  if (!inv) throw new Error('Inversión no encontrada.')
  if (inv.status === 'liquidado') throw new Error('Esta inversión ya fue liquidada.')

  const { error: updateError } = await supabase
    .from('investments')
    .update({ status: 'liquidado' })
    .eq('id', id)
    .eq('user_id', session.user.id)
  if (updateError) throw updateError
}

export async function claimInterest(id) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { data: inv, error: fetchError } = await supabase
    .from('investments')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()
  if (fetchError) throw fetchError
  if (!inv) throw new Error('Inversión no encontrada.')
  if (inv.status === 'liquidado') throw new Error('Esta inversión ya fue liquidada.')

  const interest = Number(inv.accumulated_interest) || 0
  if (interest <= 0) throw new Error('No hay intereses acumulados para cobrar.')

  // Registrar el cobro de intereses como ingreso
  const { error: txError } = await supabase.from('transactions').insert({
    user_id: session.user.id,
    type: 'ingreso',
    subtype: 'instantaneo',
    amount: interest,
    description: `Interés cobrado: ${inv.name}`,
    date: new Date().toISOString().split('T')[0]
  })
  if (txError) throw txError

  // Resetear interés acumulado a 0
  const { error: resetError } = await supabase
    .from('investments')
    .update({ accumulated_interest: 0 })
    .eq('id', id)
    .eq('user_id', session.user.id)
  if (resetError) throw resetError
}

export async function deleteInvestment(id) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { error } = await supabase
    .from('investments')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)
  if (error) throw error
}
