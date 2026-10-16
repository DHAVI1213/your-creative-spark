export type Lead = {
  id: string;
  nome: string;
  nicho: string;
  cidade: string;
  whatsapp: string;
  instagram: string;
  site: string;
  sinal: string;
  status: "novo" | "contatado" | "respondeu" | "fechado";
};

const NOMES: Record<string, string[]> = {
  restaurante: ["Cantina Sabor & Arte", "Tempero da Vovó", "Casa do Espeto", "Sabor Mineiro"],
  barbearia: ["Barbearia Corte Fino", "Navalha de Ouro", "Barba & Cia", "Estilo Masculino"],
  salao: ["Studio Beleza Pura", "Espaço Divine", "Salão Essência", "Bella Donna"],
  academia: ["Academia Corpo Livre", "Fit Zone", "Iron House", "Studio Move"],
  loja: ["Boutique Luna", "Empório Chic", "Loja Ponto Certo", "Vitrine Pop"],
  clinica: ["Clínica Vitta", "Odonto Sorriso", "Fisio Vida", "Clínica Essencial"],
};

const SINAIS = [
  "Sem site no Google",
  "Site desatualizado",
  "Só tem Instagram",
  "Sem botão de WhatsApp",
  "Fotos antigas no perfil",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function gerarLeads(cidade: string, nicho: string, qtd = 8): Lead[] {
  const nomes = NOMES[nicho] ?? NOMES.restaurante!;
  const cid = cidade.trim() || "Sua cidade";
  return Array.from({ length: qtd }, (_, i) => {
    const nome = nomes[i % nomes.length]!;
    const h = hash(`${cid}${nicho}${nome}${i}`);
    const ddd = 11 + (h % 70);
    const fone = `(${ddd}) 9${String(8000 + (h % 1999))}-${String(1000 + (h % 9000))}`;
    return {
      id: `${nicho}-${i}-${h}`,
      nome: i < nomes.length ? nome : `${nome} — filial ${Math.floor(i / nomes.length) + 1}`,
      nicho,
      cidade: cid,
      whatsapp: fone,
      instagram: `@${nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "")}`,
      site: h % 3 === 0 ? "—" : `${nome.toLowerCase().replace(/[^a-z]/g, "")}.com.br`,
      sinal: SINAIS[h % SINAIS.length]!,
      status: "novo" as const,
    };
  });
}

export function leadsParaCsv(leads: Lead[]): string {
  const cab = "Nome;Nicho;Cidade;WhatsApp;Instagram;Site;Sinal;Status";
  const linhas = leads.map((l) =>
    [l.nome, l.nicho, l.cidade, l.whatsapp, l.instagram, l.site, l.sinal, l.status].join(";"),
  );
  return ["﻿" + cab, ...linhas].join("\n");
}

export function baixarCsv(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
