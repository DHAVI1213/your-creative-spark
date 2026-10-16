// Agendador na nuvem (Cloudflare Worker).
// - Guarda a fila de posts no D1 e os arquivos no R2.
// - Contas ilimitadas: quantas quiser de Instagram, YouTube e TikTok. Cada post vai para a conta escolhida.
// - A cada minuto (cron) publica o que venceu, pela API oficial de cada rede.
// - Serve cada arquivo num link público (o Instagram busca a mídia por esse link).

const MAX_CONTAS = 0; // 0 = sem limite de contas
const MAX_TENTATIVAS = 3;
const PROCESSANDO_MAX_MS = 60 * 60 * 1000; // 1h esperando a rede processar o vídeo
const ENVIO_MAX_MS = 30 * 60 * 1000; // upload que travou no meio
const RENOVAR_IG_MS = 5 * 24 * 60 * 60 * 1000; // renova o token do Instagram a cada ~5 dias
const OAUTH_VALIDADE_MS = 15 * 60 * 1000;
const TT_CHUNK = 10 * 1024 * 1024; // pedaços de 10 MB no upload do TikTok
const TT_SINGLE_MAX = 64 * 1024 * 1024; // até 64 MB vai num pedaço só

const IG_GRAPH = 'https://graph.instagram.com';
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const YT_API = 'https://www.googleapis.com/youtube/v3';
const YT_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos';
const TT_AUTH = 'https://www.tiktok.com/v2/auth/authorize/';
const TT_API = 'https://open.tiktokapis.com/v2';

const PLATAFORMAS = new Set(['instagram', 'youtube', 'tiktok']);
const TIPOS = { instagram: new Set(['reels', 'story', 'foto']), youtube: new Set(['short']), tiktok: new Set(['video']) };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const agora = () => Date.now();
const igVersion = (env) => env.GRAPH_VERSION || 'v23.0';

function erro(msg, extra = {}) {
  const e = new Error(msg);
  Object.assign(e, extra);
  return e;
}

// ---------------------------------------------------------------- configurações (tabela settings)
async function getSet(env, k) {
  const r = await env.DB.prepare('SELECT v FROM settings WHERE k = ?').bind(k).first();
  return r ? r.v : null;
}
async function setSet(env, k, v) {
  await env.DB.prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
    .bind(k, v == null ? null : String(v))
    .run();
}

// ---------------------------------------------------------------- esquema (atualiza instalações antigas sozinho)
let esquemaOk = false;
async function garantirEsquema(env) {
  if (esquemaOk) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS contas (
      id TEXT PRIMARY KEY, plataforma TEXT NOT NULL, nome TEXT, ext_id TEXT, foto TEXT,
      token TEXT, refresh_token TEXT, token_expira INTEGER, refresh_expira INTEGER,
      token_renovado INTEGER, token_erro TEXT, extra TEXT, criado INTEGER)`
  ).run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)').run();
  for (const col of ['conta_id TEXT', 'plataforma TEXT', 'titulo TEXT', 'privacidade TEXT', 'aviso TEXT']) {
    try {
      await env.DB.prepare(`ALTER TABLE posts ADD COLUMN ${col}`).run();
    } catch (_) {
      // coluna já existe
    }
  }
  // instalação antiga (uma conta só do Instagram guardada em settings): vira a primeira conta
  const tokenAntigo = await getSet(env, 'token');
  if (tokenAntigo) {
    const igId = (await getSet(env, 'ig_id')) || 'antigo';
    const id = 'ig-' + igId;
    await env.DB.prepare(
      `INSERT OR IGNORE INTO contas (id, plataforma, nome, ext_id, token, token_expira, token_renovado, token_erro, criado)
       VALUES (?, 'instagram', ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        (await getSet(env, 'username')) || '',
        igId,
        tokenAntigo,
        Number(await getSet(env, 'token_expira')) || null,
        Number(await getSet(env, 'token_renovado')) || 0,
        (await getSet(env, 'token_erro')) || null,
        agora()
      )
      .run();
    await env.DB.prepare("UPDATE posts SET conta_id = ?, plataforma = 'instagram' WHERE conta_id IS NULL").bind(id).run();
    for (const k of ['token', 'ig_id', 'username', 'token_expira', 'token_renovado', 'token_erro']) await setSet(env, k, null);
  }
  esquemaOk = true;
}

