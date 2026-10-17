import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, MapPin, MessageCircle, Trash2 } from "lucide-react";
import ExtensaoCard from "../components/ExtensaoCard";
import { Badge, Button, Card, Empty, Input, Select } from "../components/ui";
import { baixarBlob, cn } from "../lib/utils";

type Status = "novo" | "contatado" | "respondeu" | "fechado";
type Lead = {
  id: string;
  chance: number | null;
  nivel: string;
  nome: string;
  categoria: string;
  nota: string;
  avaliacoes: string;
  telefone: string;
  whatsapp: string;
  site: string;
  situacao: string;
  endereco: string;
  maps: string;
  status: Status;
  obs: string;
};

const CHAVE = "nk.leads";
const STATUS: Status[] = ["novo", "contatado", "respondeu", "fechado"];
const COR: Record<string, string> = { quente: "text-red-400", morna: "text-amber-400", fria: "text-sky-400" };

/** Lê a planilha CSV que a extensão Minerador de Clientes baixa (separada por ";"). */
export function lerCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ";" || c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      if (linha.some((x) => x.trim())) linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim())) linhas.push(linha);
  return linhas;
}

function ler(): Lead[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || "[]");
  } catch {
    return [];
  }
}

export default function WorkspaceMinerador() {
  const [leads, setLeads] = useState<Lead[]>(ler);
  const [nivel, setNivel] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(leads));
    } catch {
      /* sem armazenamento */
    }
  }, [leads]);

  async function importar(files: FileList) {
    let novos = 0;
    let atualizados = 0;
    const lista = [...leads];
    for (const f of [...files]) {
      const linhas = lerCsv(await f.text());
      const cab = (linhas.shift() || []).map((c) => c.trim().toLowerCase());
      const col = (nome: string, l: string[]) => l[cab.indexOf(nome)]?.trim() ?? "";
      if (!cab.includes("nome")) {
        setAviso(`${f.name}: não parece a planilha do Minerador de Clientes.`);
        continue;
      }
      for (const l of linhas) {
        const maps = col("maps", l);
        const nome = col("nome", l);
        if (!nome) continue;
        const id = maps || nome + "|" + col("endereco", l);
        const dados = {
          chance: col("chance", l) ? Number(col("chance", l)) : null,
          nivel: col("nivel", l),
          nome,
          categoria: col("categoria", l),
          nota: col("nota", l),
          avaliacoes: col("avaliacoes", l),
          telefone: col("telefone", l),
          whatsapp: col("whatsapp", l),
          site: col("site", l),
          situacao: col("situacao_do_site", l),
          endereco: col("endereco", l),
          maps,
        };
        const i = lista.findIndex((x) => x.id === id);
        if (i >= 0) {
          lista[i] = { ...lista[i]!, ...dados };
          atualizados++;
        } else {
          lista.push({ id, ...dados, status: col("contatado", l) === "sim" ? "contatado" : "novo", obs: "" });
          novos++;
        }
      }
    }
    lista.sort((a, b) => (b.chance ?? -1) - (a.chance ?? -1));
    setLeads(lista);
    setAviso(`${novos} loja(s) nova(s) e ${atualizados} atualizada(s).`);
  }

  const visiveis = useMemo(
    () =>
      leads.filter(
        (l) =>
          (nivel === "todos" || l.nivel === nivel) &&
          (status === "todos" || l.status === status) &&
          (!busca.trim() || (l.nome + " " + l.categoria + " " + l.endereco).toLowerCase().includes(busca.trim().toLowerCase())),
      ),
    [leads, nivel, status, busca],
  );
  const mudar = (id: string, campos: Partial<Lead>) => setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...campos } : l)));

  const exportar = () => {
    const cab = ["chance", "nivel", "nome", "categoria", "nota", "avaliacoes", "telefone", "whatsapp", "site", "situacao_do_site", "endereco", "maps", "status", "obs"];
    const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = visiveis.map((l) => [l.chance ?? "", l.nivel, l.nome, l.categoria, l.nota, l.avaliacoes, l.telefone, l.whatsapp, l.site, l.situacao, l.endereco, l.maps, l.status, l.obs].map(csv).join(";"));
    baixarBlob(new Blob(["﻿" + [cab.join(";"), ...linhas].join("\r\n")], { type: "text/csv;charset=utf-8" }), "meus-leads.csv");
  };

  return (
    <div className="space-y-6">
      <ExtensaoCard
        nome="Minerador de Clientes"
        arquivo="/downloads/minerador-de-clientes.zip"
        versao="1.0.0"
        resumo="Acha lojas no Google Maps da sua cidade e mostra quais têm mais chance de comprar um site: sem site, só Instagram/iFood/cardápio, site que não abre ou ruim no celular. Abre o WhatsApp com a mensagem pronta."
        usar={[
          <>Clique no ícone (alfinete de mapa): o painel abre do lado.</>,
          <>Escreva o que procurar (ou toque num atalho, como “hamburgueria”) e a cidade (ex.: “Goiânia GO”) e clique em <b>Buscar no Maps</b>. Deixe a aba do Maps à vista enquanto ela lê a lista.</>,
          <>Com “Ver site e telefone de cada loja” ligado, a extensão abre cada loja em segundo plano e avalia o site. Nota 60+ é <b>quente</b>, 35–59 morna, abaixo de 35 fria.</>,
          <>Use os filtros e os botões <b>WhatsApp</b> (mensagem pronta, você revisa e envia), <b>Copiar msg</b> e <b>Planilha</b> (CSV). Edite a mensagem e os atalhos na aba Ajustes.</>,
          <>Traga a planilha para cá (abaixo) para organizar quem você já contatou, quem respondeu e quem fechou.</>,
        ]}
        extra={<p className="text-[11px] text-tmuted">Use com moderação: algumas buscas por dia, não centenas. Se o Google mostrar um aviso ou captcha, pare um pouco. Tudo fica salvo só no seu navegador.</p>}
      />

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold">
            <MapPin className="size-5 text-lime" /> Meus leads <span className="text-sm font-normal text-tmuted">({leads.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="!py-2 text-xs" onClick={() => entrada.current?.click()}>
              <FileUp className="size-4" /> Trazer planilha da extensão
            </Button>
            <input ref={entrada} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => e.target.files && void importar(e.target.files).finally(() => (e.target.value = ""))} />
            {leads.length > 0 && (
              <>
                <Button variant="outline" className="!py-2 text-xs" onClick={exportar}>
                  <Download className="size-4" /> Baixar CSV
                </Button>
                <Button variant="ghost" className="!py-2 text-xs" onClick={() => confirm("Apagar todos os leads desta lista?") && setLeads([])}>
                  <Trash2 className="size-4" /> Limpar
                </Button>
              </>
            )}
          </div>
        </div>
        {aviso && <p className="text-xs text-lime">{aviso}</p>}
        {leads.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Buscar nome, categoria ou endereço" value={busca} onChange={(e) => setBusca(e.target.value)} className="!w-64 !py-2 text-xs" />
            <Select value={nivel} onChange={(e) => setNivel(e.target.value)} className="!w-auto !py-2 text-xs">
              <option value="todos">Todas as chances</option>
              <option value="quente">Quentes</option>
              <option value="morna">Mornas</option>
              <option value="fria">Frias</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto !py-2 text-xs">
              <option value="todos">Todos os status</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
        )}
        {leads.length === 0 ? (
          <Empty icon={<MapPin className="size-7" />} titulo="Nenhum lead ainda" descricao="Use a extensão no Google Maps, clique em Planilha e traga o arquivo para cá." />
        ) : (
          <div className="space-y-2">
            {visiveis.map((l) => (
              <div key={l.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-border p-3">
                <div className="w-14 shrink-0 text-center">
                  <p className={cn("text-lg font-bold", COR[l.nivel] || "text-tmuted")}>{l.chance ?? "–"}</p>
                  <p className="text-[10px] text-tmuted">{l.nivel}</p>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold">
                    {l.nome} <span className="text-xs font-normal text-tmuted">{l.categoria}</span>
                  </p>
                  <p className="text-xs text-tmuted">
                    ★ {l.nota || "–"} ({l.avaliacoes || 0}) · {l.telefone || "sem telefone"} · {l.site ? <a href={l.site} target="_blank" rel="noreferrer" className="text-lime underline">site</a> : "sem site"}
                    {l.situacao && ` · ${l.situacao}`}
                  </p>
                  <Input placeholder="Anotação (ex.: pediu orçamento, ligar sexta)" value={l.obs} onChange={(e) => mudar(l.id, { obs: e.target.value })} className="!py-1 text-xs" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <button onClick={() => mudar(l.id, { status: STATUS[(STATUS.indexOf(l.status) + 1) % STATUS.length]! })} className="cursor-pointer" title="Mudar status">
                    <Badge tone={l.status === "fechado" || l.status === "respondeu" ? "lime" : "default"}>{l.status}</Badge>
                  </button>
                  <div className="flex gap-2 text-xs">
                    {l.whatsapp && (
                      <a href={l.whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-lime" onClick={() => l.status === "novo" && mudar(l.id, { status: "contatado" })}>
                        <MessageCircle className="size-3.5" /> WhatsApp
                      </a>
                    )}
                    {l.maps && (
                      <a href={l.maps} target="_blank" rel="noreferrer" className="text-tmuted hover:text-lime">
                        Maps
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
