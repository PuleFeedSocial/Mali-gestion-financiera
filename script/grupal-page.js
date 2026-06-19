    import { requireAuth, getUserProfile } from './auth.js'
    import { getUserGroups, createGroup, joinGroup } from './grupal.js'

    const session = await requireAuth()
    if (!session) throw new Error()

    // If user already has groups, redirect to group dashboard
    const existing = await getUserGroups()
    if (existing.length > 0) {
        window.location.href = 'dashboard.html'
        throw new Error()
    }

    function showMsg(el, text, type) {
        el.textContent = text
        el.className = `msg ${type}`
    }

    function clearMsg(el) { el.className = 'msg' }

    document.getElementById('joinCode').addEventListener('input', function() {
        this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    })

    document.getElementById('createBtn').addEventListener('click', async () => {
        const name = document.getElementById('createName').value.trim()
        const msgEl = document.getElementById('createMsg')
        clearMsg(msgEl)
        if (!name) { showMsg(msgEl, 'Ingresá un nombre para el equipo.', 'error'); return }
        try {
            const group = await createGroup(name)
            showMsg(msgEl, `¡Espacio "${group.name}" creado! Código: ${group.code}`, 'success')
            document.getElementById('createName').value = ''
        } catch (e) { showMsg(msgEl, e.message, 'error') }
    })

    document.getElementById('joinBtn').addEventListener('click', async () => {
        const code = document.getElementById('joinCode').value.trim()
        const msgEl = document.getElementById('joinMsg')
        clearMsg(msgEl)
        if (!code || code.length < 4) { showMsg(msgEl, 'Ingresá un código de acceso válido.', 'error'); return }
        try {
            const group = await joinGroup(code)
            showMsg(msgEl, `¡Bienvenido a "${group.name}"!`, 'success')
            document.getElementById('joinCode').value = ''
        } catch (e) { showMsg(msgEl, e.message, 'error') }
    })

    document.getElementById('joinCode').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('joinBtn').click()
    })
    document.getElementById('createName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('createBtn').click()
    })