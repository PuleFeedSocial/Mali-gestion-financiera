import { supabase, getSession } from './auth.js'

export async function getBalance() {
  const session = await getSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', session.user.id)

  if (error) throw error

  const total = { ingresos: 0, gastos: 0 }
  for (const t of data) {
    if (t.type === 'ingreso') total.ingresos += Number(t.amount)
    else total.gastos += Number(t.amount)
  }
  total.balance = total.ingresos - total.gastos
  return total
}

export async function addTransaction({ type, subtype, amount, description, date, dayOfMonth }) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  if (subtype === 'fijo' && dayOfMonth) {
    const { error: se } = await supabase.from('scheduled_transactions').insert({
      user_id: session.user.id,
      type,
      subtype: 'fijo',
      amount,
      description,
      day_of_month: dayOfMonth
    })
    if (se) throw se

    const today = new Date()
    if (dayOfMonth <= today.getDate()) {
      const { error: te } = await supabase.from('transactions').insert({
        user_id: session.user.id,
        type,
        subtype: 'fijo',
        amount,
        description,
        date: date || today.toISOString().split('T')[0]
      })
      if (te) throw te
    }
  } else {
    const { error } = await supabase.from('transactions').insert({
      user_id: session.user.id,
      type,
      subtype,
      amount,
      description,
      date: date || new Date().toISOString().split('T')[0]
    })
    if (error) throw error
  }
}

export async function getTransactions({ limit = 50, offset = 0, type, subtype } = {}) {
  const session = await getSession()
  if (!session) return []

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', session.user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('type', type)
  if (subtype) query = query.eq('subtype', subtype)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getScheduledTransactions() {
  const session = await getSession()
  if (!session) return []

  const { data, error } = await supabase
    .from('scheduled_transactions')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('active', true)
    .order('day_of_month')

  if (error) throw error
  return data || []
}

export async function deleteTransaction(id) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)

  if (error) throw error
}

export async function processScheduled() {
  const session = await getSession()
  if (!session) return

  const scheduled = await getScheduledTransactions()
  const now = new Date()
  const today = now.getDate()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  for (const s of scheduled) {
    if (s.day_of_month > today) continue

    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('scheduled_id', s.id)
      .gte('date', `${yearMonth}-01`)
      .lte('date', `${yearMonth}-31`)
      .limit(1)

    if (existing && existing.length > 0) continue

    const day = String(s.day_of_month).padStart(2, '0')
    await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: s.type,
      subtype: 'fijo',
      amount: s.amount,
      description: s.description,
      date: `${yearMonth}-${day}`,
      scheduled_id: s.id
    })
  }
}
