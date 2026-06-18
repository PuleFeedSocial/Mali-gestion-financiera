import { supabase, getSession } from './auth.js'

const META_PREFIX = '__META__'

function metaEncode(total, inst, paid, nextDate) {
  const obj = { t: total, i: inst, p: paid }
  if (nextDate) obj.n = nextDate
  return JSON.stringify(obj)
}

function metaDecode(desc) {
  if (!desc) return null
  const idx = desc.lastIndexOf(META_PREFIX)
  if (idx === -1) return null
  try {
    return JSON.parse(desc.slice(idx + META_PREFIX.length))
  } catch {
    return null
  }
}

function metaStrip(desc) {
  if (!desc) return desc
  const idx = desc.lastIndexOf(META_PREFIX)
  return idx === -1 ? desc : desc.slice(0, idx).trim()
}

let _hasInstallments = null

async function hasInstallmentsColumn() {
  if (_hasInstallments !== null) return _hasInstallments
  try {
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'debts')
      .eq('column_name', 'installments')
      .maybeSingle()
    _hasInstallments = !error && !!data
  } catch {
    _hasInstallments = false
  }
  return _hasInstallments
}

export async function getBalance(currency) {
  const session = await getSession()
  if (!session) return null

  const hasInst = await hasInstallmentsColumn()
  const selectCols = hasInst
    ? 'type, amount, total_amount, installments, installments_paid, status'
    : 'type, amount, status'

  const [txData, debtData] = await Promise.all([
    supabase.from('transactions').select('type, amount').eq('user_id', session.user.id),
    supabase.from('debts').select(selectCols).eq('user_id', session.user.id).eq('status', 'pendiente')
  ])

  if (txData.error) throw txData.error
  if (debtData.error) throw debtData.error

  const total = { ingresos: 0, gastos: 0, por_cobrar: 0, por_pagar: 0, currency }
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
  const isMulti = inst > 1

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + 30)
  const nextDateStr = nextDate.toISOString().split('T')[0]

  if (await hasInstallmentsColumn()) {
    const meta = isMulti ? META_PREFIX + JSON.stringify({ n: nextDateStr }) : ''
    const { error } = await supabase.from('debts').insert({
      user_id: session.user.id,
      type, debtor,
      amount: inst === 1 ? total : installmentAmount,
      total_amount: total,
      installments: inst,
      installments_paid: 0,
      description: (description || '') + meta,
      due_date: dueDate
    })
    if (error) throw error
  } else {
    const desc = isMulti
      ? (description || '') + '\n' + META_PREFIX + metaEncode(total, inst, 0, nextDateStr)
      : (description || '')
    const { error } = await supabase.from('debts').insert({
      user_id: session.user.id,
      type, debtor,
      amount: total,
      description: desc,
      due_date: dueDate
    })
    if (error) throw error
  }

  // Registrar en movimientos
  const txType = type === 'por_cobrar' ? 'ingreso' : 'gasto'
  const txSub = type === 'por_cobrar' ? 'instantaneo' : 'variable'
  await supabase.from('transactions').insert({
    user_id: session.user.id,
    type: txType,
    subtype: txSub,
    amount: total,
    description: `${type === 'por_cobrar' ? 'Préstamo otorgado' : 'Deuda contraída'}: ${debtor}${description ? ' - ' + description : ''}`,
    date: dueDate || new Date().toISOString().split('T')[0]
  })
}

