import { EDICAO_PADRAO, type Corte, type Edicao, type Filtro, type VideoItem } from "./tipos";

export type Predefinicao = Filtro & { grupo: "Clássicos" | "Anime" };
const preset = (
  nome: string,
  valores: Partial<Filtro>,
  grupo: Predefinicao["grupo"] = "Clássicos",
): Predefinicao => ({ ...EDICAO_PADRAO.filtro, nome, ...valores, grupo });
// Brilho/contraste/saturação: multiplicadores 0–2 (saturação até 3).
// Temperatura: -1 (azul) a +1 (âmbar). Demais ajustes: intensidade 0–1.
export const FILTROS: Predefinicao[] = [
  preset("Nenhum", {}),
  preset("Vivo", { contraste: 1.15, saturacao: 1.45 }),
  preset("Cinema", {
    brilho: 0.96,
    contraste: 1.25,
    saturacao: 0.8,
    temperatura: -0.12,
    vinheta: 0.25,
  }),
  preset("Preto e branco", { saturacao: 0, contraste: 1.2 }),
  preset("Retrô", { contraste: 0.9, saturacao: 0.75, temperatura: 0.35, granulado: 0.18 }),
  preset("Frio", { temperatura: -0.55, saturacao: 1.1 }),
  preset("Quente", { temperatura: 0.55, saturacao: 1.1 }),
  preset("Noite neon", {
    brilho: 0.9,
    contraste: 1.4,
    saturacao: 1.7,
    temperatura: -0.25,
    vinheta: 0.3,
  }),
  preset(
    "Anime Sistema (azul)",
    {
      brilho: 1.08,
      contraste: 1.35,
      saturacao: 1.6,
      temperatura: -0.25,
      vinheta: 0.18,
      nitidez: 0.3,
    },
    "Anime",
  ),
  preset(
    "Anime Sombra (roxo)",
    {
      brilho: 1.04,
      contraste: 1.45,
      saturacao: 1.65,
      temperatura: -0.1,
      vinheta: 0.22,
      nitidez: 0.3,
    },
    "Anime",
  ),
  preset(
    "Anime Dourado",
    {
      brilho: 1.1,
      contraste: 1.3,
      saturacao: 1.5,
      temperatura: 0.35,
      vinheta: 0.18,
      nitidez: 0.25,
    },
    "Anime",
  ),
  preset(
    "Anime Pastel",
    {
      brilho: 1.15,
      contraste: 1.12,
      saturacao: 1.3,
      temperatura: 0.08,
      vinheta: 0.1,
      nitidez: 0.15,
    },
    "Anime",
  ),
];
const limitar = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
export function normalizarFiltro(filtro: Filtro): Filtro {
  return {
    ...filtro,
    brilho: limitar(filtro.brilho, 0, 2),
    contraste: limitar(filtro.contraste, 0, 2),
    saturacao: limitar(filtro.saturacao, 0, 3),
    temperatura: limitar(filtro.temperatura, -1, 1),
    vinheta: limitar(filtro.vinheta, 0, 1),
    nitidez: limitar(filtro.nitidez, 0, 1),
    granulado: limitar(filtro.granulado, 0, 1),
  };
}
export function tonsDoFiltro(nome: string) {
  if (nome === "Anime Sistema (azul)")
    return { sombras: [0, 0.08, 0.2], luzes: [0.02, 0.06, 0.12], cor: "30,110,255" };
  if (nome === "Anime Sombra (roxo)")
    return { sombras: [0.12, -0.04, 0.2], luzes: [0.08, 0.02, 0.12], cor: "150,65,255" };
  if (nome === "Anime Dourado")
    return { sombras: [0.08, 0.02, -0.08], luzes: [0.14, 0.08, 0], cor: "255,185,55" };
  if (nome === "Anime Pastel")
    return { sombras: [0.06, 0.01, 0.1], luzes: [0.1, 0.06, 0.1], cor: "220,165,255" };
  return { sombras: [0, 0, 0], luzes: [0, 0, 0], cor: "0,0,0" };
}
export function paraCss(filtro: Filtro): string {
  const f = normalizarFiltro(filtro);
  // Retrô: sepia 25% e rotação -10°. Temperatura e tons seletivos usam
  // camadas de cor no componente; CSS filter não tem colorbalance.
  return `brightness(${f.brilho}) contrast(${f.contraste}) saturate(${f.saturacao}) sepia(${f.nome === "Retrô" ? 0.25 : 0}) hue-rotate(${f.nome === "Retrô" ? -10 : 0}deg)`;
}
export function paraFfmpeg(filtro: Filtro): string {
  const f = normalizarFiltro(filtro);
  const tons = tonsDoFiltro(f.nome);
  const [r = 0, g = 0, b = 0] = tons.sombras;
  const [lr = 0, lg = 0, lb = 0] = tons.luzes;
  // eq brightness é aditivo: (multiplicador CSS - 1)/2 aproxima meios-tons.
  // Temperatura ±1 = ±0.18 no vermelho/azul. CSS usa camada a 18%.
  // Tons anime usam os mesmos pesos em sombras e luzes, aproximados por
  // soft-light/screen no navegador. Não são conversões pixel a pixel.
  const t = f.temperatura * 0.18;
  const partes = [
    `eq=brightness=${(f.brilho - 1) / 2}:contrast=${f.contraste}:saturation=${f.saturacao}`,
    `colorbalance=rs=${r + t}:gs=${g}:bs=${b - t}:rh=${lr + t / 2}:gh=${lg}:bh=${lb - t / 2}`,
    `hue=h=${f.nome === "Retrô" ? -10 : 0}`,
  ];
  if (f.nome === "Retrô")
    partes.push(
      "colorchannelmixer=rr=0.84825:rg=0.19225:rb=0.04725:gr=0.08725:gg=0.9215:gb=0.042:br=0.068:bg=0.1335:bb=0.78275",
    );
  // Vignette: angle 0 é neutro; π/4 é intensidade máxima.
  if (f.vinheta) partes.push(`vignette=angle=${(f.vinheta * Math.PI) / 4}`);
  if (f.nitidez) partes.push(`unsharp=5:5:${f.nitidez}:5:5:0`);
  if (f.granulado) partes.push(`noise=alls=${Math.round(f.granulado * 20)}:allf=t+u`);
  return partes.join(",");
}
export function limitarCorte(corte: Corte, duracao: number): { inicio: number; fim: number } {
  const fimVideo = Number.isFinite(duracao) ? Math.max(0, duracao) : 0;
  const inicio = limitar(corte.inicio, 0, Math.max(0, fimVideo - 0.05));
  const fim =
    corte.fim === null ? fimVideo : limitar(corte.fim, Math.min(fimVideo, inicio + 0.05), fimVideo);
  return { inicio, fim };
}
export function edicaoDoVideo(video: VideoItem, edicao: Edicao): Edicao {
  return {
    ...edicao,
    ...video.ajuste,
    corte: limitarCorte(video.ajuste?.corte ?? edicao.corte, video.duracao),
  };
}
