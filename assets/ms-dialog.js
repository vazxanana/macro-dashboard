// Styled dialogs for the whole site (owner, 8 Nov 2026: the browser's own prompt / confirm / alert boxes look "very ugly").
//   await msAsk(label, value?, { title, ok, type: 'text'|'password', placeholder, max })  -> string, or null on cancel
//   await msConfirm(message, { title, ok, danger })                                       -> true / false
//   msAlert(message, { title })                                                           -> Promise (window.alert is routed here)
//   msCopy(text, { title })                                                               -> shows the text selected, with a Copy button
// Built on <dialog> (focus trap, Esc closes, backdrop); colours from the page's own tokens, with fallbacks.
(function () {
  if (window.msAsk) return;
  const css = `
  .msd{border:1px solid var(--line-strong,rgba(255,255,255,.14));border-radius:16px;padding:0;width:min(440px,calc(100vw - 32px));background:var(--panel,#111318);color:var(--ink,#eceef2);box-shadow:0 30px 70px rgba(0,0,0,.45);font:14px/1.5 var(--sans,Figtree,system-ui,sans-serif)}
  .msd::backdrop{background:rgba(5,7,12,.55);backdrop-filter:blur(4px)}
  .msd[open]{animation:msdIn .18s cubic-bezier(.22,1,.36,1)}@keyframes msdIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
  .msd form{display:grid;gap:12px;padding:20px 20px 16px}
  .msd h3{margin:0;font-size:16px;font-weight:650;letter-spacing:-.01em;display:flex;align-items:center;gap:10px}
  .msd h3 i{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--accent-soft,rgba(91,140,255,.14));color:var(--accent,#5b8cff);font-style:normal;flex:none}
  .msd h3 i svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .msd.danger h3 i{background:var(--sell-soft,rgba(242,87,111,.14));color:var(--sell,#f2576f)}
  .msd p{margin:0;color:var(--ink-dim,#a4abb8);font-size:13.5px;white-space:pre-wrap;word-break:break-word}
  .msd label{display:grid;gap:6px;font-size:12.5px;color:var(--ink-dim,#a4abb8)}
  .msd input,.msd textarea{width:100%;box-sizing:border-box;min-height:42px;padding:9px 12px;border-radius:10px;border:1px solid var(--line,rgba(255,255,255,.1));background:var(--panel-raised,#171a21);color:var(--ink,#eceef2);font:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
  .msd input:focus,.msd textarea:focus{border-color:var(--accent,#5b8cff);box-shadow:0 0 0 3px var(--accent-soft,rgba(91,140,255,.18))}
  .msd input:focus-visible,.msd textarea:focus-visible{outline:none!important}
  .msd textarea{min-height:110px;resize:vertical;font:12px/1.5 var(--mono,ui-monospace,monospace)}
  .msd .msd-a{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
  .msd button{min-height:38px;padding:0 16px;border-radius:10px;border:1px solid var(--line,rgba(255,255,255,.12));background:transparent;color:var(--ink,#eceef2);font:600 13.5px var(--sans,system-ui,sans-serif);cursor:pointer;transition:background .15s,border-color .15s,transform .08s}
  .msd button:hover{background:var(--panel-hover,rgba(255,255,255,.05));border-color:var(--line-strong,rgba(255,255,255,.2))}
  .msd button:active{transform:translateY(1px)}
  /* fixed fills: white on the themes' --accent / --sell was 3.2-4.5:1 (QA sweep 11 Nov); these are 5.1 and 5.6 in every theme */
  .msd button.pri{background:#2a62f0;border-color:#2a62f0;color:#fff}.msd button.pri:hover{filter:brightness(1.08);background:#2a62f0}
  .msd.danger button.pri,.msd.danger button.pri:hover{background:#c8243f;border-color:#c8243f}
  .msd button:focus-visible{outline:2px solid var(--accent,#5b8cff);outline-offset:2px}
  @media (pointer:coarse){.msd button,.msd input{min-height:44px}}
  @media (prefers-reduced-motion:reduce){.msd[open]{animation:none}}`;
  const ICON = { ask: '<path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M13 7l4 4"/>', confirm: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>' };
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let styled = false;
  function open(kind, o) {
    if (!styled) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); styled = true; }
    return new Promise((done) => {
      const d = document.createElement('dialog'); d.className = 'msd' + (o.danger ? ' danger' : ''); const icon = ICON[o.icon || (o.type === 'password' ? 'lock' : kind)] || ICON.ask;
      const field = kind === 'ask' ? `<label>${esc(o.label || '')}<input name="v" type="${o.type === 'password' ? 'password' : 'text'}" value="${esc(o.value)}" placeholder="${esc(o.placeholder || '')}" ${o.max ? `maxlength="${o.max}"` : ''} autocomplete="${o.type === 'password' ? 'current-password' : 'off'}" spellcheck="false"></label>`
        : kind === 'copy' ? `<textarea name="v" readonly>${esc(o.value)}</textarea>` : '';
      d.innerHTML = `<form method="dialog"><h3><i><svg viewBox="0 0 24 24">${icon}</svg></i>${esc(o.title)}</h3>${o.message ? `<p>${esc(o.message)}</p>` : ''}${field}
        <div class="msd-a">${kind === 'alert' ? '' : `<button type="button" value="cancel" data-x>${kind === 'copy' ? 'Close' : 'Cancel'}</button>`}<button type="submit" class="pri" value="ok">${esc(o.ok || (kind === 'copy' ? 'Copy' : 'OK'))}</button></div></form>`;
      document.body.appendChild(d);
      const inp = d.querySelector('[name=v]'); let result = kind === 'confirm' ? false : null, settled = false;
      const finish = () => { if (settled) return; settled = true; d.remove(); done(result); };
      d.querySelector('form').addEventListener('submit', async (e) => { e.preventDefault();
        if (kind === 'copy') { try { await navigator.clipboard.writeText(o.value); d.querySelector('.pri').textContent = 'Copied'; setTimeout(() => d.close(), 700); } catch (x) { inp.select(); document.execCommand && document.execCommand('copy'); d.querySelector('.pri').textContent = 'Selected: press Ctrl+C'; } return; }
        result = kind === 'ask' ? inp.value : kind === 'confirm' ? true : undefined; d.close(); });
      const x = d.querySelector('[data-x]'); if (x) x.addEventListener('click', () => d.close());
      d.addEventListener('close', finish); d.addEventListener('cancel', () => { result = kind === 'confirm' ? false : null; });
      d.showModal(); setTimeout(() => { if (inp) { inp.focus(); inp.select(); } else d.querySelector('.pri').focus(); }, 20);
    });
  }
  window.msAsk = (label, value, o = {}) => { const long = !o.title && String(label).length > 48; return open('ask', { title: o.title || (long ? 'Your input' : label), label: o.title && !long ? label : '', message: long ? label : '', value: value == null ? '' : value, ...o }); };
  window.msConfirm = (message, o = {}) => open('confirm', { title: o.title || 'Are you sure?', message, ok: o.ok || 'Confirm', ...o });
  window.msAlert = (message, o = {}) => open('alert', { title: o.title || 'Heads up', message, ok: 'OK', ...o });
  window.msCopy = (text, o = {}) => open('copy', { title: o.title || 'Copy', value: text, ...o });
  window.alert = (m) => { window.msAlert(String(m)); };
})();
