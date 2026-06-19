    import { getSession, ensureProfile, supabase } from './auth.js'

    async function handleCallback() {
        const session = await getSession()
        if (!session) {
            window.location.href = 'acceder-formulario.html'
            return
        }
        await ensureProfile(session.user)
        const { data: profile } = await supabase
            .from('profiles')
            .select('setup_complete')
            .eq('id', session.user.id)
            .single()
        window.location.href = profile?.setup_complete ? 'dashboard.html' : 'setup.html'
    }

    handleCallback()