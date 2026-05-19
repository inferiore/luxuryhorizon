const express    = require('express');
const Database   = require('better-sqlite3');
const cors       = require('cors');
const fs         = require('fs');
const path       = require('path');
const http       = require('http');
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3100;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'leads.db');

const OPENCLAW_CONTAINER = process.env.OPENCLAW_CONTAINER || 'openclaw-openclaw-gateway-1';
const NOTIFY_PHONE       = process.env.NOTIFY_PHONE       || '+573126322306';
const DOCKER_SOCKET      = '/var/run/docker.sock';

const NOTIFY_EMAIL    = process.env.NOTIFY_EMAIL    || 'ederb1.1c@gmail.com';
const SMTP_USER       = process.env.SMTP_USER       || '';
const SMTP_PASS       = process.env.SMTP_PASS       || '';

const mailer = (SMTP_USER && SMTP_PASS)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

// ── DB ────────────────────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// Migraciones seguras para DBs existentes
for (const col of [
  'ALTER TABLE contact_leads ADD COLUMN notified        INTEGER DEFAULT 0',
  'ALTER TABLE contact_leads ADD COLUMN notify_error    TEXT',
  'ALTER TABLE contact_leads ADD COLUMN notify_attempts INTEGER DEFAULT 0',
]) {
  try { db.exec(col); } catch {}
}

app.use(cors());
app.use(express.json());

// ── Docker exec ───────────────────────────────────────────────────────────────
function dockerExec(container, cmd) {
  return new Promise((resolve, reject) => {
    const createBody = JSON.stringify({ AttachStdout: true, AttachStderr: true, Cmd: cmd });
    const createReq  = http.request({
      socketPath: DOCKER_SOCKET,
      path: `/containers/${container}/exec`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(createBody) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let execId;
        try { execId = JSON.parse(data).Id; } catch { return reject(new Error('docker exec create failed: ' + data)); }
        const startBody = JSON.stringify({ Detach: true, Tty: false });
        const startReq  = http.request({
          socketPath: DOCKER_SOCKET,
          path: `/exec/${execId}/start`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(startBody) }
        }, res2 => { res2.resume(); res2.on('end', resolve); });
        startReq.on('error', reject);
        startReq.write(startBody);
        startReq.end();
      });
    });
    createReq.on('error', reject);
    createReq.write(createBody);
    createReq.end();
  });
}

// ── Notificación ──────────────────────────────────────────────────────────────
function buildMessage(lead) {
  return [
    `🔔 *Nuevo lead* desde ${lead.influencer ? '*' + lead.influencer + '*' : 'la web'}`,
    `👤 ${lead.name}`,
    `📱 ${lead.whatsapp_number}`,
    lead.country_name ? `🌎 ${lead.country_name}` : null,
    lead.description  ? `💬 _${lead.description}_` : null,
  ].filter(Boolean).join('\n');
}

async function sendWhatsApp(lead) {
  await dockerExec(OPENCLAW_CONTAINER, [
    'node', 'dist/index.js', 'message', 'send',
    '--channel', 'whatsapp',
    '--target',  NOTIFY_PHONE,
    '--message', buildMessage(lead),
  ]);
}

async function sendEmail(lead) {
  if (!mailer) return;
  await mailer.sendMail({
    from:    `"Luxury Horizon Leads" <${SMTP_USER}>`,
    to:      NOTIFY_EMAIL,
    subject: `🔔 Nuevo lead${lead.influencer ? ' desde ' + lead.influencer : ''}: ${lead.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;background:#0A1A32;color:#f0f0f0;padding:24px;border-radius:8px;">
        <h2 style="color:#B79A49;margin-bottom:16px;">Nuevo lead — Luxury Horizon</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#888;padding:6px 0;width:120px;">Nombre</td><td><strong>${lead.name}</strong></td></tr>
          <tr><td style="color:#888;padding:6px 0;">WhatsApp</td><td><a href="https://wa.me/${(lead.whatsapp_number||'').replace('+','')}" style="color:#44F0F7;">${lead.whatsapp_number}</a></td></tr>
          ${lead.email       ? `<tr><td style="color:#888;padding:6px 0;">Email</td><td>${lead.email}</td></tr>` : ''}
          ${lead.country_name? `<tr><td style="color:#888;padding:6px 0;">País</td><td>${lead.country_name}</td></tr>` : ''}
          ${lead.influencer  ? `<tr><td style="color:#888;padding:6px 0;">Influencer</td><td>${lead.influencer}</td></tr>` : ''}
          ${lead.description ? `<tr><td style="color:#888;padding:6px 0;">Descripción</td><td>${lead.description}</td></tr>` : ''}
        </table>
        <p style="margin-top:20px;">
          <a href="https://luxuryhorizon.lat/leads-admin" style="background:#B79A49;color:#0A1A32;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Ver todos los leads
          </a>
        </p>
      </div>`,
  });
}

