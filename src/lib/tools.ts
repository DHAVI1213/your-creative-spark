import {
  CalendarClock,
  Copy,
  FileText,
  ImageOff,
  MessagesSquare,
  Scissors,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Ferramenta = {
  id: string;
  nome: string;
  descricao: string;
  icone: LucideIcon;
  plano: "gratis" | "pro";
  imagem: string;
};

const IMAGENS: Record<string, string> = {
  limpador: "limpador",
  clonador: "clonador",
  editor: "editor",
  viral: "viral",
  minerador: "clientes",
  agendador: "agendador",
  legendas: "legendas",
  propostas: "propostas",
};

const img = (id: string) => `/tools/${IMAGENS[id] ?? id}.jpg`;

export const FERRAMENTAS: Ferramenta[] = [
  {
    id: "limpador",
    nome: "Limpador de Metadados",
    descricao: "Remove localização, aparelho e datas de fotos e vídeos (até pastas inteiras), sem refazer o vídeo.",
    icone: ImageOff,
    plano: "gratis",
    imagem: img("limpador"),
  },
  {
    id: "clonador",
    nome: "Clonador de Sites",
    descricao: "Copie um site (com autorização do dono), edite os textos e baixe para o cliente.",
    icone: Copy,
    plano: "gratis",
    imagem: img("clonador"),
  },
  {
    id: "editor",
    nome: "Editor em Massa",
    descricao: "Edite um vídeo e aplique em todos: recorte, efeitos, legenda animada, capa, Cortes Virais com IA.",
    icone: Scissors,
    plano: "pro",
    imagem: img("editor"),
  },
  {
    id: "viral",
    nome: "Minerador Viral",
    descricao: "Encontre os formatos que mais estouram num nicho e use como referência.",
    icone: Search,
    plano: "pro",
    imagem: img("viral"),
  },
  {
    id: "minerador",
    nome: "Minerador de Clientes",
    descricao: "Encontre lojas da sua cidade que precisam de site e organize seus leads.",
    icone: Users,
    plano: "pro",
    imagem: img("minerador"),
  },
  {
    id: "agendador",
    nome: "Agendador",
    descricao: "Agende em massa no Instagram, YouTube e TikTok, em várias contas, e publique com o PC desligado.",
    icone: CalendarClock,
    plano: "pro",
    imagem: img("agendador"),
  },
  {
    id: "legendas",
    nome: "Legendas e Hashtags",
    descricao: "Gere legendas prontas por nicho e hashtags que ficam clicáveis no Instagram.",
    icone: MessagesSquare,
    plano: "gratis",
    imagem: img("legendas"),
  },
  {
    id: "propostas",
    nome: "Gerador de Propostas",
    descricao: "Monte a proposta para o cliente: mensagem de WhatsApp e PDF com seu orçamento.",
    icone: FileText,
    plano: "gratis",
    imagem: img("propostas"),
  },
];

export const ferramentaPorId = (id: string) => FERRAMENTAS.find((f) => f.id === id);
