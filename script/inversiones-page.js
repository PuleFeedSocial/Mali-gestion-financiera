    import { requireAuth, getUserProfile, logout, formatCurrency } from './auth.js'
    import { getInvestments, addInvestment, liquidateInvestment, claimInterest, deleteInvestment } from './inversiones.js'

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

    document.getElementById('menuBtn')?.addEventListener('click', () => {
        document.querySelector('.i-sidebar')?.classList.toggle('open')
        document.querySelector('.i-wrapper')?.classList.toggle('overlay')
    })

    const msg = document.getElementById('iMsg')
    function showMsg(text, type) { msg.textContent = text; msg.className = `msg ${type}`; setTimeout(() => { msg.className = 'msg' }, 3500) }

    const hoy = new Date()
    document.getElementById('fFecha').value = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate()).toISOString().split('T')[0]
    document.getElementById('fStartDate').value = hoy.toISOString().split('T')[0]

    const typeLabels = {
        plazo_fijo: 'Plazo Fijo', fondos: 'Fondos', cripto: 'Cripto',
        acciones: 'Acciones', bonos: 'Bonos', otros: 'Otros'
    }

    async function cargarInversiones() {
        try {
            const todas = await getInvestments()
            const activas = todas.filter(i => i.status === 'activo')

            const capitalTotal = activas.reduce((s, i) => s + Number(i.capital), 0)
            document.getElementById('capitalInvertido').textContent = formatCurrency(capitalTotal, currency)
            document.getElementById('activosCount').textContent = activas.length

            const rendimiento = activas.reduce((s, i) => s + (Number(i.capital) * Number(i.interest_rate) / 100), 0)
            document.getElementById('rendimiento').textContent = formatCurrency(rendimiento, currency)

            const filtro = document.getElementById('filtroEstado').value
            const filtradas = filtro ? todas.filter(i => i.status === filtro) : todas
            renderTabla(filtradas)
        } catch (e) { showMsg('Error al cargar inversiones.', 'error') }
    }

    function renderTabla(inversiones) {
        const tbody = document.getElementById('invBody')
        if (!inversiones.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:2rem;">No hay inversiones registradas.</td></tr>'
            return
        }
        tbody.innerHTML = inversiones.map(i => {
            const capital = Number(i.capital)
            const tasa = Number(i.interest_rate)
            const interes = Number(i.accumulated_interest) || 0
            const endDate = i.end_date ? new Date(i.end_date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

            let acciones = '<div class="action-group">'
            if (i.status === 'activo') {
                if (interes > 0) {
                    acciones += `<button class="action-btn claim-btn" onclick="cobrarInteres(${i.id})">Cobrar</button>`
                }
                acciones += `<button class="action-btn liquidate" onclick="liquidar(${i.id})" title="Liquidar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 1a11 11 0 1 0 0 22 11 11 1 0 0 0 0-22z"/>
                        <polyline points="7 13 10 16 17 9"/>
                        <line x1="12" y1="16" x2="12" y2="9"/>
                    </svg>
                </button>`
            }
            acciones += `<button class="action-btn delete-inv" onclick="eliminarInv(${i.id})" title="Eliminar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
            </button>`
            acciones += '</div>'

            return `<tr>
                <td style="font-weight:500;">${i.name}</td>
                <td><span class="tag-pill ${i.type}">${typeLabels[i.type] || i.type}</span></td>
                <td class="monto neutral">${formatCurrency(capital, currency)}</td>
                <td style="color:var(--accent);font-weight:500;">${tasa}%</td>
                <td class="monto ${interes > 0 ? 'gain' : 'neutral'}">${formatCurrency(interes, currency)}</td>
                <td style="color:var(--text-secondary);font-size:0.8rem;">${endDate}</td>
                <td>${acciones}</td>
            </tr>`
        }).join('')
    }

    window.cobrarInteres = async function(id) {
        try {
            await claimInterest(id)
            showMsg('Interés cobrado y registrado en movimientos.', 'success')
            await cargarInversiones()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    }

    window.liquidar = async function(id) {
        if (!confirm('¿Liquidar esta inversión?')) return
        try {
            await liquidateInvestment(id)
            showMsg('Inversión liquidada.', 'success')
            await cargarInversiones()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    }

    window.eliminarInv = async function(id) {
        if (!confirm('¿Eliminar esta inversión permanentemente?')) return
        try {
            await deleteInvestment(id)
            showMsg('Inversión eliminada.', 'success')
            await cargarInversiones()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    }

    document.getElementById('addBtn').addEventListener('click', async () => {
        const name = document.getElementById('fName').value.trim()
        const type = document.getElementById('fType').value
        const capital = parseFloat(document.getElementById('fCapital').value)
        const tasa = parseFloat(document.getElementById('fTasa').value)
        const endDate = document.getElementById('fFecha').value
        const startDate = document.getElementById('fStartDate').value

        if (!name) { showMsg('Ingresá el nombre del activo.', 'error'); return }
        if (!capital || capital <= 0) { showMsg('Ingresá un capital válido.', 'error'); return }
        if (isNaN(tasa) || tasa < 0) { showMsg('Ingresá una tasa válida.', 'error'); return }
        if (!endDate) { showMsg('Seleccioná una fecha de vencimiento.', 'error'); return }

        try {
            await addInvestment({ name, type, capital, interestRate: tasa, startDate, endDate })
            showMsg('Inversión registrada.', 'success')
            document.getElementById('fName').value = ''
            document.getElementById('fCapital').value = ''
            document.getElementById('fTasa').value = ''
            const nextYear = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate())
            document.getElementById('fFecha').value = nextYear.toISOString().split('T')[0]
            await cargarInversiones()
        } catch (e) { showMsg('Error: ' + e.message, 'error') }
    })

    document.getElementById('filtroEstado').addEventListener('change', cargarInversiones)

    await cargarInversiones()