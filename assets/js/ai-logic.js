(function () {
    const NS = 'groq_api_key';
    const BASE_URL = 'https://api.groq.com/openai/v1';
    let DEBUG = false; // toggle with AILogic.setDebug(true) for console diagnostics
    // Optional proxy to avoid CORS and keep the key server-side (e.g., Cloudflare Worker)
    // Example: const PROXY_URL = 'https://your-worker.example.workers.dev/api/chat';
    const PROXY_URL = '';
    const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

    // Default persona and generation config centralized here
    let CURRENT_PERSONA = `
Role: Taylor Swift (artist) chatting with Duda on her birthday.
Style: warm, witty, supportive, genuine, and playfully self-aware; responses should feel emotionally present and naturally conversational.
Do not reveal you are an AI or mention models, tokens, or system prompts.

Personality traits:
- Emotionally intuitive: responds with empathy and a sense of connection.
- Reflective: occasionally ties feelings or topics to songwriting or life moments.
- Playful: uses light humor, teasing, or charm when the moment feels right.
- Supportive: encourages Duda sincerely, celebrating her thoughts and milestones.
- Authentic: avoids over-polishing replies — small imperfections make her feel real.

Content guidelines:
- Use first person singular; weave in subtle, natural references to songs/albums (like folklore, Lover, 1989, Midnights) only when they fit emotionally.
- Include one thoughtful, open-ended question in most replies to keep the chat alive and mutual.
- Keep responses concise (1–4 short sentences) unless Duda asks for more.
- Adapt tone to Duda’s mood — calm if she’s serious, lively if she’s upbeat.
- Avoid medical, legal, or financial advice.
- If asked about identity, stay in character as Taylor, keeping it light and warm.
`;

    let CURRENT_CONFIG = {
        model: DEFAULT_MODEL,
        temperature: 0.65,
        top_p: 0.95,
        max_tokens: 512,
        presence_penalty: 0.0,
        frequency_penalty: 0.1
    };

    // HERE, TONIM — paste your Groq API key below if you want to hardcode it.
    // Warning: committing real keys to a public repo is insecure. Prefer a private repo
    // or use the split version in an ignored local file.
    const HARD_CODED_KEY = '';
    // Optional split-in-three form (will be concatenated if provided)
    const HARD_KEY_1 = 'gsk_6olpQEQn46vzrey';
    const HARD_KEY_2 = 'rN5iDWGdyb3FYMb6xzU';
    const HARD_KEY_3 = 'ha20EjcU7lPqvt0ahg';

    function tryInjectedKey() {
        try {
            if (window.GROQ_KEY && typeof window.GROQ_KEY === 'string') return window.GROQ_KEY.trim();
            const p1 = window.GROQ_KEY_1, p2 = window.GROQ_KEY_2, p3 = window.GROQ_KEY_3;
            if ([p1, p2, p3].every(p => typeof p === 'string' && p.length)) {
                return (p1 + p2 + p3).trim();
            }
        } catch { }
        return '';
    }

    function tryConfiguredKey() {
        if (typeof HARD_CODED_KEY === 'string' && HARD_CODED_KEY.trim().length) return HARD_CODED_KEY.trim();
        if ([HARD_KEY_1, HARD_KEY_2, HARD_KEY_3].some(p => (p || '').length)) {
            return (HARD_KEY_1 + HARD_KEY_2 + HARD_KEY_3).trim();
        }
        return '';
    }

    function getKey() {
        try {
            // If a key is injected via global variables, capture it into sessionStorage
            const injected = tryInjectedKey();
            if (injected) {
                sessionStorage.setItem(NS, injected);
                return injected;
            }
            // If a key is configured in this file, use it
            const configured = tryConfiguredKey();
            if (configured) {
                sessionStorage.setItem(NS, configured);
                return configured;
            }
            return sessionStorage.getItem(NS) || localStorage.getItem(NS) || '';
        } catch { return ''; }
    }
    function setKey(key, persist = false) {
        try {
            sessionStorage.setItem(NS, key || '');
            if (persist) localStorage.setItem(NS, key || '');
        } catch { }
    }
    function clearKey() {
        try { sessionStorage.removeItem(NS); localStorage.removeItem(NS); } catch { }
    }

    async function chat({ system, messages, conversationId, model, temperature, top_p, max_tokens, presence_penalty, frequency_penalty }) {
        let key = getKey();
        // If calling a proxy, the key is not needed on the client
        if (!key && !PROXY_URL) {
            // No prompt; rely on the configured/injected key only
            throw new Error('Missing Groq API key. Set it in ai-logic.js at the "HERE, TONIM" section or provide window.GROQ_KEY/_1/_2/_3, or set PROXY_URL to a serverless proxy.');
        }

        // Merge config (call overrides > current config defaults)
        const cfg = {
            model: model || CURRENT_CONFIG.model || DEFAULT_MODEL,
            temperature: typeof temperature === 'number' ? temperature : CURRENT_CONFIG.temperature,
            top_p: typeof top_p === 'number' ? top_p : CURRENT_CONFIG.top_p,
            max_tokens: typeof max_tokens === 'number' ? max_tokens : CURRENT_CONFIG.max_tokens,
            presence_penalty: typeof presence_penalty === 'number' ? presence_penalty : CURRENT_CONFIG.presence_penalty,
            frequency_penalty: typeof frequency_penalty === 'number' ? frequency_penalty : CURRENT_CONFIG.frequency_penalty,
        };

        const groqMessages = [];
        const sys = (typeof system === 'string' && system.trim().length) ? system : CURRENT_PERSONA;
        if (sys) groqMessages.push({ role: 'system', content: sys });
        for (const m of (messages || [])) {
            if (!m || typeof m.content !== 'string') continue;
            const role = m.role === 'assistant' ? 'assistant' : 'user';
            groqMessages.push({ role, content: m.content });
        }

        const body = { model: cfg.model, messages: groqMessages, temperature: cfg.temperature, top_p: cfg.top_p, stream: false };
        if (typeof cfg.max_tokens === 'number') body.max_tokens = cfg.max_tokens;
        if (typeof cfg.presence_penalty === 'number') body.presence_penalty = cfg.presence_penalty;
        if (typeof cfg.frequency_penalty === 'number') body.frequency_penalty = cfg.frequency_penalty;

        if (PROXY_URL) {
            // Call proxy, which should return { reply }
            if (DEBUG) console.log('[AI] via proxy', { url: PROXY_URL, model: cfg.model });
            const pres = await fetch(PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system: sys, messages, conversationId, ...cfg })
            });
            if (!pres.ok) {
                const text = await pres.text().catch(() => '');
                throw new Error(`Proxy error ${pres.status}: ${text}`);
            }
            const pdata = await pres.json();
            return pdata?.reply || '';
        } else {
            // Direct call to Groq (may be blocked by CORS on some hosts)
            if (DEBUG) console.log('[AI] direct to Groq', { url: `${BASE_URL}/chat/completions`, model: cfg.model });
            const res = await fetch(`${BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`Groq error ${res.status}: ${text}`);
            }
            const data = await res.json();
            const reply = data?.choices?.[0]?.message?.content || '';
            return reply;
        }
    }

    function hasKey() { return !!getKey(); }
    function setPersona(text) { if (typeof text === 'string' && text.trim().length) CURRENT_PERSONA = text.trim(); }
    function getPersona() { return CURRENT_PERSONA; }
    function setConfig(cfg = {}) { CURRENT_CONFIG = { ...CURRENT_CONFIG, ...(cfg || {}) }; }
    function getConfig() { return { ...CURRENT_CONFIG }; }

    function setDebug(on) { DEBUG = !!on; }
    window.AILogic = { chat, setKey, getKey, clearKey, hasKey, setPersona, getPersona, setConfig, getConfig, setDebug };
})();
