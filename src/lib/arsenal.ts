/** Arsenal Gold: as IAs e ferramentas pro que vêm no plano Gold (liberadas pelo WhatsApp). */
export const ARSENAL = [
  {
    nome: "Figma Pro Education",
    duracao: "Education",
    descricao: "Design e prototipagem profissional para criar interfaces e criativos de alto nível.",
    imagem: "/arsenal/figma.jpg",
  },
  {
    nome: "Gemini IA",
    duracao: "18 meses",
    descricao: "Inteligência artificial avançada para textos, ideias e automação do seu conteúdo.",
    imagem: "/arsenal/gemini.jpg",
  },
  {
    nome: "Framer Pro",
    duracao: "12 meses",
    descricao: "Sites e interações em código, com animações premium e publicação instantânea.",
    imagem: "/arsenal/framer.jpg",
  },
];

/** Link do WhatsApp com a mensagem pronta pedindo a liberação do Gold. */
export function linkWhatsappGold(numero: string, nome: string, email: string) {
  const digitos = numero.replace(/\D/g, "");
  const tel = digitos.length <= 11 ? "55" + digitos : digitos; // sem DDI -> Brasil
  const itens = ARSENAL.map((a) => `• ${a.nome} (${a.duracao})`).join("\n");
  const texto =
    `Olá! Assinei o *plano Gold* da NK Software e quero liberar meu Arsenal Gold:\n${itens}\n\n` +
    `Nome: ${nome}\nE-mail da conta: ${email}\n\n` +
    `Segue o comprovante de pagamento 👇`;
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}
