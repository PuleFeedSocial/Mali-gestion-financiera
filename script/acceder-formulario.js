    import { getSession, login, register, loginWithGoogle } from './auth.js'

    getSession().then(session => {
        if (session) window.location.href = 'dashboard.html'
    }).catch(() => {})

    function showError(id, msg) {
        const el = document.getElementById(id)
        el.textContent = msg
        el.style.display = 'block'
    }

    function hideError(id) {
        document.getElementById(id).style.display = 'none'
    }

    function setLoading(btnId, loading) {
        const btn = document.getElementById(btnId)
        if (loading) {
            btn.dataset.text = btn.textContent
            btn.textContent = 'Cargando...'
            btn.disabled = true
        } else {
            btn.textContent = btn.dataset.text || btn.textContent
            btn.disabled = false
        }
    }

    document.querySelectorAll('.social').forEach(el => {
        el.addEventListener('click', async (e) => {
            e.preventDefault()
            try {
                await loginWithGoogle()
            } catch (err) {
                showError('loginError', err.message || 'Error al conectar con Google.')
            }
        })
    })

    document.getElementById('registerForm').addEventListener('submit', async function (e) {
        e.preventDefault()
        hideError('registerError')

        const name = document.getElementById('regName').value.trim()
        const email = document.getElementById('regEmail').value.trim()
        const password = document.getElementById('regPassword').value.trim()
        const code = document.getElementById('regCode').value.trim()

        if (!name || !email || !password || !code) {
            showError('registerError', 'Todos los campos son obligatorios.')
            return
        }

        if (password.length < 6) {
            showError('registerError', 'La contraseña debe tener al menos 6 caracteres.')
            return
        }

        if (!/^[0-9]{6}$/.test(code)) {
            showError('registerError', 'El código de activación debe tener 6 dígitos numéricos.')
            return
        }

        setLoading('registerBtn', true)

        try {
            await register(name, email, password, code)
            window.location.href = 'setup.html'
        } catch (err) {
            showError('registerError', err.message || 'Error al registrarse.')
            setLoading('registerBtn', false)
        }
    })

    document.getElementById('loginForm').addEventListener('submit', async function (e) {
        e.preventDefault()
        hideError('loginError')

        const email = document.getElementById('loginEmail').value.trim()
        const password = document.getElementById('loginPassword').value.trim()

        if (!email || !password) {
            showError('loginError', 'Todos los campos son obligatorios.')
            return
        }

        setLoading('loginBtn', true)

        try {
            await login(email, password)
            window.location.href = 'dashboard.html'
        } catch (err) {
            showError('loginError', err.message || 'Credenciales inválidas.')
            setLoading('loginBtn', false)
        }
    })

    document.getElementById('regCode').addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '')
    })

    document.addEventListener('DOMContentLoaded', () => {
        const signUpButton = document.getElementById('signUp')
        const signInButton = document.getElementById('signIn')
        const container = document.getElementById('access-container')
        const signUpMobile = document.getElementById('signUpMobile')
        const signInMobile = document.getElementById('signInMobile')

        signUpButton.addEventListener('click', () => container.classList.add('right-panel-active'))
        signInButton.addEventListener('click', () => container.classList.remove('right-panel-active'))
        signUpMobile.addEventListener('click', (e) => { e.preventDefault(); container.classList.add('right-panel-active') })
        signInMobile.addEventListener('click', (e) => { e.preventDefault(); container.classList.remove('right-panel-active') })
    })