import { expect, test } from "bun:test";
import { linkWhatsappGold } from "../src/lib/arsenal";

test("link do WhatsApp do Gold: DDI 55 e mensagem pronta", () => {
  const url = linkWhatsappGold("(62) 99999-0000", "Ana", "ana@x.com");
  expect(url.startsWith("https://wa.me/5562999990000?text=")).toBe(true);
  const texto = decodeURIComponent(url.split("text=")[1]!);
  expect(texto).toContain("plano Gold");
  expect(texto).toContain("Gemini IA (18 meses)");
  expect(texto).toContain("ana@x.com");
  expect(texto).toContain("comprovante");
  expect(linkWhatsappGold("+55 62 99999-0000", "", "")).toContain("wa.me/5562999990000");
});
