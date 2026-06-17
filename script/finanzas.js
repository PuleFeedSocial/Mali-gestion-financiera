import { supabase, getSession } from './auth.js'

export async function getBalance() {
  const session = await getSession()
  if (!session) return null

  const [txData, debtData] = await Promise.all([
    supabase.from('transactions').select('type, amount').eq('user_id', session.user.id),
    supabase.from('debts').select('type, amount, total_amount, installments, installments_paid, status').eq('user_id', session.user.id).eq('status', 'pendiente')
  ])

  if (txData.error) throw txData.error
  if (debtData.error) throw debtData.error

  const total = { ingresos: 0, gastos: 0, por_cobrar: 0, por_pagar: 0 }
  for (const t of txData.data) {
    if (t.type === 'ingreso') total.ingresos += Number(t.amount)
    else total.gastos += Number(t.amount)
  }
  for (const d of debtData.data) {
    const remaining = Number(d.amount)
    if (d.type === 'por_cobrar') total.por_cobrar += remaining
    else total.por_pagar += remaining
  }
  total.balance = total.ingresos - total.gastos + total.por_cobrar - total.por_pagar
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

export async function addDebt({ type, debtor, amount, description, dueDate, installments = 1 }) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const total = Number(amount)
  const inst = Math.max(1, Math.floor(Number(installments)))
  const installmentAmount = inst > 0 ? total / inst : total

  const { error } = await supabase.from('debts').insert({
    user_id: session.user.id,
    type,
    debtor,
    amount: inst === 1 ? total : installmentAmount,
    total_amount: total,
    installments: inst,
    installments_paid: 0,
    description,
    due_date: dueDate
  })
  if (error) throw error
}

export async function getDebts({ status, type } = {}) {
  const session = await getSession()
  if (!session) return []

  let query = supabase
    .from('debts')
    .select('*')
    .eq('user_id', session.user.id)
    .order('due_date', { ascending: true })

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function payInstallment(id) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { data: debt, error: fetchError } = await supabase
    .from('debts')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()
  if (fetchError) throw fetchError
  if (!debt) throw new Error('Deuda no encontrada.')
  if (debt.status !== 'pendiente') throw new Error('Esta deuda ya está saldada.')
  if (debt.installments_paid >= debt.installments) throw new Error('Todas las cuotas ya fueron pagadas.')

  const totalAmt = Number(debt.total_amount) || Number(debt.amount) * Number(debt.installments)
  const instAmt = debt.installments > 0 ? totalAmt / Number(debt.installments) : totalAmt
  const newPaid = Number(debt.installments_paid) + 1
  const newAmount = totalAmt - (instAmt * newPaid)
  const isComplete = newPaid >= Number(debt.installments)

  const { error: updateError } = await supabase
    .from('debts')
    .update({
      amount: Math.max(0, newAmount),
      installments_paid: newPaid,
      status: isComplete ? (debt.type === 'por_cobrar' ? 'cobrado' : 'pagado') : 'pendiente'
    })
    .eq('id', id)
    .eq('user_id', session.user.id)
  if (updateError) throw updateError

  const txType = debt.type === 'por_cobrar' ? 'ingreso' : 'gasto'
  const txSub = debt.type === 'por_cobrar' ? 'instantaneo' : 'variable'
  await supabase.from('transactions').insert({
    user_id: session.user.id,
    type: txType,
    subtype: txSub,
    amount: instAmt,
    description: `${txType === 'ingreso' ? 'Cobro' : 'Pago'} cuota ${newPaid}/${debt.installments}: ${debt.debtor} - ${debt.description}`,
    date: new Date().toISOString().split('T')[0]
  })
}

export async function updateDebtStatus(id, newStatus) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { data: debt, error: fetchError } = await supabase
    .from('debts')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()
  if (fetchError) throw fetchError
  if (!debt) throw new Error('Deuda no encontrada.')

  const totalAmt = Number(debt.total_amount) || Number(debt.amount) * Number(debt.installments)
  const remaining = Number(debt.amount)

  const { error: updateError } = await supabase
    .from('debts')
    .update({ status: newStatus, amount: 0, installments_paid: debt.installments })
    .eq('id', id)
    .eq('user_id', session.user.id)
  if (updateError) throw updateError

  if (newStatus === 'cobrado') {
    await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: 'ingreso',
      subtype: 'instantaneo',
      amount: remaining,
      description: `Cobro total: ${debt.debtor} - ${debt.description}`,
      date: new Date().toISOString().split('T')[0]
    })
  } else if (newStatus === 'pagado') {
    await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: 'gasto',
      subtype: 'variable',
      amount: remaining,
      description: `Pago total: ${debt.debtor} - ${debt.description}`,
      date: new Date().toISOString().split('T')[0]
    })
  }
}

export async function deleteDebt(id) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')
  const { error } = await supabase.from('debts').delete().eq('id', id).eq('user_id', session.user.id)
  if (error) throw error
}
