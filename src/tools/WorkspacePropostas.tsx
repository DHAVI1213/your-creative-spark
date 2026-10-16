import { useMemo, useState } from "react";
import { FileDown, MessageCircle } from "lucide-react";
import {
  PACOTES,
  brl,
  htmlProposta,
  mensagemWhats,
  soDigitos,
  totais,
  type DadosProposta,
  type ItemProposta,
} from "../lib/propostas";
import { Button, Card, CopyButton, Input, Label, Textarea } from "../components/ui";

const novaLista = (): ItemProposta[] =>
  PACOTES.map((p) => ({ ...p, ativo: false }));

export default function WorkspacePropostas() {
  const [dados, setDados] = useState<DadosProposta>({
    seuNome: "",
    seuWhats: "",
    cliente: "",
    clienteWhats: "",
    negocio: "",
    itens: novaLista(),
    prazo: "7 dias úteis",
    validade: "",
    pagamento: "50% de entrada + 50% na entrega",
    desconto: 0,
    obs: "",
  });

  const set = <K extends keyof DadosProposta>(k: K, v: DadosProposta[K]) =>
    setDados((d) => ({ ...d, [k]: v }));

  const alternar = (id: string) =>
    setDados((d) => ({
      ...d,
      itens: d.itens.map((i) => (i.id === id ? { ...i, ativo: !i.ativo } : i)),
    }));

  const mudarValor = (id: string, valor: string) =>
    setDados((d) => ({
      ...d,
      itens: d.itens.map((i) =>
        i.id === id ? { ...i, valor: Number(valor.replace(/\D/g, "")) || 0 } : i,
      ),
    }));

  const t = useMemo(() => totais(dados), [dados]);
  const msg = useMemo(() => mensagemWhats(dados), [dados]);

  const abrirPdf = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(htmlProposta(dados));
    w.document.close();
  };

  const zapUrl = () => {
    const fone = soDigitos(dados.clienteWhats);
    return `https://wa.me/${fone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Dados</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Seu nome</Label>
              <Input value={dados.seuNome} onChange={(e) => set("seuNome", e.target.value)} placeholder="Seu nome" />
            </div>
            <div>
              <Label>Seu WhatsApp</Label>
              <Input value={dados.seuWhats} onChange={(e) => set("seuWhats", e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Cliente</Label>
              <Input value={dados.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div>
              <Label>WhatsApp do cliente</Label>
              <Input value={dados.clienteWhats} onChange={(e) => set("clienteWhats", e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="col-span-2">
              <Label>Negócio do cliente</Label>
              <Input value={dados.negocio} onChange={(e) => set("negocio", e.target.value)} placeholder="Ex: Padaria Pão Dourado" />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Itens da proposta</h2>
          <div className="space-y-3">
            {dados.itens.map((i) => (
              <div
                key={i.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  i.ativo ? "border-lime/60 bg-lime/5" : "border-border"
                }`}
              >
                <input
                  type="checkbox"
                  checked={i.ativo}
                  onChange={() => alternar(i.id)}
                  className="size-5 shrink-0 accent-[#C8F53C] cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{i.nome}</p>
                  <p className="truncate text-xs text-tmuted">{i.detalhe}</p>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-tmuted">R$</span>
                  <input
                    value={i.valor}
                    onChange={(e) => mudarValor(i.id, e.target.value)}
                    inputMode="numeric"
                    className="w-20 rounded-lg border border-border bg-surface1 px-2 py-1.5 text-right text-sm outline-none focus:border-lime"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Condições</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prazo de entrega</Label>
              <Input value={dados.prazo} onChange={(e) => set("prazo", e.target.value)} />
            </div>
            <div>
              <Label>Válida até</Label>
              <Input value={dados.validade} onChange={(e) => set("validade", e.target.value)} placeholder="Ex: 30/12/2026" />
            </div>
            <div>
              <Label>Pagamento</Label>
              <Input value={dados.pagamento} onChange={(e) => set("pagamento", e.target.value)} />
            </div>
            <div>
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={dados.desconto}
                onChange={(e) => set("desconto", Number(e.target.value))}
              />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={dados.obs} onChange={(e) => set("obs", e.target.value)} placeholder="Detalhes extras..." />
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6 lg:col-span-2">
        <Card className="lg:sticky lg:top-6">
          <h2 className="mb-4 text-lg font-bold">Resumo</h2>
          <div className="space-y-1 text-sm">
            {dados.itens.filter((i) => i.ativo).map((i) => (
              <div key={i.id} className="flex justify-between text-tsecondary">
                <span>{i.nome}</span>
                <span>{brl(Number(i.valor) || 0)}</span>
              </div>
            ))}
            {t.desc > 0 && (
              <>
                <div className="flex justify-between text-tsecondary">
                  <span>Subtotal</span>
                  <span>{brl(t.sub)}</span>
                </div>
                <div className="flex justify-between text-tsecondary">
                  <span>Desconto ({t.desc}%)</span>
                  <span>− {brl(t.sub - t.total)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between border-t border-border pt-3 text-lg font-bold">
              <span>Total</span>
              <span className="text-lime">{brl(t.total)}</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <a href={zapUrl()} target="_blank" rel="noreferrer" className="block">
              <Button className="w-full">
                <MessageCircle className="size-4" /> Enviar no WhatsApp
              </Button>
            </a>
            <CopyButton text={msg} label="Copiar mensagem" />
            <Button variant="outline" onClick={abrirPdf} className="w-full">
              <FileDown className="size-4" /> Abrir PDF para imprimir
            </Button>
          </div>
          <p className="mt-4 text-xs text-tmuted">
            O PDF abre numa nova aba com botão de salvar/imprimir.
          </p>
        </Card>
      </div>
    </div>
  );
}
