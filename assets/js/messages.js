(function () {
    const cards = Array.from(document.querySelectorAll('.message-card'));

    // Fade/slide cards in when they enter the viewport
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
        }
    }, { threshold: 0.2 });
    cards.forEach(c => io.observe(c));

    // Toggle logic for smooth, glitch-free transitions using height animations
    for (const card of cards) {
        const toggle = card.querySelector('.timer-toggle');
        const extra = card.querySelector('.timer-extra');
        if (!toggle || !extra) continue;

        // Ensure inner padding wrapper exists
        if (!extra.querySelector('.timer-body')) {
            const body = document.createElement('div');
            body.className = 'timer-body';
            while (extra.firstChild) body.appendChild(extra.firstChild);
            extra.appendChild(body);
        }

        let isAnimating = false;
        let fallbackTimer = null;
        const clearFallback = () => { if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; } };
        const endAnimation = () => { clearFallback(); isAnimating = false; };
        const onEndOnce = (el, handler) => {
            const wrap = (e) => { handler(e); el.removeEventListener('transitionend', wrap); };
            el.addEventListener('transitionend', wrap);
        };

        toggle.addEventListener('click', () => {
            if (isAnimating) return;
            const isOpen = card.classList.contains('open');
            isAnimating = true;
            clearFallback();
            fallbackTimer = setTimeout(endAnimation, 900);

            if (isOpen) {
                // CLOSE
                const h = extra.scrollHeight;
                extra.style.height = h + 'px';
                void extra.offsetHeight;
                card.classList.add('collapsing');
                card.classList.remove('open');
                extra.style.height = '0px';
                toggle.setAttribute('aria-expanded', 'false');
                onEndOnce(extra, (e) => {
                    if (e.propertyName !== 'height') return;
                    extra.hidden = true;
                    extra.style.height = '';
                    card.classList.remove('collapsing');
                    endAnimation();
                });
            } else {
                // OPEN
                extra.hidden = false;
                extra.style.height = 'auto';
                const h = extra.scrollHeight;
                extra.style.height = '0px';
                void extra.offsetHeight;
                card.classList.add('open');
                toggle.setAttribute('aria-expanded', 'true');
                extra.style.height = h + 'px';
                onEndOnce(extra, (e) => {
                    if (e.propertyName !== 'height') return;
                    extra.style.height = 'auto';
                    endAnimation();
                });
                setTimeout(() => { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
            }
        });
    }
})();
