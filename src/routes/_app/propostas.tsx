import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, FileDown, MessageCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SystemHeader, SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TOOLS } from "@/lib/app";
import {
  PACOTES,
  brl,
  htmlProposta,
  mensagemWhats,
  soDigitos,
  totais,
  type DadosProposta,
  type ItemProposta,
} from "@/lib/propostas";
import { registrarUso } from "@/lib/uso";

export const Route = createFileRoute("/_app/propostas")({
  head: () => ({ meta: [{ title: "Gerador de Propostas · Fábrica de Conteúdo" }] }),
  component: Propostas,
});

const KEY = "fabrica:proposta:v1";

const inicial = (): DadosProposta => ({
  seuNome: "",
  seuWhats: "",
  cliente: "",
  clienteWhats: "",
  negocio: "",
  itens: PACOTES.map((p, i) => ({ ...p, ativo: i === 0 })),
  prazo: "7 dias úteis",
  validade: new Date(Date.now() + 7 * 864e5).toLocaleDateString("pt-BR"),
  pagamento: "50% na aprovação e 50% na entrega (Pix)",
  desconto: 0,
  obs: "",
});

function carregar(): DadosProposta {
  const base = inicial();
  try {
    const salvo = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<DadosProposta> | null;
    // Guarda só os seus dados e os itens/preços; o cliente começa em branco.
    if (salvo) {
      return {
        ...base,
        seuNome: salvo.seuNome ?? "",
        seuWhats: salvo.seuWhats ?? "",
        pagamento: salvo.pagamento ?? base.pagamento,
        prazo: salvo.prazo ?? base.prazo,
        itens: Array.isArray(salvo.itens) && salvo.itens.length ? salvo.itens : base.itens,
      };
    }
  } catch {
    /* ignora */
  }
  return base;
}

