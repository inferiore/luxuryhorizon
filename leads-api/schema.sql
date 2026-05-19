CREATE TABLE IF NOT EXISTS contact_leads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  whatsapp_number TEXT    NOT NULL,
  email           TEXT,
  description     TEXT,
  influencer      TEXT,
  country_code    TEXT,
  country_name    TEXT,
  phone_prefix    TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
