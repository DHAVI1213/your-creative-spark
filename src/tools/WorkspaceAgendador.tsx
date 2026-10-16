import { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Clapperboard, Image, Smartphone, Trash2 } from "lucide-react";
import { Button, Card, Input, Label, Select } from "../components/ui";
import { cn } from "../lib/utils";

type Tipo = "Reels" | "Stories" | "Post";
type Agendamento = { id: string; titulo: string; data: string; hora: string; tipo: Tipo; notas: string };

const CHAVE = "nk_agendamentos";
const ICONE_TIPO: Record<Tipo, typeof Clapperboard> = {
  Reels: Clapperboard,
  Stories: Smartphone,
  Post: Image,
};

function ler(): Agendamento[] {
  try {
    const raw = localStorage.getItem(CHAVE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function salvar(lista: Agendamento[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {}
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function WorkspaceAgendador() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [lista, setLista] = useState<Agendamento[]>(ler);
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(hoje.toISOString().slice(0, 10));
  const [hora, setHora] = useState("18:00");
  const [tipo, setTipo] = useState<Tipo>("Reels");
  const [notas, setNotas] = useState("");

  const atualizar = (nova: Agendamento[]) => {
    setLista(nova);
    salvar(nova);
  };

  const agendar = () => {
    if (!titulo.trim() || !data) return;
    atualizar([
      ...lista,
      { id: `${Date.now()}`, titulo: titulo.trim(), data, hora, tipo, notas: notas.trim() },
    ].sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`)));
    setTitulo("");
    setNotas("");
  };

  const remover = (id: string) => atualizar(lista.filter((a) => a.id !== id));

  const dias = useMemo(() => {
    const primeiro = new Date(ano, mes, 1).getDay();
    const total = new Date(ano, mes + 1, 0).getDate();
    return { primeiro, total };
  }, [ano, mes]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Agendamento[]>();
    for (const a of lista) {
      const arr = mapa.get(a.data) ?? [];
      arr.push(a);
      mapa.set(a.data, arr);
    }
    return mapa;
  }, [lista]);

  const chave = (d: number) =>
    `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const proximos = lista.filter((a) => `${a.data}T${a.hora}` >= new Date().toISOString().slice(0, 16));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {MESES[mes]} <span className="text-tmuted">{ano}</span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => (mes === 0 ? (setMes(11), setAno(ano - 1)) : setMes(mes - 1))}
                className="rounded-lg border border-border p-2 text-tsecondary hover:text-lime cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => (mes === 11 ? (setMes(0), setAno(ano + 1)) : setMes(mes + 1))}
                className="rounded-lg border border-border p-2 text-tsecondary hover:text-lime cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-tmuted">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div key={i} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: dias.primeiro }).map((_, i) => (
              <div key={`v${i}`} />
            ))}
            {Array.from({ length: dias.total }).map((_, i) => {
              const d = i + 1;
              const itens = porDia.get(chave(d)) ?? [];
              const ehHoje =
                d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
              return (
                <div
                  key={d}
                  onClick={() => setData(chave(d))}
                  className={cn(
                    "min-h-16 cursor-pointer rounded-xl border p-1.5 text-left transition-colors",
                    data === chave(d) ? "border-lime bg-lime/5" : "border-border hover:border-tmuted",
                    ehHoje && "ring-1 ring-lime/50",
                  )}
                >
                  <p className={cn("text-xs font-bold", ehHoje ? "text-lime" : "text-tsecondary")}>{d}</p>
                  <div className="mt-1 space-y-0.5">
                    {itens.slice(0, 2).map((a) => (
                      <p key={a.id} className="truncate text-[10px] text-tprimary">
                        <span className="text-lime">•</span> {a.hora} {a.titulo}
                      </p>
                    ))}
                    {itens.length > 2 && (
                      <p className="text-[10px] text-tmuted">+{itens.length - 2}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <CalendarPlus className="size-5 text-lime" /> Novo agendamento
          </h2>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Reels dica de finanças" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div>
                <Label>Hora</Label>
                <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
                <option>Reels</option>
                <option>Stories</option>
                <option>Post</option>
              </Select>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Legenda pronta, link..." />
            </div>
            <Button onClick={agendar} disabled={!titulo.trim()} className="w-full">
              Agendar
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Próximos ({proximos.length})</h2>
          {proximos.length === 0 ? (
            <p className="py-4 text-center text-sm text-tmuted">Nada agendado. Crie o primeiro acima.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {proximos.map((a) => {
                const Icone = ICONE_TIPO[a.tipo];
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-lime/15">
                      <Icone className="size-5 text-lime" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.titulo}</p>
                      <p className="text-xs text-tmuted">
                        {a.data.split("-").reverse().join("/")} às {a.hora} · {a.tipo}
                        {a.notas ? ` · ${a.notas}` : ""}
                      </p>
                    </div>
                    <button onClick={() => remover(a.id)} className="text-tmuted hover:text-red-400 cursor-pointer">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
