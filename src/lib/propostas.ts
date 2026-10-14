export type ItemProposta = {
  id: string;
  nome: string;
  detalhe: string;
  valor: number;
  ativo: boolean;
};

export type DadosProposta = {
  seuNome: string;
  seuWhats: string;
  cliente: string;
  clienteWhats: string;
  negocio: string;
  itens: ItemProposta[];
  prazo: string;
  validade: string;
  pagamento: string;
  desconto: number;
  obs: string;
};

export const PACOTES: Omit<ItemProposta, "ativo">[] = [
  {
    id: "site",
    nome: "Site profissional",
    detalhe: "Página com cardápio/serviços, botão de WhatsApp, mapa e versão para celular",
    valor: 600,
  },
  {
    id: "dominio",
    nome: "Domínio e publicação",
    detalhe: "Endereço próprio (.com.br) e site no ar por 1 ano",
    valor: 150,
  },
  {
    id: "social",
    nome: "Gestão de Instagram (mensal)",
    detalhe: "12 posts por mês com arte e legenda, agendados",
    valor: 450,
  },
  {
    id: "reels",
    nome: "Edição de Reels (pacote 10)",
    detalhe: "10 vídeos curtos editados com legenda e cortes dinâmicos",
    valor: 300,
  },
  {
    id: "identidade",
    nome: "Identidade visual",
    detalhe: "Logo, paleta de cores e modelos para posts",
    valor: 350,
  },
  {
    id: "google",
    nome: "Perfil no Google Maps",
    detalhe: "Criação ou ajuste do perfil da empresa com fotos e horários",
    valor: 120,
  },
];

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function totais(d: DadosProposta) {
  const sub = d.itens.filter((i) => i.ativo).reduce((s, i) => s + (Number(i.valor) || 0), 0);
  const desc = Math.min(Math.max(d.desconto || 0, 0), 100);
  return { sub, desc, total: sub * (1 - desc / 100) };
}

export function soDigitos(s: string) {
  const d = s.replace(/\D/g, "");
  if (!d) return "";
  return d.length <= 11 ? `55${d}` : d;
}

export function mensagemWhats(d: DadosProposta): string {
  const { sub, desc, total } = totais(d);
  const ativos = d.itens.filter((i) => i.ativo);
  const linhas = [
    `Olá${d.cliente ? `, ${d.cliente}` : ""}! Tudo bem?`,
    "",
    `${d.seuNome ? `Aqui é ${d.seuNome}. ` : ""}Preparei uma proposta para ${d.negocio || "o seu negócio"}:`,
    "",
    ...ativos.map((i) => `✅ *${i.nome}* — ${brl(Number(i.valor) || 0)}\n   ${i.detalhe}`),
    "",
    desc > 0 ? `Subtotal: ${brl(sub)}\nDesconto: ${desc}%` : null,
    `💰 *Total: ${brl(total)}*`,
    d.pagamento ? `💳 Pagamento: ${d.pagamento}` : null,
    d.prazo ? `⏱️ Prazo de entrega: ${d.prazo}` : null,
    d.validade ? `📅 Proposta válida até: ${d.validade}` : null,
    d.obs ? `\n${d.obs}` : null,
    "",
    "Posso te mandar a proposta completa em PDF. Ficou alguma dúvida?",
  ];
  return linhas
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export function htmlProposta(d: DadosProposta): string {
  const { sub, desc, total } = totais(d);
  const hoje = new Date().toLocaleDateString("pt-BR");
  const ativos = d.itens.filter((i) => i.ativo);
  const linhas = ativos
    .map(
      (i) =>
        `<tr><td><b>${esc(i.nome)}</b><br><span>${esc(i.detalhe)}</span></td><td class="v">${brl(Number(i.valor) || 0)}</td></tr>`,
    )
    .join("");
  const info = [
    d.pagamento && `<div><small>Pagamento</small>${esc(d.pagamento)}</div>`,
    d.prazo && `<div><small>Prazo de entrega</small>${esc(d.prazo)}</div>`,
    d.validade && `<div><small>Válida até</small>${esc(d.validade)}</div>`,
  ]
    .filter(Boolean)
    .join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proposta - ${esc(d.negocio || d.cliente || "cliente")}</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111;background:#eef0f4}
.folha{max-width:800px;margin:24px auto;background:#fff;padding:48px;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.topo{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #1d4ed8;padding-bottom:20px;gap:16px}
h1{margin:0;font-size:30px;letter-spacing:-.5px}.topo p{margin:4px 0 0;color:#555;font-size:14px}.data{text-align:right;font-size:13px;color:#555}
h2{font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#1d4ed8;margin:32px 0 10px}
table{width:100%;border-collapse:collapse}td{padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:15px}
td span{color:#666;font-size:13px}.v{text-align:right;white-space:nowrap;padding-left:16px}
.tot td{border:0;padding:6px 0;font-size:14px;color:#444}.tot .final td{font-size:22px;color:#111;font-weight:700;border-top:2px solid #111;padding-top:12px}
.info{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.info div{background:#f5f7fb;border-radius:6px;padding:12px;font-size:14px}
.info small{display:block;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.obs{white-space:pre-wrap;font-size:14px;color:#333}.ass{margin-top:56px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #999;padding-top:6px;font-size:12px;color:#666;text-align:center}
.bar{max-width:800px;margin:16px auto 0;display:flex;gap:8px;padding:0 8px}.bar button{font:inherit;padding:10px 16px;border-radius:6px;border:0;background:#1d4ed8;color:#fff;cursor:pointer}
@media (max-width:600px){.folha{padding:24px;margin:8px}.topo{flex-direction:column}.data{text-align:left}}
@media print{body{background:#fff}.folha{box-shadow:none;margin:0;max-width:none;padding:24px}.bar{display:none}}
</style></head><body>
<div class="bar"><button onclick="print()">Salvar em PDF / Imprimir</button></div>
<div class="folha">
<div class="topo"><div><h1>Proposta comercial</h1><p>Para: <b>${esc(d.cliente || "Cliente")}</b>${d.negocio ? ` · ${esc(d.negocio)}` : ""}</p></div>
<div class="data">${hoje}<br>${esc(d.seuNome)}${d.seuWhats ? `<br>WhatsApp ${esc(d.seuWhats)}` : ""}</div></div>
<h2>O que está incluído</h2><table>${linhas || "<tr><td>Nenhum item selecionado</td><td></td></tr>"}</table>
<table class="tot">${desc > 0 ? `<tr><td>Subtotal</td><td class="v">${brl(sub)}</td></tr><tr><td>Desconto (${desc}%)</td><td class="v">− ${brl(sub - total)}</td></tr>` : ""}
<tr class="final"><td>Total</td><td class="v">${brl(total)}</td></tr></table>
${info ? `<h2>Condições</h2><div class="info">${info}</div>` : ""}
${d.obs ? `<h2>Observações</h2><p class="obs">${esc(d.obs)}</p>` : ""}
<div class="ass"><div>${esc(d.seuNome || "Responsável")}</div><div>${esc(d.cliente || "Cliente")}</div></div>
</div></body></html>`;
}
