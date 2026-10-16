import { useState } from "react";
import { Download, MapPin, Search } from "lucide-react";
import { baixarCsv, gerarLeads, leadsParaCsv, type Lead } from "../lib/leads";
import { Badge, Button, Card, Input, Label, Select } from "../components/ui";
import { cn } from "../lib/utils";

const NICHOS = [
  { id: "restaurante", nome: "Restaurante / Marmita" },
  { id: "barbearia", nome: "Barbearia" },
  { id: "salao", nome: "Salão / Estética" },
  { id: "academia", nome: "Academia" },
  { id: "loja", nome: "Loja de roupas" },
  { id: "clinica", nome: "Clínica / Odonto" },
];

const STATUS: Lead["status"][] = ["novo", "contatado", "respondeu", "fechado"];
const COR_STATUS: Record<Lead["status"], string> = {
  novo: "default",
  contatado: "default",
  respondeu: "lime",
  fechado: "lime",
};

export default function WorkspaceMinerador() {
  const [cidade, setCidade] = useState("");
  const [nicho, setNicho] = useState(NICHOS[0]!.id);
  const [leads, setLeads] = useState<Lead[]>([]);

  const buscar = () => setLeads(gerarLeads(cidade, nicho));

  const ciclarStatus = (id: string) =>
    setLeads((ls) =>
      ls.map((l) =>
        l.id === id ? { ...l, status: STATUS[(STATUS.indexOf(l.status) + 1) % STATUS.length]! } : l,
      ),
    );

  return (
    <div>
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <Label>Cidade</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: Campinas" />
          </div>
          <div className="flex-1">
            <Label>Nicho</Label>
            <Select value={nicho} onChange={(e) => setNicho(e.target.value)}>
              {NICHOS.map((n) => (
                <option key={n.id} value={n.id}>{n.nome}</option>
              ))}
            </Select>
          </div>
          <Button onClick={buscar}>
            <Search className="size-4" /> Buscar leads
          </Button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-tmuted">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          Lista de prospecção para organizar sua abordagem. Clique no status de cada lead para
          avançar no funil: novo → contatado → respondeu → fechado.
        </p>
      </Card>

      {leads.length > 0 && (
        <Card className="mt-6 p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="font-bold">{leads.length} leads encontrados</h2>
            <Button variant="dark" onClick={() => baixarCsv("leads.csv", leadsParaCsv(leads))} className="!py-2 text-xs">
              <Download className="size-3.5" /> Exportar CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-tmuted">
                  <th className="px-6 py-3">Negócio</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3">Instagram</th>
                  <th className="px-4 py-3">Sinal</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-surface2/50">
                    <td className="px-6 py-3">
                      <p className="font-semibold">{l.nome}</p>
                      <p className="text-xs text-tmuted">{l.cidade}</p>
                    </td>
                    <td className="px-4 py-3 text-tsecondary">{l.whatsapp}</td>
                    <td className="px-4 py-3 text-tsecondary">{l.instagram}</td>
                    <td className="px-4 py-3">
                      <Badge tone="warn">{l.sinal}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => ciclarStatus(l.id)} className={cn("cursor-pointer")} title="Clique para avançar">
                        <Badge tone={COR_STATUS[l.status] as "default" | "lime"}>{l.status}</Badge>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
