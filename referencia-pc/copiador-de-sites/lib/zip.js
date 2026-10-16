// Gerador de .zip simples (sem compressão), suficiente para sites copiados.
(function (root) {
  'use strict';
  const TABELA = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABELA[n] = c >>> 0;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = TABELA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function dataDos(d) {
    const t = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
    const dt = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
    return [t, dt];
  }
  class Zip {
    constructor() { this.arquivos = []; }
    adiciona(nome, dados) {
      const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : new Uint8Array(dados);
      this.arquivos.push({ nome: new TextEncoder().encode(nome), bytes, crc: crc32(bytes) });
    }
    gera() {
      const partes = [], central = [];
      let pos = 0;
      const [hora, data] = dataDos(new Date());
      for (const f of this.arquivos) {
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
        h.setUint16(8, 0, true); h.setUint16(10, hora, true); h.setUint16(12, data, true);
        h.setUint32(14, f.crc, true); h.setUint32(18, f.bytes.length, true); h.setUint32(22, f.bytes.length, true);
        h.setUint16(26, f.nome.length, true); h.setUint16(28, 0, true);
        partes.push(h.buffer, f.nome, f.bytes);
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
        c.setUint16(10, 0, true); c.setUint16(12, hora, true); c.setUint16(14, data, true);
        c.setUint32(16, f.crc, true); c.setUint32(20, f.bytes.length, true); c.setUint32(24, f.bytes.length, true);
        c.setUint16(28, f.nome.length, true); c.setUint32(42, pos, true);
        central.push(c.buffer, f.nome);
        pos += 30 + f.nome.length + f.bytes.length;
      }
      const tamCentral = central.reduce((s, p) => s + (p.byteLength ?? p.length), 0);
      const e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054b50, true); e.setUint16(8, this.arquivos.length, true); e.setUint16(10, this.arquivos.length, true);
      e.setUint32(12, tamCentral, true); e.setUint32(16, pos, true);
      return new Blob([...partes, ...central, e.buffer], { type: 'application/zip' });
    }
  }
  root.Zip = Zip;
})(typeof self !== 'undefined' ? self : window);
