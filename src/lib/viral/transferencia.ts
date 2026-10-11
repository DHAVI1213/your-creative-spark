/** Arquivos reais, por conta, persistidos até o editor confirmar a importação. */
function abrir(usuario: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(`viral-editor-${usuario}`, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("arquivos", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("Não foi possível guardar os vídeos neste navegador."));
  });
}
export async function guardarNoEditor(usuario: string, arquivos: File[]) {
  const db = await abrir(usuario);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("arquivos", "readwrite"),
        store = tx.objectStore("arquivos");
      const count = store.count();
      count.onsuccess = () => {
        if (count.result > 0) {
          tx.abort();
          reject(
            new Error(
              "Há vídeos aguardando no editor. Abra o Editor e conclua a importação antes de enviar outro lote.",
            ),
          );
          return;
        }
        arquivos.forEach((file, ordem) => store.put({ id: crypto.randomUUID(), file, ordem }));
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(new Error("Não há espaço para enviar os vídeos ao editor. Baixe um lote menor."));
      tx.onerror = () => reject(new Error("Não foi possível guardar os vídeos."));
    });
  } finally {
    db.close();
  }
}
export async function receberNoEditor(
  usuario: string,
  importar: (files: File[]) => Promise<number[]>,
) {
  const db = await abrir(usuario);
  try {
    const arquivos = await new Promise<{ id: string; file: File; ordem?: number }[]>(
      (resolve, reject) => {
        const tx = db.transaction("arquivos", "readonly"),
          r = tx.objectStore("arquivos").getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(new Error("Não foi possível recuperar os vídeos do minerador."));
      },
    );
    if (!arquivos.length) return;
    arquivos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const sucesso = await importar(arquivos.map((a) => a.file));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("arquivos", "readwrite"),
        store = tx.objectStore("arquivos");
      for (const i of sucesso) if (arquivos[i]) store.delete(arquivos[i]!.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("Não foi possível confirmar a importação."));
    });
    return { importados: sucesso.length, pendentes: arquivos.length - sucesso.length };
  } finally {
    db.close();
  }
}
