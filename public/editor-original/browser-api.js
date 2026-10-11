/* Adaptação da ferramenta original: arquivos permanecem no navegador.
 * FFmpeg usa uma fila única, porque um mesmo sistema de arquivos WASM não
 * suporta dois comandos concorrentes. Nenhum caminho do Windows é aceito.
 */
window.criarApiNavegador = function ({
  criarFFmpeg,
  servidor,
  maxVideoMB,
  usuario,
  abrirConexoes,
}) {
  const arquivos = new Map(),
    urls = new Map(),
    eventos = new Map(),
    faixas = new Map(),
    transcricoes = new Map();
  const S = window.Shared;
  const preferencias = new Map();
  const gerados = new Set();
  let pastaSaida;
  let geracao = 0,
    encerrado = false;
  let banco;
  async function carregarPreferencias() {
    banco = await new Promise((resolve, reject) => {
      const r = indexedDB.open(`editor-original-${usuario}`, 2);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains("preferencias"))
          r.result.createObjectStore("preferencias");
        if (!r.result.objectStoreNames.contains("transcricoes"))
          r.result.createObjectStore("transcricoes");
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(new Error("O navegador não permitiu guardar seus perfis."));
    });
    await new Promise((resolve, reject) => {
      const r = banco.transaction("preferencias").objectStore("preferencias").openCursor();
      r.onsuccess = () => {
        const cursor = r.result;
        if (cursor) {
          preferencias.set(cursor.key, cursor.value);
          cursor.continue();
        } else resolve();
      };
      r.onerror = reject;
    });
  }
  let ffmpeg,
    motor,
    fila = Promise.resolve(),
    trabalhos = [],
    processando = false,
    aberto = false,
    cancelado = false;
  const ouvir = (nome, fn) => {
    if (!eventos.has(nome)) eventos.set(nome, new Set());
    eventos.get(nome).add(fn);
  };
  const emitir = (nome, dados) => {
    for (const fn of eventos.get(nome) || []) fn(dados);
  };
  const exclusivo = (fn) => {
    const tarefa = fila.then(fn);
    fila = tarefa.catch(() => {});
    return tarefa;
  };
  const obter = (p) => {
    const f = arquivos.get(p);
    if (!f) throw new Error("Escolha o arquivo novamente: ele não está mais nesta sessão.");
    return f;
  };
  const registrar = (f, gerado = false) => {
    const p = `${crypto.randomUUID()}/${f.name}`;
    arquivos.set(p, f);
    urls.set(p, URL.createObjectURL(f));
    if (gerado) gerados.add(p);
    return p;
  };
  const nomeSaida = (nome) => nome.replace(/\.[^.]+$/, "") + "_editado.mp4";
  async function guardarResultado(file) {
    if (pastaSaida) {
      let nome = file.name;
      for (let n = 2; ; n++) {
        try {
          await pastaSaida.getFileHandle(nome);
          nome = file.name.replace(/(\.[^.]+)$/, ` (${n})$1`);
        } catch (e) {
          if (e.name !== "NotFoundError") throw e;
          break;
        }
      }
      const handle = await pastaSaida.getFileHandle(nome, { create: true });
      const destino = await handle.createWritable();
      try {
        await destino.write(file);
        await destino.close();
      } catch (e) {
        await destino.abort().catch(() => {});
        throw e;
      }
      file = new File([file], nome, { type: file.type });
    }
    return registrar(file, true);
  }
  const baixar = (p) => {
    const f = obter(p),
      a = document.createElement("a");
    a.href = urls.get(p);
    a.download = f.name;
    a.click();
  };
  const dataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      leitor.readAsDataURL(blob);
    });
  const bytes = async (data) =>
    data instanceof Uint8Array ? data : new Uint8Array(await (await fetch(data)).arrayBuffer());
  async function escolher(accept, multiple = false) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.multiple = multiple;
      input.oncancel = () => resolve([]);
      input.onchange = () => {
        const escolhidos = [...input.files].slice(0, 50),
          validos = [];
        for (const f of escolhidos) {
          if (!accept.split(",").some((tipo) => f.type.startsWith(tipo.split("/")[0] + "/"))) {
            window.toast?.(`${f.name}: escolha um arquivo do tipo indicado.`, "err");
            continue;
          }
          if (f.type.startsWith("video/") && f.size > maxVideoMB * 1024 * 1024) {
            window.toast?.(`${f.name}: limite de ${maxVideoMB} MB neste aparelho.`, "err");
            continue;
          }
          if (
            !f.type.startsWith("video/") &&
            !f.type.startsWith("image/") &&
            !f.type.startsWith("audio/")
          ) {
            window.toast?.(`${f.name}: arquivo não suportado.`, "err");
            continue;
          }
          validos.push(registrar(f));
        }
        resolve(validos);
      };
      input.click();
    });
  }
  async function carregar() {
    if (!motor) {
      const versao = geracao;
      const promessa = criarFFmpeg()
        .then((f) => {
          if (encerrado || versao !== geracao) {
            f.terminate();
            throw new Error("Cancelado");
          }
          ffmpeg = f;
          return f;
        })
        .catch((e) => {
          if (motor === promessa) motor = null;
          throw e;
        });
      motor = promessa;
    }
    return motor;
  }
  async function executar(args, progresso) {
    const f = await carregar(),
      logs = [];
    const log = ({ message }) => {
      logs.push(message);
      if (logs.length > 80) logs.shift();
    };
    const prog = ({ progress }) => progresso?.(Math.max(0, Math.min(0.99, progress)));
    f.on("log", log);
    f.on("progress", prog);
    try {
      const code = await f.exec(args);
      if (code !== 0)
        throw new Error(
          cancelado
            ? "Cancelado"
            : `Não foi possível processar este arquivo. ${logs.slice(-4).join(" ").slice(0, 700)}`,
        );
      return logs;
    } finally {
      f.off("log", log);
      f.off("progress", prog);
    }
  }
  async function comArquivos(fn) {
    const f = await carregar(),
      nomes = [];
    const escrever = async (nome, data) => {
      nomes.push(nome);
      await f.writeFile(nome, data);
      return nome;
    };
    const resultado = (nome) => {
      nomes.push(nome);
      return nome;
    };
    try {
      return await fn({ f, escrever, resultado });
    } finally {
      for (const nome of nomes.reverse()) await f.deleteFile(nome).catch(() => {});
    }
  }
  async function probe(p) {
    const arquivo = obter(p),
      url = urls.get(p);
    // Metadados do navegador fornecem a rotação já corrigida; presença de áudio
    // é confirmada pelo FFmpeg ao exportar, sem suposição sobre vídeos mudos.
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = url;
      const finalizar = () => {
        clearTimeout(timer);
        video.removeAttribute("src");
        video.load();
      };
      const timer = setTimeout(() => {
        finalizar();
        reject(new Error("Não foi possível ler o vídeo em 10 segundos."));
      }, 10000);
      video.onerror = () => {
        finalizar();
        reject(new Error("Este formato não pode ser exibido neste navegador."));
      };
      video.onloadedmetadata = async () => {
        const meta = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          fps: 30,
          hasAudio: true,
          codec: arquivo.type,
        };
        finalizar();
        try {
          meta.hasAudio = await exclusivo(() =>
            comArquivos(async ({ f, escrever }) => {
              const entrada = await escrever(
                "probe-in",
                new Uint8Array(await arquivo.arrayBuffer()),
              );
              return audioPresente(f, entrada);
            }),
          );
          resolve(meta);
        } catch (e) {
          reject(e);
        }
      };
    });
  }
  async function frame(p, tempo = 0, meta, s, limpar = false) {
    return exclusivo(() =>
      comArquivos(async ({ f, escrever, resultado }) => {
        const entrada = await escrever("frame-in", new Uint8Array(await obter(p).arrayBuffer()));
        const filtros = meta && s ? S.limpezaFilters(meta, s) : [];
        if (limpar) {
          const L = S.layout(meta, s);
          filtros.push(`crop=${L.cw}:${L.ch}:${L.left}:${L.top}`, "scale=480:-2");
        }
        const out = resultado("frame.jpg");
        await executar([
          "-y",
          "-ss",
          String(Math.max(0, tempo)),
          "-i",
          entrada,
          "-frames:v",
          "1",
          ...(filtros.length ? ["-vf", filtros.join(",")] : []),
          out,
        ]);
        return dataUrl(new Blob([await f.readFile(out)], { type: "image/jpeg" }));
      }),
    );
  }
  async function audioPresente(f, nome) {
    const logs = [],
      log = ({ message }) => logs.push(message);
    f.on("log", log);
    try {
      await f.exec(["-hide_banner", "-i", nome]);
      return logs.some((m) => /Stream.*Audio:/.test(m));
    } finally {
      f.off("log", log);
    }
  }
  async function processar(job) {
    const versao = geracao;
    return exclusivo(() =>
      comArquivos(async ({ f, escrever, resultado }) => {
        if (cancelado || versao !== geracao) throw new Error("Cancelado");
        const entrada = await escrever(
          "entrada",
          new Uint8Array(await obter(job.input).arrayBuffer()),
        );
        const meta = { ...job.meta, hasAudio: await audioPresente(f, entrada) };
        const caminhos = { out: resultado("saida.mp4") };
        if (job.s.template.fundoTipo !== "blur")
          caminhos.bg = await escrever("fundo.png", await bytes(job.bgData));
        caminhos.ov = await escrever("camadas.png", await bytes(job.ovData));
        if (job.capaData) caminhos.capa = await escrever("capa.jpg", await bytes(job.capaData));
        const settings = S.clone(job.s);
        if (settings.audio.musica)
          settings.audio.musica = await escrever(
            "musica",
            new Uint8Array(await obter(settings.audio.musica).arrayBuffer()),
          );
        if (job.cap) {
          const faixa = faixas.get(job.cap.list);
          if (!faixa) throw new Error("Gere as legendas novamente.");
          const linhas = ["ffconcat version 1.0"];
          for (let i = 0; i < faixa.quadros.length; i++) {
            const q = faixa.quadros[i],
              nome = `legenda-${i}.png`;
            await escrever(nome, q.png);
            linhas.push(`file '${nome}'`, `duration ${Math.max(0.001, q.dur).toFixed(4)}`);
          }
          if (faixa.quadros.length) linhas.push(`file 'legenda-${faixa.quadros.length - 1}.png'`);
          caminhos.cap = {
            list: await escrever("legendas.txt", new TextEncoder().encode(linhas.join("\n"))),
            y: faixa.y0,
          };
        }
        const { args } = window.EditorBuilder.buildArgs(
          { ...job, input: entrada, meta, s: settings },
          caminhos,
          "x264",
        );
        await executar(args, (pct) => emitir("progress", { id: job.id, pct }));
        if (cancelado || versao !== geracao) throw new Error("Cancelado");
        const out = await guardarResultado(
          new File([await f.readFile(caminhos.out)], nomeSaida(job.name), { type: "video/mp4" }),
        );
        let capaOut = null;
        if (job.capaData && settings.capa.salvarJpg)
          capaOut = await guardarResultado(
            new File([await bytes(job.capaData)], job.name.replace(/\.[^.]+$/, "") + "_capa.jpg", {
              type: "image/jpeg",
            }),
          );
        emitir("done", { id: job.id, ok: true, out, capaOut, encoder: "wasm-x264" });
        // Downloads precisam de um gesto em navegadores móveis. O cartão pronto
        // oferece o download individual; não dispara 50 downloads automáticos.
      }),
    );
  }
  async function bombear() {
    if (processando) return;
    processando = true;
    try {
      while (trabalhos.length && !cancelado) {
        const job = trabalhos.shift();
        try {
          await processar(job);
        } catch (e) {
          emitir("done", { id: job.id, ok: false, error: e.message });
        }
      }
    } finally {
      processando = false;
      if (!aberto && !trabalhos.length) emitir("empty");
    }
  }
  async function transcrever(p, opts = {}) {
    const idioma = opts.idioma || "pt",
      memoria = `${p}:${idioma}`;
    if (transcricoes.has(memoria)) {
      transcricoes.set(p, transcricoes.get(memoria));
      return { words: transcricoes.get(memoria) };
    }
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", await obter(p).arrayBuffer())),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const lerCache = (chave) =>
      new Promise((resolve) => {
        if (!banco) {
          resolve(null);
          return;
        }
        const r = banco.transaction("transcricoes").objectStore("transcricoes").get(chave);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      });
    const guardarCache = (chave, valor) =>
      new Promise((resolve) => {
        if (!banco) {
          resolve();
          return;
        }
        const t = banco.transaction("transcricoes", "readwrite");
        t.objectStore("transcricoes").put(valor, chave);
        t.oncomplete = resolve;
        t.onerror = () => {
          window.toast?.(
            "Não foi possível guardar a transcrição. Libere espaço no aparelho.",
            "warn",
          );
          resolve();
        };
      });
    const meta = await probe(p),
      words = [];
    // Partes de 5 minutos mantêm o upload abaixo de 25 MB e liberam a memória
    // entre chamadas. O cache por parte permite retomar depois de cancelar.
    for (let inicio = 0; inicio < meta.duration; inicio += 300) {
      if (cancelado) throw new Error("Cancelado");
      const chave = `${hash}:${idioma}:${inicio}`;
      let parte = transcricoes.get(chave) || (await lerCache(chave));
      if (!parte) {
        const blob = await exclusivo(() =>
          comArquivos(async ({ f, escrever, resultado }) => {
            const input = await escrever("audio-in", new Uint8Array(await obter(p).arrayBuffer())),
              out = resultado("audio.mp3");
            await executar([
              "-y",
              "-ss",
              String(inicio),
              "-t",
              "300",
              "-i",
              input,
              "-vn",
              "-ar",
              "16000",
              "-ac",
              "1",
              "-b:a",
              "48k",
              out,
            ]);
            return dataUrl(new Blob([await f.readFile(out)], { type: "audio/mpeg" }));
          }),
        );
        const resposta = await servidor("transcrever", {
          audio: blob,
          idioma: opts.idioma || "pt",
        });
        parte = resposta.words.map((w) => ({ w: w.w, s: w.s + inicio, e: w.e + inicio }));
        transcricoes.set(chave, parte);
        await guardarCache(chave, parte);
      }
      words.push(...parte);
      emitir("cortes-progresso", {
        origem: opts.origem || "mesa",
        etapa: "transcrever",
        pct: Math.min(1, (inicio + 300) / meta.duration),
        geral: Math.min(0.6, ((inicio + 300) / meta.duration) * 0.6),
        msg: `Transcrevendo ${Math.min(meta.duration, inicio + 300).toFixed(0)} / ${meta.duration.toFixed(0)} segundos…`,
      });
    }
    transcricoes.set(p, words);
    transcricoes.set(memoria, words);
    return { words };
  }
  async function exportarCortes(p, lista) {
    const words = transcricoes.get(p) || [],
      out = [];
    for (let i = 0; i < lista.length; i++) {
      if (cancelado) throw new Error("Cancelado");
      const c = lista[i];
      const arquivo = await exclusivo(() =>
        comArquivos(async ({ f, escrever, resultado }) => {
          const input = await escrever("corte-in", new Uint8Array(await obter(p).arrayBuffer())),
            output = resultado("corte.mp4");
          await executar([
            "-y",
            "-ss",
            String(c.s),
            "-t",
            String(c.e - c.s),
            "-i",
            input,
            "-map",
            "0:v:0",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-threads",
            "1",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            output,
          ]);
          return guardarResultado(
            new File(
              [await f.readFile(output)],
              `corte_${String(c.n || i + 1).padStart(2, "0")}.mp4`,
              { type: "video/mp4" },
            ),
          );
        }),
      );
      out.push({
        ...c,
        arquivo,
        dur: c.e - c.s,
        words: words
          .filter((w) => w.s >= c.s && w.s < c.e)
          .map((w) => ({ ...w, s: w.s - c.s, e: Math.min(c.e, w.e) - c.s })),
      });
      emitir("cortes-progresso", {
        origem: "cortes",
        etapa: "cortar",
        pct: (i + 1) / lista.length,
        geral: 0.7 + (0.3 * (i + 1)) / lista.length,
        msg: `Cortando ${i + 1}/${lista.length}…`,
      });
    }
    return out;
  }
  const api = {
    abrirConexoes,
    url: (p) => urls.get(p) || "",
    carregarPreferencias,
    preferencias: {
      getItem: (k) => preferencias.get(k) ?? null,
      setItem: (k, v) => {
        preferencias.set(k, v);
        if (!banco) {
          window.toast?.(
            "O perfil ficará apenas nesta sessão. Libere o armazenamento do navegador.",
            "warn",
          );
          return;
        }
        const tx = banco.transaction("preferencias", "readwrite");
        tx.objectStore("preferencias").put(v, k);
        tx.onerror = () =>
          window.toast?.("Não foi possível guardar o perfil. Libere espaço no aparelho.", "err");
      },
    },
    liberar: (p) => {
      const url = urls.get(p);
      if (url) URL.revokeObjectURL(url);
      urls.delete(p);
      arquivos.delete(p);
      transcricoes.delete(p);
      gerados.delete(p);
    },
    pickVideos: () => escolher("video/*", true),
    pickFile: async (kind) => (await escolher(kind === "image" ? "image/*" : "audio/*"))[0] || null,
    pickMedia: async () =>
      (await escolher("video/*,image/*", true)).map((p) => ({
        path: p,
        nome: obter(p).name,
        kind: obter(p).type.startsWith("image/") ? "image" : "video",
      })),
    pathForFile: (f) => {
      if (f.size > maxVideoMB * 1024 * 1024 || !f.type.startsWith("video/")) {
        window.toast?.(`Use vídeos de até ${maxVideoMB} MB.`, "err");
        return "";
      }
      return registrar(f);
    },
    pickFolder: async () => {
      if (!window.showDirectoryPicker) {
        window.toast?.(
          "Baixe os resultados pelos cartões prontos. Neste navegador não é possível escolher a pasta.",
          "info",
        );
        return "Downloads";
      }
      try {
        pastaSaida = await window.showDirectoryPicker({ mode: "readwrite" });
        return pastaSaida.name;
      } catch (e) {
        if (e.name === "AbortError") return null;
        throw e;
      }
    },
    defaultOut: async () => "Downloads",
    openPath: async () => {
      for (const p of gerados) baixar(p);
    },
    showItem: async (p) => baixar(p),
    readDataUrl: (p) => dataUrl(obter(p)),
    probe,
    thumb: (p, dur) => frame(p, Math.min(1, dur / 2)),
    frame,
    cleanPreview: (p, t, meta, s) => frame(p, t, meta, s, true),
    cropdetect: (p, dur, width, height) =>
      exclusivo(() =>
        comArquivos(async ({ escrever }) => {
          const input = await escrever("detect-in", new Uint8Array(await obter(p).arrayBuffer()));
          const f = await carregar(),
            logs = [],
            log = ({ message }) => logs.push(message);
          f.on("log", log);
          try {
            await f.exec([
              "-ss",
              String(dur / 2),
              "-t",
              "2",
              "-i",
              input,
              "-vf",
              "cropdetect=24:2:0",
              "-an",
              "-f",
              "null",
              "-",
            ]);
          } finally {
            f.off("log", log);
          }
          const match = logs.join("\n").match(/crop=(\d+):(\d+):(\d+):(\d+)(?![\s\S]*crop=)/);
          if (!match) return { top: 0, bottom: 0, left: 0, right: 0 };
          const [, w, h, x, y] = match.map(Number);
          return { left: x, top: y, right: width - x - w, bottom: height - y - h };
        }),
      ),
    process: async (jobs, opts) => {
      if (!processando && !trabalhos.length) cancelado = false;
      aberto = !!opts.aberto;
      trabalhos.push(...jobs);
      void bombear();
      return true;
    },
    processFim: async () => {
      aberto = false;
      if (!processando) emitir("empty");
    },
    cancel: async () => {
      geracao++;
      cancelado = true;
      aberto = false;
      for (const job of trabalhos.splice(0))
        emitir("done", { id: job.id, ok: false, error: "Cancelado" });
      if (ffmpeg) ffmpeg.terminate();
      ffmpeg = null;
      motor = null;
    },
    onProgress: (fn) => ouvir("progress", fn),
    onDone: (fn) => ouvir("done", fn),
    onQueueEmpty: (fn) => ouvir("empty", fn),
    capTrack: async (id, faixa) => {
      const key = crypto.randomUUID();
      faixas.set(key, faixa);
      return { list: key, dir: key, y: faixa.y0 };
    },
    capExiste: async (key) => faixas.has(key),
    capApagar: async (key) => faixas.delete(key),
    transcrever: async (p, opts) => {
      cancelado = false;
      return transcrever(p, opts);
    },
    cortesEscolher: async () => (await escolher("video/*"))[0] || null,
    cortesInfo: async (p) => {
      const m = await probe(p);
      return {
        duracao: m.duration,
        largura: m.width,
        altura: m.height,
        temAudio: m.hasAudio,
        transcrito: transcricoes.has(p),
        whisper: true,
        modeloOk: true,
      };
    },
    cortesIniciar: async (opts) => {
      cancelado = false;
      const { words } = await transcrever(opts.arquivo, { ...opts, origem: "cortes" });
      const candidatos = await servidor("cortes", {
        ...opts,
        arquivo: undefined,
        duracao: (await probe(opts.arquivo)).duration,
        words,
      });
      const cortes = await exportarCortes(opts.arquivo, candidatos.cortes);
      return {
        pasta: "Downloads",
        duracao: (await probe(opts.arquivo)).duration,
        palavras: words.length,
        cortes,
        extras: candidatos.extras || [],
      };
    },
    cortesExportar: exportarCortes,
    cortesCancelar: () => api.cancel(),
    cortesAbrir: () => api.openPath(),
    cortesIaTestar: async (ia) => servidor("testar-ia", { ia }),
    cortesOllamaBaixar: async () => {
      throw new Error("Escolha um serviço de IA em nuvem para usar no celular.");
    },
    iaFrases: (opts) => servidor("frases", opts),
    onCortesProgresso: (fn) => ouvir("cortes-progresso", fn),
    onCortesLink: (fn) => ouvir("cortes-link", fn),
    onExternalImport: (fn) => ouvir("external-import", fn),
    cloudConfig: () => servidor("cloud-config", {}),
    cloudApi: (cfg, method, path, body) => servidor("cloud", { cfg, method, path, body }),
    cloudSend: async (cfg, items) => {
      const results = [],
        posts = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        emitir("cloud-progress", { i, n: items.length, nome: it.nome });
        try {
          const mediaKey = `${crypto.randomUUID()}.${it.mediaKind === "image" ? "jpg" : "mp4"}`;
          let media = obter(it.path);
          if (it.mediaKind === "image") {
            const img = new Image();
            img.src = urls.get(it.path);
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext("2d").drawImage(img, 0, 0);
            media = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95));
          }
          const r = await servidor("upload", { cfg, key: mediaKey, media: await dataUrl(media) });
          if (r.status !== 200) throw new Error(r.data.erro || "Falha no envio.");
          let capaKey = null;
          if (it.capa) {
            capaKey = `${crypto.randomUUID()}-capa.jpg`;
            const capa = await servidor("upload", {
              cfg,
              key: capaKey,
              media: await dataUrl(obter(it.capa)),
            });
            if (capa.status !== 200) throw new Error("Falha no envio da capa.");
          }
          for (const d of it.destinos || [])
            posts.push({
              id: crypto.randomUUID(),
              contaId: d.contaId,
              tipo: d.tipo,
              mediaKey,
              mediaKind: it.mediaKind,
              capaKey: d.plataforma === "instagram" ? capaKey : null,
              legenda: d.legenda ?? it.legenda,
              titulo: d.titulo || null,
              privacidade: d.privacidade || null,
              quando: it.quando,
              shareToFeed: it.shareToFeed,
              nome: it.nome,
            });
          results.push({ uid: it.uid, ok: true });
        } catch (e) {
          results.push({ uid: it.uid, ok: false, error: e.message });
        }
      }
      if (posts.length) {
        const r = await api.cloudApi(cfg, "POST", "/api/posts", posts);
        if (r.status !== 200)
          for (const result of results)
            if (result.ok)
              Object.assign(result, {
                ok: false,
                error: r.data.erro || "Falha ao registrar o agendamento.",
              });
      }
      return results;
    },
    onCloudProgress: (fn) => ouvir("cloud-progress", fn),
    openExternal: async (url) => {
      if (!/^https:\/\//i.test(url)) throw new Error("Endereço inválido.");
      window.open(url, "_blank", "noopener,noreferrer");
    },
    destruir: () => {
      encerrado = true;
      geracao++;
      cancelado = true;
      trabalhos = [];
      ffmpeg?.terminate();
      for (const url of urls.values()) URL.revokeObjectURL(url);
      arquivos.clear();
      urls.clear();
      faixas.clear();
      transcricoes.clear();
      preferencias.clear();
      gerados.clear();
      eventos.clear();
      banco?.close();
    },
  };
  window.addEventListener("pagehide", () => api.destruir(), { once: true });
  return api;
};
