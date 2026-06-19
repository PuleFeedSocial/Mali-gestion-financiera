    import { requireAuth, getUserProfile, logout, formatCurrency } from './auth.js'
    import { getBalance, addTransaction, getTransactions, deleteTransaction, processScheduled } from './finanzas.js'

    const session = await requireAuth()
    if (!session) throw new Error()

    const profile = await getUserProfile()
    const currency = profile?.currency || 'ARS'
    if (profile) {
        if (!profile.setup_complete) { window.location.href = 'setup.html'; throw new Error() }
        document.getElementById('userName').textContent = profile.name
        document.getElementById('userAvatar').textContent = profile.name.charAt(0).toUpperCase()
        if (profile.role === 'admin') {
            document.getElementById('adminLabel').style.display = 'block'
            document.getElementById('adminGroup').style.display = 'block'
        }
    }

    const msg = document.getElementById('msg')
    function showMsg(text, type) { msg.textContent = text; msg.className = `msg ${type}`; setTimeout(() => { msg.className = 'msg' }, 4000) }

    const subtipos = {
        ingreso: [{ v: 'fijo', t: 'Fijo' }, { v: 'instantaneo', t: 'Instantáneo' }],
        gasto: [{ v: 'fijo', t: 'Fijo' }, { v: 'variable', t: 'Variable' }, { v: 'hormiga', t: 'Hormiga' }]
    }

    const fTipo = document.getElementById('fTipo')
    const fSubtipo = document.getElementById('fSubtipo')
    const fMonto = document.getElementById('fMonto')
    const fDesc = document.getElementById('fDesc')
    const fFecha = document.getElementById('fFecha')
    const fDia = document.getElementById('fDia')
    const dayField = document.getElementById('dayField')

    function actualizarSubtipos() {
        const tipo = fTipo.value
        fSubtipo.innerHTML = ''
        subtipos[tipo].forEach(s => {
            const opt = document.createElement('option')
            opt.value = s.v; opt.textContent = s.t
            fSubtipo.appendChild(opt)
        })
        toggleDayField()
    }
    function toggleDayField() { dayField.classList.toggle('visible', fSubtipo.value === 'fijo') }
    fTipo.addEventListener('change', actualizarSubtipos)
    fSubtipo.addEventListener('change', toggleDayField)
    fFecha.value = new Date().toISOString().split('T')[0]
    actualizarSubtipos()

    let movimientos = []
    let filteredMovimientos = []
    let editingId = null
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

    async function cargarDatos() {
        try {
            const balance = await getBalance(currency)
            if (balance) {
                document.getElementById('totalIngresos').textContent = formatCurrency(balance.ingresos, currency)
                document.getElementById('totalGastos').textContent = formatCurrency(balance.gastos, currency)
                document.getElementById('porCobrar').textContent = formatCurrency(balance.por_cobrar, currency)
                document.getElementById('porPagar').textContent = formatCurrency(balance.por_pagar, currency)
                const bEl = document.getElementById('totalBalance')
                bEl.textContent = formatCurrency(balance.balance, currency)
            }
            await processScheduled()
            const movs = await getTransactions({ limit: 100 })
            movimientos = movs
            populateMonthFilter()
            aplicarFiltros()
        } catch (e) { showMsg('Error al cargar datos.', 'error') }
    }

    function populateMonthFilter() {
        const select = document.getElementById('filterMonth')
        const meses = new Set()
        movimientos.forEach(m => {
            if (m.date) meses.add(m.date.slice(0, 7))
        })
        const ordenado = [...meses].sort().reverse()
        select.innerHTML = '<option value="">Todos los meses</option>'
        ordenado.forEach(ym => {
            const [y, m] = ym.split('-').map(Number)
            const opt = document.createElement('option')
            opt.value = ym
            opt.textContent = `${monthNames[m - 1]} ${y}`
            select.appendChild(opt)
        })
    }

    function aplicarFiltros() {
        const search = document.getElementById('searchInput').value.toLowerCase().trim()
        const month = document.getElementById('filterMonth').value
        const type = document.getElementById('filterType').value
        filteredMovimientos = movimientos.filter(m => {
            if (search && !(m.description || '').toLowerCase().includes(search)) return false
            if (month && (!m.date || !m.date.startsWith(month))) return false
            if (type && m.type !== type) return false
            return true
        })
        renderMovimientos(filteredMovimientos)
    }

    document.getElementById('searchInput').addEventListener('input', aplicarFiltros)
    document.getElementById('filterMonth').addEventListener('change', aplicarFiltros)
    document.getElementById('filterType').addEventListener('change', aplicarFiltros)

    function renderMovimientos(movs) {
        const tbody = document.getElementById('movBody')
        const empty = document.getElementById('emptyState')
        document.getElementById('filterCount').textContent = `${movs.length} movimiento${movs.length !== 1 ? 's' : ''}`
        if (!movs || movs.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return }
        empty.style.display = 'none'
        tbody.innerHTML = movs.map(m => {
            const fecha = new Date(m.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
            const signo = m.type === 'ingreso' ? '+' : '-'
            const cls = m.type === 'ingreso' ? 'ing' : 'gas'
            return `<tr>
                <td style="color:var(--text-muted);font-size:0.8rem;">${fecha}</td>
                <td><span class="badge ${m.subtype}">${m.subtype}</span></td>
                <td style="color:var(--text-muted);">${m.type === 'ingreso' ? '💰 Ingreso' : '💸 Gasto'}</td>
                <td>${m.description}</td>
                <td class="monto ${cls}">${signo}${formatCurrency(m.amount, currency)}</td>
                <td>
                    <div class="action-group">
                        <button class="action-btn edit" data-id="${m.id}" title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="action-btn delete" data-id="${m.id}" title="Eliminar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>`
        }).join('')
        tbody.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('¿Eliminar este movimiento?')) return
                try { await deleteTransaction(btn.dataset.id); showMsg('Movimiento eliminado.', 'success'); await cargarDatos() }
                catch (e) { showMsg('Error al eliminar.', 'error') }
            })
        })
        tbody.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', () => editarMovimiento(Number(btn.dataset.id)))
        })
    }

    document.getElementById('menuBtn')?.addEventListener('click', () => {
        document.querySelector('.fp-sidebar')?.classList.toggle('open')
        document.querySelector('.fp-wrapper')?.classList.toggle('overlay')
    })
    document.querySelector('.fp-wrapper')?.addEventListener('click', (e) => {
        if (e.target === document.querySelector('.fp-wrapper') || (e.target.classList.contains('fp-wrapper') && window.innerWidth <= 768)) {
            document.querySelector('.fp-sidebar')?.classList.remove('open')
            document.querySelector('.fp-wrapper')?.classList.remove('overlay')
        }
    })

    function editarMovimiento(id) {
        const m = movimientos.find(x => x.id === id)
        if (!m) return
        editingId = id
        fTipo.value = m.type
        actualizarSubtipos()
        fSubtipo.value = m.subtype
        fMonto.value = m.amount
        fDesc.value = m.description
        fFecha.value = m.date
        document.getElementById('addBtn').textContent = 'Actualizar'
        document.getElementById('addBtn').scrollIntoView({ behavior: 'smooth' })
    }

    document.getElementById('addBtn').addEventListener('click', async () => {
        const tipo = fTipo.value; const subtype = fSubtipo.value
        const amount = parseFloat(fMonto.value); const description = fDesc.value.trim()
        const date = fFecha.value; const dayOfMonth = subtype === 'fijo' ? parseInt(fDia.value) : null
        if (!amount || amount <= 0) { showMsg('Ingresá un monto válido.', 'error'); return }
        if (!description) { showMsg('Ingresá una descripción.', 'error'); return }
        if (subtype === 'fijo' && (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31)) { showMsg('Día del mes inválido (1-31).', 'error'); return }
        try {
            if (editingId) {
                showMsg('Editar disponible próximamente. Eliminá el movimiento y creá uno nuevo.', 'success')
                editingId = null
                document.getElementById('addBtn').textContent = 'Agregar'
            } else {
                await addTransaction({ type: tipo, subtype, amount, description, date, dayOfMonth })
                showMsg('Movimiento registrado.', 'success')
            }
            fMonto.value = ''; fDesc.value = ''; fFecha.value = new Date().toISOString().split('T')[0]; if (fDia) fDia.value = ''
            await cargarDatos()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    })

    const dd = document.getElementById('userDropdown')
    dd.addEventListener('click', (e) => {
        if (e.target.closest('.user-dropdown-menu')) return
        dd.classList.toggle('open')
    })
    document.addEventListener('click', (e) => {
        if (!dd.contains(e.target)) dd.classList.remove('open')
    })
    document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout() })
    await cargarDatos()