// ---------------------------------------------------------------- contas
async function getConta(env, id) {
  return env.DB.prepare('SELECT * FROM contas WHERE id = ?').bind(id).first();
}
async function listarContas(env) {
  return (await env.DB.prepare('SELECT * FROM contas ORDER BY criado').all()).results || [];
}
async function contarContas(env) {
  return (await env.DB.prepare('SELECT COUNT(*) AS n FROM contas').first()).n;
}
async function atualizarConta(env, id, campos) {
  const ks = Object.keys(campos);
  await env.DB.prepare(`UPDATE contas SET ${ks.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...ks.map((k) => campos[k]), id)
    .run();
}
// Cria ou atualiza a conta (a mesma conta conectada de novo só troca o token).
async function salvarConta(env, c) {
  const id = `${c.plataforma === 'instagram' ? 'ig' : c.plataforma === 'youtube' ? 'yt' : 'tt'}-${c.ext_id}`;
  const existe = await getConta(env, id);
  if (MAX_CONTAS && !existe && (await contarContas(env)) >= MAX_CONTAS) throw erro(`Limite de ${MAX_CONTAS} contas. Remova uma antes de conectar outra.`, { status: 409 });
  await env.DB.prepare(
    `INSERT INTO contas (id, plataforma, nome, ext_id, foto, token, refresh_token, token_expira, refresh_expira, token_renovado, token_erro, criado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
     ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, foto = excluded.foto, token = excluded.token,
       refresh_token = COALESCE(excluded.refresh_token, contas.refresh_token), token_expira = excluded.token_expira,
       refresh_expira = COALESCE(excluded.refresh_expira, contas.refresh_expira), token_renovado = excluded.token_renovado, token_erro = NULL`
  )
    .bind(
      id,
      c.plataforma,
      c.nome || '',
      String(c.ext_id),
      c.foto || null,
      c.token,
      c.refresh_token || null,
      c.token_expira || null,
      c.refresh_expira || null,
      c.token_renovado || agora(),
      agora()
    )
    .run();
  return id;
}

// ---------------------------------------------------------------- credenciais dos apps (YouTube e TikTok)
async function credenciais(env, plat) {
  if (plat === 'youtube') {
    return {
      id: env.YT_CLIENT_ID || (await getSet(env, 'yt_client_id')),
      secret: env.YT_CLIENT_SECRET || (await getSet(env, 'yt_client_secret'))
    };
  }
  if (plat === 'tiktok') {
    return {
      id: env.TT_CLIENT_KEY || (await getSet(env, 'tt_client_key')),
      secret: env.TT_CLIENT_SECRET || (await getSet(env, 'tt_client_secret'))
    };
  }
  return {};
}
const redirectUri = (origin, plat) => `${origin}/oauth/${plat}`;

async function formPost(url, campos) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(campos)
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// ---------------------------------------------------------------- Instagram
async function ig(env, conta, method, path, params = {}) {
  if (!conta || !conta.token) throw erro('Conta do Instagram sem acesso. Conecte de novo.');
  const url = new URL(`${IG_GRAPH}/${igVersion(env)}/${path}`);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') body.set(k, String(v));
  body.set('access_token', conta.token);
  let res;
  if (method === 'GET') {
    for (const [k, v] of body) url.searchParams.set(k, v);
    res = await fetch(url, { method: 'GET' });
  } else {
    res = await fetch(url, { method, body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    throw erro(e.error_user_msg || e.message || `Instagram respondeu ${res.status}`, {
      code: e.code,
      transient: res.status >= 500 || e.is_transient === true || e.code === 2 || e.code === 4 || e.code === 17
    });
  }
  return data;
}

async function renovarIg(env, conta, forcar = false) {
  if (!conta.token) return;
  if (!forcar && agora() - (conta.token_renovado || 0) < RENOVAR_IG_MS) return;
  const url = new URL(`${IG_GRAPH}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', conta.token);
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.access_token) {
    await atualizarConta(env, conta.id, {
      token: data.access_token,
      token_expira: agora() + (Number(data.expires_in) || 60 * 86400) * 1000,
      token_erro: null,
      token_renovado: agora()
    });
  } else {
    // mesmo com erro, espera o próximo ciclo para não tentar a cada minuto
    await atualizarConta(env, conta.id, {
      token_erro: (data.error && data.error.message) || `Falha ao renovar (${res.status})`,
      token_renovado: agora()
    });
  }
}

// ---------------------------------------------------------------- YouTube
async function tokenYoutube(env, conta) {
  if (conta.token && (conta.token_expira || 0) > agora() + 5 * 60 * 1000) return conta.token;
  if (!conta.refresh_token) throw erro('Canal do YouTube sem permissão salva. Conecte de novo.');
  const cr = await credenciais(env, 'youtube');
  if (!cr.id || !cr.secret) throw erro('Faltam o Client ID e o Client Secret do YouTube na nuvem.');
  const { res, data } = await formPost(GOOGLE_TOKEN, {
    client_id: cr.id,
    client_secret: cr.secret,
    refresh_token: conta.refresh_token,
    grant_type: 'refresh_token'
  });
  if (!res.ok || !data.access_token) {
    const msg = data.error === 'invalid_grant' ? 'A permissão do YouTube expirou. Conecte o canal de novo.' : data.error_description || data.error || `Google respondeu ${res.status}`;
    await atualizarConta(env, conta.id, { token_erro: msg });
    throw erro(msg, { transient: res.status >= 500 });
  }
  const expira = agora() + (Number(data.expires_in) || 3600) * 1000;
  await atualizarConta(env, conta.id, { token: data.access_token, token_expira: expira, token_erro: null, token_renovado: agora() });
  conta.token = data.access_token;
  conta.token_expira = expira;
  return data.access_token;
}

function tituloYoutube(p) {
  const base = (p.titulo || String(p.legenda || '').split('\n').find((l) => l.trim()) || p.nome || 'Vídeo').replace(/[<>]/g, '').trim();
  return base.length > 100 ? base.slice(0, 97).trimEnd() + '…' : base;
}

async function publicarYoutube(env, p, conta) {
  const token = await tokenYoutube(env, conta);
  const head = await env.BUCKET.head(p.media_key);
  if (!head) throw erro('O arquivo do vídeo não está mais na nuvem');
  await atualizar(env, p.id, { status: 'processando', container_id: 'upload', iniciado: agora(), erro: null });
  const meta = {
    snippet: {
      title: tituloYoutube(p),
      description: String(p.legenda || '').replace(/[<>]/g, '').slice(0, 5000),
      categoryId: '22'
    },
    status: {
      privacyStatus: ['public', 'unlisted', 'private'].includes(p.privacidade) ? p.privacidade : 'public',
      selfDeclaredMadeForKids: false
    }
  };
  const ini = await fetch(`${YT_UPLOAD}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': String(head.size),
      'x-upload-content-type': (head.httpMetadata && head.httpMetadata.contentType) || 'video/mp4'
    },
    body: JSON.stringify(meta)
  });
  if (!ini.ok) throw await erroGoogle(ini);
  const destino = ini.headers.get('location');
  if (!destino) throw erro('O YouTube não devolveu o endereço de envio');
  const obj = await env.BUCKET.get(p.media_key);
  const { readable, writable } = new FixedLengthStream(head.size);
  obj.body.pipeTo(writable).catch(() => {});
  const up = await fetch(destino, {
    method: 'PUT',
    headers: { 'content-type': (head.httpMetadata && head.httpMetadata.contentType) || 'video/mp4', 'content-length': String(head.size) },
    body: readable
  });
  if (!up.ok) throw await erroGoogle(up);
  const v = await up.json().catch(() => ({}));
  if (!v.id) throw erro('O YouTube não confirmou o envio');
  let aviso = null;
  if (v.status && v.status.uploadStatus === 'rejected') throw erro(`O YouTube recusou o vídeo (${v.status.rejectionReason || 'motivo não informado'})`);
  if (meta.status.privacyStatus === 'public' && v.status && v.status.privacyStatus && v.status.privacyStatus !== 'public') {
    aviso = 'O YouTube deixou o vídeo como privado (app do Google ainda não verificado).';
  }
  await atualizar(env, p.id, {
    status: 'publicado',
    media_id: v.id,
    permalink: `https://youtube.com/shorts/${v.id}`,
    publicado: agora(),
    erro: null,
    aviso
  });
  await liberarArquivos(env, p);
}

