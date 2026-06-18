import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = 'https://pgpeezodvulzeduhwtuw.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_90CvIn-1QRJGviXuD_fSyw_Yh6pPeVC'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const ERRORES = {
  'Invalid login credentials': 'Credenciales inválidas. Revisá tu email y contraseña.',
  'Email not confirmed': 'Email no confirmado. Revisá tu bandeja de entrada.',
  'User already registered': 'Este email ya está registrado.',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
  'Unable to validate email address: invalid format': 'El formato del email no es válido.',
  'invalid email': 'El formato del email no es válido.',
  'new email should be different from the old email': 'El nuevo email debe ser diferente al actual.',
  'Email rate limit exceeded': 'Demasiados intentos. Esperá un momento y volvé a intentar.'
}

function traducirError(error) {
  if (!error) return 'Error desconocido.'
  const msg = error.message || error.msg || String(error)
  for (const [ing, esp] of Object.entries(ERRORES)) {
    if (msg.includes(ing)) return esp
  }
  return msg
}

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
  if (error) throw new Error(traducirError(error))
  return data
}

export async function register(name, email, password, activationCode) {
  // Paso 1: Reclamar código atómicamente via RPC (bypassea RLS con SECURITY DEFINER)
  const { data: claim, error: claimError } = await supabase
    .rpc('claim_activation_code', { code_to_claim: activationCode })

  // Fallback: si la función RPC no existe, usar método directo con verificación de error
  if (claimError && claimError.message?.includes('function "claim_activation_code" does not exist')) {
    const { data: codeData, error: codeError } = await supabase
      .from('activation_codes')
      .select('id, code')
      .eq('code', activationCode)
      .eq('used', false)
      .maybeSingle()
    if (codeError) throw new Error('Error al verificar código de activación.')
    if (!codeData) throw new Error('Código de activación inválido o ya utilizado.')

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(traducirError(error))
    if (!data || !data.user) throw new Error('Error al crear la cuenta.')

    const { error: pe } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, name, email, role: 'user' })
    if (pe) throw new Error('Error al crear perfil de usuario.')

    const { error: ue } = await supabase
      .from('activation_codes')
      .update({ used: true, used_by: data.user.id })
      .eq('id', codeData.id)
    if (ue) console.error('No se pudo marcar código como usado (RLS?). Ejecutá migrate-rpc-claim-code.sql')

    return data
  }

  if (claimError) throw new Error('Error al verificar código de activación.')
  if (!claim.success) throw new Error(claim.error)

  // Paso 2: Crear usuario en auth
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(traducirError(error))
  if (!data || !data.user) throw new Error('Error al crear la cuenta.')

  // Paso 3: Crear perfil
  const { error: pe } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, name, email, role: 'user' })
  if (pe) throw new Error('Error al crear perfil de usuario.')

  // Paso 4: Asociar used_by (no crítico, el código ya está marcado como usado por el RPC)
  await supabase
    .from('activation_codes')
    .update({ used_by: data.user.id })
    .eq('id', claim.code_id)

  return data
}

export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/pages/oauth-callback.html`
    }
  })
  if (error) throw new Error(traducirError(error))
}

export async function ensureProfile(user) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) return

  const name = user.user_metadata?.full_name
    || user.user_metadata?.name
    || user.email?.split('@')[0]
    || 'Usuario'

  await supabase
    .from('profiles')
    .insert({ id: user.id, name, email: user.email, role: 'user', setup_complete: false })
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
  if (data) return data

  // Si no existe perfil (OAuth), lo creamos automáticamente
  await ensureProfile(session.user)
  const { data: retry } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
  return retry
}

export async function completeSetup(currency, goals) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')
  const { error } = await supabase
    .from('profiles')
    .update({ currency, goals, setup_complete: true })
    .eq('id', session.user.id)
  if (error) throw error
}

export async function updatePassword(currentPassword, newPassword) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: session.user.email,
    password: currentPassword
  })
  if (signInError) throw new Error('La contraseña actual no es correcta.')

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function updateProfile(data) {
  const session = await getSession()
  if (!session) throw new Error('No hay sesión.')
  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', session.user.id)
  if (error) throw error
}

export { supabase }