function Propostas() {
  const tool = TOOLS.find((t) => t.id === "propostas")!;
  const [d, setD] = useState<DadosProposta>(inicial);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setD(carregar());
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* ignora */
    }
  }, [d, pronto]);

  const set = <K extends keyof DadosProposta>(k: K, v: DadosProposta[K]) =>
    setD((old) => ({ ...old, [k]: v }));
  const setItem = (id: string, patch: Partial<ItemProposta>) =>
    setD((old) => ({
      ...old,
      itens: old.itens.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));

  const msg = useMemo(() => mensagemWhats(d), [d]);
  const { total } = totais(d);
  const temItem = d.itens.some((i) => i.ativo);

  // Conta uma proposta por cliente, mesmo que ela seja copiada, enviada e aberta em PDF.
  const ultimoRegistro = useRef("");
  const registrar = () => {
    const chave = `${d.cliente}|${d.negocio}|${d.clienteWhats}`;
    if (ultimoRegistro.current === chave) return;
    ultimoRegistro.current = chave;
    registrarUso("proposta", 1, d.negocio || d.cliente || undefined);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      toast.success("Mensagem copiada!");
      registrar();
    } catch {
      toast.error("Não consegui copiar.");
    }
  };

  const abrirWhats = () => {
    const num = soDigitos(d.clienteWhats);
    const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
    registrar();
  };

  const abrirPdf = () => {
    const blob = new Blob([htmlProposta(d)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-${(d.negocio || d.cliente || "cliente").replace(/\s+/g, "-").toLowerCase()}.html`;
      a.click();
      toast.info("Baixei a proposta. Abra o arquivo e toque em “Salvar em PDF”.");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    registrar();
  };

  return (
    <div className="space-y-6">
      <SystemHeader
        label={`${tool.code} · ${tool.name}`}
        icon={tool.icon}
        title={tool.name}
        description="Escolha os serviços, ajuste os preços e mande a proposta pronta pelo WhatsApp ou em PDF. Seus dados e preços ficam salvos neste aparelho."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-6">
          <SystemWindow title="Você e o cliente">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Campo
                label="Seu nome / empresa"
                v={d.seuNome}
                on={(v) => set("seuNome", v)}
                ex="Ex.: Nataniel Sites"
              />
              <Campo
                label="Seu WhatsApp"
                v={d.seuWhats}
                on={(v) => set("seuWhats", v)}
                ex="(62) 9 9999-9999"
              />
              <Campo
                label="Nome do cliente"
                v={d.cliente}
                on={(v) => set("cliente", v)}
                ex="Ex.: João"
              />
              <Campo
                label="Negócio do cliente"
                v={d.negocio}
                on={(v) => set("negocio", v)}
                ex="Ex.: Tazz Burger"
              />
              <Campo
                label="WhatsApp do cliente"
                v={d.clienteWhats}
                on={(v) => set("clienteWhats", v)}
                ex="Para abrir a conversa direto"
              />
            </div>
          </SystemWindow>

          <SystemWindow title="Serviços">
            <div className="divide-y divide-border">
              {d.itens.map((i) => (
                <div key={i.id} className="flex gap-3 p-4">
                  <Checkbox
                    className="mt-2"
                    checked={i.ativo}
                    onCheckedChange={(c) => setItem(i.id, { ativo: c === true })}
                    aria-label={`Incluir ${i.nome}`}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={i.nome}
                        onChange={(e) => setItem(i.id, { nome: e.target.value })}
                        className="font-semibold"
                      />
                      <div className="relative sm:w-36">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={i.valor}
                          onChange={(e) => setItem(i.id, { valor: Number(e.target.value) })}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <Textarea
                      rows={2}
                      value={i.detalhe}
                      onChange={(e) => setItem(i.id, { detalhe: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover serviço"
                    onClick={() =>
                      setD((old) => ({ ...old, itens: old.itens.filter((x) => x.id !== i.id) }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 p-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setD((old) => ({
                      ...old,
                      itens: [
                        ...old.itens,
                        {
                          id: `c${Date.now()}`,
                          nome: "Novo serviço",
                          detalhe: "Descreva o que está incluído",
                          valor: 0,
                          ativo: true,
                        },
                      ],
                    }))
                  }
                >
                  <Plus className="size-4" /> Adicionar serviço
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setD((old) => ({ ...old, itens: inicial().itens }))}
                >
                  Restaurar pacotes padrão
                </Button>
              </div>
            </div>
          </SystemWindow>

          <SystemWindow title="Condições">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Campo
                label="Pagamento"
                v={d.pagamento}
                on={(v) => set("pagamento", v)}
                ex="Pix, cartão..."
              />
              <Campo
                label="Prazo de entrega"
                v={d.prazo}
                on={(v) => set("prazo", v)}
                ex="7 dias úteis"
              />
              <Campo
                label="Válida até"
                v={d.validade}
                on={(v) => set("validade", v)}
                ex="dd/mm/aaaa"
              />
              <div className="space-y-1.5">
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={d.desconto}
                  onChange={(e) => set("desconto", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  rows={3}
                  value={d.obs}
                  onChange={(e) => set("obs", e.target.value)}
                  placeholder="Ex.: Inclui 2 rodadas de ajustes."
                />
              </div>
            </div>
          </SystemWindow>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <SystemWindow title="Resumo" scan>
            <div className="space-y-4 p-5">
              <div className="flex items-end justify-between">
                <span className="sys-label">Total</span>
                <span className="font-display text-3xl font-bold text-primary">{brl(total)}</span>
              </div>
              <Textarea readOnly rows={14} value={msg} className="font-mono text-xs" />
              <div className="grid gap-2">
                <Button onClick={abrirWhats} disabled={!temItem}>
                  <MessageCircle className="size-4" /> Enviar no WhatsApp
                </Button>
                <Button variant="outline" onClick={() => void copiar()} disabled={!temItem}>
                  <Copy className="size-4" /> Copiar mensagem
                </Button>
                <Button variant="outline" onClick={abrirPdf} disabled={!temItem}>
                  <FileDown className="size-4" /> Abrir proposta em PDF
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O PDF abre numa aba nova. Toque em “Salvar em PDF / Imprimir” e escolha “Salvar como
                PDF”.
              </p>
            </div>
          </SystemWindow>
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  v,
  on,
  ex,
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  ex: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} placeholder={ex} />
    </div>
  );
}