async function erroGoogle(res) {
  const d = await res.json().catch(() => ({}));
  const e = d.error || {};
  const motivo = (e.errors && e.errors[0] && e.errors[0].reason) || '';
  let msg = e.message || `YouTube respondeu ${res.status}`;
  if (motivo === 'quotaExceeded') msg = 'Cota diária do YouTube acabou (cerca de 6 envios por dia). Tento de novo mais tarde.';
  if (motivo === 'uploadLimitExceeded') msg = 'O canal chegou no limite de envios do dia. Tento de novo mais tarde.';
  return erro(msg, { transient: res.status >= 500 || motivo === 'quotaExceeded' || motivo === 'uploadLimitExceeded', atrasoMin: motivo ? 180 : 0 });
}

// ---------------------------------------------------------------- TikTok
async function tokenTiktok(env, conta) {
  if (conta.token && (conta.token_expira || 0) > agora() + 10 * 60 * 1000) return conta.token;
  if (!conta.refresh_token) throw erro('Conta do TikTok sem permissão salva. Conecte de novo.');
  const cr = await credenciais(env, 'tiktok');
  if (!cr.id || !cr.secret) throw erro('Faltam o Client Key e o Client Secret do TikTok na nuvem.');
  const { res, data } = await formPost(`${TT_API}/oauth/token/`, {
    client_key: cr.id,
    client_secret: cr.secret,
    grant_type: 'refresh_token',
    refresh_token: conta.refresh_token
  });
  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.error || `TikTok respondeu ${res.status}`;
    await atualizarConta(env, conta.id, { token_erro: msg });
    throw erro(msg, { transient: res.status >= 500 });
  }
  const campos = {
    token: data.access_token,
    token_expira: agora() + (Number(data.expires_in) || 86400) * 1000,
    token_erro: null,
    token_renovado: agora()
  };
  if (data.refresh_token) {
    campos.refresh_token = data.refresh_token;
    campos.refresh_expira = agora() + (Number(data.refresh_expires_in) || 365 * 86400) * 1000;
  }
  await atualizarConta(env, conta.id, campos);
  Object.assign(conta, campos);
  return data.access_token;
}

