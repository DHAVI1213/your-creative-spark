import type { Camada, TextoCamada } from "./tipos";

export const FONTES_EDITOR = [
  { nome: "Bebas Neue", arquivo: "BebasNeue-Regular.ttf" },
  { nome: "Anton", arquivo: "Anton-Regular.ttf" },
  { nome: "Montserrat", arquivo: "Montserrat-ExtraBold.ttf" },
  { nome: "Bangers", arquivo: "Bangers-Regular.ttf" },
  { nome: "Russo One", arquivo: "RussoOne-Regular.ttf" },
  { nome: "Poppins", arquivo: "Poppins-Bold.ttf" },
] as const;
export const GOOGLE_FONTES_EDITOR =
  "https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Bebas+Neue&family=Montserrat:wght@800&family=Poppins:wght@400;700&family=Russo+One&display=swap";

export function substituirVariaveis(texto: string, nome: string, numero: number): string {
  const semExtensao = nome.replace(/\.[^.]+$/, "");
  return texto.replace(/\{(nome|numero)\}/g, (_, variavel: string) =>
    variavel === "nome" ? semExtensao : String(Math.max(1, Math.floor(numero))),
  );
}
const limitar = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : (min + max) / 2;

// x/y são o CENTRO da camada. As dimensões são relativas à moldura.
// A caixa rotacionada também deve ficar dentro dela; reduzir uma camada
// maior que a moldura evita que a normalização gere coordenadas impossíveis.
export function limitarPosicao(
  x: number,
  y: number,
  largura: number,
  altura: number,
  rotacao = 0,
  proporcao = 1,
) {
  const rad = (rotacao * Math.PI) / 180;
  const w = limitar(largura, 0.01, 1);
  const h = limitar(altura, 0.001, 10000);
  const r = Number.isFinite(proporcao) && proporcao > 0 ? proporcao : 1;
  const caixaX = Math.abs(Math.cos(rad)) * w + (Math.abs(Math.sin(rad)) * h) / r;
  const caixaY = Math.abs(Math.sin(rad)) * w * r + Math.abs(Math.cos(rad)) * h;
  const escala = Math.min(1, 1 / caixaX, 1 / caixaY);
  const metadeX = Math.min(0.5, (caixaX * escala) / 2);
  const metadeY = Math.min(0.5, (caixaY * escala) / 2);
  return {
    x: limitar(x, metadeX, 1 - metadeX),
    y: limitar(y, metadeY, 1 - metadeY),
    largura: w * escala,
    altura: h * escala,
  };
}
export function alinharCentro(valor: number, tolerancia = 0.02) {
  return Math.abs(valor - 0.5) <= tolerancia ? 0.5 : valor;
}
export function camadaVisivel(camada: Camada, tempo: number) {
  return !camada.oculta && tempo >= camada.inicio && (camada.fim === null || tempo < camada.fim);
}
export const MODELOS_TEXTO = [
  "Título Sistema",
  "Chamada",
  "Parte {numero}",
  "Siga para mais",
  "Marca d'água discreta",
] as const;
export function criarTexto(modelo: string = "Título Sistema"): Camada {
  const texto: TextoCamada = {
    conteudo: "Seu título",
    fonte: "Bebas Neue",
    tamanho: 0.07,
    cor: "#38bdf8",
    contorno: { cor: "#082f49", espessura: 0.003 },
    sombra: true,
    fundo: null,
    negrito: true,
    maiusculas: false,
    alinhamento: "center",
  };
  if (modelo === "Chamada")
    Object.assign(texto, {
      conteudo: "Olha isso!",
      cor: "#fde047",
      fonte: "Anton",
      fundo: { cor: "#000000", opacidade: 0.85, arredondado: 0.01 },
    });
  if (modelo === "Parte {numero}")
    Object.assign(texto, { conteudo: "Parte {numero}", cor: "#ffffff", fonte: "Russo One" });
  if (modelo === "Siga para mais")
    Object.assign(texto, {
      conteudo: "Siga para mais",
      cor: "#ffffff",
      fonte: "Poppins",
      tamanho: 0.045,
    });
  if (modelo === "Marca d'água discreta")
    Object.assign(texto, {
      conteudo: "@sua_marca",
      cor: "#ffffff",
      fonte: "Montserrat",
      tamanho: 0.025,
      sombra: false,
      contorno: { cor: "#000000", espessura: 0 },
    });
  return {
    id: crypto.randomUUID(),
    tipo: "texto",
    x: modelo === "Marca d'água discreta" ? 0.75 : 0.5,
    y: modelo === "Marca d'água discreta" ? 0.1 : modelo === "Siga para mais" ? 0.75 : 0.25,
    largura: modelo === "Marca d'água discreta" ? 0.35 : 0.8,
    rotacao: 0,
    opacidade: modelo === "Marca d'água discreta" ? 0.4 : 1,
    inicio: 0,
    fim: null,
    animacao: "nenhuma",
    texto,
  };
}
export async function lerImagem(file: File): Promise<Camada> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Escolha uma imagem PNG, JPG ou WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter até 10 MB.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () =>
      typeof leitor.result === "string"
        ? resolve(leitor.result)
        : reject(new Error("Não foi possível ler a imagem."));
    leitor.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    leitor.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve();
    imagem.onerror = () => reject(new Error("Não foi possível abrir esta imagem."));
    imagem.src = dataUrl;
  });
  return {
    id: crypto.randomUUID(),
    tipo: "imagem",
    x: 0.5,
    y: 0.5,
    largura: 0.25,
    rotacao: 0,
    opacidade: 1,
    inicio: 0,
    fim: null,
    animacao: "nenhuma",
    imagem: { dataUrl, mimeType: file.type },
  };
}
