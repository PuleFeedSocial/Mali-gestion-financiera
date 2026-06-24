    import { requireAuth, getUserProfile, logout, formatCurrency } from './auth.js'
    import { getBalance, addDebt, getDebts, payInstallment, updateDebtStatus, deleteDebt } from './finanzas.js'

    const session = await requireAuth()
    if (!session) throw new Error()

    const profile = await getUserProfile()
    const currency = profile?.currency || 'ARS'
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


    const fm = n => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const msg = document.getElementById('dMsg')
    function showMsg(text, type) { msg.textContent = text; msg.className = `msg ${type}`; setTimeout(() => { msg.className = 'msg' }, 3500) }

    document.getElementById('fFecha').value = new Date().toISOString().split('T')[0]

    async function cargarResumen() {
        const balance = await getBalance(currency)
        if (balance) {
            document.getElementById('porCobrar').textContent = `${formatCurrency(balance.por_cobrar, currency)}`
            document.getElementById('porPagar').textContent = `${formatCurrency(balance.por_pagar, currency)}`
        }
    }

    function marcarVencidas(deudas) {
        const hoy = new Date()
        deudas.forEach(d => {
            if (d.status === 'pendiente' && new Date(d.due_date + 'T23:59:59') < hoy) {
                d.vencida = true
            }
        })
        return deudas
    }

    async function cargarDeudas() {
        const todas = await getDebts()
        const conVencidas = marcarVencidas(todas)
        const pendientes = conVencidas.filter(d => d.status === 'pendiente' && !d.vencida)
        const vencidas = conVencidas.filter(d => d.status === 'pendiente' && d.vencida)
        document.getElementById('pendientesCount').textContent = pendientes.length
        document.getElementById('vencidasCount').textContent = vencidas.length

        const filtro = document.getElementById('filtroEstado').value
        let filtradas = conVencidas
        if (filtro === 'pendiente') filtradas = conVencidas.filter(d => d.status === 'pendiente' && !d.vencida)
        else if (filtro === 'vencidas') filtradas = conVencidas.filter(d => d.status === 'pendiente' && d.vencida)
        else if (filtro !== 'todas') filtradas = conVencidas.filter(d => d.status === filtro)

        renderDeudas(filtradas)
    }

    function renderDeudas(deudas) {
        const tbody = document.getElementById('deudasBody')
        if (!deudas.length) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-secondary);padding:2rem;">No hay deudas registradas.</td></tr>'
            return
        }
        tbody.innerHTML = deudas.map(d => {
            const fmtDate = (str) => {
                if (!str) return '-'
                const p = str.split('-')
                return `${p[2]}/${p[1]}/${p[0]}`
            }
            const vence = d.due_date ? fmtDate(d.due_date) : '-'
            const ingreso = d.created_at ? fmtDate(d.created_at.split('T')[0]) : '-'
            const proxCobro = d.next_payment_date ? fmtDate(d.next_payment_date) : (d.status === 'pendiente' && d.installments > 1 ? vence : '-')
            const cls = d.type === 'por_cobrar' ? 'cobrar' : 'pagar'
            const signo = d.type === 'por_cobrar' ? '+' : '-'
            const estadoCls = d.vencida ? 'vencida' : d.status
            const estadoTxt = d.vencida ? 'Vencida' : { pendiente: 'Pendiente', cobrado: 'Cobrada', pagado: 'Pagada', cancelado: 'Cancelada' }[d.status]

            const totalAmt = Number(d.total_amount) || Number(d.amount)
            const inst = Number(d.installments) || 1
            const paid = Number(d.installments_paid) || 0
            const pct = inst > 0 ? Math.round(paid / inst * 100) : 0

            let acciones = '<div class="action-group">'
            if (d.status === 'pendiente' && paid < inst) {
                acciones += `<button class="action-btn pay-btn" onclick="pagarCuota(${d.id})">${d.type === 'por_cobrar' ? 'Cobrar' : 'Pagar'}</button>`
                if (paid === 0) {
                    acciones += `<button class="action-btn cancel-svg" onclick="cancelar(${d.id})" title="Cancelar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                    </button>`
                }
            }
            acciones += `<button class="action-btn delete-svg" onclick="eliminar(${d.id})" title="Eliminar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
            </button>`
            acciones += '</div>'

            return `<tr>
                <td style="color:var(--text-secondary);font-size:0.8rem;">${ingreso}</td>
                <td style="color:${d.vencida ? '#ff6b6b' : 'var(--text-secondary)'};font-size:0.85rem;">${vence}</td>
                <td style="color:var(--text-muted);font-size:0.8rem;">${proxCobro}</td>
                <td>${d.type === 'por_cobrar' ? '💰 Cobrar' : '💸 Pagar'}</td>
                <td>${d.debtor}</td>
                <td style="color:var(--text-secondary);font-size:0.8rem;">${d.description || '-'}</td>
                <td class="monto ${cls}">${signo}${formatCurrency(totalAmt, currency)}</td>
                <td>
                    <div class="progress-micro">
                        <div class="bar"><div class="fill ${pct >= 100 ? 'complete' : 'partial'}" style="width:${pct}%"></div></div>
                        <span class="label">${paid}/${inst}</span>
                    </div>
                </td>
                <td class="monto ${cls}">${signo}${formatCurrency(inst > 1 ? totalAmt / inst : totalAmt, currency)}</td>
                <td><span class="status-pill ${estadoCls}"><span class="dot"></span>${estadoTxt}</span></td>
                <td>${acciones}</td>
            </tr>`
        }).join('')
    }

    window.pagarCuota = async function(id) {
        try {
            await payInstallment(id)
            showMsg('Cuota registrada.', 'success')
            await Promise.all([cargarResumen(), cargarDeudas()])
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    }

    window.cancelar = async function(id) {
        if (!confirm('¿Cancelar esta deuda?')) return
        try {
            await updateDebtStatus(id, 'cancelado')
            showMsg('Deuda cancelada.', 'success')
            await Promise.all([cargarResumen(), cargarDeudas()])
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    }

    window.eliminar = async function(id) {
        if (!confirm('¿Eliminar esta deuda permanentemente?')) return
        try {
            await deleteDebt(id)
            showMsg('Deuda eliminada.', 'success')
            await Promise.all([cargarResumen(), cargarDeudas()])
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    }

    document.getElementById('addBtn').addEventListener('click', async () => {
        const tipo = document.getElementById('fTipo').value
        const debtor = document.getElementById('fDeudor').value.trim()
        const amount = parseFloat(document.getElementById('fMonto').value)
        const cuotas = parseInt(document.getElementById('fCuotas').value) || 1
        const description = document.getElementById('fDesc').value.trim()
        const dueDate = document.getElementById('fFecha').value

        if (!debtor) { showMsg('Ingresá el nombre de la persona o entidad.', 'error'); return }
        if (!amount || amount <= 0) { showMsg('Ingresá un monto válido.', 'error'); return }
        if (cuotas < 1) { showMsg('Las cuotas deben ser al menos 1.', 'error'); return }
        if (!dueDate) { showMsg('Seleccioná una fecha.', 'error'); return }

        try {
            await addDebt({ type: tipo, debtor, amount, description, dueDate, installments: cuotas })
            showMsg('Deuda registrada.', 'success')
            document.getElementById('fDeudor').value = ''
            document.getElementById('fMonto').value = ''
            document.getElementById('fCuotas').value = '1'
            document.getElementById('fDesc').value = ''
            document.getElementById('fFecha').value = new Date().toISOString().split('T')[0]
            await Promise.all([cargarResumen(), cargarDeudas()])
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    })

    document.getElementById('filtroEstado').addEventListener('change', cargarDeudas)

    try { await Promise.all([cargarResumen(), cargarDeudas()]) } catch (e) { showMsg('Error al cargar: ' + e.message, 'error') }