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
});