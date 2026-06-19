    import { requireAuth, getUserProfile, completeSetup } from './auth.js'

    const session = await requireAuth('acceder-formulario.html')
    if (!session) throw new Error()

    const profile = await getUserProfile()
    if (profile && profile.setup_complete) {
        window.location.href = 'dashboard.html'
        throw new Error()
    }

    document.querySelectorAll('.opt').forEach(el => {
        el.addEventListener('click', function () {
            const cb = this.querySelector('input')
            cb.checked = !cb.checked
            this.classList.toggle('selected', cb.checked)
        })
    })

    document.getElementById('setupBtn').addEventListener('click', async function () {
        const currency = document.getElementById('currency').value
        const checked = document.querySelectorAll('#goalsContainer input:checked')
        const goals = Array.from(checked).map(c => c.value).join(',')

        if (goals.length === 0) {
            const msg = document.getElementById('setupMsg')
            msg.textContent = 'Seleccioná al menos un objetivo.'
            msg.className = 'msg error'
            return
        }

        this.textContent = 'Guardando...'
        this.disabled = true

        try {
            await completeSetup(currency, goals)
            window.location.href = 'dashboard.html'
        } catch (e) {
            const msg = document.getElementById('setupMsg')
            msg.textContent = 'Error: ' + e.message
            msg.className = 'msg error'
            this.textContent = 'Ir al Dashboard'
            this.disabled = false
        }
    })