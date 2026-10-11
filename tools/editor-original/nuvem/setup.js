// Instala a parte da nuvem na sua conta Cloudflare, passo a passo.
// Pode rodar de novo quando quiser: ele reaproveita o que já existe.
"use strict";
const { spawnSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");

const DIR = __dirname;
const DB_NAME = "agendador-editor";
const BUCKET = "agendador-editor-midia";
const CONFIG = path.join(DIR, "config.json");

const say = (m = "") => console.log(m);
const step = (n, m) => say(`\n[${n}/6] ${m}`);
function fail(m) {
  say(`\n  ✗ ${m}\n`);
  process.exit(1);
}

function wr(args, opts = {}) {
  const r = spawnSync("npx", ["wrangler", ...args], {
    cwd: DIR,
    shell: true,
    encoding: "utf8",
    input: opts.input,
    stdio: opts.inherit ? "inherit" : ["pipe", "pipe", "pipe"],
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", FORCE_COLOR: "0" },
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

// roda mostrando a saída na tela e também guardando o texto
function wrTee(args) {
  return new Promise((resolve) => {
    const p = spawn("npx", ["wrangler", ...args], {
      cwd: DIR,
      shell: true,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (d) => {
      out += d;
      process.stdout.write(d);
    });
    p.stderr.on("data", (d) => {
      out += d;
      process.stderr.write(d);
    });
    p.on("close", (code) => resolve({ code, out }));
  });
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => (rl.close(), r(a.trim()))));
}

async function main() {
  say("=== Agendador na nuvem · instalação na Cloudflare ===");

  step(1, "Entrando na sua conta Cloudflare…");
  let who = wr(["whoami"]);
  if (/not authenticated|You are not/i.test(who.out) || who.code !== 0) {
    say('  O navegador vai abrir. Entre (ou crie a conta grátis) e clique em "Allow".');
    wr(["login"], { inherit: true });
    who = wr(["whoami"]);
    if (who.code !== 0 || /not authenticated/i.test(who.out))
      fail("Não consegui entrar na Cloudflare. Rode de novo.");
  }
  say("  ✓ Conectado");

  step(2, "Banco de dados da fila (D1)…");
  let dbId = null;
  const list = wr(["d1", "list", "--json"]);
  try {
    const arr = JSON.parse(list.out.slice(list.out.indexOf("[")));
    const found = arr.find((d) => d.name === DB_NAME);
    if (found) dbId = found.uuid || found.database_id || found.id;
  } catch (_) {}
  if (!dbId) {
    const c = wr(["d1", "create", DB_NAME]);
    const m =
      c.out.match(/database_id"?\s*[=:]\s*"([0-9a-f-]{20,})"/i) ||
      c.out.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (!m) fail("Não consegui criar o banco D1:\n" + c.out);
    dbId = m[1];
  }
  const tomlPath = path.join(DIR, "wrangler.toml");
  const toml = fs
    .readFileSync(tomlPath, "utf8")
    .replace(/database_id = "[^"]*"/, `database_id = "${dbId}"`);
  fs.writeFileSync(tomlPath, toml);
  say(`  ✓ Banco pronto (${dbId})`);

  step(3, "Armazenamento dos vídeos (R2)…");
  const b = wr(["r2", "bucket", "create", BUCKET]);
  if (b.code !== 0 && !/already exists|already own/i.test(b.out)) {
    if (/enable R2|R2 is not enabled|10042|purchase|billing/i.test(b.out)) {
      say("\n  O R2 ainda não está ativado na sua conta. Faça assim:");
      say('   1. Abra https://dash.cloudflare.com  →  menu "R2 Object Storage"');
      say("   2. Clique para ativar/comprar o plano (é o plano grátis, até 10 GB).");
      say("      A Cloudflare pede um cartão, mas não cobra dentro do limite grátis.");
      say("   3. Depois rode este instalador de novo.");
      process.exit(1);
    }
    fail("Não consegui criar o armazenamento R2:\n" + b.out);
  }
  say("  ✓ Armazenamento pronto");

  step(4, "Criando as tabelas…");
  const s = wr(["d1", "execute", DB_NAME, "--remote", "--file", "schema.sql", "--yes"]);
  if (s.code !== 0) {
    const s2 = wr(["d1", "execute", DB_NAME, "--remote", "--file", "schema.sql"], {
      inherit: true,
    });
    if (s2.code !== 0) fail("Não consegui criar as tabelas.");
  }
  say("  ✓ Tabelas prontas");

  step(5, "Publicando o agendador…");
  const d = await wrTee(["deploy"]);
  if (d.code !== 0) {
    if (/subdomain/i.test(d.out)) {
      say("\n  Falta escolher o seu endereço workers.dev:");
      say('   Abra https://dash.cloudflare.com → "Workers e Pages" → escolha um subdomínio.');
      say("   Depois rode este instalador de novo.");
      process.exit(1);
    }
    fail("A publicação falhou (veja a mensagem acima).");
  }
  let url = (d.out.match(/https:\/\/[\w.-]+\.workers\.dev/) || [])[0];
  if (!url)
    url = await ask("\n  Cole aqui o endereço https://....workers.dev que apareceu acima: ");
  url = url.replace(/\/+$/, "");

  step(6, "Criando a chave secreta entre o app e a nuvem…");
  let apiKey = null;
  try {
    apiKey = JSON.parse(fs.readFileSync(CONFIG, "utf8")).apiKey;
  } catch (_) {}
  if (!apiKey) apiKey = crypto.randomBytes(24).toString("hex");
  const sec = wr(["secret", "put", "API_KEY"], { input: apiKey + "\n" });
  if (sec.code !== 0) fail("Não consegui salvar a chave secreta:\n" + sec.out);
  fs.writeFileSync(CONFIG, JSON.stringify({ url, apiKey }, null, 2));

  // teste final
  let ok = false;
  for (let i = 0; i < 6 && !ok; i++) {
    try {
      const r = await fetch(url + "/api/status", {
        headers: { authorization: "Bearer " + apiKey },
      });
      ok = r.ok;
    } catch (_) {}
    if (!ok) await new Promise((r) => setTimeout(r, 3000));
  }

  say("\n=====================================================");
  say(
    ok
      ? "  ✓ Nuvem instalada e funcionando!"
      : "  ✓ Nuvem instalada (o teste não respondeu ainda, pode levar 1 minuto).",
  );
  say(`  Endereço: ${url}`);
  say("  O app lê este endereço e a chave sozinho (arquivo nuvem/config.json).");
  say(
    "  Próximo passo: no app, aba Agendador → Contas → conecte quantas contas quiser de Instagram, YouTube ou TikTok.",
  );
  say("=====================================================\n");
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
