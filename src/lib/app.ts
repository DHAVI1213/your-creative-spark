import { CalendarClock, Eraser, Film, Radar, type LucideIcon } from "lucide-react";

export const APP_NAME = "Spark Suite";
export const APP_TAGLINE = "Suas ferramentas de criação e vendas em um app só";

export type ToolStatus = "ativo" | "em-breve";

export type Tool = {
  id: string;
  name: string;
  short: string;
  description: string;
  to: "/limpador" | "/editor" | "/agendador" | "/minerador";
  icon: LucideIcon;
  status: ToolStatus;
};

export const TOOLS: Tool[] = [
  {
    id: "limpador",
    name: "Limpador de Metadados",
    short: "Limpador",
    description:
      "Remove localização, aparelho e datas das suas fotos e vídeos. Tudo no seu aparelho.",
    to: "/limpador",
    icon: Eraser,
    status: "ativo",
  },
  {
    id: "editor",
    name: "Editor em Massa",
    short: "Editor",
    description: "Edite um vídeo e aplique a mesma edição em todos de uma vez.",
    to: "/editor",
    icon: Film,
    status: "em-breve",
  },
  {
    id: "agendador",
    name: "Agendador",
    short: "Agendador",
    description: "Agende Reels, Stories e posts — publica mesmo com o aparelho desligado.",
    to: "/agendador",
    icon: CalendarClock,
    status: "em-breve",
  },
  {
    id: "minerador",
    name: "Minerador de Clientes",
    short: "Minerador",
    description: "Encontre lojas da sua cidade que precisam de site e organize seus leads.",
    to: "/minerador",
    icon: Radar,
    status: "em-breve",
  },
];
