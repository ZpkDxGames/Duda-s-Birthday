// Shared navigation helpers: fade transitions, smooth in
(function () {
    const root = document.documentElement;
    const body = document.body;
    // Animate a content container inside <main> so fixed elements (header/composer) aren't under a transform
    const main = document.querySelector('main');
    const pageEls = (() => {
        if (!main) return [body];
        const direct = Array.from(main.children).filter((el) => el instanceof HTMLElement && !el.classList.contains('composer'));
        if (direct.length) return direct;
        return [main];
    })();

    pageEls.forEach((el) => el.classList.add('page', 'page-enter'));
    requestAnimationFrame(() => pageEls.forEach((el) => el.classList.add('page-enter-active')));

    function navigateWithFade(href) {
        pageEls.forEach((el) => el.classList.add('fade-out'));
        setTimeout(() => { window.location.href = href; }, 320);
    }

    // Intercept same-origin anchor clicks for a nicer transition
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a) return;
        const url = new URL(a.href, window.location.origin);
        if (url.origin === window.location.origin && !a.hasAttribute('data-no-fade')) {
            e.preventDefault();
            navigateWithFade(a.getAttribute('href'));
        }
    });

    // Expose helper globally for explicit triggers
    window.__nav = { navigateWithFade };

    // No need to toggle no-page-transform since only main content is animated

    // Build a lightweight overlay scrollbar indicator that doesn't affect layout
    const osb = document.createElement('div');
    osb.id = 'overlayScrollbar';
    osb.className = 'hidden';
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    osb.appendChild(thumb);
    document.body.appendChild(osb);

    let hideTimer;
    function hasModalOpen() { return !!document.querySelector('.modal-root:not(.hidden), #modalOverlay:not(.hidden)'); }

    function updateOverlayScrollbar() {
        const doc = document.documentElement;
        const sh = doc.scrollHeight;
        const ch = doc.clientHeight;
        if (sh <= ch + 1 || hasModalOpen()) {
            osb.classList.add('hidden');
            return;
        }
        osb.classList.remove('hidden');
        const trackTop = 6, trackBottom = 6;
        const trackH = window.innerHeight - (trackTop + trackBottom);
        const ratio = Math.max(0, Math.min(1, ch / sh));
        const minThumb = 24;
        const tH = Math.max(minThumb, Math.round(trackH * ratio));
        const maxScroll = sh - ch;
        const st = window.scrollY || doc.scrollTop;
        const free = Math.max(1, trackH - tH);
        const tTop = trackTop + Math.round((st / maxScroll) * free);
        thumb.style.height = tH + 'px';
        thumb.style.transform = `translateY(${tTop}px)`;
    }

    function revealOverlayScrollbar() {
        if (hasModalOpen()) return; // keep hidden during modals
        updateOverlayScrollbar();
        osb.classList.add('visible');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => osb.classList.remove('visible'), 1000);
    }

    ['scroll', 'resize'].forEach(evt => window.addEventListener(evt, updateOverlayScrollbar, { passive: true }));
    ['mousemove', 'wheel', 'touchstart', 'touchmove', 'keydown'].forEach(evt => window.addEventListener(evt, revealOverlayScrollbar, { passive: true }));
    // Initial measure
    updateOverlayScrollbar();
})();
