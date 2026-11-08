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
  // "Faaaaaaaaah": a breathy F, then a long, loud falling shout (two detuned saw voices with vibrato through "a" formants,
  // lightly driven for grit), the pitch sliding down like a groan
  function faah() {
    const a = ctx(); if (!a) return; const t = a.currentTime, out = a.createGain(), drive = a.createWaveShaper(), k = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; k[i] = Math.tanh(2.2 * x); } drive.curve = k; out.gain.value = 0.7; drive.connect(out).connect(a.destination);
    const n = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = a.createBufferSource(), hp = a.createBiquadFilter(), ng = a.createGain(); ns.buffer = n; hp.type = 'highpass'; hp.frequency.value = 1800;
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.5, t + 0.1); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    ns.connect(hp).connect(ng).connect(out); ns.start(t); ns.stop(t + 0.5);
    const v = t + 0.26, dur = 2.6, vo = a.createGain(), vib = a.createOscillator(), vg = a.createGain();
    vib.frequency.setValueAtTime(4.5, v); vib.frequency.linearRampToValueAtTime(7, v + dur); vg.gain.value = 7;
    vo.gain.setValueAtTime(0.0001, v); vo.gain.exponentialRampToValueAtTime(1, v + 0.1); vo.gain.setValueAtTime(1, v + dur * 0.5); vo.gain.exponentialRampToValueAtTime(0.0001, v + dur);
    for (const det of [0, 7]) { const o = a.createOscillator(); o.type = 'sawtooth'; o.detune.value = det;
      o.frequency.setValueAtTime(330, v); o.frequency.linearRampToValueAtTime(300, v + 0.5); o.frequency.exponentialRampToValueAtTime(95, v + dur);
      vib.connect(vg).connect(o.frequency); o.connect(vo); o.start(v); o.stop(v + dur + 0.05); }
    for (const [f, q, g] of [[750, 6, 1], [1200, 8, 0.7], [2600, 10, 0.3]]) { const bp = a.createBiquadFilter(), bg = a.createGain(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, v); bp.frequency.linearRampToValueAtTime(f * 0.85, v + dur); bp.Q.value = q; bg.gain.value = g; vo.connect(bp).connect(bg).connect(drive); }
    vib.start(v); vib.stop(v + dur + 0.05);
  }
  // the owner's own clip, if one is saved in this browser (localStorage btLab:lossSound, a data URL under 1.5 MB)
  let custom = null, customName = null; try { custom = localStorage.getItem('btLab:lossSound'); customName = localStorage.getItem('btLab:lossSoundName'); } catch (e) {}
  function playLoss() { if (custom) { try { const el = new Audio(custom); el.volume = 1; el.play().catch(() => faah()); return; } catch (e) {} } faah(); }
  const fmtR = (r) => (r == null || !isFinite(r) ? '' : (r > 0 ? '+' : '') + (+r).toFixed(2).replace(/\.?0+$/, '') + 'R');
  window.BTFX = {
    win(R, sub, title) { const d = layer('win', title || 'Target hit', [fmtR(R), sub].filter(Boolean).join(' · ')); confetti(d); if (on) chime(); },
    loss(R, sub, title) { layer('loss', title || 'Stopped out', [fmtR(R), sub].filter(Boolean).join(' · ')); if (!RM()) { document.body.classList.remove('btfx-shake'); void document.body.offsetWidth; document.body.classList.add('btfx-shake'); setTimeout(() => document.body.classList.remove('btfx-shake'), 600); } if (on) playLoss(); },
    playLoss() { ctx(); playLoss(); },
    get customName() { return custom ? customName || 'your sound' : null; },
    setCustom(file) { if (!file) { custom = customName = null; try { localStorage.removeItem('btLab:lossSound'); localStorage.removeItem('btLab:lossSoundName'); } catch (e) {} return Promise.resolve(true); }
      if (!/^audio\//.test(file.type)) return Promise.resolve('That is not an audio file'); if (file.size > 1.5e6) return Promise.resolve('Too big: keep the clip under 1.5 MB (a few seconds)');
      return new Promise((res) => { const r = new FileReader(); r.onload = () => { try { localStorage.setItem('btLab:lossSound', r.result); localStorage.setItem('btLab:lossSoundName', file.name); custom = r.result; customName = file.name; res(true); } catch (e) { res('This browser has no room to keep the sound'); } }; r.onerror = () => res('Could not read the file'); r.readAsDataURL(file); }); },
    get sound() { return on; },
    set sound(v) { on = !!v; try { localStorage.setItem('btLab:sound', on ? '1' : '0'); } catch (e) {} if (on) ctx(); },
    unlock: ctx,
  };
  // browsers start audio only after a user gesture: open the context on the first click or key
  const un = () => { if (on) ctx(); removeEventListener('pointerdown', un); removeEventListener('keydown', un); };
  addEventListener('pointerdown', un); addEventListener('keydown', un);
})();
