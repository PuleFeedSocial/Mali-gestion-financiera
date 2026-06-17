import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = 'https://pgpeezodvulzeduhwtuw.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_90CvIn-1QRJGviXuD_fSyw_Yh6pPeVC'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function requireAuth(redirectTo) {
  const session = await getSession()
  if (!session) {
    window.location.href = redirectTo || 'acceder-formulario.html'
    return null
  }
  return session
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function register(name, email, password, activationCode) {
  const { data: codeData, error: codeError } = await supabase
    .from('activation_codes')
    .select('id, code')
    .eq('code', activationCode)
    .eq('used', false)
    .maybeSingle()
  if (codeError) throw codeError
  if (!codeData) throw new Error('Código de activación inválido o ya utilizado.')

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  if (!data || !data.user) throw new Error('Error al crear la cuenta.')

  const { error: pe } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, name, role: 'user' })
  if (pe) throw pe

  await supabase
    .from('activation_codes')
    .update({ used: true, used_by: data.user.id })
    .eq('id', codeData.id)

  return data
}

export async function logout() {
  await supabase.auth.signOut()
  window.location.href = 'acceder-formulario.html'
}

export async function getUserProfile() {
  const session = await getSession()
  if (!session) return null
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
  return data
}
