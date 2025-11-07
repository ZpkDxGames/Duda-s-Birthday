(function () {
    const audio = document.getElementById('audio');
    const playToggle = document.getElementById('playToggle');
    const playIcon = document.getElementById('playIcon');
    const seek = document.getElementById('seek');
    const curTime = document.getElementById('curTime');
    const durTime = document.getElementById('durTime');
    const tracklist = document.getElementById('tracklist');
    const titleEl = document.getElementById('title');
    const artistEl = document.getElementById('artist');
    const coverEl = document.querySelector('.cover');
    const volume = document.getElementById('volume');
    const volumeToggle = document.getElementById('volumeToggle');
    const volumePopover = document.getElementById('volumePopover');
    const volumeIcon = document.getElementById('volumeIcon');
    const vslider = document.getElementById('vslider');
    const vfill = vslider ? vslider.querySelector('.vfill') : null;
    const vthumb = vslider ? vslider.querySelector('.vthumb') : null;
    const nowPlaying = document.getElementById('nowPlaying');

    const VOL_ICONS = {
        muted: '../media/keys/muted.svg',
        low: '../media/keys/lowvolume.svg',
        high: '../media/keys/highvolume.svg'
    };

    const ICONS = {
        play: '../media/keys/play.svg',
        pause: '../media/keys/pause.svg'
    };

    function fmt(t) {
        if (!isFinite(t)) return '00:00';
        const m = Math.floor(t / 60); const s = Math.floor(t % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function updateDuration() {
        const d = Number(audio.duration);
        if (isFinite(d) && d > 0) {
            seek.max = Math.ceil(d);
            durTime.textContent = fmt(d);
        } else {
            seek.max = 0;
            durTime.textContent = '00:00';
        }
        updateSeekBg();
    }

    let hasLoadedTrack = false;
    function setPlayingState(isPlaying) {
        playIcon.src = isPlaying ? ICONS.pause : ICONS.play;
        playIcon.alt = isPlaying ? 'Pause' : 'Play';
        playToggle.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
        const active = document.querySelector('#tracklist li.active');
        if (active) {
            if (isPlaying) active.classList.add('playing');
            else active.classList.remove('playing');
        }
        // Removed rotating album effect; keep only swap fade
        if (nowPlaying) {
            if (!hasLoadedTrack) {
                // Before any track is loaded, show placeholder
                nowPlaying.hidden = false;
                nowPlaying.textContent = '...';
            } else {
                nowPlaying.hidden = false;
                nowPlaying.textContent = isPlaying ? 'Now playing...' : 'Muted...';
            }
        }
    }

    playToggle.addEventListener('click', async () => {
        if (audio.paused) {
            try { await audio.play(); setPlayingState(true); } catch { }
        } else { audio.pause(); setPlayingState(false); }
    });

    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('loadeddata', updateDuration);
    audio.addEventListener('canplay', updateDuration);

    audio.addEventListener('timeupdate', () => {
        curTime.textContent = fmt(audio.currentTime);
        if (!seek.dragging) seek.value = Math.floor(audio.currentTime);
        updateSeekBg();
    });

    audio.addEventListener('ended', () => {
        setPlayingState(false);
        seek.value = 0; curTime.textContent = '00:00';
    });
    audio.addEventListener('playing', () => setPlayingState(true));
    audio.addEventListener('pause', () => setPlayingState(false));

    // Volume UI sync
    function updateVolumeUI() {
        const v = (audio.volume || 0);
        const pct = Math.max(0, Math.min(100, Math.round(v * 100)));
        if (volume) volume.value = String(pct);
        if (vfill) vfill.style.height = pct + '%';
        if (vthumb) vthumb.style.bottom = pct + '%';
    }
    function updateVolumeIcon() {
        if (!volumeIcon) return;
        const pct = Math.round((audio.volume || 0) * 100);
        let src = VOL_ICONS.muted;
        if (pct >= 50) src = VOL_ICONS.high;
        else if (pct >= 1) src = VOL_ICONS.low;
        volumeIcon.src = src;
    }

    function setupVolumePopover() {
        if (!volume || !volumeToggle || !volumePopover) return;
        // init from storage
        const saved = Number(localStorage.getItem('music.volume'));
        const vol = isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 1;
        audio.volume = vol;
    volume.value = String(Math.round(vol * 100));
    updateVolumeUI();
        updateVolumeIcon();

        // Compute target height based on the custom slider height + its vertical margins + container padding
        function computeOpenHeight() {
            const vs = vslider;
            const vsHeight = vs ? vs.getBoundingClientRect().height : (parseFloat(getComputedStyle(volume).width) || 150);
            const vsCS = vs ? getComputedStyle(vs) : null;
            const mt = vsCS ? (parseFloat(vsCS.marginTop) || 0) : 0;
            const mb = vsCS ? (parseFloat(vsCS.marginBottom) || 0) : 0;
            const body = volumePopover ? volumePopover.querySelector('.vp-body') : null;
            const bodyCS = body ? getComputedStyle(body) : null;
            const pt = bodyCS ? (parseFloat(bodyCS.paddingTop) || 0) : 0;
            const pb = bodyCS ? (parseFloat(bodyCS.paddingBottom) || 0) : 0;
            return Math.ceil(vsHeight + mt + mb + pt + pb);
        }
        let isOpen = false;
        let isAnimating = false;

        function openPop() {
            if (isOpen || isAnimating) return;
            isAnimating = true;
            isOpen = true;
            volumePopover.classList.add('open');
            volumePopover.setAttribute('aria-hidden', 'false');
            if (volumeToggle) volumeToggle.setAttribute('aria-expanded', 'true');
            // animate height
            volumePopover.style.height = '0px';
            // force reflow
            void volumePopover.offsetHeight;
            const target = computeOpenHeight();
            volumePopover.style.height = target + 'px';
            const done = () => { isAnimating = false; volumePopover.removeEventListener('transitionend', done); };
            volumePopover.addEventListener('transitionend', done);
            document.addEventListener('click', onDocClick, { capture: true });
            document.addEventListener('keydown', onKey);
        }
        function closePop() {
            if (!isOpen || isAnimating) return;
            isAnimating = true;
            isOpen = false;
            volumePopover.style.height = getComputedStyle(volumePopover).height;
            void volumePopover.offsetHeight;
            volumePopover.style.height = '0px';
            const done = () => {
                volumePopover.classList.remove('open');
                volumePopover.setAttribute('aria-hidden', 'true');
                if (volumeToggle) volumeToggle.setAttribute('aria-expanded', 'false');
                isAnimating = false;
                volumePopover.removeEventListener('transitionend', done);
                document.removeEventListener('click', onDocClick, true);
                document.removeEventListener('keydown', onKey);
            };
            volumePopover.addEventListener('transitionend', done);
        }
        function onDocClick(e) {
            if (!volumePopover.contains(e.target) && !volumeToggle.contains(e.target)) {
                closePop();
            }
        }
        function onKey(e) { if (e.key === 'Escape') closePop(); }

        volumeToggle.addEventListener('click', () => {
            if (isOpen) closePop(); else openPop();
        });

        // Custom slider pointer interactions
        function setVolFromEvent(e) {
            if (!vslider) return;
            const rect = vslider.getBoundingClientRect();
            const y = e.clientY;
            let pct = 1 - ((y - rect.top) / rect.height);
            pct = Math.max(0, Math.min(1, pct));
            audio.volume = pct;
            localStorage.setItem('music.volume', String(pct));
            updateVolumeUI();
            updateVolumeIcon();
        }
        if (vslider) {
            vslider.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                try { vslider.setPointerCapture(e.pointerId); } catch {}
                setVolFromEvent(e);
                const move = (ev) => setVolFromEvent(ev);
                const up = (ev) => {
                    try { vslider.releasePointerCapture(ev.pointerId); } catch {}
                    window.removeEventListener('pointermove', move);
                    window.removeEventListener('pointerup', up);
                    window.removeEventListener('pointercancel', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
                window.addEventListener('pointercancel', up);
            });
        }
        audio.addEventListener('volumechange', () => {
            const vNow = Math.round((audio.volume || 0) * 100);
            if (String(vNow) !== volume.value) volume.value = String(vNow);
            updateVolumeUI();
            updateVolumeIcon();
        });
    }

    seek.addEventListener('input', () => {
        seek.dragging = true;
        curTime.textContent = fmt(Number(seek.value));
        updateSeekBg();
    });
    seek.addEventListener('change', () => {
        audio.currentTime = Number(seek.value) || 0;
        seek.dragging = false;
        updateSeekBg();
    });

    function updateSeekBg() {
        const max = Number(seek.max) || 0; const val = Number(seek.value) || 0;
        const pct = max ? (val / max * 100) : 0;
        seek.style.backgroundSize = pct + '% 100%';
    }

    // Build track list from known files (ordered by original release date)
    // Hint: set `cover` to an image path like "../media/albums/red.webp" for each track.
    const tracks = [
        { title: 'Red', file: 'Red.mp3', artist: 'Taylor Swift', date: '2012-10-22', album: 'Red', cover: '../media/albums/red.webp' },
        { title: 'Shake It Off', file: 'Shake It Off.mp3', artist: 'Taylor Swift', date: '2014-08-18', album: '1989', cover: '../media/albums/1989.webp' },
        { title: 'Blank Space', file: 'Blank Space.mp3', artist: 'Taylor Swift', date: '2014-11-10', album: '1989', cover: '../media/albums/1989.webp' },
        { title: 'Bad Blood', file: 'Bad Blood.mp3', artist: 'Taylor Swift', date: '2015-05-17', album: '1989', cover: '../media/albums/1989.webp' },
        { title: 'Look What You Made Me Do', file: 'Look What You Made Me Do.mp3', artist: 'Taylor Swift', date: '2017-08-25', album: 'Reputation', cover: '../media/albums/reputation.webp' },
        { title: '…Ready For It?', file: '…Ready For It.mp3', artist: 'Taylor Swift', date: '2017-09-15', album: 'Reputation', cover: '../media/albums/reputation.webp' },
        { title: 'Don’t Blame Me', file: 'Don’t Blame Me.mp3', artist: 'Taylor Swift', date: '2017-11-10', album: 'Reputation', cover: '../media/albums/reputation.webp' },
        { title: 'Lover', file: 'Lover.mp3', artist: 'Taylor Swift', date: '2019-08-16', album: 'Lover', cover: '../media/albums/lover.webp' },
        { title: 'Cruel Summer', file: 'Cruel Summer.mp3', artist: 'Taylor Swift', date: '2019-08-23', album: 'Lover', cover: '../media/albums/lover.webp' },
        { title: 'Cornelia Street', file: 'Cornelia Street.mp3', artist: 'Taylor Swift', date: '2019-08-23', album: 'Lover', cover: '../media/albums/lover.webp' },
        { title: 'Cardigan', file: 'Cardigan.mp3', artist: 'Taylor Swift', date: '2020-07-24', album: 'Folklore', cover: '../media/albums/folklore.webp' },
        { title: 'Ivy', file: 'Ivy.mp3', artist: 'Taylor Swift', date: '2020-12-11', album: 'Evermore', cover: '../media/albums/evermore.webp' },
        { title: 'Anti-Hero', file: 'Anti-Hero.mp3', artist: 'Taylor Swift', date: '2022-10-21', album: 'Midnights', cover: '../media/albums/midnights.webp' },
        { title: 'Mastermind', file: 'Mastermind.mp3', artist: 'Taylor Swift', date: '2022-10-21', album: 'Midnights', cover: '../media/albums/midnights.webp' },
        { title: 'Karma', file: 'Karma.mp3', artist: 'Taylor Swift', date: '2022-10-21', album: 'Midnights', cover: '../media/albums/midnights.webp' },
        { title: "Safe & Sound (Taylor's Version)", file: "Safe & Sound (Taylor's Version).mp3", artist: 'Taylor Swift', date: '2023-03-17', album: "The Hunger Games: Songs from District 12 and Beyond (Taylor’s Version Single)", cover: '../media/albums/safe-and-sound-tv.webp' },
        { title: 'Loml', file: 'Loml.mp3', artist: 'Taylor Swift', date: '2024-04-19', album: 'The Tortured Poets Department', cover: '../media/albums/ttpd.webp' },
        { title: 'How Did It End?', file: 'How Did It End.mp3', artist: 'Taylor Swift', date: '2024-04-19', album: 'The Tortured Poets Department', cover: '../media/albums/ttpd.webp' },
        { title: 'The Fate of Ophelia', file: 'The Fate of Ophelia.mp3', artist: 'Taylor Swift', date: '2024-04-19', album: 'The Tortured Poets Department: The Anthology', cover: '../media/albums/ttpd-anthology.webp' },
        { title: 'Opalite', file: 'Opalite.mp3', artist: 'Taylor Swift', date: '2024-04-19', album: 'The Tortured Poets Department: The Anthology', cover: '../media/albums/ttpd-anthology.webp' }
    ].filter(t => t && t.file);


    function filePath(name) { return '../media/music/' + encodeURIComponent(name); }
    const defaultCover = '../media/albums/defaultcover.webp';

    function renderTracklist() {
        if (!tracklist) return;
        // sort ascending by date (oldest first)
        tracks.sort((a, b) => new Date(a.date) - new Date(b.date));
        tracklist.innerHTML = '';
        tracks.forEach((t, idx) => {
            const li = document.createElement('li');
            if (idx === 0) li.classList.add('active');
            li.setAttribute('data-src', filePath(t.file));
            li.setAttribute('data-title', t.title);
            li.setAttribute('data-artist', t.artist || '');
            if (t.cover) li.setAttribute('data-cover', t.cover);
            li.setAttribute('data-date', t.date);
            li.innerHTML = `
                <div class="thumb" style="background-image:url('${(t.cover || defaultCover).replace(/'/g, "%27")}')"></div>
                <div class="meta"><span class="t">${t.title}</span><small class="a">${t.artist}</small></div>
                <div class="right"><div class="eq" aria-hidden="true"><i></i><i></i><i></i></div></div>
            `;
            li.tabIndex = 0;
            tracklist.appendChild(li);
        });
        // Do not auto-load any track; keep initial UI until user selects
        const countEl = document.getElementById('trackCount');
        if (countEl) countEl.textContent = `${tracks.length} song${tracks.length !== 1 ? 's' : ''}`;
        // Limit visible height to exactly 3 items for a calmer view
        sizeTracklistViewport(3);
    }

    renderTracklist();
    // Recompute viewport on resize for responsiveness
    window.addEventListener('resize', () => sizeTracklistViewport(3));

    // Track switching
    if (tracklist) {
        tracklist.addEventListener('click', async (e) => {
            const li = e.target.closest('li');
            if (!li) return;
            [...tracklist.children].forEach(x => { x.classList.remove('active'); x.classList.remove('playing'); x.removeAttribute('aria-current'); });
            li.classList.add('active');
            li.setAttribute('aria-current', 'true');
            const src = li.getAttribute('data-src');
            const title = li.getAttribute('data-title') || '';
            const artist = li.getAttribute('data-artist') || '';
            const cover = li.getAttribute('data-cover');
            if (titleEl) titleEl.textContent = title;
            if (artistEl) artistEl.textContent = artist ? `${artist}` : '';
            if (cover && coverEl) {
                coverEl.classList.add('swap');
                const onL = () => { coverEl.classList.remove('swap'); coverEl.removeEventListener('load', onL); };
                coverEl.addEventListener('load', onL);
                coverEl.src = cover;
            }

            hasLoadedTrack = true;
            setPlayingState(false);
            audio.pause();
            seek.value = 0; curTime.textContent = '00:00'; durTime.textContent = '00:00';
            audio.src = src;
            audio.load();
            // Wait a microtask so metadata listeners can run, then attempt to play
            Promise.resolve().then(async () => {
                try { await audio.play(); setPlayingState(true); } catch { /* autoplay may be blocked */ }
            });
        });
        // Keyboard activation (Enter/Space)
        tracklist.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const li = document.activeElement.closest('li');
                if (li && tracklist.contains(li)) {
                    e.preventDefault();
                    li.click();
                }
            }
        });
        setupVolumePopover();
    }
})();

// Helper: size the tracklist viewport to show N items exactly (with scroll for the rest)
function sizeTracklistViewport(visibleCount) {
    const list = document.getElementById('tracklist');
    const scroll = document.querySelector('.tracklist-scroll');
    if (!list || !scroll) return;
    // Measure after layout settles
    requestAnimationFrame(() => {
        const items = Array.from(list.children).slice(0, visibleCount);
        if (items.length === 0) return;
        let total = 0;
        for (const li of items) total += li.getBoundingClientRect().height;
        // Add row gaps between items
        const cs = getComputedStyle(list);
        const rowGap = parseFloat(cs.rowGap || '0') || 0;
        if (items.length > 1) total += rowGap * (items.length - 1);
        // Add a tiny padding so last item isn't clipped
        total += 6;
        scroll.style.maxHeight = Math.ceil(total) + 'px';
    });
}
