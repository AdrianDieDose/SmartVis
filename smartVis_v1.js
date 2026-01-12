(function () {
    /* ================= CONFIG ================= */

    const BAR_COUNT = 20;
    const MIN = -0.5, MAX = 1, PEAK = 2;
    const DIVS = [0.25, 0.5, 1];
    const CUSTOM_COLORS = ["#1db954", "#ff4d4d", "#4dd2ff", "#b44dff", "#ffb84d", "#ffffff", "default"];

    /* ===== PUMP TUNING ===== */

    const PUMP_STRENGTH = 0.85;
    const PUMP_PHASE_SPREAD = 0.6;
    const PUMP_BRIGHTNESS_FLOOR = 0.1;
    const PUMP_BRIGHTNESS_WEIGHT = 0.7;

    /* ================= INIT ================= */

    function init() {
        if (!window.Spicetify || !Spicetify.Player)
            return setTimeout(init, 500);
        insertVisualizer();
    }

    /* ================= DOM INSERT ================= */

    function insertVisualizer() {
        const rightBar = document.querySelector(".main-nowPlayingBar-right");
        const playerControls = document.querySelector(".player-controls");
        const playerBar = playerControls?.querySelector(".playback-bar");
        const lyricsBtn = document.querySelector('.LyricsPageIcon');

        if (!rightBar || !playerControls || !playerBar)
            return setTimeout(insertVisualizer, 500);

        if (document.getElementById("smartVisBtnWrapper")) return;

        const spiceColor = getSpiceColor();

        /* ---------- UI ---------- */

        const btnWrapper = createFlex("row", "6px");
        btnWrapper.id = "smartVisBtnWrapper";

        const modeBtn  = makeButton("Mode", MODE_MAIN_SVG, btnWrapper);
        const bpmBtn   = makeButton("Tap BPM", BPM_SVG, btnWrapper);
        const divBtn   = makeTextButton("BPM Division", "1×", btnWrapper);
        const colorBtn = makeButton("Color", DROPLET_SVG, btnWrapper);

        rightBar.insertBefore(btnWrapper, rightBar.lastChild);

        /* ---------- Bars ---------- */

        const barWrapperOuter = createFlex("row");
        barWrapperOuter.id = "smartVisBarWrapper";
        Object.assign(barWrapperOuter.style, {
            width: "84%",
            height: "6px"
        });

        const barWrapper = createFlex("row", "2px");
        Object.assign(barWrapper.style, {
            width: "100%",
            height: "100%"
        });

        barWrapperOuter.appendChild(barWrapper);
        playerBar.after(barWrapperOuter);

        injectStyles(spiceColor);

        const bars = [];
        const states = [];

        for (let i = 0; i < BAR_COUNT; i++) {
            const bar = document.createElement("div");
            bar.className = "smartVisBar";
            bar.style.backgroundColor = spiceColor;
            barWrapper.appendChild(bar);

            bars.push(bar);
            states.push({
                target: Math.random(),
                timer: Math.random() * 400 + 100,
                phase: Math.random() * Math.PI * 2
            });
        }

        startVisualizer({
            bars,
            states,
            modeBtn,
            bpmBtn,
            divBtn,
            colorBtn,
            setColor: c => bars.forEach(b => b.style.backgroundColor = c)
        });
    }

    /* ================= VISUALIZER ================= */

    function startVisualizer(ctx) {
        const MODES = ["main", "pulse", "pump", "pump_new", "pulse-pump", "off"];
        let modeIndex = 0;
        let mode = MODES[0];

        let bpm = 120;
        let taps = [];

        let divIndex = 2;
        let bpmFactor = DIVS[divIndex];

        let pulseIndex = 0;
        let lastBeat = performance.now();
        let lastVolume = 0;

        let colorMode = "spice";
        let colorIndex = 0;
        let currentColor = getSpiceColor();

        observeSpiceColor(c => {
            if (colorMode === "spice") {
                currentColor = c;
                ctx.setColor(c);
            }
        });

        /* ---------- Buttons ---------- */

        ctx.modeBtn.onclick = () => {
            modeIndex = (modeIndex + 1) % MODES.length;
            mode = MODES[modeIndex];

            ctx.modeBtn.innerHTML =
                mode === "main" ? MODE_MAIN_SVG :
                mode === "pulse" ? MODE_PULSE_SVG :
                mode === "off" ? MODE_OFF_SVG :
                PUMP_SVG;
        };

        ctx.bpmBtn.onclick = () => {
            tapBPM();
            ctx.bpmBtn.classList.add("pulse");
            setTimeout(() => ctx.bpmBtn.classList.remove("pulse"), 150);
        };

        ctx.divBtn.onclick = () => {
            divIndex = (divIndex + 1) % DIVS.length;
            bpmFactor = DIVS[divIndex];
            ctx.divBtn.textContent =
                bpmFactor === 1 ? "1×" :
                bpmFactor === 0.5 ? "½" : "¼";
        };

        ctx.colorBtn.onclick = () => {
            colorMode = "custom";
            colorIndex = (colorIndex + 1) % CUSTOM_COLORS.length;
            currentColor = CUSTOM_COLORS[colorIndex];
            
			if(currentColor == "default"){
				currentColor = getSpiceColor();
				ctx.setColor(currentColor);
			}else{
				ctx.setColor(currentColor);
			}
			
        };

        /* ---------- BPM ---------- */

        function tapBPM() {
            taps.push(performance.now());
            if (taps.length > 4) taps.shift();
            if (taps.length < 2) return;

            const diffs = taps.slice(1).map((t, i) => t - taps[i]);
            bpm = 60000 / (diffs.reduce((a, b) => a + b) / diffs.length);
        }

        function autoBPM() {
            const wf = Spicetify.Player.data?._raw?.waveform;
            if (!wf) return;

            const vol = wf.reduce((a, b) => a + b * b, 0) / wf.length;
            if (vol > lastVolume * 1.5) tapBPM();
            lastVolume = vol;
        }

        /* ---------- DRAW ---------- */

        function draw(ts) {
            requestAnimationFrame(draw);

            const interval = 60000 / (bpm * bpmFactor);
            const trackPos = Spicetify.Player.getProgress();

            if (mode === "off") {
                ctx.bars.forEach(b => {
                    b.style.opacity = MIN;
                    b.style.filter = "brightness(0.5)";
                });
                return;
            }

            if (mode === "pulse") {
                if (ts - lastBeat > interval) {
                    lastBeat = ts;
                    pulseIndex = 0;
                }

                ctx.bars.forEach((b, i) => {
                    const on = i <= pulseIndex;
                    b.style.opacity = on ? MAX : MIN;
                    b.style.filter = `brightness(${on ? 1.5 : 0.5})`;
                });

                pulseIndex = Math.min(pulseIndex + 1, ctx.bars.length - 1);
                return;
            }

            if (!Spicetify.Player.isPlaying()) return;
            autoBPM();

            ctx.bars.forEach((bar, i) => {
                const s = ctx.states[i];
                s.timer -= 16;
				// Pulse pump is shit bc of new max and min values
                if (s.timer <= 0) {
                    s.target = Math.min(
                        MIN + Math.random() * (MAX - MIN) * PEAK,
                        1
                    );
                    s.timer = Math.random() * 200 + 50;
                }

                const cur = parseFloat(bar.style.opacity) || MIN;
                let next;

                if (mode === "pump_new") {
                    const pump = 0.6 + Math.sin((trackPos / interval) * Math.PI * 2) * 0.8;
                    next = cur + (s.target - cur) * 0.25 * pump;
                }
                else if (mode === "pump") {
                    const pulse = 0.6 + Math.sin((trackPos / interval) * Math.PI * 2) * 0.8;
                    next = cur + (s.target * pulse - cur) * 0.25;
                }
else if (mode === "pulse-pump") {
    const basePhase = (trackPos / interval) * Math.PI * 2;

    if (typeof s.waveDirection === "undefined") {
        s.waveDirection = 1;
        s.targetDirection = Math.random() < 0.5 ? 1 : -1;
        s.waveTimer = Math.random() * 5000 + 3000;
    }

    s.waveTimer -= 16;
    if (s.waveTimer <= 0) {
        s.targetDirection *= -1;
        s.waveTimer = Math.random() * 5000 + 3000;
    }

    s.waveDirection += (s.targetDirection - s.waveDirection) * 0.05;

    // Spread wave across more bars for rightward motion
    const phaseOffset = (i / ctx.bars.length) * Math.PI * 2; // i/ctx.bars.length
    const wavePhase = basePhase + phaseOffset + s.phase * PUMP_PHASE_SPREAD;

    // Pulse expanded to light more bars at once
    const pulse = 0.8 + Math.sin(wavePhase) * 1.2; // higher amplitude

    // Flicker for randomness
    if (!s.flickerTimer) s.flickerTimer = Math.random() * 500;
    if (!s.flickerValue) s.flickerValue = 1;

    s.flickerTimer -= 16;
    if (s.flickerTimer <= 0) {
        s.flickerValue = 0.85 + Math.random() * 0.3; // more variation
        s.flickerTimer = Math.random() * 400 + 200;
    }

    const multiplier = 0.85; // stronger movement
    next = cur + (s.target * pulse * s.flickerValue - cur) * multiplier;

    // Clamp opacity
    const clampedNext = Math.max(0, Math.min(next, MAX));

    // Brightness calculation
    let brightness = PUMP_BRIGHTNESS_FLOOR + clampedNext * PUMP_BRIGHTNESS_WEIGHT + pulse * (1 - PUMP_BRIGHTNESS_WEIGHT);
    brightness *= 1.6; // brighten more
    brightness = Math.max(0, brightness);

    bar.style.opacity = clampedNext;
    bar.style.filter = `brightness(${brightness})`;
    return;
}





                else {
                    next = cur + (s.target - cur) * 0.25;
                }

                bar.style.opacity = next;
                bar.style.filter = `brightness(${0.5 + next * 1.5})`;
            });
        }

        requestAnimationFrame(draw);
    }

    /* ================= HELPERS ================= */

    function getSpiceColor() {
        return getComputedStyle(document.body)
            .getPropertyValue("--spice-button-active")
            .trim() || "#fff";
    }

    function observeSpiceColor(onChange) {
        let last = getSpiceColor();
        new MutationObserver(() => {
            const c = getSpiceColor();
            if (c !== last) {
                last = c;
                onChange(c);
            }
        }).observe(document.body, {
            attributes: true,
            attributeFilter: ["style", "class"]
        });
    }

    function createFlex(dir, gap = "0") {
        const d = document.createElement("div");
        Object.assign(d.style, {
            display: "flex",
            flexDirection: dir,
            alignItems: "center",
            gap
        });
        return d;
    }

    function makeButton(title, svg, parent) {
        const b = document.createElement("button");
        b.title = title;
        b.innerHTML = svg;
        parent.appendChild(b);
        return b;
    }

    function makeTextButton(title, text, parent) {
        const b = document.createElement("button");
        b.title = title;
        b.textContent = text;
        b.style.fontSize = "11px";
        b.style.fontWeight = "600";
        parent.appendChild(b);
        return b;
    }

    function injectStyles(color) {
        if (document.getElementById("smartVisStyles")) return;

        const s = document.createElement("style");
        s.id = "smartVisStyles";
        s.textContent = `
            #smartVisBtnWrapper button {
                width: 28px;
                height: 28px;
                border: none;
                background: transparent;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform .1s ease;
            }
            #smartVisBtnWrapper button:hover {
                transform: scale(1.15);
            }
            .smartVisBar {
                flex: 1;
                height: 100%;
                background: ${color};
                opacity: .2;
                filter: brightness(.5);
                transition: opacity .1s linear, filter .1s linear;
            }
        `;
        document.head.appendChild(s);
    }

    /* ================= SVGs ================= */

    const MODE_MAIN_SVG =
        `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,14 7,10 11,16 15,6 19,12"/>
        </svg>`;

    const MODE_PULSE_SVG =
        `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 12h20"/>
        </svg>`;

    const MODE_OFF_SVG =
        `<svg viewBox="0 0 24 24" width="16" height="16">
            <rect x="3" y="3" width="18" height="18" rx="2"
                  fill="transparent" stroke="currentColor"/>
        </svg>`;

    const BPM_SVG =
        `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="7" x2="12" y2="12"/>
        </svg>`;

    const PUMP_SVG =
        `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M13 2L3 14h7l-1 8 12-14h-7l-1-6z"/>
        </svg>`;

    const DROPLET_SVG =
        `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 2C12 2 5 9 5 14a7 7 0 0 0 14 0c0-5-7-12-7-12z"/>
        </svg>`;

    init();
})();
