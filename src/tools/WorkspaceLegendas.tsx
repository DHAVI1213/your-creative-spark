import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  NICHOS,
  gerarHashtags,
  gerarLegendas,
  type EntradaLegenda,
  type Tom,
} from "../lib/legendas";
import { Button, Card, CopyButton, Input, Label, Select } from "../components/ui";

const TONS: { id: Tom; nome: string }[] = [
  { id: "vendedor", nome: "Vendedor" },
  { id: "leve", nome: "Leve / divertido" },
  { id: "profissional", nome: "Profissional" },
  { id: "emocional", nome: "Emocional" },
];

export default function WorkspaceLegendas() {
  const [nichoId, setNichoId] = useState(NICHOS[0]!.id);
  const [tom, setTom] = useState<Tom>("vendedor");
  const [negocio, setNegocio] = useState("");
  const [oferta, setOferta] = useState("");
  const [cta, setCta] = useState("Chama no direct ou no WhatsApp!");
  const [cidade, setCidade] = useState("");
  const [extras, setExtras] = useState("");
  const [qtdTags, setQtdTags] = useState(15);
  const [emojis, setEmojis] = useState(true);
  const [resultado, setResultado] = useState<string[] | null>(null);

  const entrada: EntradaLegenda = useMemo(
    () => ({
      nicho: NICHOS.find((n) => n.id === nichoId)!,
      tom,
      negocio,
      oferta,
      cta,
      cidade,
      extras: extras.split(/[,\s]+/).filter(Boolean),
      qtdTags,
      emojis,
    }),
    [nichoId, tom, negocio, oferta, cta, cidade, extras, qtdTags, emojis],
  );

  const gerar = () => setResultado(gerarLegendas(entrada, 3));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-6 text-lg font-bold">Configurar</h2>
        <div className="space-y-4">
          <div>
            <Label>Nicho</Label>
            <Select value={nichoId} onChange={(e) => setNichoId(e.target.value)}>
              {NICHOS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Tom de voz</Label>
            <div className="grid grid-cols-2 gap-2">
              {TONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTom(t.id)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium cursor-pointer transition-all ${
                    tom === t.id
                      ? "border-lime bg-lime/10 text-lime"
                      : "border-border text-tsecondary hover:border-tmuted"
                  }`}
                >
                  {t.nome}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Negócio</Label>
              <Input value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder="Nome do negócio" />
            </div>
            <div>
              <Label>Cidade (opcional)</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="São Paulo" />
            </div>
          </div>
          <div>
            <Label>Oferta (opcional)</Label>
            <Input value={oferta} onChange={(e) => setOferta(e.target.value)} placeholder="Ex: 20% off hoje" />
          </div>
          <div>
            <Label>Chamada para ação</Label>
            <Input value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
          <div>
            <Label>Tags extras (separadas por vírgula)</Label>
            <Input value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="delivery, promo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Qtd. de hashtags: {qtdTags}</Label>
              <input
                type="range"
                min={5}
                max={30}
                value={qtdTags}
                onChange={(e) => setQtdTags(Number(e.target.value))}
                className="w-full accent-[#C8F53C]"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm text-tsecondary">
              <input
                type="checkbox"
                checked={emojis}
                onChange={(e) => setEmojis(e.target.checked)}
                className="size-4 accent-[#C8F53C]"
              />
              Usar emojis
            </label>
          </div>
          <Button onClick={gerar} className="w-full">
            <Sparkles className="size-4" /> Gerar 3 legendas
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {resultado ? (
          resultado.map((leg, i) => (
            <Card key={i}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-lime">Legenda {i + 1}</p>
                <CopyButton text={leg} label="Copiar legenda" />
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-tsecondary">{leg}</p>
            </Card>
          ))
        ) : (
          <Card>
            <p className="py-10 text-center text-sm text-tmuted">
              Preencha ao lado e clique em gerar. As hashtags saem clicáveis no Instagram.
            </p>
          </Card>
        )}
        {resultado && (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-lime">Só hashtags</p>
              <CopyButton text={gerarHashtags(entrada).join(" ")} label="Copiar tags" />
            </div>
            <p className="text-sm leading-relaxed text-tsecondary">
              {gerarHashtags(entrada).join(" ")}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
