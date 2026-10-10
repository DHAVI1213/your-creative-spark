/**
 * Leitura e limpeza de metadados de imagens, 100% no navegador.
 *
 * JPEG: remove os blocos EXIF/XMP/IPTC sem recomprimir (qualidade intacta).
 *       Se a foto depende da orientação do EXIF, redesenha já girada.
 * PNG:  remove os blocos de texto/EXIF/data sem recomprimir.
 * WebP e outros: redesenha a imagem (o redesenho não carrega metadados).
 */

export type MetaEntry = { label: string; value: string; sensitive?: boolean };

export type ImageMetaReport = {
  format: "jpeg" | "png" | "webp" | "outro";
  entries: MetaEntry[];
  orientation: number;
  hasMetadata: boolean;
};

const TAGS_IFD0: Record<number, string> = {
  0x010f: "Fabricante",
  0x0110: "Aparelho",
  0x0131: "Software",
  0x0132: "Data de modificação",
  0x013b: "Autor",
  0x8298: "Direitos autorais",
};
const TAGS_EXIF: Record<number, string> = {
  0x9003: "Data da foto",
  0x9004: "Data de digitalização",
  0xa433: "Fabricante da lente",
  0xa434: "Modelo da lente",
  0xa431: "Número de série",
  0xa420: "ID único da imagem",
};

function detectFormat(bytes: Uint8Array): ImageMetaReport["format"] {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "png";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "webp";
  return "outro";
}

function ascii(bytes: Uint8Array, start: number, len: number) {
  let s = "";
  for (let i = start; i < start + len && i < bytes.length; i++)
    s += String.fromCharCode(bytes[i] ?? 0);
  return s;
}

