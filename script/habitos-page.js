    import { requireAuth, getUserProfile, logout } from './auth.js'
    import { getHabits, addHabit, toggleHabitDay, deleteHabit } from './habitos.js'

    const session = await requireAuth()
    if (!session) throw new Error()

    const profile = await getUserProfile()
    document.getElementById('userName').textContent = profile?.name || 'Usuario'
    document.getElementById('userAvatar').textContent = (profile?.name || 'U').charAt(0).toUpperCase()
    if (profile?.role === 'admin') {
        document.getElementById('adminLabel').style.display = 'block'
        document.getElementById('adminGroup').style.display = 'block'
    }

    const dd = document.getElementById('userDropdown')
    dd.addEventListener('click', (e) => { if (!e.target.closest('.user-dropdown-menu')) dd.classList.toggle('open') })
    document.addEventListener('click', (e) => { if (!dd.contains(e.target)) dd.classList.remove('open') })
    document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout() })

    document.getElementById('menuBtn')?.addEventListener('click', () => {
        document.querySelector('.app-sidebar')?.classList.toggle('open')
        document.querySelector('.app-wrapper')?.classList.toggle('overlay')
    })

    const msg = document.getElementById('hMsg')
    function showMsg(text, type) { msg.textContent = text; msg.className = `msg ${type}`; setTimeout(() => { msg.className = 'msg' }, 3000) }

    const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

    async function cargarHabitos() {
        try {
            const habits = await getHabits()
            renderHabitos(habits)
        } catch (e) { showMsg('Error al cargar hábitos.', 'error') }
    }

    function renderHabitos(habits) {
        const list = document.getElementById('habitsList')
        const empty = document.getElementById('emptyState')
        if (!habits.length) {
            list.innerHTML = ''
            empty.style.display = 'block'
            return
        }
        empty.style.display = 'none'
        list.innerHTML = habits.map(h => `
            <div class="habit-row" data-id="${h.id}">
                <div class="habit-left">
                    <div class="habit-name">
                        <span class="habit-icon">${h.icon}</span>
                        ${h.name}
                    </div>
                    <div class="habit-streak">
                        <span class="fire">🔥</span>
                        Racha: ${h.racha} días
                    </div>
                </div>
                <div class="habit-tracker">
                    ${dayLabels.map((label, i) => {
                        const day = h.days[i]
                        const cls = day.isFuture ? 'day-future' : (day.done ? 'day-done' : 'day-empty')
                        return `<div class="day-cell ${cls}" data-habit-id="${h.id}" data-date="${day.date}" data-done="${day.done}" title="${day.date}">${cls === 'day-done' ? '' : ''}</div>`
                    }).join('')}
                </div>
                <div class="habit-actions">
                    <button class="del-habit" onclick="eliminarHabit(${h.id})" title="Eliminar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('')

        document.querySelectorAll('.day-cell.day-empty, .day-cell.day-done').forEach(cell => {
            if (cell.classList.contains('day-future')) return
            cell.addEventListener('click', async () => {
                const habitId = parseInt(cell.dataset.habitId)
                const date = cell.dataset.date
                const wasDone = cell.dataset.done === 'true'
                try {
                    await toggleHabitDay(habitId, date, !wasDone)
                    await cargarHabitos()
                } catch (e) { showMsg('Error al actualizar.', 'error') }
            })
        })
    }

    window.eliminarHabit = async function(id) {
        if (!confirm('¿Eliminar este hábito?')) return
        try {
            await deleteHabit(id)
            showMsg('Hábito eliminado.', 'success')
            await cargarHabitos()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    }

    function openModal() {
        document.getElementById('modalTitle').textContent = 'Nuevo hábito'
        document.getElementById('mName').value = ''
        document.getElementById('mIcon').value = '💧'
        document.getElementById('modalOverlay').classList.add('open')
        setTimeout(() => document.getElementById('mName').focus(), 100)
    }

    document.getElementById('newHabitBtn').addEventListener('click', openModal)
    document.getElementById('emptyCta').addEventListener('click', openModal)

    document.getElementById('mSaveBtn').addEventListener('click', async () => {
        const name = document.getElementById('mName').value.trim()
        const icon = document.getElementById('mIcon').value
        if (!name) { showMsg('Ingresá un nombre para el hábito.', 'error'); return }
        try {
            await addHabit(name, icon)
            showMsg('Hábito creado.', 'success')
            document.getElementById('modalOverlay').classList.remove('open')
            await cargarHabitos()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    })

    document.getElementById('mCancelBtn').addEventListener('click', () => document.getElementById('modalOverlay').classList.remove('open'))
    document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) document.getElementById('modalOverlay').classList.remove('open') })
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('modalOverlay').classList.remove('open') })

    await cargarHabitos()