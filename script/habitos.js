import { supabase, getSession } from './auth.js'

export async function getHabits() {
  const session = await getSession()
  if (!session) return []

  const { data: habits, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!habits) return []

  const hoy = new Date()
  const diaSemana = hoy.getDay()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((diaSemana === 0 ? 7 : diaSemana) - 1))
  const weekStart = lunes.toISOString().split('T')[0]
  const weekEnd = new Date(lunes)
  weekEnd.setDate(lunes.getDate() + 6)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  const { data: logs, error: logError } = await supabase
    .from('habit_logs')
    .select('*')
    .in('habit_id', habits.map(h => h.id))
    .gte('date', weekStart)
    .lte('date', weekEndStr)
  if (logError) throw logError

  const logsByHabit = {}
  if (logs) {
    logs.forEach(log => {
      if (!logsByHabit[log.habit_id]) logsByHabit[log.habit_id] = {}
      logsByHabit[log.habit_id][log.date] = log.done
    })
  }

  return habits.map(h => {
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      days.push({
        date: dateStr,
        done: logsByHabit[h.id]?.[dateStr] || false,
        isFuture: d > hoy
      })
    }

    let racha = 0
    const checkDate = new Date(hoy)
    const offset = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1
    checkDate.setDate(hoy.getDate() - offset)
    for (let i = 0; i < 365; i++) {
      const d = new Date(checkDate)
      d.setDate(checkDate.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      if (logsByHabit[h.id]?.[dateStr]) {
        racha++
      } else {
        if (d < hoy) break
      }
    }

    return { ...h, days, racha }
  })
}

export async function addHabit(name, icon) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { error } = await supabase.from('habits').insert({
    user_id: session.user.id,
    name, icon: icon || '✅'
  })
  if (error) throw error
}

export async function toggleHabitDay(habitId, date, done) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { data: existing } = await supabase
    .from('habit_logs')
    .select('id')
    .eq('habit_id', habitId)
    .eq('date', date)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('habit_logs')
      .update({ done })
      .eq('id', existing.id)
    if (error) throw error
  } else if (done) {
    const { error } = await supabase
      .from('habit_logs')
      .insert({ habit_id: habitId, date, done: true })
    if (error) throw error
  }
}

export async function deleteHabit(id) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)
  if (error) throw error
}
