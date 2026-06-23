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

    let currentMonth = new Date().getMonth()
    let currentYear = new Date().getFullYear()
    let allTasks = []
    let editingTaskId = null
    let selectedDate = null

    const msg = document.getElementById('cMsg')
    function showMsg(text, type) { msg.textContent = text; msg.className = `msg ${type}`; setTimeout(() => { msg.className = 'msg' }, 3500) }

    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const dayHeaders = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
    const tagLabels = { academic:'📚 Académico', freelance:'💼 Freelance', personal:'🎯 Personal' }
    const statusLabels = { por_hacer:'📌 Pendiente', en_progreso:'🔄 En progreso', en_pausa:'⏸ Pausa', realizado:'✅ Hecho' }

    function populateSelects() {
        const ms = document.getElementById('monthSelect')
        ms.innerHTML = monthNames.map((m, i) => `<option value="${i}">${m}</option>`).join('')
        ms.value = currentMonth
        const ys = document.getElementById('yearSelect')
        const y = new Date().getFullYear()
        ys.innerHTML = ''
        for (let i = y - 10; i <= y + 10; i++) {
            const opt = document.createElement('option')
            opt.value = i; opt.textContent = i
            if (i === currentYear) opt.selected = true
            ys.appendChild(opt)
        }
    }

    async function cargarTareas() {
        try {
            allTasks = await getTasks()
            renderCalendario()
            if (selectedDate) showAgenda(selectedDate)
        } catch (e) { showMsg('Error al cargar tareas.', 'error') }
    }

    function renderCalendario() {
        const firstDay = new Date(currentYear, currentMonth, 1)
        const lastDay = new Date(currentYear, currentMonth + 1, 0)
        const daysInMonth = lastDay.getDate()
        let startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
        const todayStr = new Date().toISOString().split('T')[0]

        document.getElementById('monthYearLabel').textContent = `${monthNames[currentMonth]} ${currentYear}`
        document.getElementById('monthSelect').value = currentMonth
        document.getElementById('yearSelect').value = currentYear

        const grid = document.getElementById('calGrid')
        grid.innerHTML = dayHeaders.map(d => `<div class="cal-header">${d}</div>`).join('')

        const prevMonth = new Date(currentYear, currentMonth, 0)
        const prevDays = prevMonth.getDate()
        for (let i = startDay - 1; i >= 0; i--) {
            const d = prevDays - i
            const pm = currentMonth === 0 ? 12 : currentMonth; const py = currentMonth === 0 ? currentYear - 1 : currentYear; const dateStr = `${py}-${String(pm).padStart(2,'0')}-${String(d).padStart(2,'0')}`
            grid.appendChild(createDayCell(d, dateStr, true, todayStr))
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
            grid.appendChild(createDayCell(d, dateStr, false, todayStr))
        }
        const totalCells = startDay + daysInMonth
        const remaining = (7 - (totalCells % 7)) % 7
        for (let d = 1; d <= remaining; d++) {
            const nm = currentMonth === 11 ? 1 : currentMonth + 2; const ny = currentMonth === 11 ? currentYear + 1 : currentYear; const dateStr = `${ny}-${String(nm).padStart(2,'0')}-${String(d).padStart(2,'0')}`
            grid.appendChild(createDayCell(d, dateStr, true, todayStr))
        }
    }

    function createDayCell(dayNum, dateStr, other, todayStr) {
        const div = document.createElement('div')
        div.className = 'cal-day' + (other ? ' other-month' : '') + (dateStr === todayStr ? ' today' : '') + (dateStr === selectedDate ? ' selected' : '')
        div.innerHTML = `<div class="day-num">${dayNum}</div>`
        div.dataset.date = dateStr

        const tasks = allTasks.filter(t => t.date === dateStr)
        const visible = tasks.slice(0, 3)
        const extra = tasks.length - 3

        visible.forEach(t => {
            const span = document.createElement('div')
            span.className = `cal-task tag-${t.tag || 'personal'}${t.status === 'realizado' ? ' done' : ''}`
            span.textContent = t.description
            span.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(t) })
            div.appendChild(span)
        })
        if (extra > 0) {
            const more = document.createElement('span')
            more.className = 'more-link'
            more.textContent = `+${extra} más`
            more.addEventListener('click', (e) => { e.stopPropagation(); showAgenda(dateStr) })
            div.appendChild(more)
        }
        div.addEventListener('click', () => showAgenda(dateStr))
        return div
    }

    function showAgenda(dateStr) {
        selectedDate = dateStr
        document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'))
        const dayEl = document.querySelector(`.cal-day[data-date="${dateStr}"]`)
        if (dayEl) dayEl.classList.add('selected')

        const parts = dateStr.split('-')
        const d = new Date(parts[0], parts[1] - 1, parts[2])
        const dateLabel = `${d.getDate()} de ${monthNames[d.getMonth()]}`
        document.getElementById('agendaHeader').textContent = `📅 Agenda: ${dateLabel}`
        document.getElementById('agendaSub').innerHTML = `<span class="tag-pill ${allTasks.find(t=>t.date===dateStr)?.tag||'personal'}" style="font-size:0.7rem;">${allTasks.filter(t=>t.date===dateStr).length} actividades</span>`

        const list = document.getElementById('agendaList')
        const dayTasks = allTasks.filter(t => t.date === dateStr)

        if (!dayTasks.length) {
            list.innerHTML = `<div class="agenda-empty">No hay actividades para este día.<br><button class="small-btn" onclick="openAddModal('${dateStr}')" style="margin-top:0.8rem;">+ Agregar</button></div>`
            return
        }

        list.innerHTML = dayTasks.map(t => `
            <div class="agenda-item" onclick="openEditModal(${JSON.stringify(t).replace(/"/g,'&quot;')})">
                <div class="item-title">
                    <span class="status-dot ${t.status}"></span>
                    ${t.type === 'evento' ? '📅' : '📋'} ${t.description}
                </div>
                <div class="item-meta">
                    <span class="tag-pill ${t.tag || 'personal'}">${tagLabels[t.tag] || '🎯 Personal'}</span>
                    <span>${statusLabels[t.status] || '📌 Pendiente'}</span>
                </div>
                <div class="item-actions">
                    ${['por_hacer','en_progreso','en_pausa','realizado'].map(s =>
                        `<button class="small-btn ${t.status === s ? 'active' : ''}" onclick="event.stopPropagation();cambiarEstado(${t.id},'${s}')">${({por_hacer:'H',en_progreso:'P',en_pausa:'Pausa',realizado:'Hecho'})[s]}</button>`
                    ).join('')}
                    <button class="small-btn danger" onclick="event.stopPropagation();eliminarTarea(${t.id})" style="margin-left:auto;">✕</button>
                </div>
            </div>
        `).join('')
    }

    function openAddModal(dateStr) {
        editingTaskId = null
        document.getElementById('modalTitle').textContent = 'Nueva actividad'
        document.getElementById('mFecha').value = dateStr || new Date().toISOString().split('T')[0]
        document.getElementById('mTipo').value = 'tarea'
        document.getElementById('mDesc').value = ''
        document.getElementById('mTag').value = 'personal'
        document.getElementById('mSaveBtn').textContent = 'Guardar'
        document.getElementById('modalOverlay').classList.add('open')
        setTimeout(() => document.getElementById('mDesc').focus(), 100)
    }

    function openEditModal(task) {
        editingTaskId = task.id
        document.getElementById('modalTitle').textContent = 'Editar actividad'
        document.getElementById('mFecha').value = task.date
        document.getElementById('mTipo').value = task.type
        document.getElementById('mDesc').value = task.description
        document.getElementById('mTag').value = task.tag || 'personal'
        document.getElementById('mSaveBtn').textContent = 'Actualizar'
        document.getElementById('modalOverlay').classList.add('open')
        setTimeout(() => document.getElementById('mDesc').focus(), 100)
    }

    window.openAddModal = openAddModal

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

    document.getElementById('mSaveBtn').addEventListener('click', async () => {
        const date = document.getElementById('mFecha').value
        const type = document.getElementById('mTipo').value
        const desc = document.getElementById('mDesc').value.trim()
        const tag = document.getElementById('mTag').value
        if (!desc) { showMsg('Ingresá una descripción.', 'error'); return }
        try {
            if (editingTaskId) {
                await updateTask(editingTaskId, { date, type, description: desc, tag })
                showMsg('Actividad actualizada.', 'success')
            } else {
                await addTask({ date, type, description: desc, tag })
                showMsg('Actividad agregada.', 'success')
            }
            document.getElementById('modalOverlay').classList.remove('open')
            await cargarTareas()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    })

    document.getElementById('mCancelBtn').addEventListener('click', () => document.getElementById('modalOverlay').classList.remove('open'))
    document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) document.getElementById('modalOverlay').classList.remove('open') })
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('modalOverlay').classList.remove('open') })

    document.getElementById('prevMonth').addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear-- } renderCalendario() })
    document.getElementById('nextMonth').addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++ } renderCalendario() })
    document.getElementById('monthSelect').addEventListener('change', (e) => { currentMonth = parseInt(e.target.value); renderCalendario() })
    document.getElementById('yearSelect').addEventListener('change', (e) => { currentYear = parseInt(e.target.value); renderCalendario() })
    document.getElementById('todayBtn').addEventListener('click', () => { const n = new Date(); currentMonth = n.getMonth(); currentYear = n.getFullYear(); renderCalendario(); showAgenda(new Date().toISOString().split('T')[0]) })
    document.getElementById('newEventBtn').addEventListener('click', () => openAddModal(new Date().toISOString().split('T')[0]))

    const dd = document.getElementById('userDropdown')
    dd.addEventListener('click', (e) => { if (e.target.closest('.user-dropdown-menu')) return; dd.classList.toggle('open') })
    document.addEventListener('click', (e) => { if (!dd.contains(e.target)) dd.classList.remove('open') })
    document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout() })
    document.getElementById('menuBtn')?.addEventListener('click', () => {
        document.querySelector('.app-sidebar')?.classList.toggle('open')
        document.querySelector('.app-wrapper')?.classList.toggle('overlay')
    })

    populateSelects()
    await cargarTareas()
    // Show today's agenda on load
    showAgenda(new Date().toISOString().split('T')[0])