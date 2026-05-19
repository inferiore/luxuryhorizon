const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3100;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'leads.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Init DB and run schema
const db = new Database(DB_PATH);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

app.use(cors());
app.use(express.json());

// POST /api/leads — store a new lead
app.post('/api/leads', (req, res) => {
  const { name, whatsapp_number, email, description, influencer, country_code, country_name, phone_prefix } = req.body;

  if (!name || !whatsapp_number) {
    return res.status(400).json({ error: 'name y whatsapp_number son requeridos' });
  }

  const stmt = db.prepare(`
    INSERT INTO contact_leads (name, whatsapp_number, email, description, influencer, country_code, country_name, phone_prefix)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name,
    whatsapp_number,
    email || null,
    description || null,
    influencer || null,
    country_code || null,
    country_name || null,
    phone_prefix || null
  );

  console.log(`[lead] ${name} | ${whatsapp_number} | influencer: ${influencer || 'directo'} | país: ${country_name}`);
  res.status(201).json({ success: true, id: result.lastInsertRowid });
});

// GET /api/leads — list all leads (proteger con token en producción si se necesita)
app.get('/api/leads', (req, res) => {
  const leads = db.prepare('SELECT * FROM contact_leads ORDER BY created_at DESC').all();
  res.json(leads);
});

app.listen(PORT, () => {
  console.log(`Leads API corriendo en puerto ${PORT}`);
});
