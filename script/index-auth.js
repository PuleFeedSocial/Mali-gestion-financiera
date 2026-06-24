import { getSession, getUserProfile, logout } from './auth.js'

const session = await getSession()
if (!session) {
  document.getElementById('navUserArea').style.display = 'none'
  document.querySelector('.desktop-btn').style.display = ''
  document.querySelector('.mobile-btn-container').style.display = ''
} else {
  const profile = await getUserProfile()

  document.getElementById('navUserArea').style.display = 'flex'
  document.querySelector('.desktop-btn').style.display = 'none'

  const mobileBtn = document.querySelector('.mobile-btn-container a')
  if (mobileBtn) {
    mobileBtn.href = './pages/dashboard.html'
    mobileBtn.textContent = 'Dashboard'
  }

  document.getElementById('navUserName').textContent = profile?.name || 'Usuario'
  document.getElementById('navUserAvatar').textContent = (profile?.name || 'U').charAt(0).toUpperCase()

  document.querySelector('.hero .cta-buttons a').href = './pages/dashboard.html'
  document.querySelector('.hero .cta-buttons a').textContent = 'Ir al Dashboard'
  document.querySelector('.cta-section a.btn-primary').href = './pages/dashboard.html'
  document.querySelector('.cta-section a.btn-primary').textContent = 'Ir al Dashboard'

  const dd = document.getElementById('navUserDropdown')
  dd.addEventListener('click', (e) => {
    if (e.target.closest('.user-dropdown-menu')) return
    dd.classList.toggle('open')
  })
  document.addEventListener('click', (e) => {
    if (!dd.contains(e.target)) dd.classList.remove('open')
  })

  document.getElementById('navLogoutBtn').addEventListener('click', (e) => {
    e.preventDefault()
    logout()
  })
}
