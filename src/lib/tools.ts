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
import type { PlanoMinimo } from "./planos";

export type Ferramenta = {
  id: string;
  nome: string;
  descricao: string;
  icone: LucideIcon;
  /** Plano mínimo que libera a ferramenta (o mesmo da página de preços). */
  plano: PlanoMinimo;
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
    plano: "basico",
    imagem: img("limpador"),
  },
  {
    id: "clonador",
    nome: "Clonador de Sites",
    descricao: "Extensão que copia um site (com autorização), edita e exporta para a Lovable/GitHub.",
    icone: Copy,
    plano: "basico",
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
    descricao: "Extensão que acha os vídeos que mais performaram num perfil (IG, TikTok, YouTube) e baixa em massa.",
    icone: Search,
    plano: "pro",
    imagem: img("viral"),
  },
  {
    id: "minerador",
    nome: "Minerador de Clientes",
    descricao: "Extensão que acha lojas no Google Maps que precisam de site; organize os leads aqui.",
    icone: Users,
    plano: "pro",
    imagem: img("minerador"),
  },
  {
    id: "agendador",
    nome: "Agendador",
    descricao: "Agende em massa no Instagram, YouTube e TikTok, em várias contas, e publique com o PC desligado.",
    icone: CalendarClock,
    plano: "elite",
    imagem: img("agendador"),
  },
  {
    id: "legendas",
    nome: "Legendas e Hashtags",
    descricao: "Gere legendas prontas por nicho e hashtags que ficam clicáveis no Instagram.",
    icone: MessagesSquare,
    plano: "basico",
    imagem: img("legendas"),
  },
  {
    id: "propostas",
    nome: "Gerador de Propostas",
    descricao: "Monte a proposta para o cliente: mensagem de WhatsApp e PDF com seu orçamento.",
    icone: FileText,
    plano: "basico",
    imagem: img("propostas"),
  },
];

export const ferramentaPorId = (id: string) => FERRAMENTAS.find((f) => f.id === id);