async function sendNotification(lead) {
  try {
    await sendWhatsApp(lead);
  } catch (err) {
    // WhatsApp falló — notificar por email como fallback
    await sendEmail(lead).catch(mailErr =>
      console.error('[email] Error al enviar fallback:', mailErr.message)
    );
    throw err; // re-lanzar para que markNotified registre el error
  }
}

function markNotified(id, error = null) {
  if (error) {
    db.prepare(`
      UPDATE contact_leads
      SET notified = 0, notify_error = ?, notify_attempts = notify_attempts + 1
      WHERE id = ?
    `).run(String(error), id);
  } else {
    db.prepare(`
      UPDATE contact_leads
      SET notified = 1, notify_error = NULL, notify_attempts = notify_attempts + 1
      WHERE id = ?
    `).run(id);
  }
}

// ── POST /api/leads ───────────────────────────────────────────────────────────
app.post('/api/leads', async (req, res) => {
  const { name, whatsapp_number, email, description, influencer, country_code, country_name, phone_prefix } = req.body;

  if (!name || !whatsapp_number) {
    return res.status(400).json({ error: 'name y whatsapp_number son requeridos' });
  }

  const { lastInsertRowid: id } = db.prepare(`
    INSERT INTO contact_leads (name, whatsapp_number, email, description, influencer, country_code, country_name, phone_prefix)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, whatsapp_number, email || null, description || null, influencer || null, country_code || null, country_name || null, phone_prefix || null);

  console.log(`[lead #${id}] ${name} | ${whatsapp_number} | influencer: ${influencer || 'directo'}`);
  res.status(201).json({ success: true, id });

  // Notificar en background y registrar resultado
  sendNotification({ name, whatsapp_number, influencer, country_name, description })
    .then(() => { markNotified(id); console.log(`[notify #${id}] ✅ enviado`); })
    .catch(err => { markNotified(id, err.message); console.error(`[notify #${id}] ❌ ${err.message}`); });
});

// ── POST /api/leads/:id/retry ─────────────────────────────────────────────────
app.post('/api/leads/:id/retry', async (req, res) => {
  const lead = db.prepare('SELECT * FROM contact_leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

  try {
    await sendNotification(lead);
    markNotified(lead.id);
    console.log(`[retry #${lead.id}] ✅ enviado`);
    res.json({ success: true });
  } catch (err) {
    markNotified(lead.id, err.message);
    console.error(`[retry #${lead.id}] ❌ ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/leads ────────────────────────────────────────────────────────────
app.get('/api/leads', (req, res) => {
  const leads = db.prepare('SELECT * FROM contact_leads ORDER BY created_at DESC').all();
  res.json(leads);
});

// ── GET /leads-admin ─ UI web ─────────────────────────────────────────────────
app.get('/leads-admin', (req, res) => {
  const leads = db.prepare('SELECT * FROM contact_leads ORDER BY created_at DESC').all();

  const rows = leads.map(l => {
    const date  = new Date(l.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    const badge = l.notified
      ? `<span class="badge ok">✅ Enviado</span>`
      : `<span class="badge fail">❌ ${l.notify_error ? l.notify_error.slice(0, 60) : 'No enviado'}</span>`;
    const retry = !l.notified
      ? `<button class="retry-btn" onclick="retry(${l.id}, this)">Reintentar</button>`
      : '';
    const flag  = l.country_code
      ? String.fromCodePoint(...[...l.country_code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
      : '';

    return `<tr id="row-${l.id}">
      <td>${l.id}</td>
      <td>${date}</td>
      <td>${flag} ${l.country_name || ''}</td>
      <td><strong>${l.name}</strong></td>
      <td><a href="https://wa.me/${l.whatsapp_number.replace('+','')}" target="_blank">${l.whatsapp_number}</a></td>
      <td>${l.email || '<span class="dim">—</span>'}</td>
      <td class="desc">${l.description || '<span class="dim">—</span>'}</td>
      <td>${l.influencer || '<span class="dim">directo</span>'}</td>
      <td class="status">${badge}<br>${retry}</td>
      <td class="dim">${l.notify_attempts}</td>
    </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Leads — Luxury Horizon</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0A1A32; color: #f0f0f0; font-family: 'Segoe UI', sans-serif; font-size: 14px; padding: 24px; }
    h1 { color: #B79A49; font-size: 1.4rem; letter-spacing: 2px; margin-bottom: 4px; }
    .meta { color: #666; margin-bottom: 20px; font-size: .85rem; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; }
    .card { background: #112244; border: 1px solid #1e3a5f; border-radius: 8px; padding: 14px 20px; min-width: 120px; }
    .card .num { font-size: 1.8rem; font-weight: 700; color: #B79A49; }
    .card .label { font-size: .75rem; color: #888; margin-top: 2px; }
    .card.fail .num { color: #f87171; }
    .card.ok .num { color: #4ade80; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #112244; color: #B79A49; font-size: .75rem; letter-spacing: 1px; padding: 10px 12px; text-align: left; position: sticky; top: 0; }
    td { padding: 10px 12px; border-bottom: 1px solid #1a2e50; vertical-align: top; }
    tr:hover td { background: #0d1f3c; }
    a { color: #44F0F7; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .badge { font-size: .78rem; padding: 2px 8px; border-radius: 20px; display: inline-block; }
    .badge.ok   { background: #0d3320; color: #4ade80; }
    .badge.fail { background: #3a0d0d; color: #f87171; }
    .retry-btn { margin-top: 6px; padding: 4px 12px; background: #B79A49; color: #0A1A32; border: none; border-radius: 4px; cursor: pointer; font-size: .78rem; font-weight: 700; }
    .retry-btn:disabled { opacity: .5; cursor: default; }
    .dim { color: #555; }
    .desc { max-width: 200px; word-break: break-word; }
    .status { min-width: 160px; }
    .refresh { float: right; padding: 6px 16px; background: #1e3a5f; color: #f0f0f0; border: none; border-radius: 6px; cursor: pointer; font-size: .85rem; }
    .refresh:hover { background: #2a4f7f; }
  </style>
</head>
<body>
  <h1>LEADS — LUXURY HORIZON</h1>
  <p class="meta">Actualizado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
    <button class="refresh" onclick="location.reload()">↻ Actualizar</button>
  </p>

  <div class="summary">
    <div class="card">
      <div class="num">${leads.length}</div>
      <div class="label">TOTAL</div>
    </div>
    <div class="card ok">
      <div class="num">${leads.filter(l => l.notified).length}</div>
      <div class="label">NOTIFICADOS</div>
    </div>
    <div class="card fail">
      <div class="num">${leads.filter(l => !l.notified).length}</div>
      <div class="label">PENDIENTES</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>FECHA</th><th>PAÍS</th><th>NOMBRE</th><th>WHATSAPP</th>
        <th>EMAIL</th><th>DESCRIPCIÓN</th><th>INFLUENCER</th><th>NOTIFICACIÓN</th><th>INTENTOS</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="10" style="text-align:center;color:#555;padding:40px">Sin leads aún</td></tr>'}</tbody>
  </table>

  <script>
  async function retry(id, btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    const res = await fetch('/api/leads/' + id + '/retry', { method: 'POST' });
    const data = await res.json();
    const cell = document.querySelector('#row-' + id + ' .status');
    if (data.success) {
      cell.innerHTML = '<span class="badge ok">✅ Enviado</span>';
    } else {
      cell.innerHTML = '<span class="badge fail">❌ ' + (data.error || 'Error').slice(0, 60) + '</span><br><button class="retry-btn" onclick="retry(' + id + ', this)">Reintentar</button>';
    }
  }
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log(`Leads API corriendo en puerto ${PORT}`));
