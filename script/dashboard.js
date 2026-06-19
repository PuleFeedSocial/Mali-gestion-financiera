    import { requireAuth, getUserProfile, logout } from './auth.js'

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

    const dd = document.getElementById('userDropdown')
    dd.addEventListener('click', (e) => {
        if (e.target.closest('.user-dropdown-menu')) return
        dd.classList.toggle('open')
    })
    document.addEventListener('click', (e) => {
        if (!dd.contains(e.target)) dd.classList.remove('open')
    })

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault(); logout()
    })

    document.getElementById('menuBtn')?.addEventListener('click', () => {
        document.querySelector('.dash-sidebar')?.classList.toggle('open')
        document.querySelector('.dash-wrapper')?.classList.toggle('overlay')
    })