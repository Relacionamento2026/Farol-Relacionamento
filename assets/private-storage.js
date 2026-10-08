/* Private Storage adapter: stable database paths, authenticated downloads only. */
(function (root) {
  'use strict';
  const ORIGIN = 'https://pvorwgrpkcofoukbqtyg.supabase.co';
  function parse(value) {
    try {
      const url = new URL(value);
      if (url.origin !== ORIGIN) return null;
      const match = url.pathname.match(/^\/storage\/v1\/object\/public\/(materiais|UPLOADS)\/(.+)$/);
      return match ? {bucket: match[1], path: decodeURIComponent(match[2])} : null;
    } catch (_) { return null; }
  }
  function createResolver(getClient, urls = URL) {
    const cache = new Map(); let generation = 0;
    return {
      async resolve(value) {
        const file = parse(value); if (!file) return value;
        const client = getClient(); if (!client) throw new Error('Entre no Farol para abrir o arquivo.');
        const key = file.bucket + '/' + file.path;
        if (!cache.has(key)) {
          const epoch = generation;
          const pending = (async () => {
            const {data, error} = await client.storage.from(file.bucket).download(file.path);
            if (error || !data) throw new Error('Arquivo indisponível ou acesso não autorizado.');
            if (epoch !== generation) throw new Error('Sessão encerrada.');
            return urls.createObjectURL(data);
          })();
          cache.set(key, pending);
          pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
        }
        return cache.get(key);
      },
      clear() {
        generation++;
        for (const promise of cache.values()) promise.then(url => urls.revokeObjectURL(url), () => {});
        cache.clear();
      }
    };
  }
  function install(getClient) {
    const resolver = createResolver(getClient);
    const originals = new WeakMap();
    async function rewrite(el) {
      if (!el.getAttribute) return;
      for (const attr of ['href', 'src', 'data', 'poster']) {
        let original = el.getAttribute(attr); if (!original) continue;
        // Office's remote viewer cannot open a private file: offer authenticated download.
        if (el.tagName === 'IFRAME' && original.startsWith('https://view.officeapps.live.com/')) {
          const source = new URL(original).searchParams.get('src');
          if (parse(source)) {
            const link = document.createElement('a'); link.href = source;
            link.textContent = 'Baixar apresentação'; link.className = 'pdf-btn';
            el.replaceWith(link); return;
          }
        }
        const file = parse(original); if (!file) continue;
        const known = originals.get(el) || {}; known[attr] = original; originals.set(el, known);
        if (attr === 'href') { el.dataset.privateFile = original; el.removeAttribute('href'); }
        else el.removeAttribute(attr);
        try {
          const secured = await resolver.resolve(original);
          if (!el.isConnected || originals.get(el)?.[attr] !== original) continue;
          el.setAttribute(attr, secured);
          if (attr === 'href') { el.download = file.path.split('/').pop(); el.rel = 'noopener'; }
        } catch (_) { el.title = 'Entre no Farol para acessar este arquivo.'; }
      }
    }
    function scan(node) {
      rewrite(node);
      if (node.querySelectorAll) node.querySelectorAll('[src],[href],[data],[poster]').forEach(rewrite);
    }
    const observer = new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'attributes') rewrite(r.target);
        else r.addedNodes.forEach(scan);
      }
    });
    observer.observe(document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['src','href','data','poster']});
    scan(document.body);
    document.addEventListener('click', async event => {
      const anchor = event.target.closest?.('a[data-private-file]'); if (!anchor) return;
      if (anchor.href.startsWith('blob:')) return;
      event.preventDefault();
      try { anchor.href = await resolver.resolve(anchor.dataset.privateFile); anchor.click(); }
      catch (_) { alert('Não foi possível abrir o arquivo. Confira seu acesso ao Farol.'); }
    });
    return {resolve: resolver.resolve, clear() {
      resolver.clear();
      document.querySelectorAll('[src],[href],[data],[poster]').forEach(el => {
        const old = originals.get(el); if (!old) return;
        for (const attr of Object.keys(old)) el.removeAttribute(attr);
      });
    }};
  }
  const api = {parse,createResolver,install};
  if (typeof module !== 'undefined') module.exports = api;
  root.FarolPrivateStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
