export type Palavra = { w: string; s: number; e: number };
export type Candidato = {
  s: number;
  e: number;
  nota: number;
  titulo: string;
  gancho: string;
  descricao: string;
  origem: string;
  n?: number;
};

/** Aceita apenas trechos reais, inteiros e não sobrepostos. Notas são estimativas. */
export function limitarCandidatos(
  lista: Candidato[],
  duracao: number,
  min: number,
  max: number,
  quantidade: number,
) {
  const escolhidos: Candidato[] = [];
  for (const c of [...lista].sort((a, b) => b.nota - a.nota)) {
    const s = Math.max(0, Number(c.s)),
      e = Math.min(duracao, Number(c.e));
    if (!Number.isFinite(s) || !Number.isFinite(e) || e - s < min || e - s > max + 0.01) continue;
    if (escolhidos.some((x) => s < x.e && e > x.s)) continue;
    escolhidos.push({
      ...c,
      s,
      e,
      nota: Math.max(0, Math.min(100, Number(c.nota) || 0)),
      n: escolhidos.length + 1,
    });
    if (escolhidos.length >= quantidade) break;
  }
  return escolhidos;
}

/** Regras da ferramenta original: ganchos, perguntas, frases completas e ritmo. */
export function candidatosPorRegras(words: Palavra[], min: number, max: number): Candidato[] {
  const resultado: Candidato[] = [];
  for (let i = 0; i < words.length; i++) {
    const primeira = words[i];
    if (!primeira) continue;
    if (i && !/[.!?…]$/.test(words[i - 1]?.w ?? "") && primeira.s - (words[i - 1]?.e ?? 0) < 1)
      continue;
    let fim = i;
    while (fim + 1 < words.length && (words[fim]?.e ?? 0) - primeira.s < min) fim++;
    while (
      fim + 1 < words.length &&
      !/[.!?…]$/.test(words[fim]?.w ?? "") &&
      (words[fim + 1]?.e ?? Infinity) - primeira.s <= max
    )
      fim++;
    const ultima = words[fim];
    if (!ultima || ultima.e - primeira.s > max || ultima.e - primeira.s < min) continue;
    const trecho = words
        .slice(i, fim + 1)
        .map((w) => w.w)
        .join(" "),
      texto = trecho
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const gancho =
      /\b(segredo|verdade|ninguem|nunca|problema|erro|descobri|incrivel|dinheiro|sucesso|por que)\b/.test(
        texto.slice(0, 150),
      );
    const ritmo = (fim - i + 1) / (ultima.e - primeira.s);
    resultado.push({
      s: primeira.s,
      e: ultima.e,
      nota:
        40 +
        (gancho ? 18 : 0) +
        (trecho.includes("?") ? 8 : 0) +
        (ritmo >= 2.2 && ritmo <= 4.2 ? 8 : 0),
      titulo: trecho.slice(0, 85),
      gancho: trecho.slice(0, 150),
      descricao: trecho,
      origem: "regras",
    });
  }
  return resultado;
}

export function enderecoNuvem(valor: string) {
  const u = new URL(valor);
  // Só Workers públicos. Impede que uma configuração seja usada para acessar
  // serviços privados, metadata de nuvem ou credenciais de outro usuário.
  if (
    u.protocol !== "https:" ||
    !u.hostname.endsWith(".workers.dev") ||
    u.username ||
    u.password ||
    u.port ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw new Error("Use o endereço HTTPS do seu Agendador em workers.dev.");
  return u.origin;
}