async function tt(token, path, body) {
  const res = await fetch(`${TT_API}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  const e = data.error || {};
  if (!res.ok || (e.code && e.code !== 'ok')) {
    const msgs = {
      spam_risk_too_many_posts: 'O TikTok limitou os posts de hoje desta conta. Tento de novo mais tarde.',
      spam_risk_user_banned_from_posting: 'O TikTok bloqueou postagens desta conta.',
      reached_active_user_cap: 'O app do TikTok chegou no limite de usuários do dia.',
      unaudited_client_can_only_post_to_private_accounts: 'App do TikTok ainda não auditado: só posta em conta privada.',
      privacy_level_option_mismatch: 'Privacidade não permitida para esta conta.'
    };
    throw erro(msgs[e.code] || e.message || `TikTok respondeu ${res.status}`, {
      transient: res.status >= 500 || res.status === 429 || e.code === 'rate_limit_exceeded' || e.code === 'spam_risk_too_many_posts',
      atrasoMin: e.code === 'spam_risk_too_many_posts' ? 240 : 0
    });
  }
  return data.data || {};
}

async function iniciarTiktok(env, p, conta) {
  const token = await tokenTiktok(env, conta);
  const head = await env.BUCKET.head(p.media_key);
  if (!head) throw erro('O arquivo do vídeo não está mais na nuvem');
  // a privacidade pedida precisa estar entre as que a conta permite
  const info = await tt(token, '/post/publish/creator_info/query/', {});
  const opcoes = info.privacy_level_options || [];
  const pedida = p.privacidade || 'PUBLIC_TO_EVERYONE';
  let privacidade = pedida;
  let aviso = null;
  if (opcoes.length && !opcoes.includes(pedida)) {
    privacidade = opcoes.includes('SELF_ONLY') ? 'SELF_ONLY' : opcoes[0];
    aviso = `O TikTok não liberou "${nomePrivTT(pedida)}" para esta conta; postei como "${nomePrivTT(privacidade)}".`;
  }
  const size = head.size;
  const chunk = size <= TT_SINGLE_MAX ? size : TT_CHUNK;
  const total = size <= TT_SINGLE_MAX ? 1 : Math.floor(size / TT_CHUNK);
  await atualizar(env, p.id, { status: 'processando', container_id: 'upload', iniciado: agora(), erro: null, aviso });
  const d = await tt(token, '/post/publish/video/init/', {
    post_info: {
      title: String(p.legenda || '').slice(0, 2200),
      privacy_level: privacidade,
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000
    },
    source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunk, total_chunk_count: total }
  });
  if (!d.upload_url || !d.publish_id) throw erro('O TikTok não devolveu o endereço de envio');
  const tipo = (head.httpMetadata && head.httpMetadata.contentType) || 'video/mp4';
  for (let i = 0; i < total; i++) {
    const ini = i * chunk;
    const fim = i === total - 1 ? size - 1 : ini + chunk - 1;
    const len = fim - ini + 1;
    const parte = await env.BUCKET.get(p.media_key, { range: { offset: ini, length: len } });
    const { readable, writable } = new FixedLengthStream(len);
    parte.body.pipeTo(writable).catch(() => {});
    const up = await fetch(d.upload_url, {
      method: 'PUT',
      headers: { 'content-type': tipo, 'content-length': String(len), 'content-range': `bytes ${ini}-${fim}/${size}` },
      body: readable
    });
    if (!up.ok && up.status !== 201 && up.status !== 206) throw erro(`O TikTok recusou o envio do vídeo (${up.status})`, { transient: up.status >= 500 });
  }
  await atualizar(env, p.id, { container_id: d.publish_id, iniciado: agora() });
}

const PRIV_TT = { PUBLIC_TO_EVERYONE: 'Todos', MUTUAL_FOLLOW_FRIENDS: 'Amigos', FOLLOWER_OF_CREATOR: 'Seguidores', SELF_ONLY: 'Só eu' };
const nomePrivTT = (v) => PRIV_TT[v] || v;

async function checarTiktok(env, p, conta) {
  const token = await tokenTiktok(env, conta);
  const d = await tt(token, '/post/publish/status/fetch/', { publish_id: p.container_id });
  const st = d.status;
  if (st === 'PUBLISH_COMPLETE') {
    const ids = d.publicaly_available_post_id || d.publicly_available_post_id || [];
    const u = conta.extra ? JSON.parse(conta.extra).username : null;
    await atualizar(env, p.id, {
      status: 'publicado',
      media_id: ids[0] ? String(ids[0]) : p.container_id,
      permalink: ids[0] && u ? `https://www.tiktok.com/@${u}/video/${ids[0]}` : null,
      publicado: agora(),
      erro: null
    });
    await liberarArquivos(env, p);
    return;
  }
  if (st === 'SEND_TO_USER_INBOX') {
    await atualizar(env, p.id, { status: 'publicado', publicado: agora(), erro: null, aviso: 'Foi para a caixa de entrada do TikTok: abra o app para terminar de postar.' });
    await liberarArquivos(env, p);
    return;
  }
  if (st === 'FAILED') return falha(env, p, erro(`O TikTok recusou o vídeo (${d.fail_reason || 'motivo não informado'})`));
  if (agora() - (p.iniciado || agora()) > PROCESSANDO_MAX_MS) {
    await atualizar(env, p.id, { status: 'erro', erro: 'O TikTok demorou demais para processar o vídeo' });
  }
}

// ---------------------------------------------------------------- fila
const mediaUrl = (base, key) => `${base}/m/${encodeURIComponent(key)}`;

