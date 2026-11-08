// ChronosTrade trade effects (owner, 8 Nov 2026: "when someone hits TP make an effect on the screen, and when he loses an effect
// and a sound saying faaaaaah"). BTFX.win(R) / BTFX.loss(R): a full-screen overlay (confetti + green glow, or red flash + shake)
// and a sound made with WebAudio (a rising chime; a synthesized falling "faaaah" voice: noise "f" then a sawtooth through
// "a" formants, gliding down). No audio files. Sound is on by default and remembered (localStorage btLab:sound);
// prefers-reduced-motion keeps a short fade only.
(function () {
  if (window.BTFX) return;
  const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let on = true; try { on = localStorage.getItem('btLab:sound') !== '0'; } catch (e) {}
  let ac = null; const ctx = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; } return ac; };
  const css = `
  .btfx{position:fixed;inset:0;pointer-events:none;z-index:2000}
  .btfx canvas{position:absolute;inset:0;width:100%;height:100%}
  .btfx .glow{position:absolute;inset:0;opacity:0;animation:btfxGlow 1.4s cubic-bezier(.22,1,.36,1) forwards}
  .btfx.win .glow{box-shadow:inset 0 0 140px 30px rgba(47,191,143,.55)}
  .btfx.loss .glow{background:radial-gradient(ellipse at center,rgba(242,87,111,0) 40%,rgba(242,87,111,.42) 100%)}
  .btfx .big{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%) scale(.6);font:800 clamp(44px,9vw,104px)/1 Figtree,system-ui,sans-serif;letter-spacing:-.03em;opacity:0;animation:btfxPop 1.6s cubic-bezier(.22,1,.36,1) forwards;text-shadow:0 10px 40px rgba(0,0,0,.35);white-space:nowrap}
  .btfx.win .big{color:#2fbf8f}.btfx.loss .big{color:#f2576f}
  .btfx .big small{display:block;text-align:center;font-size:.24em;font-weight:650;letter-spacing:.02em;margin-top:.35em;opacity:.9}
  @keyframes btfxGlow{0%{opacity:0}18%{opacity:1}100%{opacity:0}}
  @keyframes btfxPop{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}16%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}30%{transform:translate(-50%,-50%) scale(1)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%) scale(1)}}
  @keyframes btfxShake{0%,100%{transform:none}15%{transform:translate(-9px,3px) rotate(-.4deg)}30%{transform:translate(8px,-3px) rotate(.4deg)}45%{transform:translate(-6px,2px)}60%{transform:translate(5px,-1px)}75%{transform:translate(-3px,1px)}}
  body.btfx-shake #app{animation:btfxShake .5s cubic-bezier(.36,.07,.19,.97)}
  @media (prefers-reduced-motion:reduce){.btfx .big{animation-duration:1.2s}.btfx .glow{animation-duration:.9s}}`;
  let styled = false;
  function layer(kind, title, sub) {
    if (!styled) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); styled = true; }
    document.querySelectorAll('.btfx').forEach((n) => n.remove());
    const d = document.createElement('div'); d.className = 'btfx ' + kind; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = `<div class="glow"></div><div class="big">${title}<small>${sub || ''}</small></div>`; document.body.appendChild(d);
    setTimeout(() => d.remove(), 2600); return d;
  }
  function confetti(host) {
    if (RM()) return; const c = document.createElement('canvas'); host.appendChild(c); const dpr = Math.min(2, devicePixelRatio || 1);
    const W = (c.width = innerWidth * dpr), H = (c.height = innerHeight * dpr), g = c.getContext('2d');
    const cols = ['#2fbf8f', '#e3b341', '#5b8cff', '#ffffff', '#7ee2b8'], P = [];
    for (let i = 0; i < 160; i++) { const left = i % 2 === 0; P.push({ x: left ? 0 : W, y: H * 0.75, vx: (left ? 1 : -1) * (6 + Math.random() * 10) * dpr, vy: -(10 + Math.random() * 14) * dpr, r: (3 + Math.random() * 4) * dpr, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: cols[i % cols.length] }); }
    const t0 = performance.now();
    (function f(now) { const t = (now - t0) / 1000; if (t > 2.4) return; g.clearRect(0, 0, W, H);
      for (const p of P) { p.vy += 0.42 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; g.save(); g.globalAlpha = Math.max(0, 1 - t / 2.4); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); }
      requestAnimationFrame(f); })(t0);
  }
  function chime() {
    const a = ctx(); if (!a) return; const t = a.currentTime, out = a.createGain(); out.gain.value = 0.22; out.connect(a.destination);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.9, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.7);
      o.connect(g).connect(out); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.75); });
  }
  // "faaaaaah": a breathy f (filtered noise), then a falling voiced "aah" (sawtooth with vibrato through three vowel formants)
  function faah() {
    const a = ctx(); if (!a) return; const t = a.currentTime, out = a.createGain(); out.gain.value = 0.5; out.connect(a.destination);
    const n = a.createBuffer(1, a.sampleRate * 0.4, a.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = a.createBufferSource(), hp = a.createBiquadFilter(), ng = a.createGain(); ns.buffer = n; hp.type = 'highpass'; hp.frequency.value = 2200;
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.35, t + 0.08); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    ns.connect(hp).connect(ng).connect(out); ns.start(t); ns.stop(t + 0.4);
    const v = t + 0.2, dur = 1.6, o = a.createOscillator(), vib = a.createOscillator(), vg = a.createGain(), vo = a.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(260, v); o.frequency.linearRampToValueAtTime(235, v + 0.35); o.frequency.exponentialRampToValueAtTime(120, v + dur);
    vib.frequency.value = 5.5; vg.gain.value = 5; vib.connect(vg).connect(o.frequency);
    vo.gain.setValueAtTime(0.0001, v); vo.gain.exponentialRampToValueAtTime(0.8, v + 0.12); vo.gain.setValueAtTime(0.8, v + dur * 0.55); vo.gain.exponentialRampToValueAtTime(0.0001, v + dur);
    o.connect(vo);
    for (const [f, q, g] of [[800, 8, 1], [1150, 9, 0.6], [2900, 12, 0.25]]) { const bp = a.createBiquadFilter(), bg = a.createGain(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; bg.gain.value = g; vo.connect(bp).connect(bg).connect(out); }
    o.start(v); vib.start(v); o.stop(v + dur + 0.05); vib.stop(v + dur + 0.05);
  }
  const fmtR = (r) => (r == null || !isFinite(r) ? '' : (r > 0 ? '+' : '') + (+r).toFixed(2).replace(/\.?0+$/, '') + 'R');
  window.BTFX = {
    win(R, sub, title) { const d = layer('win', title || 'Target hit', [fmtR(R), sub].filter(Boolean).join(' · ')); confetti(d); if (on) chime(); },
    loss(R, sub, title) { layer('loss', title || 'Stopped out', [fmtR(R), sub].filter(Boolean).join(' · ')); if (!RM()) { document.body.classList.remove('btfx-shake'); void document.body.offsetWidth; document.body.classList.add('btfx-shake'); setTimeout(() => document.body.classList.remove('btfx-shake'), 600); } if (on) faah(); },
    get sound() { return on; },
    set sound(v) { on = !!v; try { localStorage.setItem('btLab:sound', on ? '1' : '0'); } catch (e) {} if (on) ctx(); },
    unlock: ctx,
  };
  // browsers start audio only after a user gesture: open the context on the first click or key
  const un = () => { if (on) ctx(); removeEventListener('pointerdown', un); removeEventListener('keydown', un); };
  addEventListener('pointerdown', un); addEventListener('keydown', un);
})();
