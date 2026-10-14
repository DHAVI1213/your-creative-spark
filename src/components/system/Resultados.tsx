import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { USO_ROTULO, lerUso, limparUso, type UsoEvento, type UsoTipo } from "@/lib/uso";
import { SystemWindow } from "./System";

const TIPOS: { tipo: UsoTipo; to: "/legendas" | "/propostas" | "/limpador" | "/clonador" }[] = [
  { tipo: "legenda", to: "/legendas" },
  { tipo: "proposta", to: "/propostas" },
  { tipo: "limpeza", to: "/limpador" },
  { tipo: "clone", to: "/clonador" },
];

const DIAS = 14;

function diaChave(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function Resultados() {
  const [eventos, setEventos] = useState<UsoEvento[] | null>(null);

  useEffect(() => {
    setEventos(lerUso());
  }, []);

  const dados = useMemo(() => {
    const ev = eventos ?? [];
    const totais = Object.fromEntries(TIPOS.map(({ tipo }) => [tipo, 0])) as Record<
      UsoTipo,
      number
    >;
    for (const e of ev) totais[e.tipo] = (totais[e.tipo] ?? 0) + e.n;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dias = Array.from({ length: DIAS }, (_, i) => {
      const d = new Date(hoje.getTime() - (DIAS - 1 - i) * 864e5);
      return { chave: diaChave(d.getTime()), rotulo: d.getDate().toString(), n: 0, data: d };
    });
    const porChave = new Map(dias.map((d) => [d.chave, d]));
    for (const e of ev) {
      const d = porChave.get(diaChave(e.t));
      if (d) d.n += e.n;
    }
    const max = Math.max(1, ...dias.map((d) => d.n));
    const semana = dias.slice(-7).reduce((s, d) => s + d.n, 0);
    const recentes = [...ev].reverse().slice(0, 5);
    return { totais, dias, max, semana, recentes };
  }, [eventos]);

  if (eventos === null) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="sys-label flex items-center gap-2">
          <Activity className="size-3.5" />[ Seus resultados ]
        </p>
        {eventos.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => {
              limparUso();
              setEventos([]);
            }}
          >
            <RotateCcw className="size-3.5" /> Zerar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TIPOS.map(({ tipo, to }) => (
          <Link
            key={tipo}
            to={to}
            className="sys-panel rounded-md p-4 transition-transform hover:-translate-y-0.5"
          >
            <div className="font-display text-3xl font-bold text-primary">{dados.totais[tipo]}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
              {USO_ROTULO[tipo]}
            </div>
          </Link>
        ))}
      </div>

      <SystemWindow>
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm font-semibold">Atividade nos últimos {DIAS} dias</span>
              <span className="font-mono text-xs text-muted-foreground">
                {dados.semana} nos últimos 7 dias
              </span>
            </div>
            <div
              className="flex h-32 items-end gap-1"
              role="img"
              aria-label="Gráfico de atividade diária"
            >
              {dados.dias.map((d) => (
                <div
                  key={d.chave}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    title={`${d.data.toLocaleDateString("pt-BR")}: ${d.n}`}
                    className="w-full rounded-t-sm bg-primary/80 transition-all"
                    style={{
                      height: d.n ? `${Math.max(6, (d.n / dados.max) * 100)}%` : "2px",
                      opacity: d.n ? 1 : 0.25,
                    }}
                  />
                  <span className="font-mono text-[9px] text-muted-foreground">{d.rotulo}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Últimas ações</p>
            {dados.recentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nada ainda. Gere uma legenda ou uma proposta e o resultado aparece aqui.
              </p>
            ) : (
              <ul className="space-y-2">
                {dados.recentes.map((e) => (
                  <li key={`${e.t}-${e.tipo}`} className="flex justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {USO_ROTULO[e.tipo]}
                      {e.nota ? <span className="text-muted-foreground"> · {e.nota}</span> : null}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {new Date(e.t).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SystemWindow>
      <p className="text-xs text-muted-foreground">Os números ficam salvos só neste aparelho.</p>
    </section>
  );
}
