// vercel.json's rewrites and headers, read from that file so there is one source of truth.
// Patterns: path-to-regexp as Vercel uses it (":name", ":name*", raw "(…)" groups).

export function compile(source) {
  let re = '', names = [], i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === ':') {
      const m = /^:([A-Za-z_]\w*)(\*)?/.exec(source.slice(i));
      names.push(m[1]);
      re += m[2] ? '(.*)' : '([^/]+)';
      i += m[0].length;
    } else if (c === '(') {
      let depth = 0, j = i;
      for (; j < source.length; j++) { if (source[j] === '(') depth++; else if (source[j] === ')' && --depth === 0) break; }
      re += source.slice(i, j + 1); names.push(null); i = j + 1;
    } else if (c === '\\') { re += source.slice(i, i + 2); i += 2; }
    else { re += /[.+?^${}|[\]]/.test(c) ? '\\' + c : c; i++; }
  }
  return { re: new RegExp('^' + re + '$'), names };
}

export function match(source, path) {
  const { re, names } = compile(source);
  const m = re.exec(path);
  if (!m) return null;
  const p = {};
  names.forEach((n, k) => { if (n) p[n] = m[k + 1] || ''; });
  return p;
}

const fill = (dest, p) => dest.replace(/:([A-Za-z_]\w*)\*?/g, (_, n) => (n in p ? p[n] : ''));

// First matching rewrite wins (one pass, as on Vercel). Returns the new path and query.
export function rewrite(rewrites, url) {
  for (const r of rewrites || []) {
    const p = match(r.source, url.pathname);
    if (!p) continue;
    const to = new URL(fill(r.destination, p), url.origin);
    const out = new URL(url);
    out.pathname = to.pathname;
    for (const [k, v] of to.searchParams) out.searchParams.set(k, v);
    return out;
  }
  return url;
}

const condOk = (url, list, want) => (list || []).every((c) => c.type !== 'query' || url.searchParams.has(c.key) === want);

// Every matching header rule applies, later ones winning (Vercel's order). Matched on the ORIGINAL path.
export function headersFor(rules, url) {
  const out = {};
  for (const r of rules || []) {
    if (!match(r.source, url.pathname)) continue;
    if (!condOk(url, r.has, true) || !condOk(url, r.missing, false)) continue;
    for (const h of r.headers) out[h.key] = h.value;
  }
  return out;
}
