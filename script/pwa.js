(function () {
  if (!('serviceWorker' in navigator)) return

  let swReady = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swReady) showUpdateBanner()
  })

  navigator.serviceWorker.register('/sw.js').then((reg) => {
    swReady = true

    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing
      if (!newSW) return
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner()
        }
      })
    })
  }).catch(() => {})

  function showUpdateBanner() {
    const existing = document.getElementById('pwa-update-banner')
    if (existing) return
    const banner = document.createElement('div')
    banner.id = 'pwa-update-banner'
    banner.innerHTML = `
      <span>Nueva versión disponible</span>
      <button id="pwa-update-btn">Actualizar</button>
    `
    Object.assign(banner.style, {
      position: 'fixed', bottom: '0', left: '0', right: '0',
      background: '#1f1f1d', color: '#fff', padding: '0.8rem 1rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      zIndex: '9999', borderTop: '1px solid rgba(255,255,255,0.1)',
      fontSize: '0.85rem', transform: 'translateY(100%)',
      transition: 'transform 0.3s ease'
    })
    document.body.appendChild(banner)
    requestAnimationFrame(() => { banner.style.transform = 'translateY(0)' })

    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
      navigator.serviceWorker.ready.then((reg) => {
        reg.waiting?.postMessage('SKIP_WAITING')
      })
    })
  }

  let deferredPrompt = null
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    const btn = document.getElementById('pwa-install-btn')
    if (btn) btn.style.display = 'inline-flex'
  })

  window.installPWA = function () {
    const btn = document.getElementById('pwa-install-btn')
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null
      if (btn) btn.style.display = 'none'
    })
  }

  if (Notification && Notification.permission === 'default') {
    document.addEventListener('click', () => {
      Notification.requestPermission()
    }, { once: true })
  }

  // Overlay click → close sidebar
  document.addEventListener('click', (e) => {
    if (!e.target.closest) return
    const overlay = e.target.closest('.dash-wrapper.overlay, .admin-wrapper.overlay, .fp-wrapper.overlay, .d-wrapper.overlay, .t-wrapper.overlay, .c-wrapper.overlay, .h-wrapper.overlay, .i-wrapper.overlay')
    if (overlay) {
      const sidebar = overlay.querySelector('.dash-sidebar, .admin-sidebar, .fp-sidebar, .d-sidebar, .t-sidebar, .c-sidebar, .h-sidebar, .i-sidebar')
      if (sidebar && !sidebar.contains(e.target)) {
        sidebar.classList.remove('open')
        overlay.classList.remove('overlay')
      }
    }
  })

  // Swipe to close sidebar
  let touchStartX = 0
  document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX }, { passive: true })
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX
    if (dx > 80) {
      document.querySelectorAll('.dash-sidebar.open, .admin-sidebar.open, .fp-sidebar.open, .d-sidebar.open, .t-sidebar.open, .c-sidebar.open, .h-sidebar.open, .i-sidebar.open').forEach((el) => {
        el.classList.remove('open')
        el.closest('.dash-wrapper, .admin-wrapper, .fp-wrapper, .d-wrapper, .t-wrapper, .c-wrapper, .h-wrapper, .i-wrapper')?.classList.remove('overlay')
      })
    }
  }, { passive: true })
})()
