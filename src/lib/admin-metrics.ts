export type Transaction = { id: string; user_id: string | null; email: string; plan: string; amount_cents: number | null; status: string; created_at: string; source: string };
export type AdminUser = { id: string; name: string | null; email: string; plan: string; active: boolean; created_at: string; last_seen_at: string | null };
export type Plan = { id: string; name: string; price_cents: number; recurring: boolean };
export type ToolSetting = { id: string; name: string; description: string; enabled: boolean };
export type SiteContent = { hero_title?: string; hero_description?: string; testimonials?: { nome: string; profissao: string; texto: string; foto: string }[]; faq?: { q: string; a: string }[] };
export type AdminData = { users: AdminUser[]; transactions: Transaction[]; plans: Plan[]; tools: ToolSetting[]; usage: { tool_id: string; day: string; count: number }[]; online: number; content: SiteContent; subscriptions: { user_id: string | null; status: string; plano: string; valido_ate: string | null; valor_centavos: number | null }[]; captured_at: string };
export const isPaid = (t: Transaction) => t.status === 'pago' || t.status === 'paid';
export function growth(current: number, previous: number): number | null { return previous > 0 ? (current - previous) / previous * 100 : null; }
export function metrics(data: AdminData, now = new Date()) {
  const paid = data.transactions.filter(isPaid);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sum = (start: Date, end: Date) => paid.filter(t => new Date(t.created_at) >= start && new Date(t.created_at) < end).reduce((s,t) => s + (t.amount_cents ?? 0), 0) / 100;
  const total = paid.reduce((s,t) => s + (t.amount_cents ?? 0), 0) / 100;
  const uniqueCustomers = new Set(paid.map(t => t.user_id).filter(Boolean));
  const activeSubs = data.subscriptions.filter(s => s.status === 'ativo' && (!s.valido_ate || new Date(s.valido_ate) > now));
  const byUser = new Map<string, typeof activeSubs[number]>(); activeSubs.forEach(s => { if(s.user_id) byUser.set(s.user_id,s); });
  const mrr = [...byUser.values()].reduce((sum,s) => { const p = data.plans.find(p => p.id === s.plano); return sum + (p?.recurring ? p.price_cents / 100 : s.plano === 'mensal' ? (s.valor_centavos ?? 0) / 100 : 0); },0);
  return { today: sum(today,now), month: sum(month,now), todayGrowth: growth(sum(today,now),sum(yesterday,today)), monthGrowth:growth(sum(month,now),sum(lastMonth,month)), purchases24:paid.filter(t => new Date(t.created_at).getTime() >= now.getTime()-86400000 && new Date(t.created_at)<=now).length,total,ticket:paid.length ? total/paid.length : null,conversion:data.users.length ? uniqueCustomers.size/data.users.length*100 : null,mrr };
}
export function revenueSeries(transactions: Transaction[], days: number, mode: string, now = new Date()) {
 const start = new Date(now.getFullYear(),now.getMonth(),now.getDate()); start.setDate(start.getDate()-days+1);
 const groups = new Map<string,{label:string;value:number}>();
 for(let i=0;i<days;i++){ const d=new Date(start);d.setDate(start.getDate()+i); const key=mode==='Mensal'?`${d.getFullYear()}-${d.getMonth()}`:mode==='Semanal'?String(Math.floor(i/7)):String(i); const row=groups.get(key)??{label:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),value:0}; const next=new Date(d);next.setDate(d.getDate()+1); row.value+=transactions.filter(t=>isPaid(t)&&new Date(t.created_at)>=d&&new Date(t.created_at)<next).reduce((s,t)=>s+(t.amount_cents??0)/100,0);groups.set(key,row); }
 return [...groups.values()];
}