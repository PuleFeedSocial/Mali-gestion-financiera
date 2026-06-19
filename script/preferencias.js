    import { requireAuth, getUserProfile, updateProfile, subscribeToPush, getNotificationPreferences, setNotificationPreference, NOTIF_TYPES, NOTIF_LABELS } from './auth.js'

    const session = await requireAuth()
    if (!session) throw new Error()

    const profile = await getUserProfile()
    if (profile) {
        document.getElementById('currency').value = profile.currency || 'USD'
        document.getElementById('goals').value = profile.goals || ''
    }

    const msg = document.getElementById('prefMsg')
    const notifContainer = document.getElementById('notifToggles')
    const notifStatus = document.getElementById('notifStatus')

    document.getElementById('savePrefBtn').addEventListener('click', async function () {
        const currency = document.getElementById('currency').value
        this.disabled = true; this.textContent = 'Guardando...'
        try { await updateProfile({ currency }); msg.className = 'msg success'; msg.textContent = 'Moneda actualizada a ' + currency + '.'; setTimeout(() => { msg.className = 'msg' }, 3000); this.disabled = false; this.textContent = 'Guardar preferencias' }
        catch (e) { msg.className = 'msg error'; msg.textContent = 'Error: ' + e.message; this.disabled = false; this.textContent = 'Guardar preferencias' }
    })

    document.getElementById('saveGoalsBtn').addEventListener('click', async function () {
        const goals = document.getElementById('goals').value.trim()
        this.disabled = true; this.textContent = 'Guardando...'
        try { await updateProfile({ goals }); msg.className = 'msg success'; msg.textContent = 'Objetivos guardados.'; setTimeout(() => { msg.className = 'msg' }, 3000); this.disabled = false; this.textContent = 'Guardar objetivos' }
        catch (e) { msg.className = 'msg error'; msg.textContent = 'Error: ' + e.message; this.disabled = false; this.textContent = 'Guardar objetivos' }
    })

    // --- Notifications ---

    const prefs = await getNotificationPreferences()
    const descs = {
        task_reminder: 'Tareas pendientes del día',
        debt_reminder: 'Cuotas de deudas por vencer',
        habit_reminder: 'Hábitos que no marcaste hoy',
        calendar_event: 'Eventos del calendario',
        group_invite: 'Invitaciones a grupos'
    }

    for (const type of NOTIF_TYPES) {
        const row = document.createElement('div')
        row.className = 'toggle-row'
        const enabled = prefs[type] !== false
        const toggleId = 'toggle-' + type
        row.innerHTML = `
            <div>
                <div class="toggle-label">${NOTIF_LABELS[type] || type}</div>
                <div class="toggle-desc">${descs[type] || ''}</div>
            </div>
            <button class="toggle-switch${enabled ? ' active' : ''}" id="${toggleId}" data-type="${type}"></button>
        `
        notifContainer.appendChild(row)
        document.getElementById(toggleId).addEventListener('click', async function () {
            const newState = !this.classList.contains('active')
            this.classList.toggle('active', newState)
            try {
                await setNotificationPreference(type, newState)
                notifStatus.textContent = 'Preferencia guardada.'
                notifStatus.style.color = 'var(--accent)'
            } catch (e) {
                this.classList.toggle('active', !newState)
                notifStatus.textContent = 'Error al guardar: ' + e.message
                notifStatus.style.color = '#ff6b6b'
            }
            setTimeout(() => { notifStatus.textContent = '' }, 3000)
        })
    }

    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            const btn = document.createElement('button')
            btn.className = 'btn btn-primary'
            btn.style.cssText = 'padding:0.6rem 1.5rem;font-size:0.9rem;margin-top:1rem;'
            btn.textContent = 'Sincronizar notificaciones'
            btn.addEventListener('click', async () => {
                btn.disabled = true; btn.textContent = 'Sincronizando...'
                try {
                    await subscribeToPush()
                    notifStatus.textContent = 'Notificaciones activadas correctamente.'
                    notifStatus.style.color = 'var(--accent)'
                } catch (e) {
                    notifStatus.textContent = 'Error: ' + e.message
                    notifStatus.style.color = '#ff6b6b'
                }
                btn.disabled = false; btn.textContent = 'Sincronizar notificaciones'
                setTimeout(() => { notifStatus.textContent = '' }, 3000)
            })
            notifContainer.after(btn)
        } else if (Notification.permission === 'default') {
            notifStatus.textContent = 'Hacé clic en cualquier parte para activar las notificaciones.'
        } else {
            notifStatus.textContent = 'Notificaciones bloqueadas. Activálas desde la configuración de tu navegador.'
        }
    } else {
        notifStatus.textContent = 'Tu navegador no soporta notificaciones.'
    }