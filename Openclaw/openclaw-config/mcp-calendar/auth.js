#!/usr/bin/env node
// Ejecutar UNA vez para obtener/renovar el token de Google Calendar.
// Uso: node auth.js
// Luego copiar el token al servidor si es necesario.
const { google } = require("googleapis");
const fs = require("fs");
const http = require("http");
const url = require("url");

const CREDENTIALS_PATH = process.env.GOOGLE_OAUTH_CREDENTIALS
  || require("path").join(__dirname, "../../Credencials/gcp-oauth.keys.json");
const TOKEN_PATH = process.env.GOOGLE_CALENDAR_TOKEN_PATH
  || require("path").join(__dirname, "../tokens/google-calendar-token.json");

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const REDIRECT_PORT = 3456;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
const { client_id, client_secret } = creds.web || creds.installed;

const oAuth2 = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

const authUrl = oAuth2.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent",
});

console.log("\n=== Autorización Google Calendar ===");
console.log("Abre este URL en tu navegador:\n");
console.log(authUrl);
console.log("\nEsperando redirección en http://localhost:" + REDIRECT_PORT + " ...\n");

// Abre el navegador automáticamente en Mac
const { exec } = require("child_process");
exec(`open "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  const params = url.parse(req.url, true).query;
  if (!params.code) {
    res.end("Sin código. Intenta de nuevo.");
    return;
  }

  res.end("<h2>✅ Autorizado. Puedes cerrar esta ventana.</h2>");
  server.close();

  try {
    const { tokens } = await oAuth2.getToken(params.code);
    const tokenData = { normal: tokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
    console.log("✅ Token guardado en:", TOKEN_PATH);
    console.log("   access_token expira:", new Date(tokens.expiry_date).toLocaleString());
    console.log("   refresh_token:", tokens.refresh_token ? "✓ presente" : "⚠ ausente");
    if (tokens.refresh_token_expires_in) {
      const days = Math.round(tokens.refresh_token_expires_in / 86400);
      console.log(`\n⚠  La app está en modo Testing — el refresh token expira en ${days} días.`);
      console.log("   Para evitar esto: Google Cloud Console → APIs & Services → OAuth consent screen → PUBLICAR APP");
    } else {
      console.log("\n✅ App publicada — el refresh token no expira.");
    }
    console.log("\nSi el servidor está en GCP, copia el token:");
    console.log(`   scp ${TOKEN_PATH} usuario@34.44.81.102:/ruta/tokens/google-calendar-token.json`);
    process.exit(0);
  } catch (err) {
    console.error("Error al obtener token:", err.message);
    process.exit(1);
  }
});

server.listen(REDIRECT_PORT);
