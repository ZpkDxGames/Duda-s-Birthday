(function () {
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const composerEl = document.querySelector('.composer');

    const SESSION_KEY_HISTORY = 'chat_history_taylor';
    const SAVED_KEY = 'chat_saved_taylor';
    // No backend URL needed; requests are handled directly by AILogic (client-side Groq)
    const CONVERSATION_ID = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    // Persona and generation settings are centralized in AILogic (ai-logic.js)

    function readHistory() {
        try { return JSON.parse(sessionStorage.getItem(SESSION_KEY_HISTORY) || '[]'); } catch { return [] }
    }
    function writeHistory(h) { sessionStorage.setItem(SESSION_KEY_HISTORY, JSON.stringify(h)); }

    function readSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return [] } }
    function writeSaved(arr) { localStorage.setItem(SAVED_KEY, JSON.stringify(arr)); }

    function fmt(ts) {
        try {
            const d = new Date(ts);
            return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        } catch { return '' }
    }
    function preview(hist) {
        const firstUser = hist.find(m => m.role === 'user');
        const text = firstUser?.content || '';
        return (text.length > 64 ? text.slice(0, 61) + '…' : text) || 'Conversation';
    }

    // Carousel state and rendering for saved sessions
    let savedIndex = 0;
    function clampIndex() { const len = readSaved().length; if (len === 0) return savedIndex = 0; savedIndex = Math.max(0, Math.min(savedIndex, len - 1)); return savedIndex; }
    function renderSavedCarousel() {
        const track = document.getElementById('savedCarousel');
        const prevBtn = document.getElementById('savedPrev');
        const nextBtn = document.getElementById('savedNext');
        const indexLabel = document.getElementById('savedIndexLabel');
        const loadBtn = document.getElementById('loadSavedBtn');
        const delBtn = document.getElementById('deleteSavedBtn');
        if (!track) return;
        const saved = readSaved();
        track.innerHTML = '';
        if (!saved.length) {
            // Empty state slide
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.innerHTML = `<div class="session-card"><div class="session-title">No saved sessions</div><div class="session-meta">Start chatting and press “Save current session”.</div></div>`;
            track.appendChild(slide);
            indexLabel.textContent = '0/0';
            prevBtn.disabled = true; nextBtn.disabled = true;
            loadBtn.disabled = true; delBtn.disabled = true;
            track.style.transform = 'translateX(0)';
            return;
        }
        clampIndex();
        saved.forEach(entry => {
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.dataset.id = entry.id;
            slide.innerHTML = `
        <div class="session-card">
          <div class="session-title">${preview(entry.history)}</div>
          <div class="session-meta">${fmt(entry.ts)} · ${entry.history.length} msgs</div>
        </div>`;
            track.appendChild(slide);
        });
        const pct = -(savedIndex * 100);
        track.style.transform = `translateX(${pct}%)`;
        indexLabel.textContent = `${savedIndex + 1}/${saved.length}`;
        prevBtn.disabled = savedIndex <= 0; nextBtn.disabled = savedIndex >= saved.length - 1;
        loadBtn.disabled = false; delBtn.disabled = false;
    }

    function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
    function assistantAvatar() {
        const img = new Image();
        img.src = '../media/taylorframe.webp';
        img.alt = 'Taylor avatar';
        img.className = 'avatar';
        return img;
    }
    function userAvatar() {
        const img = new Image();
        img.src = '../media/dudaframe.webp';
        img.alt = 'Duda avatar';
        img.className = 'avatar';
        return img;
    }
    function addBubble(role, text) {
        if (role === 'assistant') {
            const row = el('div', 'msg assistant animate');
            const img = assistantAvatar();
            const b = el('div', 'bubble assistant', text);
            row.appendChild(img);
            row.appendChild(b);
            messagesEl.appendChild(row);
            // Auto-scroll to keep the latest assistant message in view
            maybeAutoScroll(true);
            return b;
        } else if (role === 'user') {
            const row = el('div', 'msg user animate');
            const b = el('div', 'bubble user', text);
            const img = userAvatar();
            row.appendChild(b);
            row.appendChild(img);
            messagesEl.appendChild(row);
            // Auto-scroll when the user sends a message
            maybeAutoScroll(true);
            return b;
        } else {
            const b = el('div', 'bubble system', text);
            messagesEl.appendChild(b);
            maybeAutoScroll();
            return b;
        }
    }
    function addTyping() {
        // Add 'animate' so the typing row ascends smoothly on entry
        const row = el('div', 'msg assistant is-typing animate');
        const img = assistantAvatar();
        const b = el('div', 'bubble assistant');
        const label = el('span', 'typing-label', 'Taylor is typing.');
        b.appendChild(label);
        row.appendChild(img);
        row.appendChild(b);
        messagesEl.appendChild(row);
        // Keep typing indicator visible as it appears
        maybeAutoScroll(true);
        // cycle ".", "..", "..."
        let i = 1;
        const start = performance.now();
        const it = setInterval(() => {
            i = (i % 3) + 1;
            label.textContent = 'Taylor is typing ' + '.'.repeat(i);
        }, 400);
        const stop = () => new Promise(resolve => {
            clearInterval(it);
            // graceful exit animation
            row.classList.add('exit');
            const done = () => { row.remove(); resolve(); };
            row.addEventListener('animationend', done, { once: true });
            // safety timeout in case animationend doesn't fire
            setTimeout(() => { if (row.isConnected) { row.remove(); } resolve(); }, 300);
        });
        return { row, stop, start };
    }

    // User typing preview: shows a temporary bubble saying "You are typing..."
    let userTyping = null;
    function addUserTyping() {
        const row = el('div', 'msg user is-typing animate');
        const b = el('div', 'bubble user');
        const label = el('span', 'typing-label', 'You\'re typing .');
        b.appendChild(label);
        row.appendChild(b);
        const img = userAvatar();
        row.appendChild(img);
        messagesEl.appendChild(row);
        // Keep user typing preview visible near the bottom
        maybeAutoScroll(true);
        let i = 1;
        const it = setInterval(() => { i = (i % 3) + 1; label.textContent = 'You\'re typing ' + '.'.repeat(i); }, 400);
        const stop = () => {
            clearInterval(it);
            row.classList.add('exit');
            row.addEventListener('animationend', () => { row.remove(); }, { once: true });
            setTimeout(() => { if (row.isConnected) { row.remove(); } }, 300);
        };
        return { row, stop };
    }

    // Ensure messages bottom padding equals actual composer height plus a comfy gap to avoid overlap
    function adjustMessagesPad() {
        try {
            const atBottomBefore = isNearBottom();
            const h = (composerEl?.offsetHeight || 0);
            messagesEl.style.paddingBottom = `calc(${h}px + env(safe-area-inset-bottom, 0px))`;
            // If the user was at the bottom, keep them there after layout shift
            if (atBottomBefore) scrollToBottom(false);
        } catch { }
    }

    // --- Autoscroll helpers so the frame follows messages while descending ---
    function getScrollTop() { return window.pageYOffset || document.documentElement.scrollTop || 0; }
    function getViewportH() { return window.innerHeight || document.documentElement.clientHeight || 0; }
    function getDocH() { return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight); }
    function distToBottom() { return getDocH() - (getScrollTop() + getViewportH()); }
    function isNearBottom(threshold = 80) { return distToBottom() <= threshold; }
    function scrollToBottom(smooth = true) {
        window.scrollTo({ top: getDocH(), behavior: smooth ? 'smooth' : 'auto' });
    }
    function maybeAutoScroll(force = false) { if (force || isNearBottom()) scrollToBottom(true); }

    async function requestReply(history) {
        if (window.AILogic && typeof window.AILogic.chat === 'function') {
            const content = await window.AILogic.chat({
                messages: history,
                conversationId: CONVERSATION_ID
            });
            if (!content) throw new Error('EMPTY');
            return content;
        }
        throw new Error('AILogic not available');
    }

    async function send() {
        const text = (inputEl.value || '').trim();
        if (!text) return;
        inputEl.value = '';

        // Remove user typing preview if present
        if (userTyping) { await userTyping.stop(); userTyping = null; }

        const history = readHistory();
        history.push({ role: 'user', content: text });
        addBubble('user', text);

        const typing = addTyping();
        const minTypingMs = 3000 + Math.floor(Math.random() * 1000); // 3.0s - 4.0s jitter

        try {
            const reply = await requestReply(history);
            history.push({ role: 'assistant', content: reply });
            writeHistory(history);
            // Ensure typing is shown at least 2.5s before revealing the reply
            const elapsed = performance.now() - typing.start;
            const wait = Math.max(0, minTypingMs - elapsed);
            if (wait) await new Promise(r => setTimeout(r, wait));
            await typing.stop();
            addBubble('assistant', reply);
            maybeAutoScroll(true);
        } catch (err) {
            // Ensure minimum typing duration on error as well
            const elapsed = performance.now() - typing.start;
            const wait = Math.max(0, minTypingMs - elapsed);
            if (wait) await new Promise(r => setTimeout(r, wait));
            await typing.stop();
            console.error('AI error:', err);
            const reply = 'Sorry, I couldn\'t reach the AI service right now. Please try again in a moment.';
            history.push({ role: 'assistant', content: reply });
            writeHistory(history);
            addBubble('assistant', reply);
            maybeAutoScroll(true);
        }
    }

    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { send(); } });
    // Show/hide user typing preview reactively
    inputEl.addEventListener('input', () => {
        const hasText = !!(inputEl.value && inputEl.value.trim().length);
        if (hasText && !userTyping) { userTyping = addUserTyping(); }
        else if (!hasText && userTyping) { userTyping.stop(); userTyping = null; }
    });
    window.addEventListener('resize', adjustMessagesPad);
    window.addEventListener('orientationchange', adjustMessagesPad);
    window.addEventListener('load', adjustMessagesPad);

    // History management UI
    const historyBtn = document.getElementById('historyBtn');
    const historyModal = document.getElementById('historyModal');
    const dialogModal = document.getElementById('dialogModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const historyCount = document.getElementById('historyCount');
    const saveSessionBtn = document.getElementById('saveSessionBtn');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const clearSavedBtn = document.getElementById('clearSavedBtn');

    function updateHistoryCount() { if (historyCount) historyCount.textContent = `(${readSaved().length})`; }

    function openModal(el) { document.documentElement.classList.add('no-page-transform'); modalOverlay?.classList.remove('hidden'); el?.classList.remove('hidden'); el?.setAttribute('aria-hidden', 'false'); }
    function closeModal(el) { el?.classList.add('hidden'); el?.setAttribute('aria-hidden', 'true'); if (!document.querySelector('.modal-root:not(.hidden)')) modalOverlay?.classList.add('hidden'); }
    function closeAllModals() { document.querySelectorAll('.modal-root').forEach(m => m.classList.add('hidden')); modalOverlay?.classList.remove('intense'); modalOverlay?.classList.add('hidden'); }

    function resetConversation() {
        // Clear UI
        messagesEl.innerHTML = '';
        // New greeting
        const greeting = "Hi Duda! It’s Taylor. Consider this your birthday glitter-bomb ✨ If today had a soundtrack, what would the first track be?";
        addBubble('assistant', greeting);
        // Reset session history
        writeHistory([{ role: 'assistant', content: greeting }]);
    }

    // Open History modal centered with overlay
    historyBtn?.addEventListener('click', () => { updateHistoryCount(); renderSavedCarousel(); openModal(historyModal); });
    // Close buttons and overlay click
    document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeAllModals()));
    modalOverlay?.addEventListener('click', closeAllModals);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllModals(); });

    // Custom dialogs
    const dialogTitle = document.getElementById('dialogTitle');
    const dialogMessage = document.getElementById('dialogMessage');
    const dialogOk = document.getElementById('dialogOk');
    const dialogCancel = document.getElementById('dialogCancel');

    function showNotice(message, title = 'Notice', okText = 'OK') {
        return new Promise(resolve => {
            dialogTitle.textContent = title;
            dialogMessage.textContent = message;
            dialogCancel.style.display = 'none';
            dialogOk.textContent = okText;
            const onClose = () => { dialogOk.removeEventListener('click', onOk); closeModal(dialogModal); modalOverlay?.classList.remove('intense'); resolve(true); };
            function onOk() { onClose(); }
            dialogOk.addEventListener('click', onOk, { once: true });
            if (historyModal && !historyModal.classList.contains('hidden')) closeModal(historyModal);
            modalOverlay?.classList.add('intense');
            openModal(dialogModal);
        });
    }
    function showConfirm(message, title = 'Confirm', okText = 'OK', cancelText = 'Cancel') {
        return new Promise(resolve => {
            dialogTitle.textContent = title;
            dialogMessage.textContent = message;
            dialogCancel.style.display = '';
            dialogOk.textContent = okText; dialogCancel.textContent = cancelText;
            function onOk() { cleanup(); resolve(true); }
            function onCancel() { cleanup(); resolve(false); }
            function cleanup() { dialogOk.removeEventListener('click', onOk); dialogCancel.removeEventListener('click', onCancel); closeModal(dialogModal); modalOverlay?.classList.remove('intense'); }
            dialogOk.addEventListener('click', onOk, { once: true });
            dialogCancel.addEventListener('click', onCancel, { once: true });
            if (historyModal && !historyModal.classList.contains('hidden')) closeModal(historyModal);
            modalOverlay?.classList.add('intense');
            openModal(dialogModal);
        });
    }

    saveSessionBtn?.addEventListener('click', async () => {
        const hist = readHistory();
        // Only save if there's more than the initial greeting
        if (hist.length <= 1) { await showNotice('Nothing to save yet. Say something first!', 'Heads up'); return; }
        const saved = readSaved();
        const entry = { id: 's_' + Date.now(), ts: Date.now(), history: hist };
        saved.unshift(entry);
        writeSaved(saved);
        updateHistoryCount();
        await showNotice('Session saved to history.', 'Saved');
        savedIndex = 0; renderSavedCarousel();
    });
    newSessionBtn?.addEventListener('click', () => { resetConversation(); closeModal(historyModal); });
    clearSavedBtn?.addEventListener('click', async () => {
        const ok = await showConfirm('Clear all saved sessions? This cannot be undone.', 'Clear history', 'Clear', 'Cancel');
        if (ok) {
            localStorage.removeItem(SAVED_KEY);
            updateHistoryCount();
            savedIndex = 0; renderSavedCarousel();
        }
    });

    // Carousel controls
    document.getElementById('savedPrev')?.addEventListener('click', () => { savedIndex = Math.max(0, savedIndex - 1); renderSavedCarousel(); });
    document.getElementById('savedNext')?.addEventListener('click', () => { const len = readSaved().length; savedIndex = Math.min(len - 1, savedIndex + 1); renderSavedCarousel(); });
    document.getElementById('loadSavedBtn')?.addEventListener('click', async () => {
        const saved = readSaved();
        if (!saved.length) return;
        const entry = saved[savedIndex];
        const ok = await showConfirm('Load this session? Current conversation will be replaced in view.', 'Load session', 'Load', 'Cancel');
        if (!ok) return;
        messagesEl.innerHTML = '';
        entry.history.forEach(m => addBubble(m.role, m.content));
        writeHistory(entry.history);
        adjustMessagesPad();
        closeModal(historyModal);
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
    document.getElementById('deleteSavedBtn')?.addEventListener('click', async () => {
        const saved = readSaved();
        if (!saved.length) return;
        const entry = saved[savedIndex];
        const ok = await showConfirm('Delete this saved session?', 'Delete', 'Delete', 'Cancel');
        if (!ok) return;
        const rest = saved.filter(s => s.id !== entry.id);
        writeSaved(rest);
        updateHistoryCount();
        if (savedIndex >= rest.length) savedIndex = Math.max(0, rest.length - 1);
        renderSavedCarousel();
    });

    (function init() {
        // Always start a fresh conversation on page load
        sessionStorage.removeItem(SESSION_KEY_HISTORY);
        const greeting = "Hello, Duda! It’s Taylor ❤️ \nConsider this your birthday glitter-bomb ✨ \n\nIf today had a soundtrack, what would the first track be?";
        addBubble('assistant', greeting);
        writeHistory([{ role: 'assistant', content: greeting }]);
        updateHistoryCount();
        adjustMessagesPad();
    })();
})();
