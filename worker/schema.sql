-- Banco de dados do Hire-X (Cloudflare D1)
CREATE TABLE IF NOT EXISTS leads (
  id               TEXT PRIMARY KEY,
  token            TEXT UNIQUE,
  nome             TEXT NOT NULL,
  email            TEXT NOT NULL,
  email_norm       TEXT NOT NULL UNIQUE,
  whatsapp         TEXT NOT NULL,
  ip_hash          TEXT,
  ip_analise_hash  TEXT,
  consentimento_em INTEGER NOT NULL,
  criado_em        INTEGER NOT NULL,
  atualizado_em    INTEGER NOT NULL,
  analisado_em     INTEGER,
  status           TEXT NOT NULL DEFAULT 'cadastrado', -- cadastrado | processando | concluido | erro
  cargos           TEXT,
  resultado_json   TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON leads (whatsapp);
CREATE INDEX IF NOT EXISTS idx_leads_ip ON leads (ip_hash, criado_em);
CREATE INDEX IF NOT EXISTS idx_leads_ip_analise ON leads (ip_analise_hash, analisado_em);
