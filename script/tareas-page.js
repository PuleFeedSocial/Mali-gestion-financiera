    import { requireAuth, getUserProfile, logout } from './auth.js'
    import { getTasks, addTask, updateTaskStatus, updateTask, deleteTask } from './tareas.js'

    const session = await requireAuth()
    if (!session) throw new Error()

    const profile = await getUserProfile()
    if (profile) {
        if (!profile.setup_complete) { window.location.href = 'setup.html'; throw new Error() }
        document.getElementById('userName').textContent = profile.name
        document.getElementById('userAvatar').textContent = profile.name.charAt(0).toUpperCase()
        if (profile.role === 'admin') {
            document.getElementById('adminLabel').style.display = 'block'
            document.getElementById('adminGroup').style.display = 'block'
        }
    }

    const currency = profile?.currency || 'ARS'
    const msg = document.getElementById('tMsg')
    let currentFilter = 'todas'
    function showMsg(text, type) { msg.textContent = text; msg.className = `msg ${type}`; setTimeout(() => { msg.className = 'msg' }, 3500) }

    document.getElementById('fFecha').value = new Date().toISOString().split('T')[0]

    async function cargarTareas() {
        try {
            let tareas
            if (currentFilter === 'todas') {
                tareas = await getTasks()
            } else if (currentFilter === 'realizado') {
                tareas = await getTasks({ status: 'realizado' })
            } else {
                tareas = await getTasks()
                tareas = tareas.filter(t => t.status !== 'realizado')
            }
            renderTareas(tareas)
        } catch (e) { showMsg('Error al cargar tareas.', 'error') }
    }

    function renderTareas(tareas) {
        const tbody = document.getElementById('tasksBody')
        if (!tareas || tareas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay tareas registradas.</td></tr>'
            return
        }
        tbody.innerHTML = tareas.map(t => {
            const fecha = t.date ? new Date(t.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
            const badges = ['por_hacer', 'en_progreso', 'en_pausa', 'realizado'].map(s => {
                const labels = { por_hacer: 'H', en_progreso: 'P', en_pausa: 'Pausa', realizado: 'Hecho' }
                const active = t.status === s
                return `<button class="status-btn${active ? ' active-' + s : ''}" onclick="cambiarEstado(${t.id}, '${s}')" title="${s.replace(/_/g, ' ')}">${labels[s]}</button>`
            }).join('')
            return `<tr>
                <td style="color:var(--text-secondary);font-size:0.8rem;">${fecha}</td>
                <td><span class="badge-tipo ${t.type}">${t.type === 'tarea' ? '📋 Tarea' : '📅 Evento'}</span></td>
                <td>${t.description}</td>
                <td><span class="tag-pill ${t.tag || 'personal'}">${({academic:'📚 Académico', freelance:'💼 Freelance', personal:'🎯 Personal'})[t.tag] || '🎯 Personal'}</span></td>
                <td><div style="display:flex;gap:0.3rem;flex-wrap:wrap;">${badges}</div></td>
                <td style="text-align:right;">
                    <button class="edit-btn" onclick="editarTarea(${t.id}, '${t.tag || 'personal'}', '${t.date}')" title="Editar">✏️</button>
                    <button class="del-btn" onclick="eliminarTarea(${t.id})" title="Eliminar">✕</button>
                </td>
            </tr>`
        }).join('')
    }

    window.cambiarEstado = async function(id, status) {
        try {
            await updateTaskStatus(id, status)
            showMsg('Estado actualizado.', 'success')
            await cargarTareas()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    }

    window.eliminarTarea = async function(id) {
        if (!confirm('¿Eliminar esta tarea?')) return
        try {
            await deleteTask(id)
            showMsg('Tarea eliminada.', 'success')
            await cargarTareas()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    }

    window.editarTarea = async function(id, currentTag, currentDate) {
        const desc = prompt('Nueva descripción:')
        if (!desc || desc.trim() === '') return
        const tag = prompt('Etiqueta (personal, academic, freelance):', currentTag || 'personal')
        if (!tag || !['personal','academic','freelance'].includes(tag)) return
        try {
            await updateTask(id, { date: currentDate, type: 'tarea', description: desc.trim(), tag })
            showMsg('Tarea actualizada.', 'success')
            await cargarTareas()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    }

    document.getElementById('addBtn').addEventListener('click', async () => {
        const date = document.getElementById('fFecha').value
        const type = document.getElementById('fTipo').value
        const description = document.getElementById('fDesc').value.trim()

        if (!date) { showMsg('Seleccioná una fecha.', 'error'); return }
        if (!description) { showMsg('Ingresá una descripción.', 'error'); return }

        try {
            await addTask({ date, type, description, tag: document.getElementById('fTag').value })
            showMsg('Tarea agregada.', 'success')
            document.getElementById('fDesc').value = ''
            document.getElementById('fFecha').value = new Date().toISOString().split('T')[0]
            await cargarTareas()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    })

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
            tab.classList.add('active')
            currentFilter = tab.dataset.filter
            cargarTareas()
        })
    })

    const dd = document.getElementById('userDropdown')
    dd.addEventListener('click', (e) => { if (e.target.closest('.user-dropdown-menu')) return; dd.classList.toggle('open') })
    document.addEventListener('click', (e) => { if (!dd.contains(e.target)) dd.classList.remove('open') })
    document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout() })
    document.getElementById('menuBtn')?.addEventListener('click', () => {
        document.querySelector('.t-sidebar')?.classList.toggle('open')
        document.querySelector('.t-wrapper')?.classList.toggle('overlay')
    })

    await cargarTareas()