export async function getDebts({ status, type } = {}) {
  const session = await getSession()
  if (!session) return []

  const hasInst = await hasInstallmentsColumn()

  let query = supabase
    .from('debts')
    .select('*')
    .eq('user_id', session.user.id)
    .order('due_date', { ascending: true })

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw error
  if (!data) return []

  return data.map(d => {
    const meta = metaDecode(d.description)

    if (hasInst) {
      return {
        ...d,
        total_amount: Number(d.total_amount) || Number(d.amount),
        installments: Number(d.installments) || 1,
        installments_paid: Number(d.installments_paid) || 0,
        next_payment_date: meta?.n || null,
        description: meta ? metaStrip(d.description) : (d.description || '')
      }
    }

    if (meta) {
      return {
        ...d,
        description: metaStrip(d.description),
        total_amount: meta.t,
        installments: meta.i,
        installments_paid: meta.p,
        amount: meta.t - (meta.t / meta.i * meta.p),
        next_payment_date: meta.n || null
      }
    }
    return {
      ...d,
      total_amount: Number(d.amount),
      installments: 1,
      installments_paid: d.status === 'pendiente' ? 0 : 1,
      next_payment_date: null
    }
  })
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

  const hasInst = await hasInstallmentsColumn()

  let totalAmt, instCount, paidCount, instAmt
  let cleanDesc = debt.description || ''
  let oldMeta = null

  if (hasInst) {
    totalAmt = Number(debt.total_amount) || Number(debt.amount) * Number(debt.installments)
    instCount = Number(debt.installments) || 1
    paidCount = Number(debt.installments_paid) || 0
    oldMeta = metaDecode(debt.description)
    if (oldMeta) cleanDesc = metaStrip(debt.description)
  } else {
    const meta = metaDecode(debt.description)
    if (!meta) throw new Error('Esta deuda no tiene cuotas.')
    totalAmt = meta.t
    instCount = meta.i
    paidCount = meta.p
    oldMeta = meta
    cleanDesc = metaStrip(debt.description)
  }

  if (debt.status !== 'pendiente') throw new Error('Esta deuda ya está saldada.')
  if (paidCount >= instCount) throw new Error('Todas las cuotas ya fueron pagadas.')

  instAmt = instCount > 0 ? totalAmt / instCount : totalAmt
  const newPaid = paidCount + 1
  const newAmount = totalAmt - (instAmt * newPaid)
  const isComplete = newPaid >= instCount

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + 30)
  const nextDateStr = nextDate.toISOString().split('T')[0]

  if (hasInst) {
    const metaPayload = { n: nextDateStr }
    const metaStr = META_PREFIX + JSON.stringify(metaPayload)
    const newDesc = isComplete ? cleanDesc : cleanDesc + metaStr
    const { error: updateError } = await supabase
      .from('debts')
      .update({
        amount: Math.max(0, newAmount),
        installments_paid: newPaid,
        status: isComplete ? (debt.type === 'por_cobrar' ? 'cobrado' : 'pagado') : 'pendiente',
        description: newDesc
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
    if (updateError) throw updateError
  } else {
    const newDesc = isComplete
      ? cleanDesc
      : cleanDesc + '\n' + META_PREFIX + metaEncode(totalAmt, instCount, newPaid, nextDateStr)
    const { error: updateError } = await supabase
      .from('debts')
      .update({
        amount: Math.max(0, newAmount),
        description: newDesc,
        status: isComplete ? (debt.type === 'por_cobrar' ? 'cobrado' : 'pagado') : 'pendiente'
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
    if (updateError) throw updateError
  }

  const txType = debt.type === 'por_cobrar' ? 'ingreso' : 'gasto'
  const txSub = debt.type === 'por_cobrar' ? 'instantaneo' : 'variable'
  await supabase.from('transactions').insert({
    user_id: session.user.id,
    type: txType,
    subtype: txSub,
    amount: instAmt,
    description: `${txType === 'ingreso' ? 'Cobro' : 'Pago'} cuota ${newPaid}/${instCount}: ${debt.debtor} - ${cleanDesc}`,
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

  const hasInst = await hasInstallmentsColumn()
  const remaining = Number(debt.amount)
  const cleanDesc = metaStrip(debt.description || '')

  if (hasInst) {
    const { error: updateError } = await supabase
      .from('debts')
      .update({ status: newStatus, amount: 0, installments_paid: debt.installments, description: cleanDesc })
      .eq('id', id)
      .eq('user_id', session.user.id)
    if (updateError) throw updateError
  } else {
    const { error: updateError } = await supabase
      .from('debts')
      .update({ status: newStatus, description: cleanDesc })
      .eq('id', id)
      .eq('user_id', session.user.id)
    if (updateError) throw updateError
  }

  if (newStatus === 'cobrado') {
    await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: 'ingreso',
      subtype: 'instantaneo',
      amount: remaining,
      description: `Cobro total: ${debt.debtor} - ${cleanDesc}`,
      date: new Date().toISOString().split('T')[0]
    })
  } else if (newStatus === 'pagado') {
    await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: 'gasto',
      subtype: 'variable',
      amount: remaining,
      description: `Pago total: ${debt.debtor} - ${cleanDesc}`,
      date: new Date().toISOString().split('T')[0]
    })
  } else if (newStatus === 'cancelado') {
    await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: debt.type === 'por_cobrar' ? 'gasto' : 'ingreso',
      subtype: 'instantaneo',
      amount: remaining,
      description: `Cancelación: ${debt.debtor} - ${cleanDesc}`,
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
