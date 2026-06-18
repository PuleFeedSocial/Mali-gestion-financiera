import { supabase, getSession } from './auth.js'

export async function getUserGroups() {
  const session = await getSession()
  if (!session) return []

  const { data, error } = await supabase
    .from('group_members')
    .select('*, groups(*)')
    .eq('user_id', session.user.id)
  if (error) throw error
  return data?.map(m => ({ ...m.groups, role: m.role, joined_at: m.joined_at })) || []
}

export async function createGroup(name) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const code = Math.random().toString(36).substring(2, 8).toUpperCase()

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name, code, created_by: session.user.id })
    .select()
    .single()
  if (groupError) throw groupError

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: session.user.id, role: 'admin' })
  if (memberError) throw memberError

  return { ...group, role: 'admin' }
}

export async function joinGroup(code) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle()
  if (groupError) throw groupError
  if (!group) throw new Error('Código inválido. Verificá e intentá de nuevo.')

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: session.user.id, role: 'member' })
  if (memberError) {
    if (memberError.message?.includes('duplicate') || memberError.code === '23505') {
      throw new Error('Ya sos miembro de este grupo.')
    }
    throw memberError
  }

  return { ...group, role: 'member' }
}
