// Nota de "chance de venda" de um site para cada loja (0 a 100) e os motivos.
// Função pura: recebe a loja já com o resultado da checagem do site (loja.checagem).
(function (raiz) {
  'use strict';

  function pontuar(l) {
    const motivos = [];
    let necessidade = 0; // quanto a loja precisa de site (0 a 75)
    const c = l.checagem;

    if (l.fechadoDeVez) return { chance: 0, nivel: 'fora', motivos: [{ t: 'fechada de vez', tipo: 'ruim' }] };

    if (!l.detalhada && !l.site) {
      // ainda não sabemos se tem site
      necessidade = -1;
    } else if (!l.site) {
      necessidade = 70;
      motivos.push({ t: 'sem site no Google', tipo: 'ruim' });
    } else if (!c) {
      necessidade = -1;
    } else if (c.tipo === 'social') {
      necessidade = 64;
      motivos.push({ t: `"site" é o ${c.plataforma}`, tipo: 'ruim' });
    } else if (c.tipo === 'pedido') {
      necessidade = 58;
      motivos.push({ t: `só tem ${c.plataforma}`, tipo: 'ruim' });
    } else if (!c.alcancavel) {
      necessidade = 66;
      motivos.push({ t: `site ${c.erro || 'fora do ar'}`, tipo: 'ruim' });
    } else {
      if (c.vazio) { necessidade += 40; motivos.push({ t: 'site vazio / em construção', tipo: 'ruim' }); }
      if (c.celular === false) { necessidade += 22; motivos.push({ t: 'não se ajusta ao celular', tipo: 'ruim' }); }
      if (!c.https) { necessidade += 14; motivos.push({ t: 'sem cadeado (https)', tipo: 'ruim' }); }
      if (c.ms > 5000) { necessidade += 10; motivos.push({ t: `lento (${(c.ms / 1000).toFixed(1)} s)`, tipo: 'ruim' }); }
      if (c.antigo) { necessidade += 12; motivos.push({ t: 'visual antigo', tipo: 'ruim' }); }
      if (c.ano && c.ano <= new Date().getFullYear() - 3) { necessidade += 10; motivos.push({ t: `parado desde ${c.ano}`, tipo: 'ruim' }); }
      if (/grátis|gratuito|Construtor|desativado/i.test(c.plataforma || '')) { necessidade += 18; motivos.push({ t: c.plataforma, tipo: 'ruim' }); }
      else if (c.plataforma) motivos.push({ t: `feito em ${c.plataforma}`, tipo: '' });
      if (necessidade === 0) motivos.push({ t: 'site parece bom', tipo: 'bom' });
      necessidade = Math.min(necessidade, 62);
    }

    // força do negócio (0 a 25): muitas avaliações e nota boa = vende bem e tem como investir
    const av = l.avaliacoes || 0;
    let forca = Math.min(18, Math.max(0, Math.log10(av + 1) * 7.5));
    if (l.nota >= 4.5) forca += 5; else if (l.nota >= 4.2) forca += 3; else if (l.nota && l.nota < 3.6) forca -= 3;
    if (l.pedidoOnline) forca += 2;
    forca = Math.max(0, Math.min(25, forca));
    if (av >= 300) motivos.push({ t: `${av} avaliações`, tipo: 'bom' });
    if (l.fechadoTemporario) motivos.push({ t: 'fechada temporariamente', tipo: 'ruim' });

    if (necessidade < 0) return { chance: null, nivel: 'carregando', motivos };
    let chance = Math.round(necessidade + forca);
    if (l.fechadoTemporario) chance = Math.round(chance * 0.6);
    chance = Math.max(0, Math.min(100, chance));
    const nivel = chance >= 60 ? 'quente' : chance >= 35 ? 'morna' : 'fria';
    return { chance, nivel, motivos };
  }

  // telefone do Maps ("061996412062", "+55 61 99641-2062") -> { digitos, celular, wa }
  function telefone(t) {
    let d = String(t || '').replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
    if (d.startsWith('0')) d = d.replace(/^0+/, '');
    if (d.length < 10) return { digitos: d, celular: false, wa: '' };
    const ddd = d.slice(0, 2), num = d.slice(2);
    const celular = num.length === 9 && num[0] === '9';
    const bonito = num.length === 9 ? `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}` : `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
    return { digitos: d, celular, bonito, wa: celular ? `55${d}` : '' };
  }

  raiz.MC = { pontuar, telefone };
  if (typeof module !== 'undefined') module.exports = raiz.MC;
})(typeof self !== 'undefined' ? self : globalThis);
