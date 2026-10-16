export type NichoViral = { id: string; nome: string };

export type ReferenciaViral = {
  id: string;
  formato: string;
  titulo: string;
  descricao: string;
  views: string;
  engajamento: string;
  duracao: string;
  gancho: string;
  porQueFunciona: string;
};

export const NICHOS_VIRAIS: NichoViral[] = [
  { id: "financas", nome: "Finanças" },
  { id: "beleza", nome: "Beleza / Estética" },
  { id: "fitness", nome: "Fitness" },
  { id: "comida", nome: "Comida / Delivery" },
  { id: "moda", nome: "Moda" },
  { id: "marketing", nome: "Marketing digital" },
];

const BASE: Record<string, ReferenciaViral[]> = {
  financas: [
    {
      id: "f1",
      formato: "Lista numerada",
      titulo: "5 hábitos que mudam sua relação com o dinheiro",
      descricao: "Carrossel ou vídeo com contagem regressiva e trilha tensa.",
      views: "2,4 mi",
      engajamento: "8,2%",
      duracao: "0:32",
      gancho: "“Você faz isso todo dia sem perceber…”",
      porQueFunciona: "Promessa específica + curiosidade no gancho seguram até o fim.",
    },
    {
      id: "f2",
      formato: "Antes/depois",
      titulo: "Como saí de R$ 8 mil de dívida em 6 meses",
      descricao: "Print da fatura + narração do passo a passo.",
      views: "1,1 mi",
      engajamento: "11,5%",
      duracao: "0:58",
      gancho: "“Olha o valor da minha fatura em janeiro…”",
      porQueFunciona: "Prova visual gera credibilidade e comentários.",
    },
    {
      id: "f3",
      formato: "Mito x verdade",
      titulo: "Guardar dinheiro NÃO te deixa rico (e eu provo)",
      descricao: "Fala direto pra câmera com cortes secos.",
      views: "890 mil",
      engajamento: "9,7%",
      duracao: "0:41",
      gancho: "“Tudo que te ensinaram sobre guardar dinheiro está errado.”",
      porQueFunciona: "Quebra de expectativa gera debate nos comentários.",
    },
  ],
  beleza: [
    {
      id: "b1",
      formato: "Transformação",
      titulo: "Cabelo ressecado? Olha esse antes e depois",
      descricao: "Transição com som viral no momento do resultado.",
      views: "3,2 mi",
      engajamento: "12,1%",
      duracao: "0:15",
      gancho: "Close no cabelo danificado + “espera o final”.",
      porQueFunciona: "Loop perfeito: o fim conecta com o começo.",
    },
    {
      id: "b2",
      formato: "Tutorial rápido",
      titulo: "Sobrancelha perfeita em 30 segundos",
      descricao: "Passo a passo acelerado com texto na tela.",
      views: "1,8 mi",
      engajamento: "7,4%",
      duracao: "0:30",
      gancho: "“Pare de errar na sobrancelha fazendo isso”.",
      porQueFunciona: "Entrega valor imediato e salvável.",
    },
  ],
  fitness: [
    {
      id: "t1",
      formato: "Desafio",
      titulo: "30 dias de treino: dia 1 vs dia 30",
      descricao: "Série diária com evolução visível.",
      views: "4,5 mi",
      engajamento: "10,3%",
      duracao: "0:22",
      gancho: "“Dia 1: não aguento 5 flexões”.",
      porQueFunciona: "Narrativa de jornada cria audiência recorrente.",
    },
    {
      id: "t2",
      formato: "Erro comum",
      titulo: "Você está fazendo agachamento errado",
      descricao: "Correção com ângulo lateral e setas.",
      views: "2,1 mi",
      engajamento: "8,9%",
      duracao: "0:35",
      gancho: "“Se seu joelho faz isso, pare agora”.",
      porQueFunciona: "Alerta + autoridade geram compartilhamento.",
    },
  ],
  comida: [
    {
      id: "c1",
      formato: "ASMR / preparo",
      titulo: "O smash perfeito, sem segredo",
      descricao: "Som da chapa + close no queijo derretendo.",
      views: "5,7 mi",
      engajamento: "13,2%",
      duracao: "0:28",
      gancho: "Som alto da carne na chapa nos 2 primeiros segundos.",
      porQueFunciona: "Estímulo sensorial prende sem precisar de fala.",
    },
    {
      id: "c2",
      formato: "Receita em 3 passos",
      titulo: "Lanche de 15 min que parece restaurante",
      descricao: "Ingredientes na bancada, montagem rápida.",
      views: "1,4 mi",
      engajamento: "6,8%",
      duracao: "0:45",
      gancho: "“Com 3 ingredientes você faz isso”.",
      porQueFunciona: "Simplicidade + resultado aspiracional.",
    },
  ],
  moda: [
    {
      id: "m1",
      formato: "Provador",
      titulo: "3 looks com a mesma calça",
      descricao: "Trocas rápidas com transição de snap.",
      views: "2,9 mi",
      engajamento: "9,1%",
      duracao: "0:25",
      gancho: "“Uma calça, três ocasiões”.",
      porQueFunciona: "Versatilidade = mais salvamentos.",
    },
  ],
  marketing: [
    {
      id: "k1",
      formato: "Bastidor",
      titulo: "Quanto gastei pra fazer esse lançamento",
      descricao: "Planilha na tela + narração dos números.",
      views: "1,7 mi",
      engajamento: "10,8%",
      duracao: "1:05",
      gancho: "“Vou abrir os números de verdade”.",
      porQueFunciona: "Transparência rara gera confiança e debate.",
    },
  ],
};

export function referenciasDoNicho(nichoId: string): ReferenciaViral[] {
  return BASE[nichoId] ?? [];
}

export type ReferenciaSalva = ReferenciaViral & { url: string; anotacao: string };

export function salvarReferencia(ref: ReferenciaSalva) {
  try {
    const raw = localStorage.getItem("nk_referencias");
    const lista: ReferenciaSalva[] = raw ? JSON.parse(raw) : [];
    lista.unshift({ ...ref, id: `${ref.id}-${Date.now()}` });
    localStorage.setItem("nk_referencias", JSON.stringify(lista));
  } catch {}
}

export function listarReferencias(): ReferenciaSalva[] {
  try {
    const raw = localStorage.getItem("nk_referencias");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removerReferencia(id: string) {
  try {
    const lista = listarReferencias().filter((r) => r.id !== id);
    localStorage.setItem("nk_referencias", JSON.stringify(lista));
  } catch {}
}
