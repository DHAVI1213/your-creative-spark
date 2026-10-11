// Transforma os ajustes de um vídeo num comando FFmpeg.
// Camadas: fundo (cor/imagem PNG ou o próprio vídeo desfocado) -> vídeo recortado/escalado
// -> sobreposição PNG (legenda, CTA, logo) gerada pela interface.
"use strict";
const SharedBuilder = window.Shared;
(function (S) {
  const hex = (c) =>
    "0x" +
    String(c || "#000000")
      .replace("#", "")
      .padEnd(6, "0")
      .slice(0, 6);
  const num = (n, d = 3) => Number(n).toFixed(d);

  function buildArgs(job, paths, encoder) {
    const { meta, s } = job;
    const L = S.layout(meta, s);
    const T = S.timing(meta, s);
    const { CW, CH } = L;
    const e = s.efeitos,
      t = s.template,
      a = s.audio;
    const fps = Number(s.saida.fps) || 30;
    const br = Number(s.saida.bitrate) || 8;
    const intro = paths.capa ? S.capaIntro(s) : 0; // capa congelada antes do vídeo
    const total = T.outDur + intro;
    const embed = !!paths.capa && !!(s.capa && s.capa.ativo && s.capa.embutir); // miniatura dentro do MP4

    const args = [
      "-y",
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "error",
      "-nostats",
      "-filter_complex_threads",
      "1",
      "-threads",
      "1",
    ];
    const idx = {};
    let n = 0;

    // Entradas
    if (paths.hwdec) args.push("-hwaccel", "cuda"); // decodifica na placa NVIDIA (os quadros voltam para a memória)
    args.push("-ss", num(T.start), "-t", num(T.inDur), "-i", job.input);
    idx.v = n++;
    const blur = t.fundoTipo === "blur";
    if (!blur) {
      args.push("-loop", "1", "-framerate", String(fps), "-i", paths.bg);
      idx.bg = n++;
    }
    args.push("-loop", "1", "-framerate", String(fps), "-i", paths.ov);
    idx.ov = n++;
    if (intro) {
      args.push("-loop", "1", "-framerate", String(fps), "-t", num(intro), "-i", paths.capa);
      idx.capa = n++;
    }
    if (embed) {
      args.push("-i", paths.capa);
      idx.thumb = n++;
    }
    // legenda animada: sequência de PNGs (lista do demuxer concat) com a duração de cada estado
    if (paths.cap) {
      args.push("-f", "concat", "-safe", "0", "-i", paths.cap.list);
      idx.cap = n++;
    }

    const useMusic = (a.modo === "substituir" || a.modo === "mixar") && !!a.musica;
    const useOrig =
      meta.hasAudio &&
      (a.modo === "original" || a.modo === "mixar" || (a.modo === "substituir" && !useMusic));
    if (useMusic) {
      args.push("-stream_loop", "-1", "-i", a.musica);
      idx.mus = n++;
    }
    if (!useMusic && !useOrig) {
      args.push("-f", "lavfi", "-t", num(total), "-i", "anullsrc=r=48000:cl=stereo");
      idx.sil = n++;
    }

    // Vídeo
    const g = [];
    const vf = S.limpezaFilters(meta, s);
    if (L.left || L.top || L.cw !== meta.width || L.ch !== meta.height) {
      vf.push(`crop=${L.cw}:${L.ch}:${L.left}:${L.top}`);
    }
    if (e.espelhar) vf.push("hflip");
    const q = S.eqParams(e);
    if (q.changed) {
      vf.push(
        `eq=contrast=${q.contrast}:saturation=${num(q.saturation)}:brightness=${num(q.brightness)}:gamma=${q.gamma}`,
      );
    }
    const fx = S.filtroSpec(e);
    if (fx) {
      const m = fx.m;
      vf.push(
        `colorchannelmixer=rr=${m[0]}:rg=${m[1]}:rb=${m[2]}:gr=${m[3]}:gg=${m[4]}:gb=${m[5]}:br=${m[6]}:bg=${m[7]}:bb=${m[8]}`,
      );
      if (fx.slope !== 1 || fx.icpt !== 0) {
        const ex = `clip(val*${fx.slope}+${num(fx.icpt * 255, 2)}\\,0\\,255)`;
        vf.push(`lutrgb=r='${ex}':g='${ex}':b='${ex}'`);
      }
      if (fx.vin > 0) vf.push(`vignette=angle=${num(S.vinAngle(fx.vin))}`);
    }
    if (e.antiDup) vf.push("noise=alls=2:allf=t");
    if (T.speed !== 1) vf.push(`setpts=PTS/${T.speed}`);
    vf.push(`fps=${fps}`);
    g.push(`[${idx.v}:v]${vf.join(",")}[vb]`);

    let fgSrc = "vb";
    if (blur) {
      g.push("[vb]split=2[vm][vbl]");
      fgSrc = "vm";
      // desfoque feito em 1/4 do tamanho e ampliado: o mesmo visual, bem mais leve
      const bw = S.even(CW / 4),
        bh = S.even(CH / 4);
      const rad = Math.max(1, Math.round((5 * CW) / 1080));
      g.push(
        `[vbl]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},` +
          `boxblur=${rad}:2,scale=${CW}:${CH},eq=brightness=-0.08,setsar=1[bg]`,
      );
    } else {
      g.push(`[${idx.bg}:v]scale=${CW}:${CH},setsar=1,format=yuv420p[bg]`);
    }

    let fg = `[${fgSrc}]scale=${L.sw}:${L.sh}:flags=lanczos,crop=${L.dw}:${L.dh}`;
    if (L.F > 0)
      fg += `,pad=${L.dw + 2 * L.F}:${L.dh + 2 * L.F}:${L.F}:${L.F}:color=${hex(t.molduraCor)}`;
    g.push(`${fg},setsar=1[fg]`);
    g.push(`[bg][fg]overlay=${L.x}:${L.y}:shortest=1[c1]`);
    g.push(`[${idx.ov}:v]scale=${CW}:${CH},format=rgba[ov]`);
    if (idx.cap !== undefined) {
      g.push(`[c1][ov]overlay=0:0:shortest=1[c1o]`);
      g.push(`[${idx.cap}:v]format=rgba,fps=${fps}[capv]`);
      g.push(`[c1o][capv]overlay=0:${paths.cap.y}:eof_action=pass:format=auto[c2]`);
    } else {
      g.push(`[c1][ov]overlay=0:0:shortest=1[c2]`);
    }
    if (intro) {
      g.push(`[c2]format=yuv420p,setsar=1[vmain]`);
      g.push(`[${idx.capa}:v]scale=${CW}:${CH},setsar=1,fps=${fps},format=yuv420p[vcapa]`);
      g.push(`[vcapa][vmain]concat=n=2:v=1:a=0[vout]`);
    } else {
      g.push(`[c2]format=yuv420p[vout]`);
    }

    // Áudio
    let aMap;
    if (idx.sil !== undefined) {
      aMap = `${idx.sil}:a`;
    } else {
      const fin = [];
      if (e.melhorarAudio) {
        fin.push(
          "highpass=f=80",
          "acompressor=threshold=0.125:ratio=3:attack=10:release=200",
          "loudnorm=I=-14:TP=-1.5:LRA=11",
        );
      }
      fin.push("aresample=48000", "aformat=sample_fmts=fltp:channel_layouts=stereo");
      if (intro) fin.push(`adelay=${Math.round(intro * 1000)}:all=1`);
      const parts = [];
      if (useOrig) {
        const f = [];
        if (T.speed !== 1) f.push(`atempo=${T.speed}`);
        f.push(`volume=${Number(a.volume)}`, "aformat=channel_layouts=stereo");
        g.push(`[${idx.v}:a]${f.join(",")}[ao]`);
        parts.push("[ao]");
      }
      if (useMusic) {
        g.push(
          `[${idx.mus}:a]atrim=0:${num(T.outDur)},asetpts=N/SR/TB,volume=${Number(a.musicaVolume)},aformat=channel_layouts=stereo[am]`,
        );
        parts.push("[am]");
      }
      if (parts.length === 2) {
        g.push(
          `[ao][am]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,${fin.join(",")}[aout]`,
        );
      } else {
        g.push(`${parts[0]}${fin.join(",")}[aout]`);
      }
      aMap = "[aout]";
    }

    args.push("-filter_complex", g.join(";"), "-map", "[vout]", "-map", aMap);
    if (embed) args.push("-map", `${idx.thumb}:v`);

    // opções com :0 valem só para o vídeo principal (a miniatura embutida é o stream v:1)
    const rate = [
      "-b:v:0",
      `${br}M`,
      "-maxrate:v:0",
      `${Math.round(br * 1.5)}M`,
      "-bufsize:v:0",
      `${br * 2}M`,
    ];
    if (encoder === "nvenc") {
      args.push(
        "-c:v:0",
        "h264_nvenc",
        "-preset:v:0",
        "p5",
        "-tune:v:0",
        "hq",
        "-rc:v:0",
        "vbr",
        ...rate,
        "-profile:v:0",
        "high",
      );
    } else {
      args.push("-c:v:0", "libx264", "-preset:v:0", "veryfast", ...rate, "-profile:v:0", "high");
    }
    if (embed) args.push("-c:v:1", "mjpeg", "-disposition:v:1", "attached_pic");
    // apaga todos os metadados: data de criação, aparelho, local, programa/encoder usado,
    // capítulos e as informações que o codificador grava dentro do vídeo (SEI)
    if (s.saida.semMetadados !== false) {
      args.push(
        "-map_chapters",
        "-1",
        "-fflags",
        "+bitexact",
        "-flags:v:0",
        "+bitexact",
        "-flags:a",
        "+bitexact",
        "-metadata:s:v:0",
        "encoder= ",
        "-metadata:s:v:0",
        "handler_name= ",
        "-metadata:s:a:0",
        "encoder= ",
        "-metadata:s:a:0",
        "handler_name= ",
        "-bsf:v:0",
        "filter_units=remove_types=6",
      );
    }
    args.push(
      "-pix_fmt:v:0",
      "yuv420p",
      "-r:v:0",
      String(fps),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-t",
      num(total),
      "-map_metadata",
      "-1",
      "-movflags",
      "+faststart",
      paths.out,
    );
    return { args, outDur: total };
  }

  window.EditorBuilder = { buildArgs };
})(SharedBuilder);
