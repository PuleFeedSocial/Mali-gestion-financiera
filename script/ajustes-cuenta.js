    import { requireAuth, getUserProfile, updatePassword, updateProfile } from './auth.js'

    const session = await requireAuth()
    if (!session) throw new Error()

    const profile = await getUserProfile()
    if (profile) document.getElementById('userName').value = profile.name

    const msg = document.getElementById('ajMsg')
    function showMsg(text, type) { msg.textContent = text; msg.className = `msg ${type}`; setTimeout(() => { msg.className = 'msg' }, 4000) }

    document.getElementById('changePwBtn').addEventListener('click', async function () {
        const current = document.getElementById('currentPw').value
        const newP = document.getElementById('newPw').value
        if (!current || !newP) { showMsg('Completá ambos campos.', 'error'); return }
        if (newP.length < 6) { showMsg('La nueva contraseña debe tener al menos 6 caracteres.', 'error'); return }
        this.disabled = true; this.textContent = 'Guardando...'
        try { await updatePassword(current, newP); showMsg('Contraseña actualizada.', 'success'); this.disabled = false; this.textContent = 'Actualizar contraseña'; document.getElementById('currentPw').value = ''; document.getElementById('newPw').value = '' }
        catch (e) { showMsg(e.message, 'error'); this.disabled = false; this.textContent = 'Actualizar contraseña' }
    })

    document.getElementById('updateNameBtn').addEventListener('click', async function () {
        const name = document.getElementById('userName').value.trim()
        if (!name) { showMsg('El nombre no puede estar vacío.', 'error'); return }
        this.disabled = true; this.textContent = 'Guardando...'
        try { await updateProfile({ name }); showMsg('Nombre actualizado.', 'success'); this.disabled = false; this.textContent = 'Guardar cambios' }
        catch (e) { showMsg(e.message, 'error'); this.disabled = false; this.textContent = 'Guardar cambios' }
    })