import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ferramentaPorId } from "../lib/tools";
import { temAcesso } from "../lib/planos";
import Paywall from "../components/Paywall";
import NotFound from "./NotFound";
import WorkspaceLimpador from "../tools/WorkspaceLimpador";
import WorkspaceClonador from "../tools/WorkspaceClonador";
import WorkspaceEditor from "../tools/WorkspaceEditor";
import WorkspaceViral from "../tools/WorkspaceViral";
import WorkspaceMinerador from "../tools/WorkspaceMinerador";
import WorkspaceAgendador from "../tools/WorkspaceAgendador";
import WorkspaceLegendas from "../tools/WorkspaceLegendas";
import WorkspacePropostas from "../tools/WorkspacePropostas";
import { useSiteSettings } from "../lib/site-settings";

const WORKSPACES: Record<string, React.ComponentType> = {
  limpador: WorkspaceLimpador,
  clonador: WorkspaceClonador,
  editor: WorkspaceEditor,
  viral: WorkspaceViral,
  minerador: WorkspaceMinerador,
  agendador: WorkspaceAgendador,
  legendas: WorkspaceLegendas,
  propostas: WorkspacePropostas,
};

export default function ToolWorkspace() {
  const { toolId } = useParams();
  const { usuario } = useAuth();
  const settings = useSiteSettings();
  const original = ferramentaPorId(toolId ?? "");
  const saved = settings.tools.find(t => t.id === toolId);
  const ferramenta = original && saved ? { ...original, nome: saved.name, descricao: saved.description } : original;

  if (!usuario) return <Navigate to="/entrar" replace />;
  if (!ferramenta) return <NotFound />;

  const bloqueada = !temAcesso(usuario.plano, ferramenta.plano);
  const Body = WORKSPACES[ferramenta.id];
  if (!Body) return <NotFound />;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 overflow-hidden rounded-2xl border border-border">
        <div className="relative h-40 md:h-52">
          <img src={ferramenta.imagem} alt={ferramenta.nome} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6 flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-lime text-black">
              <ferramenta.icone className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{ferramenta.nome}</h1>
              <p className="text-sm text-tsecondary">{ferramenta.descricao}</p>
            </div>
          </div>
        </div>
      </div>
      {bloqueada ? <Paywall ferramenta={ferramenta.nome} plano={ferramenta.plano} /> : <Body />}
    </div>
  );
}
