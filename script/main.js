document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Configuración del Observer para animaciones al hacer scroll
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15 // Anima cuando el 15% del elemento es visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Evita que la animación se repita
            }
        });
    }, observerOptions);

    // Seleccionamos y observamos los elementos a animar
    const animatedElements = document.querySelectorAll('.fade-in, .fade-up');
    animatedElements.forEach(el => observer.observe(el));

    // 2. Smooth Scroll para todos los enlaces internos (anclas)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // 3. Menú Hamburguesa para Móviles
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.getElementById('nav-links');
    const navItems = document.querySelectorAll('.nav-links a');

    // Abrir/Cerrar menú al tocar el ícono
    mobileMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('is-active');
        navLinks.classList.toggle('active');
        
        // Bloquear o desbloquear el scroll del body cuando el menú está abierto
        if (navLinks.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    });

    // Cerrar el menú automáticamente cuando se hace clic en un enlace
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            mobileMenu.classList.remove('is-active');
            navLinks.classList.remove('active');
            document.body.style.overflow = 'auto'; // Restaurar el scroll
        });
    });

});