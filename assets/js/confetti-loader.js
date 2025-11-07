// Minimalist confetti.js (Canvas Confetti) loader
// https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js
(function(){
    if (window.confetti) return;
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
    s.async = true;
    document.head.appendChild(s);
})();
