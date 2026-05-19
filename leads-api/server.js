const express  = require('express');
const Database = require('better-sqlite3');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const http     = require('http');

const app  = express();
const PORT = process.env.PORT     || 3100;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'leads.db');

const OPENCLAW_CONTAINER = process.env.OPENCLAW_CONTAINER || 'openclaw-openclaw-gateway-1';
const NOTIFY_PHONE       = process.env.NOTIFY_PHONE       || '+573126322306';
const DOCKER_SOCKET      = '/var/run/docker.sock';

// ── DB ────────────────────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

app.use(cors());
app.use(express.json());

// ── Notificación via OpenClaw ─────────────────────────────────────────────────
function dockerExec(container, cmd) {
  return new Promise((resolve, reject) => {
    const createBody = JSON.stringify({ AttachStdout: true, AttachStderr: true, Cmd: cmd });

    const createReq = http.request({
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
        const startReq = http.request({
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

async function notifyLead(lead) {
  const lines = [
    `🔔 *Nuevo lead* desde ${lead.influencer ? '*' + lead.influencer + '*' : 'la web'}`,
    `👤 ${lead.name}`,
    `📱 ${lead.whatsapp_number}`,
    lead.country_name ? `🌎 ${lead.country_name}` : null,
    lead.description  ? `💬 _${lead.description}_` : null,
  ].filter(Boolean).join('\n');

  await dockerExec(OPENCLAW_CONTAINER, [
    'node', 'dist/index.js', 'message', 'send',
    '--channel', 'whatsapp',
    '--target',  NOTIFY_PHONE,
    '--message', lines,
  ]);

  console.log(`[notify] Mensaje enviado a ${NOTIFY_PHONE}`);
}

// ── POST /api/leads ───────────────────────────────────────────────────────────
app.post('/api/leads', async (req, res) => {
  const { name, whatsapp_number, email, description, influencer, country_code, country_name, phone_prefix } = req.body;

  if (!name || !whatsapp_number) {
    return res.status(400).json({ error: 'name y whatsapp_number son requeridos' });
  }

  const result = db.prepare(`
    INSERT INTO contact_leads (name, whatsapp_number, email, description, influencer, country_code, country_name, phone_prefix)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, whatsapp_number, email || null, description || null, influencer || null, country_code || null, country_name || null, phone_prefix || null);

  console.log(`[lead] ${name} | ${whatsapp_number} | influencer: ${influencer || 'directo'} | país: ${country_name}`);

  // Responder inmediatamente; notificación va en segundo plano
  res.status(201).json({ success: true, id: result.lastInsertRowid });

  notifyLead({ name, whatsapp_number, influencer, country_name, description })
    .catch(err => console.error('[notify] Error al notificar a OpenClaw:', err.message));
});

// ── GET /api/leads ────────────────────────────────────────────────────────────
app.get('/api/leads', (req, res) => {
  const leads = db.prepare('SELECT * FROM contact_leads ORDER BY created_at DESC').all();
  res.json(leads);
});

app.listen(PORT, () => console.log(`Leads API corriendo en puerto ${PORT}`));