async function atualizar(env, id, campos) {
  const ks = Object.keys(campos);
  await env.DB.prepare(`UPDATE posts SET ${ks.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...ks.map((k) => campos[k]), id)
    .run();
}

// Só apaga o arquivo quando nenhum outro post (outra conta) ainda vai usar ele.
async function liberarArquivos(env, p) {
  const resta = (
    await env.DB.prepare("SELECT COUNT(*) AS n FROM posts WHERE media_key = ? AND id <> ? AND status IN ('agendado', 'processando', 'erro')")
      .bind(p.media_key, p.id)
      .first()
  ).n;
  if (resta) return;
  await env.BUCKET.delete(p.media_key).catch(() => {});
  if (p.capa_key) await env.BUCKET.delete(p.capa_key).catch(() => {});
}

async function falha(env, p, err) {
  const tentativas = (p.tentativas || 0) + 1;
  if (err.transient && tentativas < MAX_TENTATIVAS) {
    const espera = (err.atrasoMin || tentativas * 5) * 60 * 1000;
    await atualizar(env, p.id, {
      status: 'agendado',
      container_id: null,
      tentativas,
      erro: `Tentativa ${tentativas}: ${err.message}`,
      quando: agora() + espera
    });
  } else {
    await atualizar(env, p.id, { status: 'erro', tentativas, erro: err.message });
  }
}

async function criarContainerIg(env, p, conta, base) {
  const params = { caption: p.tipo === 'story' ? undefined : p.legenda };
  const url = mediaUrl(base, p.media_key);
  if (p.tipo === 'reels') {
    Object.assign(params, { media_type: 'REELS', video_url: url, share_to_feed: p.share_to_feed ? 'true' : 'false' });
    if (p.capa_key) params.cover_url = mediaUrl(base, p.capa_key);
  } else if (p.tipo === 'story') {
    params.media_type = 'STORIES';
    if (p.media_kind === 'video') params.video_url = url;
    else params.image_url = url;
  } else {
    params.image_url = url; // foto no feed
  }
  const r = await ig(env, conta, 'POST', `${conta.ext_id}/media`, params);
  await atualizar(env, p.id, { status: 'processando', container_id: r.id, iniciado: agora(), erro: null });
}

async function checarIg(env, p, conta) {
  const st = await ig(env, conta, 'GET', p.container_id, { fields: 'status_code,status' });
  const code = st.status_code;
  if (code === 'IN_PROGRESS' || !code) {
    if (agora() - (p.iniciado || agora()) > PROCESSANDO_MAX_MS) {
      await atualizar(env, p.id, { status: 'erro', erro: 'O Instagram demorou demais para processar o vídeo' });
    }
    return;
  }
  if (code === 'ERROR' || code === 'EXPIRED') {
    return falha(env, p, erro(`Instagram recusou a mídia (${code})${st.status ? ': ' + st.status : ''}`, { transient: code === 'EXPIRED' }));
  }
  const pub = await ig(env, conta, 'POST', `${conta.ext_id}/media_publish`, { creation_id: p.container_id });
  let permalink = null;
  try {
    permalink = (await ig(env, conta, 'GET', pub.id, { fields: 'permalink' })).permalink || null;
  } catch (_) {}
  await atualizar(env, p.id, { status: 'publicado', media_id: pub.id, permalink, publicado: agora(), erro: null });
  await liberarArquivos(env, p);
}

async function rodarFila(env) {
  await garantirEsquema(env);
  const contas = new Map((await listarContas(env)).map((c) => [c.id, c]));
  for (const c of contas.values()) if (c.plataforma === 'instagram') await renovarIg(env, c).catch(() => {});
  if (!contas.size) return { pulado: 'nenhuma conta conectada', processando: 0, iniciados: 0 };
  const base = await getSet(env, 'base_url');

  // 1) posts já enviados: ver se a rede terminou de processar
  const emProc = (await env.DB.prepare("SELECT * FROM posts WHERE status = 'processando' ORDER BY quando LIMIT 15").all()).results;
  for (const p of emProc) {
    const conta = contas.get(p.conta_id);
    try {
      if (!conta) throw erro('A conta deste post foi removida');
      if (p.container_id === 'upload') {
        // upload que começou e não terminou (o envio caiu no meio)
        if (agora() - (p.iniciado || 0) > ENVIO_MAX_MS) await falha(env, p, erro('O envio do vídeo caiu no meio', { transient: true }));
        continue;
      }
      if (conta.plataforma === 'instagram') await checarIg(env, p, conta);
      else if (conta.plataforma === 'tiktok') await checarTiktok(env, p, conta);
    } catch (err) {
      await falha(env, p, err);
    }
  }

  // 2) posts que chegaram na hora. Upload grande (YouTube/TikTok): no máximo 1 de cada por minuto.
  const vencidos = (
    await env.DB.prepare("SELECT * FROM posts WHERE status = 'agendado' AND quando <= ? ORDER BY quando LIMIT 12").bind(agora()).all()
  ).results;
  let iniciados = 0;
  const pesados = { youtube: 0, tiktok: 0 };
  for (const p of vencidos) {
    const conta = contas.get(p.conta_id);
    try {
      if (!conta) throw erro('A conta deste post foi removida');
      if (conta.plataforma === 'instagram') {
        if (!base) throw erro('A nuvem ainda não sabe o próprio endereço. Envie um arquivo pelo app primeiro.', { transient: true });
        await criarContainerIg(env, p, conta, base);
      } else {
        if (pesados[conta.plataforma] >= 1) continue;
        pesados[conta.plataforma]++;
        if (conta.plataforma === 'youtube') await publicarYoutube(env, p, conta);
        else await iniciarTiktok(env, p, conta);
      }
      iniciados++;
    } catch (err) {
      await falha(env, p, err);
    }
  }
  return { processando: emProc.length, iniciados };
}

// ---------------------------------------------------------------- conectar contas (OAuth)
async function iniciarOauth(env, origin, plat) {
  const cr = await credenciais(env, plat);
  if (!cr.id || !cr.secret) throw erro(`Configure primeiro as chaves do app do ${plat === 'youtube' ? 'YouTube' : 'TikTok'}.`, { status: 400 });
  if (MAX_CONTAS && (await contarContas(env)) >= MAX_CONTAS) throw erro(`Limite de ${MAX_CONTAS} contas. Remova uma antes de conectar outra.`, { status: 409 });
  const state = crypto.randomUUID().replace(/-/g, '');
  await setSet(env, 'oauth_' + state, JSON.stringify({ plat, expira: agora() + OAUTH_VALIDADE_MS }));
  const redir = redirectUri(origin, plat);
  if (plat === 'youtube') {
    const u = new URL(GOOGLE_AUTH);
    u.searchParams.set('client_id', cr.id);
    u.searchParams.set('redirect_uri', redir);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly');
    u.searchParams.set('access_type', 'offline');
    u.searchParams.set('prompt', 'consent select_account');
    u.searchParams.set('include_granted_scopes', 'true');
    u.searchParams.set('state', state);
    return u.toString();
  }
  const u = new URL(TT_AUTH);
  u.searchParams.set('client_key', cr.id);
  u.searchParams.set('redirect_uri', redir);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'user.info.basic,video.publish');
  u.searchParams.set('state', state);
  return u.toString();
}

function paginaResultado(ok, titulo, texto) {
  const cor = ok ? '#22c55e' : '#f05252';
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title><body style="margin:0;background:#0a0910;color:#ece9f5;font:16px/1.5 system-ui,Segoe UI,sans-serif;display:grid;place-items:center;min-height:100vh">
<div style="max-width:440px;padding:32px;border:1px solid #262233;border-radius:16px;background:#110f18;text-align:center">
<div style="width:56px;height:56px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;background:${cor}22;color:${cor};font-size:28px">${ok ? '✓' : '!'}</div>
<h1 style="font-size:20px;margin:0 0 8px">${titulo}</h1><p style="color:#8b86a0;margin:0">${texto}</p></div></body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function callbackOauth(env, url, plat) {
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code');
  const negado = url.searchParams.get('error');
  const salvo = state && /^[\w]{16,64}$/.test(state) ? await getSet(env, 'oauth_' + state) : null;
  if (salvo) await setSet(env, 'oauth_' + state, null); // uso único
  const info = salvo ? JSON.parse(salvo) : null;
  if (!info || info.plat !== plat || info.expira < agora()) {
    return paginaResultado(false, 'Link expirado', 'Volte no app e clique em conectar de novo.');
  }
  if (negado || !code) return paginaResultado(false, 'Conexão cancelada', 'Nenhuma conta foi conectada. Pode fechar esta aba.');
  const cr = await credenciais(env, plat);
  const redir = redirectUri(url.origin, plat);
  try {
    let nome;
    if (plat === 'youtube') {
      const { res, data } = await formPost(GOOGLE_TOKEN, {
        code,
        client_id: cr.id,
        client_secret: cr.secret,
        redirect_uri: redir,
        grant_type: 'authorization_code'
      });
      if (!res.ok || !data.access_token) throw erro(data.error_description || data.error || 'O Google recusou a conexão');
      const ch = await fetch(`${YT_API}/channels?part=snippet&mine=true`, { headers: { authorization: `Bearer ${data.access_token}` } });
      const cd = await ch.json().catch(() => ({}));
      const c = cd.items && cd.items[0];
      if (!c) throw erro('Esta conta do Google não tem canal no YouTube. Crie o canal e tente de novo.');
      nome = c.snippet.title;
      await salvarConta(env, {
        plataforma: 'youtube',
        ext_id: c.id,
        nome,
        foto: c.snippet.thumbnails && c.snippet.thumbnails.default && c.snippet.thumbnails.default.url,
        token: data.access_token,
        refresh_token: data.refresh_token || null,
        token_expira: agora() + (Number(data.expires_in) || 3600) * 1000
      });
    } else {
      const { res, data } = await formPost(`${TT_API}/oauth/token/`, {
        client_key: cr.id,
        client_secret: cr.secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redir
      });
      if (!res.ok || !data.access_token) throw erro(data.error_description || data.error || 'O TikTok recusou a conexão');
      const ui = await fetch(`${TT_API}/user/info/?fields=open_id,display_name,avatar_url`, { headers: { authorization: `Bearer ${data.access_token}` } });
      const ud = await ui.json().catch(() => ({}));
      const u = (ud.data && ud.data.user) || {};
      nome = u.display_name || 'TikTok';
      await salvarConta(env, {
        plataforma: 'tiktok',
        ext_id: data.open_id || u.open_id,
        nome,
        foto: u.avatar_url || null,
        token: data.access_token,
        refresh_token: data.refresh_token,
        token_expira: agora() + (Number(data.expires_in) || 86400) * 1000,
        refresh_expira: agora() + (Number(data.refresh_expires_in) || 365 * 86400) * 1000
      });
    }
    return paginaResultado(true, 'Conta conectada!', `<b>${escHtml(nome)}</b> já aparece no app. Pode fechar esta aba.`);
  } catch (err) {
    return paginaResultado(false, 'Não deu para conectar', escHtml(err.message));
  }
}

// ---------------------------------------------------------------- arquivos públicos
async function servirArquivo(req, env, key) {
  const range = req.headers.get('range');
  let opts;
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      const r0 = m[1] === '' ? undefined : Number(m[1]);
      const r1 = m[2] === '' ? undefined : Number(m[2]);
      if (r0 === undefined && r1 !== undefined) opts = { range: { suffix: r1 } };
      else if (r0 !== undefined) opts = { range: r1 !== undefined ? { offset: r0, length: r1 - r0 + 1 } : { offset: r0 } };
    }
  }
  const obj = await env.BUCKET.get(key, opts);
  if (!obj) return new Response('Arquivo não encontrado', { status: 404 });
  const headers = new Headers();
  headers.set('content-type', (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream');
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'public, max-age=3600');
  if (opts && obj.range) {
    const off = obj.range.offset ?? obj.size - obj.range.length;
    const len = obj.range.length ?? obj.size - off;
    headers.set('content-range', `bytes ${off}-${off + len - 1}/${obj.size}`);
    headers.set('content-length', String(len));
    return new Response(req.method === 'HEAD' ? null : obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(req.method === 'HEAD' ? null : obj.body, { status: 200, headers });
}

// ---------------------------------------------------------------- API do app
function autorizado(req, env) {
  const h = req.headers.get('authorization') || '';
  return env.API_KEY && h === `Bearer ${env.API_KEY}`;
}

function contaPublica(c, pub24) {
  let extra = {};
  try {
    extra = c.extra ? JSON.parse(c.extra) : {};
  } catch (_) {}
  return {
    id: c.id,
    plataforma: c.plataforma,
    nome: c.nome,
    usuario: extra.username || null,
    foto: c.foto,
    // Instagram: validade do token (renova sozinho). YouTube/TikTok: validade da permissão de longo prazo.
    acessoAte: c.plataforma === 'instagram' ? c.token_expira : c.plataforma === 'tiktok' ? c.refresh_expira : null,
    erro: c.token_erro || null,
    publicados24h: pub24[c.id] || 0
  };
}

async function api(req, env, url) {
  const p = url.pathname;
  const m = req.method;
  let mm;

  if (p === '/api/status' && m === 'GET') {
    const counts = (await env.DB.prepare('SELECT status, COUNT(*) AS n FROM posts GROUP BY status').all()).results;
    const dia = (
      await env.DB.prepare("SELECT conta_id, COUNT(*) AS n FROM posts WHERE status = 'publicado' AND publicado > ? GROUP BY conta_id")
        .bind(agora() - 86400000)
        .all()
    ).results;
    const pub24 = Object.fromEntries(dia.map((d) => [d.conta_id, d.n]));
    const contas = (await listarContas(env)).map((c) => contaPublica(c, pub24));
    return json({
      ok: true,
      versao: 3,
      maxContas: MAX_CONTAS,
      contas,
      plataformas: {
        youtube: !!(await credenciais(env, 'youtube')).secret,
        tiktok: !!(await credenciais(env, 'tiktok')).secret
      },
      redirect: { youtube: redirectUri(url.origin, 'youtube'), tiktok: redirectUri(url.origin, 'tiktok') },
      publicados24h: dia.reduce((s, d) => s + d.n, 0),
      contagem: Object.fromEntries(counts.map((c) => [c.status, c.n]))
    });
  }

  // chaves dos apps do YouTube/TikTok (o segredo nunca volta para o app)
  if (p === '/api/plataformas' && m === 'POST') {
    const b = await req.json();
    if (b.youtube) {
      if (b.youtube.clientId) await setSet(env, 'yt_client_id', String(b.youtube.clientId).trim());
      if (b.youtube.clientSecret) await setSet(env, 'yt_client_secret', String(b.youtube.clientSecret).trim());
    }
    if (b.tiktok) {
      if (b.tiktok.clientKey) await setSet(env, 'tt_client_key', String(b.tiktok.clientKey).trim());
      if (b.tiktok.clientSecret) await setSet(env, 'tt_client_secret', String(b.tiktok.clientSecret).trim());
    }
    return json({ ok: true });
  }

  if (p === '/api/contas/instagram' && m === 'POST') {
    const { token } = await req.json();
    if (!token) return json({ erro: 'Cole o token de acesso' }, 400);
    const u = new URL(`${IG_GRAPH}/${igVersion(env)}/me`);
    u.searchParams.set('fields', 'user_id,username,profile_picture_url');
    u.searchParams.set('access_token', token.trim());
    const r = await fetch(u);
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) return json({ erro: (d.error && d.error.message) || 'Token inválido' }, 400);
    const id = await salvarConta(env, {
      plataforma: 'instagram',
      ext_id: d.user_id || d.id,
      nome: d.username || '',
      foto: d.profile_picture_url || null,
      token: token.trim(),
      token_renovado: 0
    });
    await setSet(env, 'base_url', url.origin);
    const conta = await getConta(env, id);
    await renovarIg(env, conta, true).catch(() => {}); // troca por um token de 60 dias
    return json({ ok: true, id, conta: d.username });
  }

  if (p === '/api/oauth/iniciar' && m === 'POST') {
    const { plataforma } = await req.json();
    if (plataforma !== 'youtube' && plataforma !== 'tiktok') return json({ erro: 'Plataforma inválida' }, 400);
    return json({ ok: true, url: await iniciarOauth(env, url.origin, plataforma) });
  }

  if ((mm = p.match(/^\/api\/contas\/([\w.:-]+)$/)) && m === 'DELETE') {
    const conta = await getConta(env, mm[1]);
    if (!conta) return json({ erro: 'Conta não encontrada' }, 404);
    await env.DB.prepare('DELETE FROM contas WHERE id = ?').bind(conta.id).run();
    await env.DB.prepare("UPDATE posts SET status = 'erro', erro = 'A conta foi desconectada' WHERE conta_id = ? AND status = 'agendado'")
      .bind(conta.id)
      .run();
    return json({ ok: true });
  }

  if (p.startsWith('/api/upload/') && m === 'PUT') {
    const key = decodeURIComponent(p.slice('/api/upload/'.length));
    if (!/^[\w.-]{8,120}$/.test(key)) return json({ erro: 'Nome de arquivo inválido' }, 400);
    await env.BUCKET.put(key, req.body, { httpMetadata: { contentType: req.headers.get('content-type') || 'application/octet-stream' } });
    await setSet(env, 'base_url', url.origin);
    return json({ ok: true, key });
  }

  if (p === '/api/posts' && m === 'POST') {
    const lista = await req.json();
    if (!Array.isArray(lista) || !lista.length) return json({ erro: 'Nenhum post enviado' }, 400);
    const contas = new Map((await listarContas(env)).map((c) => [c.id, c]));
    const stmt = env.DB.prepare(
      `INSERT INTO posts (id, tipo, media_key, media_kind, capa_key, legenda, quando, share_to_feed, nome, status, tentativas, criado,
         conta_id, plataforma, titulo, privacidade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'agendado', 0, ?, ?, ?, ?, ?)`
    );
    const batch = [];
    for (const it of lista) {
      const conta = contas.get(it.contaId);
      if (!conta) return json({ erro: 'Escolha para qual conta vai cada post' }, 400);
      const plat = conta.plataforma;
      if (!TIPOS[plat].has(it.tipo) || !it.mediaKey || !Number(it.quando)) return json({ erro: `Post inválido para ${plat}` }, 400);
      if (plat !== 'instagram' && it.mediaKind === 'image') return json({ erro: `${plat === 'youtube' ? 'YouTube' : 'TikTok'} aqui só aceita vídeo` }, 400);
      batch.push(
        stmt.bind(
          it.id || crypto.randomUUID(),
          it.tipo,
          it.mediaKey,
          it.mediaKind === 'image' ? 'image' : 'video',
          plat === 'instagram' ? it.capaKey || null : null,
          String(it.legenda || '').slice(0, plat === 'youtube' ? 5000 : 2200),
          Number(it.quando),
          it.shareToFeed === false ? 0 : 1,
          String(it.nome || '').slice(0, 200),
          agora(),
          conta.id,
          plat,
          it.titulo ? String(it.titulo).slice(0, 100) : null,
          it.privacidade ? String(it.privacidade).slice(0, 40) : null
        )
      );
    }
    await env.DB.batch(batch);
    return json({ ok: true, n: batch.length });
  }

  if (p === '/api/posts' && m === 'GET') {
    const r = await env.DB.prepare('SELECT * FROM posts ORDER BY quando DESC LIMIT 800').all();
    return json({ ok: true, posts: r.results });
  }

  if ((mm = p.match(/^\/api\/posts\/([\w-]+)$/)) && m === 'DELETE') {
    const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(mm[1]).first();
    if (!post) return json({ erro: 'Não encontrado' }, 404);
    if (post.status === 'processando') return json({ erro: 'Este post já está sendo publicado' }, 409);
    await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(mm[1]).run();
    if (post.status !== 'publicado') await liberarArquivos(env, post);
    return json({ ok: true });
  }

  if ((mm = p.match(/^\/api\/posts\/([\w-]+)$/)) && m === 'PATCH') {
    const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(mm[1]).first();
    if (!post) return json({ erro: 'Não encontrado' }, 404);
    if (!['agendado', 'erro'].includes(post.status)) return json({ erro: 'Só dá pra mudar posts ainda não publicados' }, 409);
    const b = await req.json();
    const campos = {};
    if (b.legenda !== undefined) campos.legenda = String(b.legenda).slice(0, post.plataforma === 'youtube' ? 5000 : 2200);
    if (b.quando !== undefined) campos.quando = Number(b.quando);
    if (b.tentarDeNovo) Object.assign(campos, { status: 'agendado', tentativas: 0, erro: null, aviso: null, container_id: null, quando: campos.quando || agora() });
    if (!Object.keys(campos).length) return json({ erro: 'Nada para mudar' }, 400);
    await atualizar(env, post.id, campos);
    return json({ ok: true });
  }

  if (p === '/api/rodar' && m === 'POST') {
    return json({ ok: true, ...(await rodarFila(env)) });
  }

  return json({ erro: 'Rota não encontrada' }, 404);
}

// páginas públicas exigidas pelo TikTok/Google ao cadastrar o app (política de privacidade e termos de uso)
function paginaLegal(qual, origin) {
  const priv = qual === 'privacidade';
  const titulo = priv ? 'Política de Privacidade — Privacy Policy' : 'Termos de Uso — Terms of Service';
  const corpo = priv
    ? `<p>Este aplicativo é uma ferramenta pessoal de agendamento de publicações. Ele só é usado pelo próprio dono, nas contas que ele mesmo conecta.</p>
<p><b>Dados coletados:</b> ao conectar uma conta (TikTok, YouTube ou Instagram), o app guarda o token de acesso, o nome público e o identificador da conta, além dos vídeos, legendas e horários agendados pelo dono.</p>
<p><b>Uso:</b> esses dados servem apenas para publicar os vídeos que o dono agendou, na conta que ele escolheu. Nada é vendido, compartilhado com terceiros ou usado para publicidade.</p>
<p><b>Armazenamento:</b> os dados ficam na conta Cloudflare do dono. Os vídeos são apagados da nuvem depois de publicados.</p>
<p><b>Exclusão:</b> o dono pode desconectar uma conta a qualquer momento no app, o que apaga o token. Também é possível revogar o acesso nas configurações do TikTok, Google ou Instagram.</p>
<hr><p lang="en">This is a personal post-scheduling tool used only by its owner on accounts the owner connects. It stores access tokens, public account name/ID, and the videos, captions and times the owner schedules, solely to publish those posts. No data is sold, shared or used for ads. Videos are deleted after publishing. Disconnecting an account deletes its token; access can also be revoked in TikTok/Google/Instagram settings.</p>`
    : `<p>Este aplicativo é uma ferramenta pessoal para agendar e publicar vídeos nas contas do próprio dono.</p>
<p>Ao usar o app, o dono é responsável pelo conteúdo que publica e por seguir as regras de cada plataforma (TikTok, YouTube e Instagram).</p>
<p>O app é oferecido como está, sem garantia de disponibilidade. As publicações dependem das APIs oficiais de cada plataforma, que podem recusar, limitar ou atrasar envios.</p>
<p>O acesso às contas pode ser removido a qualquer momento desconectando a conta no app ou nas configurações da plataforma.</p>
<hr><p lang="en">This app is a personal tool to schedule and publish videos to its owner's own accounts. The owner is responsible for the content and for following each platform's rules. Provided as is, without availability guarantees; publishing depends on each platform's official API. Access can be removed at any time by disconnecting the account.</p>`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#1b1b1b;background:#fff}h1{font-size:24px}hr{margin:28px 0;border:0;border-top:1px solid #ddd}a{color:#6d4aff}</style></head>
<body><h1>${titulo}</h1>${corpo}<p><small>Atualizado em 2026 · <a href="${origin}/${priv ? 'termos' : 'privacidade'}">${priv ? 'Termos de Uso' : 'Política de Privacidade'}</a></small></p></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, app: 'agendador-editor-em-massa', versao: 2 });
      if (url.pathname.startsWith('/m/') && (req.method === 'GET' || req.method === 'HEAD')) {
        return servirArquivo(req, env, decodeURIComponent(url.pathname.slice(3)));
      }
      const caminho = url.pathname.replace(/\/+$/, '');
      if ((caminho === '/privacidade' || caminho === '/termos') && req.method === 'GET') return paginaLegal(caminho.slice(1), url.origin);
      // arquivo de verificação de propriedade da URL do TikTok (tiktokCODIGO.txt)
      const vt = url.pathname.match(/^\/tiktok([A-Za-z0-9_-]+)\.txt$/);
      if (vt && req.method === 'GET') return new Response(`tiktok-developers-site-verification=${vt[1]}`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      await garantirEsquema(env);
      let mm;
      if ((mm = url.pathname.match(/^\/oauth\/(youtube|tiktok)$/)) && req.method === 'GET') return callbackOauth(env, url, mm[1]);
      if (url.pathname.startsWith('/api/')) {
        if (!autorizado(req, env)) return json({ erro: 'Chave da nuvem incorreta' }, 401);
        return await api(req, env, url);
      }
      return json({ erro: 'Rota não encontrada' }, 404);
    } catch (err) {
      return json({ erro: String((err && err.message) || err) }, err && err.status ? err.status : 500);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(rodarFila(env));
  }
};

// usado pelos testes locais
export { rodarFila, garantirEsquema, PLATAFORMAS };
