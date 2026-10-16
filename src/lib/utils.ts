export function cn(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(" ");
}

export function baixarBlob(blob: Blob, nome: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
