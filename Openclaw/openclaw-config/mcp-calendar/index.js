#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { google } = require("googleapis");
const fs = require("fs");

const CREDENTIALS_PATH = process.env.GOOGLE_OAUTH_CREDENTIALS;
const TOKEN_PATH = process.env.GOOGLE_CALENDAR_TOKEN_PATH;
const CALENDAR_ID = process.env.CALENDAR_ID || "primary";

function getAuth() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const { client_id, client_secret, redirect_uris } = creds.web || creds.installed;
  const oAuth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  const token = tokenData.normal || tokenData;
  oAuth2.setCredentials(token);
  return oAuth2;
}

const TOOLS = [
  {
    name: "crear_evento",
    description: "Crea un evento en Google Calendar con el número de teléfono como título.",
    inputSchema: {
      type: "object",
      properties: {
        telefono: { type: "string", description: "Número de teléfono en formato +573153828958 (título del evento)" },
        fecha: { type: "string", description: "Fecha del evento en formato YYYY-MM-DD" },
        descripcion: { type: "string", description: "Descripción opcional del evento" }
      },
      required: ["telefono", "fecha"]
    }
  },
  {
    name: "listar_eventos",
    description: "Lista los eventos del calendario en un rango de fechas.",
    inputSchema: {
      type: "object",
      properties: {
        fecha_inicio: { type: "string", description: "Fecha de inicio en formato YYYY-MM-DD" },
        fecha_fin: { type: "string", description: "Fecha de fin en formato YYYY-MM-DD (opcional, por defecto 7 días después)" }
      },
      required: ["fecha_inicio"]
    }
  },
  {
    name: "eliminar_evento",
    description: "Busca un evento por nombre (título) y lo elimina del calendario.",
    inputSchema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre o título del evento a eliminar (puede ser parcial, p.ej. número de teléfono)" }
      },
      required: ["nombre"]
    }
  }
];

async function crearEvento({ telefono, fecha, descripcion }) {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  const event = {
    summary: telefono,
    start: { date: fecha },
    end: { date: fecha },
    ...(descripcion ? { description: descripcion } : {})
  };
  const res = await calendar.events.insert({ calendarId: CALENDAR_ID, resource: event });
  return `✅ Evento creado: ${telefono} — ${fecha}`;
}

async function eliminarEvento({ nombre }) {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  // Search in the next 12 months from today
  const ahora = new Date();
  const fin = new Date(ahora);
  fin.setFullYear(fin.getFullYear() + 1);
  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: new Date(ahora.getFullYear() - 1, 0, 1).toISOString(),
    timeMax: fin.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250
  });
  const events = res.data.items || [];
  const q = nombre.toLowerCase();
  const match = events.find(e => {
    const summary = (e.summary || "").toLowerCase();
    const desc    = (e.description || "").toLowerCase();
    const combined = `${summary} | ${desc}`;
    return summary.includes(q) || desc.includes(q) || combined.includes(q) || q.includes(summary);
  });
  if (!match) return `❌ No se encontró ningún evento con el nombre "${nombre}".`;
  await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: match.id });
  const fecha = match.start.date || match.start.dateTime?.split("T")[0];
  return `🗑️ Evento eliminado: ${match.summary} — ${fecha}`;
}

async function listarEventos({ fecha_inicio, fecha_fin }) {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  const fin = fecha_fin || (() => {
    const d = new Date(fecha_inicio);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  })();
  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: new Date(fecha_inicio).toISOString(),
    timeMax: new Date(fin + "T23:59:59").toISOString(),
    singleEvents: true,
    orderBy: "startTime"
  });
  const events = res.data.items || [];
  if (events.length === 0) return "No hay eventos en ese período.";
  return events.map(e => {
    const fecha = e.start.date || e.start.dateTime?.split("T")[0];
    return `📅 ${fecha} — ${e.summary}${e.description ? " | " + e.description : ""}`;
  }).join("\n");
}

const server = new Server(
  { name: "mcp-calendar-lux", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let result;
    if (name === "crear_evento") result = await crearEvento(args);
    else if (name === "listar_eventos") result = await listarEventos(args);
    else if (name === "eliminar_evento") result = await eliminarEvento(args);
    else throw new Error(`Tool desconocida: ${name}`);
    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
