import {
  CalendarClock,
  Copy,
  Eraser,
  FileSignature,
  Film,
  Flame,
  Hash,
  Radar,
  type LucideIcon,
} from "lucide-react";

export const APP_NAME = "Fábrica de Conteúdo";
export const APP_TAGLINE = "Suas ferramentas de criação e vendas em um app só";

export type ToolStatus = "ativo" | "em-breve";

export type ToolPath =
  | "/limpador"
  | "/clonador"
  | "/legendas"
  | "/propostas"
  | "/editor"
  | "/viral"
  | "/minerador"
  | "/agendador";

export type Tool = {
  id: string;
  /** Código da habilidade, no estilo do sistema. */
  code: string;
  rank: "E" | "D" | "C" | "B" | "A" | "S";
  name: string;
  short: string;
  description: string;
  to: ToolPath;
  icon: LucideIcon;
  status: ToolStatus;
};

export const TOOLS: Tool[] = [
  {
    id: "limpador",
    code: "HAB-01",
    rank: "C",
    name: "Limpador de Metadados",
    short: "Limpador",
    description: "Remove localização, aparelho e datas das suas fotos e vídeos, sem upload.",
    to: "/limpador",
    icon: Eraser,
    status: "ativo",
  },
  {
    id: "clonador",
    code: "HAB-02",
    rank: "A",
    name: "Clonador de Sites",
    short: "Clonador",
    description: "Copie um site (com autorização do dono), edite os textos e baixe para o cliente.",
    to: "/clonador",
    icon: Copy,
    status: "ativo",
  },
  {
    id: "legendas",
    code: "HAB-07",
    rank: "B",
    name: "Legendas e Hashtags",
    short: "Legendas",
    description: "Gere legendas prontas por nicho e hashtags que ficam clicáveis no Instagram.",
    to: "/legendas",
    icon: Hash,
    status: "ativo",
  },
  {
    id: "propostas",
    code: "HAB-08",
    rank: "A",
    name: "Gerador de Propostas",
    short: "Propostas",
    description: "Monte a proposta para o cliente: mensagem de WhatsApp e PDF com seu orçamento.",
    to: "/propostas",
    icon: FileSignature,
    status: "ativo",
  },
  {
    id: "editor",
    code: "HAB-03",
    rank: "S",
    name: "Editor em Massa",
    short: "Editor",
    description: "Edite um vídeo e aplique a mesma edição em todos de uma vez.",
    to: "/editor",
    icon: Film,
    status: "em-breve",
  },
  {
    id: "viral",
    code: "HAB-04",
    rank: "A",
    name: "Minerador Viral",
    short: "Viral",
    description: "Encontre os vídeos que mais estouram num perfil ou nicho e use como referência.",
    to: "/viral",
    icon: Flame,
    status: "em-breve",
  },
  {
    id: "minerador",
    code: "HAB-05",
    rank: "B",
    name: "Minerador de Clientes",
    short: "Clientes",
    description: "Encontre lojas da sua cidade que precisam de site e organize seus leads.",
    to: "/minerador",
    icon: Radar,
    status: "em-breve",
  },
  {
    id: "agendador",
    code: "HAB-06",
    rank: "S",
    name: "Agendador",
    short: "Agendador",
    description: "Agende Reels, Stories e posts — publica mesmo com o aparelho desligado.",
    to: "/agendador",
    icon: CalendarClock,
    status: "em-breve",
  },
];

export const RANK_COLOR: Record<Tool["rank"], string> = {
  E: "text-muted-foreground border-muted-foreground/40",
  D: "text-success border-success/50",
  C: "text-primary border-primary/50",
  B: "text-shadow border-shadow/60",
  A: "text-destructive border-destructive/60",
  S: "text-gold border-gold/60",
};
