CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,            -- reels | story | foto (Instagram) · short (YouTube) · video (TikTok)
  media_key TEXT NOT NULL,       -- arquivo no R2
  media_kind TEXT NOT NULL,      -- video | image
  capa_key TEXT,                 -- capa do reels (opcional)
  legenda TEXT,
  quando INTEGER NOT NULL,       -- horário de publicar (ms, UTC)
  share_to_feed INTEGER DEFAULT 1,
  nome TEXT,
  status TEXT NOT NULL,          -- agendado | processando | publicado | erro
  container_id TEXT,
  media_id TEXT,
  permalink TEXT,
  tentativas INTEGER DEFAULT 0,
  erro TEXT,
  iniciado INTEGER,
  publicado INTEGER,
  criado INTEGER,
  conta_id TEXT,                 -- conta de destino (tabela contas)
  plataforma TEXT,               -- instagram | youtube | tiktok
  titulo TEXT,                   -- título (YouTube)
  privacidade TEXT,              -- YouTube: public|unlisted|private · TikTok: PUBLIC_TO_EVERYONE|...
  aviso TEXT                     -- observação da rede (ex.: postado como privado)
);
CREATE INDEX IF NOT EXISTS posts_fila ON posts (status, quando);

CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT
);

CREATE TABLE IF NOT EXISTS contas (
  id TEXT PRIMARY KEY,           -- ig-123 | yt-UC... | tt-open_id
  plataforma TEXT NOT NULL,      -- instagram | youtube | tiktok
  nome TEXT,
  ext_id TEXT,
  foto TEXT,
  token TEXT,
  refresh_token TEXT,
  token_expira INTEGER,
  refresh_expira INTEGER,
  token_renovado INTEGER,
  token_erro TEXT,
  extra TEXT,
  criado INTEGER
);
