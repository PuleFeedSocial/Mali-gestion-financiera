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

  // === Mobile Sidebar Menu ===
  ;(function () {
    var btn = document.querySelector('.mobile-menu-btn')
    var sidebar = document.querySelector('.app-sidebar')
    if (!btn || !sidebar) return

    var overlay = document.querySelector('.sidebar-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.className = 'sidebar-overlay'
      document.body.appendChild(overlay)
    }

    function open () { sidebar.classList.add('open'); overlay.classList.add('active') }
    function close () { sidebar.classList.remove('open'); overlay.classList.remove('active') }

    btn.addEventListener('click', function (e) {
      e.stopPropagation()
      if (sidebar.classList.contains('open')) close()
      else open()
    })

    overlay.addEventListener('click', close)

    var touchStartX = 0
    document.addEventListener('touchstart', function (e) { touchStartX = e.changedTouches[0].screenX }, { passive: true })
    document.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].screenX - touchStartX
      if (dx > 80 && !sidebar.classList.contains('open')) open()
    }, { passive: true })
  })()
})()
