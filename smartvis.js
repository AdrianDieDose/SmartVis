(function () {
    /* ================= CONFIG ================= */

    const BAR_COUNT = 20;
    const MIN = -0.4;
    const MAX = 1.0;
    const PEAK = 2;

    const DIVS = [0.25, 0.5, 1];
    const CUSTOM_COLORS = [
        "#1db954", "#ff4d4d", "#4dd2ff",
        "#b44dff", "#ffb84d", "#ffffff", "default"
    ];

    /* ================= ENGINE ================= */

    const Engine = {
        ts: 0,
        dt: 1,
        active: true,
        update(ts) {
            if (!this.ts) this.ts = ts;
            this.dt = Math.min(3, (ts - this.ts) / 16.666);
            this.ts = ts;
        }
    };

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

        const barOuter = createFlex("row");
        barOuter.id = "smartVisBarWrapper";
        Object.assign(barOuter.style, { width: "84%", height: "6px" });

        const barInner = createFlex("row", "2px");
        Object.assign(barInner.style, { width: "100%", height: "100%" });

        barOuter.appendChild(barInner);
        playerBar.after(barOuter);

        injectStyles(spiceColor);

        const bars = [];
        const states = [];

        for (let i = 0; i < BAR_COUNT; i++) {
            const bar = document.createElement("div");
            bar.className = "smartVisBar";
            bar.style.backgroundColor = spiceColor;
            barInner.appendChild(bar);

            bars.push(bar);
            states.push({
                target: Math.random(),
                timer: Math.random() * 400 + 100,
                phase: Math.random() * Math.PI * 2,
                flicker: 1
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

        /* ---------- STATE ---------- */

        const MODES = ["main", "pulse", "pump", "pulse-pump","pulse-beat-pump", "off"];
        let modeIndex = 0;
        let mode = MODES[0];

        let bpm = 120;
        let taps = [];
        let divIndex = 2;
        let bpmFactor = DIVS[divIndex];

        let pulseIndex = 0;
        let lastBeat = 0;
        let lastVolume = 0;

        /* ---------- UI ---------- */

        ctx.modeBtn.onclick = () => {
            modeIndex = (modeIndex + 1) % MODES.length;
            mode = MODES[modeIndex];
            ctx.modeBtn.innerHTML =
                mode === "main" ? MODE_MAIN_SVG :
                mode === "pulse" ? MODE_PULSE_SVG :
                mode === "off"   ? MODE_OFF_SVG   :
                PUMP_SVG;
        };

        ctx.bpmBtn.onclick = () => tapBPM();

        ctx.divBtn.onclick = () => {
            divIndex = (divIndex + 1) % DIVS.length;
            bpmFactor = DIVS[divIndex];
            ctx.divBtn.textContent = bpmFactor === 1 ? "1×" : bpmFactor === 0.5 ? "½" : "¼";
        };

let colorIndex = 0;
ctx.colorBtn.onclick = () => {
    colorIndex = (colorIndex + 1) % CUSTOM_COLORS.length;
    let c = CUSTOM_COLORS[colorIndex];
    if (c === "default") c = getSpiceColor();
    ctx.setColor(c);
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
            const e = wf.reduce((a, b) => a + b * b, 0) / wf.length;
            if (e > lastVolume * 1.4) lastBeat = Engine.ts;
            lastVolume += (e - lastVolume) * 0.2;
        }

        /* ================= MODES ================= */

        const Modes = {

            off(bar) {
                return { opacity: MIN, brightness: 0.5 };
            },

            pulse(bar, s, i, ctx, beatInterval) {
                const on = i <= pulseIndex;
                return {
                    opacity: on ? MAX : MIN,
                    brightness: on ? 1.5 : 0.5
                };
            },

            main(bar, s) {
                return {
                    opacity: s.target,
                    brightness: 0.5 + s.target * 1.4
                };
            },

            pump(bar, s, i, ctx, beatInterval) {
                const phase = Engine.ts / beatInterval * Math.PI * 2;
                const p = 0.6 + Math.sin(phase) * 0.8;
                const o = s.target * p;
                return { opacity: o, brightness: 0.6 + o * 1.5 };
            },

            "pulse-pump"(bar, s, i, ctx, beatInterval) {
                s.phase += (0.6 + bpm / 180) * Engine.dt * 0.02;
                const phase = s.phase + (i / ctx.bars.length) * Math.PI * 2;
                const pulse = 0.6 + Math.sin(phase) * 0.8;
                return {
                    opacity: pulse,
                    brightness: 0.7 + pulse * 1.6
                };
            },
			"pulse-beat-pump"(bar, s, i, ctx, beatInterval) {

    // beat synced pump
    const beatPhase = Engine.ts / beatInterval * Math.PI * 2;
    const beat = 0.6 + Math.sin(beatPhase) * 0.8;

    // flowing pulse phase
    s.phase += (0.6 + bpm / 180) * Engine.dt * 0.02;
    const flowPhase = s.phase + (i / ctx.bars.length) * Math.PI * 2;
    const flow = 0.6 + Math.sin(flowPhase) * 0.8;

    // combine
    const pulse = beat * flow;
    const o = s.target * pulse;

    return {
        opacity: o,
        brightness: 0.6 + o * 1.7
    };
},
        };

        /* ================= DRAW ================= */

        function draw(ts) {
            requestAnimationFrame(draw);
            Engine.update(ts);
            if (!Engine.active) return;

            const interval = 60000 / (bpm * bpmFactor);
            if (!Spicetify.Player.isPlaying()) return;

            autoBPM();

            if (mode === "pulse" && ts - lastBeat > interval) {
                lastBeat = ts;
                pulseIndex = 0;
            }

            ctx.bars.forEach((bar, i) => {
                const s = ctx.states[i];
                s.timer -= Engine.dt * 16;
                if (s.timer <= 0) {
                    s.target = Math.random();
                    s.timer = Math.random() * 300 + 100;
                }

                const out = Modes[mode]?.(bar, s, i, ctx, interval)
                    || Modes.main(bar, s);

                bar.style.opacity = clamp(out.opacity, MIN, MAX);
                bar.style.filter = `brightness(${out.brightness})`;
            });

            pulseIndex = Math.min(pulseIndex + 1, ctx.bars.length - 1);
        }

        requestAnimationFrame(draw);
    }

    /* ================= HELPERS ================= */

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    function getSpiceColor() {
        return getComputedStyle(document.body)
            .getPropertyValue("--spice-button-active")
            .trim() || "#fff";
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
            }
            .smartVisBar {
                flex: 1;
				height: 6px;            
                background: ${color};
                opacity: .2;
                filter: brightness(.5);
                transition: opacity .08s linear, filter .08s linear;
            }
        `;
        document.head.appendChild(s);
    }

    /* ================= SVGs ================= */

    const MODE_MAIN_SVG = `<svg viewBox="0 0 24 24" width="16" height="16"><polyline points="3,14 7,10 11,16 15,6 19,12" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    const MODE_PULSE_SVG = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M2 12h20" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    const MODE_OFF_SVG   = `<svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor"/></svg>`;
    const BPM_SVG        = `<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    const PUMP_SVG       = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M13 2L3 14h7l-1 8 12-14h-7z" fill="currentColor"/></svg>`;
    const DROPLET_SVG    = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C12 2 5 9 5 14a7 7 0 0 0 14 0c0-5-7-12-7-12z" fill="currentColor"/></svg>`;

    init();
})();