/** Lê um bloco TIFF (EXIF) e devolve as tags que interessam ao usuário. */
function parseTiff(view: DataView, base: number, entries: MetaEntry[]): number {
  let orientation = 1;
  const little = view.getUint16(base) === 0x4949;
  const u16 = (o: number) => view.getUint16(base + o, little);
  const u32 = (o: number) => view.getUint32(base + o, little);

  const readValue = (entry: number): string | number[] | null => {
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    const sizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    const size = (sizes[type] ?? 1) * count;
    const off = size > 4 ? u32(entry + 8) : entry + 8;
    if (base + off + size > view.byteLength) return null;
    if (type === 2) {
      let s = "";
      for (let i = 0; i < count; i++) {
        const c = view.getUint8(base + off + i);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s.trim();
    }
    if (type === 3) return Array.from({ length: count }, (_, i) => u16(off + i * 2));
    if (type === 4) return Array.from({ length: count }, (_, i) => u32(off + i * 4));
    if (type === 5)
      return Array.from({ length: count }, (_, i) => {
        const d = u32(off + i * 8 + 4);
        return d ? u32(off + i * 8) / d : 0;
      });
    return null;
  };

  const walk = (ifdOffset: number, tags: Record<number, string>) => {
    const pointers: { exif?: number; gps?: number } = {};
    if (base + ifdOffset + 2 > view.byteLength) return pointers;
    const n = u16(ifdOffset);
    for (let i = 0; i < n; i++) {
      const entry = ifdOffset + 2 + i * 12;
      if (base + entry + 12 > view.byteLength) break;
      const tag = u16(entry);
      if (tag === 0x8769) pointers.exif = u32(entry + 8);
      else if (tag === 0x8825) pointers.gps = u32(entry + 8);
      else if (tag === 0x0112) {
        const v = readValue(entry);
        if (Array.isArray(v)) orientation = v[0] || 1;
      } else if (tags[tag]) {
        const v = readValue(entry);
        if (typeof v === "string" && v)
          entries.push({ label: tags[tag], value: v, sensitive: true });
      }
    }
    return pointers;
  };

  const ifd0 = u32(4);
  const { exif, gps } = walk(ifd0, TAGS_IFD0);
  if (exif) walk(exif, TAGS_EXIF);

  if (gps && base + gps + 2 <= view.byteLength) {
    const n = u16(gps);
    const g: Record<number, string | number[] | null> = {};
    for (let i = 0; i < n; i++) {
      const entry = gps + 2 + i * 12;
      if (base + entry + 12 > view.byteLength) break;
      g[u16(entry)] = readValue(entry);
    }
    const toDeg = (v: unknown) =>
      Array.isArray(v) ? v[0] + (v[1] ?? 0) / 60 + (v[2] ?? 0) / 3600 : null;
    const lat = toDeg(g[2]);
    const lon = toDeg(g[4]);
    if (lat !== null && lon !== null && (lat !== 0 || lon !== 0)) {
      const la = (g[1] === "S" ? -lat : lat).toFixed(5);
      const lo = (g[3] === "W" ? -lon : lon).toFixed(5);
      entries.unshift({ label: "Localização GPS", value: `${la}, ${lo}`, sensitive: true });
    } else if (n > 0) {
      entries.unshift({ label: "Dados de GPS", value: "presentes", sensitive: true });
    }
  }
  return orientation;
}

function readJpeg(bytes: Uint8Array): Omit<ImageMetaReport, "format"> {
  const entries: MetaEntry[] = [];
  let orientation = 1;
  let hasMetadata = false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 2;
  while (p + 4 <= bytes.length && bytes[p] === 0xff) {
    const marker = bytes[p + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = view.getUint16(p + 2);
    const start = p + 4;
    if (marker === 0xe1 && ascii(bytes, start, 4) === "Exif") {
      hasMetadata = true;
      try {
        orientation = parseTiff(view, start + 6, entries);
      } catch {
        entries.push({ label: "EXIF", value: "presente", sensitive: true });
      }
    } else if (marker === 0xe1 && ascii(bytes, start, 28).startsWith("http://ns.adobe.com/xap")) {
      hasMetadata = true;
      entries.push({ label: "XMP (edição/autoria)", value: "presente", sensitive: true });
    } else if (marker === 0xed) {
      hasMetadata = true;
      entries.push({ label: "IPTC (legenda/autor)", value: "presente", sensitive: true });
    } else if (marker === 0xfe) {
      hasMetadata = true;
      entries.push({ label: "Comentário", value: ascii(bytes, start, Math.min(len - 2, 80)) });
    }
    p += 2 + len;
  }
  return { entries, orientation, hasMetadata };
}

const PNG_META_CHUNKS = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);

function readPng(bytes: Uint8Array): Omit<ImageMetaReport, "format"> {
  const entries: MetaEntry[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8;
  let hasMetadata = false;
  while (p + 8 <= bytes.length) {
    const len = view.getUint32(p);
    const type = ascii(bytes, p + 4, 4);
    if (PNG_META_CHUNKS.has(type)) {
      hasMetadata = true;
      if (type === "tEXt") {
        const raw = ascii(bytes, p + 8, Math.min(len, 120));
        const [k, v] = raw.split("\0");
        entries.push({ label: k || "Texto", value: (v ?? "").slice(0, 80) || "presente" });
      } else if (type === "eXIf") {
        entries.push({ label: "EXIF", value: "presente", sensitive: true });
      } else if (type === "tIME") {
        entries.push({ label: "Data de modificação", value: "presente" });
      } else {
        entries.push({ label: "Texto embutido", value: "presente" });
      }
    }
    if (type === "IEND") break;
    p += 12 + len;
  }
  return { entries, orientation: 1, hasMetadata };
}

export async function readImageMeta(file: File): Promise<ImageMetaReport> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectFormat(bytes);
  if (format === "jpeg") return { format, ...readJpeg(bytes) };
  if (format === "png") return { format, ...readPng(bytes) };
  if (format === "webp") {
    const s = ascii(bytes, 0, Math.min(bytes.length, 4096));
    const has = s.includes("EXIF") || s.includes("XMP ");
    return {
      format,
      orientation: 1,
      hasMetadata: has,
      entries: has ? [{ label: "EXIF/XMP", value: "presente", sensitive: true }] : [],
    };
  }
  return {
    format,
    orientation: 1,
    hasMetadata: true,
    entries: [{ label: "Formato", value: "será redesenhado" }],
  };
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let p = 2;
  while (p + 4 <= bytes.length && bytes[p] === 0xff) {
    const marker = bytes[p + 1];
    if (marker === 0xda) break;
    const len = view.getUint16(p + 2);
    const start = p + 4;
    if (marker === undefined) break;
    const isIcc = marker === 0xe2 && ascii(bytes, start, 11) === "ICC_PROFILE";
    // Mantém JFIF (APP0), perfil de cor (ICC) e os blocos da imagem; descarta APP1..APP15 e comentários.
    const drop = (marker >= 0xe1 && marker <= 0xef && !isIcc) || marker === 0xfe;
    if (!drop) parts.push(bytes.subarray(p, p + 2 + len));
    p += 2 + len;
  }
  parts.push(bytes.subarray(p));
  const out = new Uint8Array(parts.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of parts) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

function stripPng(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = view.getUint32(p);
    const type = ascii(bytes, p + 4, 4);
    if (!PNG_META_CHUNKS.has(type)) parts.push(bytes.subarray(p, p + 12 + len));
    p += 12 + len;
    if (type === "IEND") break;
  }
  const out = new Uint8Array(parts.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of parts) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

async function redraw(file: File, type: string): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu desenhar a imagem.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const outType = ["image/jpeg", "image/png", "image/webp"].includes(type) ? type : "image/png";
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))),
      outType,
      0.95,
    ),
  );
}

export async function cleanImage(file: File, report: ImageMetaReport): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (report.format === "jpeg" && report.orientation === 1) {
    return new Blob([stripJpeg(bytes) as BlobPart], { type: "image/jpeg" });
  }
  if (report.format === "png") {
    return new Blob([stripPng(bytes) as BlobPart], { type: "image/png" });
  }
  return redraw(file, file.type);
}
