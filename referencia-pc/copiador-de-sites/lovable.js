'use strict';
/* global Zip */
// Exportação para a Lovable: transforma a cópia visual num projeto TanStack Start pronto para o GitHub.
//   src/routes/<pagina>.tsx   -> uma rota por página (o HTML vai dentro, o CSS entra pela <head> da rota)
//   public/site/...           -> CSS, imagens, fontes e mídia da cópia (os caminhos relativos continuam valendo)
//   public/site/_reset.css    -> devolve o visual padrão do navegador onde o site original não definiu nada
//                                (o reset do Tailwind da Lovable não estraga a cópia)
(function (root) {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const PREFIXO = '/site/';

  // O CSS da cópia não vem dentro de @layer, então ganha do reset do Tailwind (que fica em @layer base).
  // Onde a cópia não definiu nada, "revert" volta ao padrão do navegador, como no site original.
  const RESET_CSS = `/* Gerado pelo Copiador de Sites. Carregado ANTES do CSS da cópia (que vence quando define algo). */
:where(html, body, .site-copy, .site-copy *) { all: revert; }
`;

  const lerZip = (zip) => {
    const m = new Map();
    for (const f of zip.arquivos) m.set(dec.decode(f.nome), f.bytes);
    return m;
  };
  const ehHtml = (n) => /\.html?$/i.test(n) && !n.includes('/');
  const slugDe = (arquivo) => arquivo.replace(/\.html?$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pagina';
  const nomeComp = (slug) => 'Pagina' + slug.split('-').filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  const atributo = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  // referência relativa a um arquivo da cópia -> caminho absoluto dentro de /site/
  function criaReescritor(ativos, paginas) {
    const rota = new Map(paginas.map((p) => [p.arquivo, p.rota]));
    const ref = (v) => {
      if (!v) return v;
      const t = v.trim();
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(t)) return v;
      const limpo = t.replace(/^\.\//, '');
      const caminho = limpo.split(/[?#]/)[0];
      let dec1 = caminho;
      try { dec1 = decodeURIComponent(caminho); } catch (_) {}
      if (ativos.has(dec1)) return PREFIXO + limpo;
      return v;
    };
    const link = (v) => {
      if (!v) return v;
      const t = v.trim();
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(t)) return v;
      const [arq, ...resto] = t.replace(/^\.\//, '').split('#');
      if (rota.has(arq)) return rota.get(arq) + (resto.length ? '#' + resto.join('#') : '');
      return ref(v);
    };
    const css = (txt) => txt.replace(/url\(\s*(['"]?)([^)'"]+?)\1\s*\)/g, (m, q, u) => {
      const novo = ref(u);
      return novo === u ? m : `url(${q}${novo}${q})`;
    });
    const srcset = (v) => v.split(/,\s+(?=\S)/).map((p) => {
      const [u, ...r] = p.trim().split(/\s+/);
      return [ref(u), ...r].join(' ');
    }).join(', ');
    return { ref, link, css, srcset };
  }

  function montaPagina(arquivo, html, rew, rota) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const info = { arquivo, rota, slug: rota === '/' ? 'index' : rota.slice(1) };

    // <head>: título, descrição, redes sociais, CSS e ícone entram pela rota
    info.titulo = atributo(doc.title) || atributo(info.slug);
    const meta = [];
    const pega = (sel, chave, valor) => {
      const el = doc.querySelector(sel);
      const v = el && atributo(el.getAttribute('content'));
      if (v) meta.push({ [chave]: valor, content: v });
    };
    pega('meta[name="description" i]', 'name', 'description');
    pega('meta[property="og:title"]', 'property', 'og:title');
    pega('meta[property="og:description"]', 'property', 'og:description');
    pega('meta[property="og:type"]', 'property', 'og:type');
    const og = doc.querySelector('meta[property="og:image"]');
    if (og && /^https?:/i.test(og.getAttribute('content') || '')) meta.push({ property: 'og:image', content: og.getAttribute('content') });
    info.meta = meta;

    info.links = [];
    doc.querySelectorAll('link[href]').forEach((l) => {
      const rel = (l.getAttribute('rel') || '').toLowerCase();
      const href = rew.ref(l.getAttribute('href'));
      if (/stylesheet/.test(rel)) info.links.push({ rel: 'stylesheet', href });
      else if (/(^|\s)icon($|\s)|apple-touch-icon/.test(rel)) {
        const o = { rel: l.getAttribute('rel'), href };
        if (l.getAttribute('type')) o.type = l.getAttribute('type');
        if (l.getAttribute('sizes')) o.sizes = l.getAttribute('sizes');
        info.links.push(o);
      }
    });

    // <style> do head vai junto com o HTML (fica antes do conteúdo)
    const estilos = [...doc.head.querySelectorAll('style')].map((s) => `<style>${rew.css(s.textContent)}</style>`).join('\n');

    // reescreve os caminhos dentro do corpo
    const body = doc.body;
    body.querySelectorAll('[src]').forEach((el) => el.setAttribute('src', rew.ref(el.getAttribute('src'))));
    body.querySelectorAll('[poster]').forEach((el) => el.setAttribute('poster', rew.ref(el.getAttribute('poster'))));
    body.querySelectorAll('[srcset]').forEach((el) => el.setAttribute('srcset', rew.srcset(el.getAttribute('srcset'))));
    body.querySelectorAll('[data-src]').forEach((el) => el.setAttribute('data-src', rew.ref(el.getAttribute('data-src'))));
    body.querySelectorAll('image[href], use[href]').forEach((el) => el.setAttribute('href', rew.ref(el.getAttribute('href'))));
    body.querySelectorAll('a[href]').forEach((el) => el.setAttribute('href', rew.link(el.getAttribute('href'))));
    body.querySelectorAll('link[href]').forEach((el) => el.setAttribute('href', rew.ref(el.getAttribute('href'))));
    body.querySelectorAll('style').forEach((s) => { s.textContent = rew.css(s.textContent); });
    body.querySelectorAll('[style]').forEach((el) => el.setAttribute('style', rew.css(el.getAttribute('style'))));

    info.bodyClass = atributo(body.getAttribute('class'));
    info.bodyStyle = rew.css(body.getAttribute('style') || '');
    info.lang = doc.documentElement.getAttribute('lang') || '';
    info.markup = (estilos ? estilos + '\n' : '') + body.innerHTML;
    return info;
  }

  function tsxDaPagina(p, resetHref) {
    const links = [{ rel: 'stylesheet', href: resetHref }, ...p.links];
    const headObj = { meta: [{ title: p.titulo }, ...p.meta], links };
    const j = (x) => JSON.stringify(x, null, 2).replace(/\n/g, '\n  ');
    const comp = nomeComp(p.slug);
    return `// Página copiada com o Copiador de Sites (${p.arquivo}). O HTML fica na constante "markup".
// Edite os textos direto aqui ou peça para a Lovable ajustar. O CSS e as imagens ficam em public/site/.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

const markup = ${JSON.stringify(p.markup)};

export const Route = createFileRoute(${JSON.stringify(p.rota)})({
  head: () => (${j(headObj)}),
  component: ${comp},
});

function ${comp}() {
  useEffect(() => {
    // o <body> do site original tinha classes/estilos que o CSS copiado usa
    const classes = ${JSON.stringify(p.bodyClass)}.split(" ").filter(Boolean);
    const estiloAntes = document.body.getAttribute("style");
    document.body.classList.add(...classes);
    ${p.bodyStyle ? `document.body.style.cssText += ";" + ${JSON.stringify(p.bodyStyle)};` : ''}
    return () => {
      document.body.classList.remove(...classes);
      if (estiloAntes === null) document.body.removeAttribute("style"); else document.body.setAttribute("style", estiloAntes);
    };
  }, []);
  return <div className="site-copy" dangerouslySetInnerHTML={{ __html: markup }} />;
}
`;
  }

  function leiaMe(info) {
    return [
      'PROJETO PARA A LOVABLE (feito pelo Copiador de Sites)',
      `Copiado de: ${info.url}`,
      `Data: ${new Date().toLocaleString('pt-BR')}`,
      `Páginas: ${info.paginas.map((p) => p.rota).join('  ')}`,
      '',
      'COMO USAR',
      '1. Na Lovable, crie um projeto novo (pode ser com um pedido simples, ex.: "página em branco").',
      '2. No projeto, conecte o GitHub (botão do GitHub > Connect project) para criar o repositório.',
      '3. Coloque estes arquivos no repositório, na branch main:',
      '   - Pelo site do GitHub: Add file > Upload files, arraste as pastas "src" e "public" e confirme (Commit).',
      '   - Ou pelo git: extraia este .zip dentro da pasta do repositório e faça commit + push.',
      '   - Ou use o campo "Enviar direto para o GitHub" do Copiador, que faz isso por você.',
      '4. A Lovable atualiza sozinha. As rotas novas entram no menu do projeto na hora.',
      '',
      'O QUE VAI DENTRO',
      '- src/routes/*.tsx : uma rota por página, com o HTML copiado.',
      '- public/site/      : CSS, imagens, fontes e mídia (os caminhos continuam valendo).',
      '- public/site/_reset.css : mantém o visual igual ao original mesmo com o Tailwind da Lovable.',
      '',
      'LIMITES (cópia visual)',
      '- Sem scripts: menus que abrem, carrosséis, animações e 3D ficam parados. Peça à Lovable para refazer a parte que precisar.',
      '- O que dependia de servidor do site original (carrinho, login, busca) não funciona.',
      '- Use somente em sites com autorização do dono.'
    ].join('\r\n');
  }

  // tmp = Zip gerado por copiaVisual (index.html, outras .html, css/, img/, fontes/...)
  // info = { url, paginas: [{url, titulo}] } ; devolve um Zip novo no formato da Lovable
  function montaLovable(tmp, info) {
    const arqs = lerZip(tmp);
    const htmls = [...arqs.keys()].filter(ehHtml);
    if (!htmls.length) throw new Error('A cópia não gerou nenhuma página para exportar.');
    const ativos = new Set([...arqs.keys()].filter((n) => !ehHtml(n) && n !== 'LEIA-ME.txt'));

    const usados = new Set();
    const paginas = htmls.sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b))).map((arquivo) => {
      let slug = arquivo === 'index.html' ? '' : slugDe(arquivo);
      if (slug === 'site') slug = 'site-pagina';
      let base = slug;
      for (let i = 2; usados.has(slug); i++) slug = `${base}-${i}`;
      usados.add(slug);
      return { arquivo, rota: slug ? '/' + slug : '/' };
    });
    const rew = criaReescritor(ativos, paginas);

    const out = new Zip();
    const resetHref = PREFIXO + '_reset.css';
    out.adiciona('public/site/_reset.css', RESET_CSS);
    for (const n of ativos) out.adiciona('public/site/' + n, arqs.get(n));
    const infoPaginas = [];
    for (const p of paginas) {
      const pg = montaPagina(p.arquivo, dec.decode(arqs.get(p.arquivo)), rew, p.rota);
      infoPaginas.push(pg);
      const nomeArq = p.rota === '/' ? 'index.tsx' : p.rota.slice(1) + '.tsx';
      out.adiciona('src/routes/' + nomeArq, tsxDaPagina(pg, resetHref));
    }
    out.adiciona('LEIA-ME-LOVABLE.txt', leiaMe({ url: info.url, paginas: infoPaginas }));
    return { zip: out, paginas: infoPaginas };
  }

  // ------------------------------------------------------------ envio direto para o GitHub (API Git Data)
  // Faz UM commit novo em cima da branch padrão (a que a Lovable acompanha). Nunca reescreve o histórico.
  const b64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  async function enviaGitHub(cfg, zip, opc) {
    const log = (opc && opc.log) || (() => {});
    const repo = String(cfg.repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repositório inválido. Use o formato usuario/repositorio.');
    if (!cfg.token) throw new Error('Cole o token do GitHub.');
    const api = async (metodo, caminho, corpo) => {
      const r = await fetch('https://api.github.com' + caminho, {
        method: metodo,
        headers: {
          Authorization: 'Bearer ' + cfg.token,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(corpo ? { 'Content-Type': 'application/json' } : {})
        },
        body: corpo ? JSON.stringify(corpo) : undefined
      });
      const txt = await r.text();
      let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (_) {}
      if (!r.ok) {
        const msg = (j && j.message) || txt.slice(0, 200) || 'sem resposta';
        const dica = r.status === 401 ? ' (token inválido ou vencido)'
          : r.status === 403 || r.status === 404 ? ' (confira o nome do repositório e se o token tem a permissão "Contents: Read and write" nele)'
          : r.status === 409 ? ' (repositório vazio: faça o primeiro commit pela Lovable e tente de novo)' : '';
        throw new Error(`GitHub ${r.status}: ${msg}${dica}`);
      }
      return j;
    };
    const info = await api('GET', `/repos/${repo}`);
    const ramo = cfg.ramo || info.default_branch || 'main';
    if (info.permissions && info.permissions.push === false) throw new Error('Este token não tem permissão de escrita nesse repositório.');
    log(`GitHub: ${repo} (branch ${ramo})`, 'ok');
    const ref = await api('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(ramo)}`);
    const base = ref.object.sha;
    const commitBase = await api('GET', `/repos/${repo}/git/commits/${base}`);

    const arquivos = zip.arquivos
      .map((f) => ({ caminho: new TextDecoder().decode(f.nome), bytes: f.bytes }))
      .filter((f) => !/^LEIA-ME/i.test(f.caminho));
    const itens = [];
    let feitos = 0, i = 0;
    await Promise.all(Array.from({ length: Math.min(6, arquivos.length) }, async () => {
      while (i < arquivos.length) {
        const f = arquivos[i++];
        const blob = await api('POST', `/repos/${repo}/git/blobs`, { content: b64(f.bytes), encoding: 'base64' });
        itens.push({ path: f.caminho, mode: '100644', type: 'blob', sha: blob.sha });
        feitos++;
        if (opc && opc.progresso) opc.progresso(feitos / arquivos.length);
      }
    }));
    itens.sort((a, b) => a.path.localeCompare(b.path));
    const arvore = await api('POST', `/repos/${repo}/git/trees`, { base_tree: commitBase.tree.sha, tree: itens });
    const mensagem = cfg.mensagem || 'feat: site copiado com o Copiador de Sites';
    const commit = await api('POST', `/repos/${repo}/git/commits`, { message: mensagem, tree: arvore.sha, parents: [base] });
    // sem force: se alguém mexeu na branch no meio do caminho, o GitHub recusa em vez de apagar o trabalho
    await api('PATCH', `/repos/${repo}/git/refs/heads/${encodeURIComponent(ramo)}`, { sha: commit.sha, force: false });
    return { repo, ramo, commit: commit.sha, arquivos: arquivos.length, url: `https://github.com/${repo}/commit/${commit.sha}` };
  }

  root.CopiadorLovable = { montaLovable, enviaGitHub };
})(typeof self !== 'undefined' ? self : window);
