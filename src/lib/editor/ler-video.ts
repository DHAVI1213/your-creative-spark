export type InfoVideo = { duracao: number; largura: number; altura: number };

export function lerInfo(file: File): Promise<InfoVideo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.hidden = true;
    video.preload = "metadata";
    const limpar = () => {
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const falhar = (mensagem: string) => {
      limpar();
      reject(new Error(mensagem));
    };
    const timeout = setTimeout(
      () => falhar("O vídeo demorou mais de 10 segundos para abrir. Tente outro arquivo."),
      10_000,
    );
    video.onerror = () =>
      falhar("Não foi possível abrir este vídeo. Confira o formato do arquivo.");
    video.onloadedmetadata = () => {
      const info = {
        duracao: video.duration,
        largura: video.videoWidth,
        altura: video.videoHeight,
      };
      if (!Number.isFinite(info.duracao) || info.duracao <= 0 || !info.largura || !info.altura) {
        falhar("Este vídeo não tem duração ou dimensões válidas.");
        return;
      }
      limpar();
      resolve(info);
    };
    video.src = url;
  });
}
