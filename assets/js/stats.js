(function () {
    // Brasilia timezone: America/Sao_Paulo (UTC-3, or UTC-2 during DST)
    // Birthday: 07/11 every year
    // High School start: 01/02/2023
    // Project window: 30/10/2025 21:22 -> 06/11/2025 23:59

    const TZ = 'America/Sao_Paulo';
    // Set this to the user's birth year (e.g., 2008) or set data-birth-year on <body> in HTML
    const BIRTH_YEAR = 2007;

    const numberFormat = new Intl.NumberFormat('pt-BR');
    const dateFormat = new Intl.DateTimeFormat('pt-BR', {
        timeZone: TZ,
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
    // For dates constructed as Brazil wall-clock on the UTC timeline, format with UTC to show the intended local date
    const wallDateFormat = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'UTC',
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
        timeZone: TZ,
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const cards = {
        birthday: {
            root: document.getElementById('birthdayCountdown'),
            value: document.querySelector('#birthdayCountdown .value'),
            fields: {
                date: document.querySelector('[data-field="birthday-date"]'),
                age: document.querySelector('[data-field="birthday-age"]'),
                weeks: document.querySelector('[data-field="birthday-weeks"]'),
                hours: document.querySelector('[data-field="birthday-hours"]')
            }
        },
        highSchool: {
            root: document.getElementById('highSchoolTime'),
            value: document.querySelector('#highSchoolTime .value'),
            fields: {
                days: document.querySelector('[data-field="hs-days"]'),
                hours: document.querySelector('[data-field="hs-hours"]')
            }
        },
        project: {
            root: document.getElementById('projectTime'),
            value: document.querySelector('#projectTime .value'),
            fields: {
                minutes: document.querySelector('[data-field="project-minutes"]'),
                seconds: document.querySelector('[data-field="project-seconds"]')
            }
        }
    };

    const highSchoolStart = brDateUTC(2023, 2, 1, 0, 0, 0);
    const highSchoolFreezeAt = brDateUTC(2025, 12, 5, 0, 0, 0);
    const projectStart = brDateUTC(2025, 10, 30, 21, 22, 0);
    const projectStop = brDateUTC(2025, 11, 6, 23, 59, 0);

    // No static extra fields rendered for HS/Project after trimming

    setupToggles();

    function brDateUTC(year, month /*1-12*/, day, hour = 0, minute = 0, second = 0) {
        return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    }

    function nowBrazil() {
        const fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone: TZ,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const parts = fmt.formatToParts(new Date());
        const get = (type) => parts.find(p => p.type === type)?.value;
        const year = Number(get('year'));
        const month = Number(get('month'));
        const day = Number(get('day'));
        const hour = Number(get('hour'));
        const minute = Number(get('minute'));
        const second = Number(get('second'));
        return brDateUTC(year, month, day, hour, minute, second);
    }

    function nextBirthday(now) {
        let year = now.getUTCFullYear();
        const month = now.getUTCMonth() + 1;
        const day = now.getUTCDate();
        if (month > 11 || (month === 11 && day >= 7)) {
            year += 1;
        }
        return brDateUTC(year, 11, 7, 0, 0, 0);
    }

    function diffTotals(ms) {
        const clamped = Math.max(0, ms);
        const totalSeconds = Math.floor(clamped / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        const totalDays = Math.floor(totalHours / 24);
        return {
            ms: clamped,
            totalSeconds,
            totalMinutes,
            totalHours,
            totalDays,
            weeks: Math.floor(totalDays / 7),
            remainderHours: totalHours % 24,
            remainderMinutes: totalMinutes % 60,
            remainderSeconds: totalSeconds % 60
        };
    }

    function diffCalendar(from, to) {
        let years = to.getUTCFullYear() - from.getUTCFullYear();
        let months = to.getUTCMonth() - from.getUTCMonth();
        let days = to.getUTCDate() - from.getUTCDate();

        if (days < 0) {
            months -= 1;
            const previousMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0));
            days += previousMonth.getUTCDate();
        }
        if (months < 0) {
            years -= 1;
            months += 12;
        }
        return { years, months, days };
    }

    function fmtCountdown(ms) {
        const totals = diffTotals(ms);
        const days = totals.totalDays;
        const hours = totals.remainderHours;
        const minutes = totals.remainderMinutes;
        const seconds = totals.remainderSeconds;
        return `${numberFormat.format(days)}d · ${String(hours).padStart(2, '0')}h · ${String(minutes).padStart(2, '0')}min · ${String(seconds).padStart(2, '0')}s`;
    }

    // Abbreviation helper: '123 h', '45 min', etc.
    function withUnit(value, unit) {
        return `${numberFormat.format(value)} ${unit}`;
    }

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function setupToggles() {
        document.querySelectorAll('.timer').forEach((card) => {
            const toggle = card.querySelector('.timer-toggle');
            const extra = card.querySelector('.timer-extra');
            if (!toggle || !extra) return;

            // Ensure inner padding wrapper exists so container height can be 0
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
                    // Close: animate height to 0
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
                    // Open: measure target height and animate from 0
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
                }
            });
        });
    }

    const projectDurationMs = Math.max(0, projectStop - projectStart);
    const projectTotals = diffTotals(projectDurationMs);
    const projectValueLabel = `${projectTotals.totalHours}h · ${pad(projectTotals.remainderMinutes)}min · ${pad(projectTotals.remainderSeconds)}s`;
    const projectSecondsLabel = withUnit(projectTotals.totalSeconds, 's');

    function renderProjectTotals() {
        if (!cards.project.value) return;
        cards.project.value.textContent = projectValueLabel;
        if (cards.project.fields.seconds) {
            cards.project.fields.seconds.textContent = projectSecondsLabel;
        }
    }

    function tick() {
        const now = nowBrazil();
        // const nowDisplay = dateTimeFormat.format(now); // no longer displayed in extras

        // 1. Time 'till next birthday
        const birthdayTarget = nextBirthday(now);
        const birthdayDiff = diffTotals(birthdayTarget - now);
        cards.birthday.value.textContent = fmtCountdown(birthdayDiff.ms);
        // Show the Brazil wall-date correctly (07/11), using UTC formatter for UTC-anchored wall-clock
        cards.birthday.fields.date.textContent = wallDateFormat.format(birthdayTarget);
        // Current age (requires birth year)
        const birthYear = Number(document.body?.dataset?.birthYear ?? BIRTH_YEAR);
        if (Number.isFinite(birthYear)) {
            const thisYearBirthday = brDateUTC(now.getUTCFullYear(), 11, 7, 0, 0, 0);
            let age = now >= thisYearBirthday ? (now.getUTCFullYear() - birthYear) : (now.getUTCFullYear() - birthYear - 1);
            if (age < 0) age = 0;
            cards.birthday.fields.age.textContent = withUnit(age, 'y');
        } else if (cards.birthday.fields.age) {
            cards.birthday.fields.age.textContent = '--';
        }
        cards.birthday.fields.weeks.textContent = withUnit(birthdayDiff.weeks, 'weeks');
        cards.birthday.fields.hours.textContent = withUnit(birthdayDiff.totalHours, 'h');

        // 2. High School elapsed
        const hsNow = now >= highSchoolFreezeAt ? highSchoolFreezeAt : now;
        const hsDiffMs = hsNow - highSchoolStart;
        const hsTotals = diffTotals(hsDiffMs);
        const hsCalendar = diffCalendar(highSchoolStart, hsNow);
        cards.highSchool.value.textContent = `${hsCalendar.years}y · ${pad(hsCalendar.months)}m · ${pad(hsCalendar.days)}d · ${pad(hsTotals.remainderHours)}h`;
        cards.highSchool.fields.days.textContent = withUnit(hsTotals.totalDays, 'd');
        cards.highSchool.fields.hours.textContent = withUnit(hsTotals.totalHours, 'h');

        // Project work time remains frozen to the curated window
    }

    renderProjectTotals();
    tick();
    setInterval(tick, 1000);
})();
