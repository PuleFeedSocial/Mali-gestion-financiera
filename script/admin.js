    import { requireAuth, getUserProfile, supabase, logout } from './auth.js'

    const session = await requireAuth()
    if (!session) throw new Error()

    const profile = await getUserProfile()
    if (!profile || profile.role !== 'admin') {
        window.location.href = 'dashboard.html'
        throw new Error()
    }

    document.getElementById('userName').textContent = profile.name
    document.getElementById('userAvatar').textContent = profile.name.charAt(0).toUpperCase()

    const dd = document.getElementById('userDropdown')
    dd.addEventListener('click', (e) => {
        if (e.target.closest('.user-dropdown-menu')) return
        dd.classList.toggle('open')
    })
    document.addEventListener('click', (e) => {
        if (!dd.contains(e.target)) dd.classList.remove('open')
    })

    const msg = document.getElementById('adminMsg')
    function showMsg(text, type) {
        msg.textContent = text
        msg.className = `msg ${type}`
        setTimeout(() => { msg.className = 'msg' }, 4000)
    }

    async function cargarUsuarios() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) { showMsg('Error al cargar usuarios: ' + error.message, 'error'); return }

        const tbody = document.getElementById('usersBody')
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:2rem;">No hay usuarios registrados.</td></tr>'
            return
        }

        tbody.innerHTML = data.map(u => {
            const fecha = new Date(u.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
            return `<tr>
                <td>${u.name}</td>
                <td style="color:var(--text-secondary);font-size:0.8rem;">${u.email || '-'}</td>
                <td><span class="badge-role ${u.role}">${u.role}</span></td>
                <td style="color:var(--text-secondary);font-size:0.8rem;">${fecha}</td>
                <td>
                    ${u.role === 'admin'
                        ? (profile.id !== u.id ? '<button class="small-btn" onclick="cambiarRol(\'' + u.id + '\',\'user\')">Hacer user</button>' : '<span style="font-size:0.7rem;color:var(--text-secondary);">(vos)</span>')
                        : '<button class="small-btn" onclick="cambiarRol(\'' + u.id + '\',\'admin\')">Hacer admin</button>'
                    }
                </td>
            </tr>`
        }).join('')
    }

    window.cambiarRol = async function(userId, nuevoRol) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: nuevoRol })
                .eq('id', userId)

            if (error) throw error
            showMsg(`Rol actualizado a ${nuevoRol}.`, 'success')
            await cargarUsuarios()
        } catch (e) {
            showMsg('Error al cambiar rol: ' + e.message, 'error')
        }
    }

    async function cargarCodigos() {
        const { data, error } = await supabase
            .from('activation_codes')
            .select('*, profiles!activation_codes_used_by_fkey(name)')
            .order('created_at', { ascending: false })

        if (error) { showMsg('Error al cargar códigos: ' + error.message, 'error'); return }

        const tbody = document.getElementById('codesBody')
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:2rem;">No hay códigos generados.</td></tr>'
            return
        }

        tbody.innerHTML = data.map(c => {
            const fecha = new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
            const usado = c.used
            const usadoPor = usado && c.profiles ? c.profiles.name : (usado ? '(desconocido)' : '-')
            return `<tr>
                <td><span class="badge-code">${c.code}</span></td>
                <td>${usado ? '<span class="badge-used">● Usado</span>' : '<span class="badge-available">● Disponible</span>'}</td>
                <td style="color:var(--text-secondary);font-size:0.8rem;">${usadoPor}</td>
                <td style="color:var(--text-secondary);font-size:0.8rem;">${fecha}</td>
                <td><button class="small-btn danger" onclick="eliminarCodigo('${c.id}')">Eliminar</button></td>
            </tr>`
        }).join('')
    }

    window.eliminarCodigo = async function(codeId) {
        if (!confirm('¿Eliminar este código de activación?')) return
        try {
            const { error } = await supabase
                .from('activation_codes')
                .delete()
                .eq('id', codeId)
            if (error) throw error
            showMsg('Código eliminado.', 'success')
            await cargarCodigos()
        } catch (e) {
            showMsg('Error al eliminar: ' + e.message, 'error')
        }
    }

    document.getElementById('genBtn').addEventListener('click', async () => {
        const cantidad = parseInt(document.getElementById('genCantidad').value) || 1
        const codigos = []

        for (let i = 0; i < cantidad; i++) {
            const buf = new Uint32Array(1); crypto.getRandomValues(buf); const code = String(100000 + (buf[0] % 900000))
            codigos.push({ code })
        }

        try {
            const { error } = await supabase.from('activation_codes').insert(codigos)
            if (error) throw error
            showMsg(`${cantidad} código(s) generado(s).`, 'success')
            await cargarCodigos()
        } catch (e) {
            showMsg('Error al generar: ' + e.message, 'error')
        }
    })

    document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout() })
    document.getElementById('menuBtn')?.addEventListener('click', () => {
        document.querySelector('.admin-sidebar')?.classList.toggle('open')
        document.querySelector('.admin-wrapper')?.classList.toggle('overlay')
    })

    await cargarUsuarios()
    await cargarCodigos()