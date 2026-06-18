import { supabase, getSession } from './auth.js'

export async function getTasks({ status, type } = {}) {
  const session = await getSession()
  if (!session) return []

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', session.user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function addTask({ date, type, description }) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { error } = await supabase.from('tasks').insert({
    user_id: session.user.id,
    date,
    type,
    description,
    status: 'por_hacer'
  })
  if (error) throw error
}

export async function updateTaskStatus(id, newStatus) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { error } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', id)
    .eq('user_id', session.user.id)
  if (error) throw error
}

export async function updateTask(id, { date, type, description }) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { error } = await supabase
    .from('tasks')
    .update({ date, type, description })
    .eq('id', id)
    .eq('user_id', session.user.id)
  if (error) throw error
}

export async function deleteTask(id) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)
  if (error) throw error
}
