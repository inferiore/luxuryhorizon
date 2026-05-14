#!/bin/bash
set -e

set -a
source .env
set +a

echo "🦞 Luxury Horizon — OpenClaw Setup"
echo "==================================="

# ── 1. Directorios necesarios ─────────────────────────────────────────────────
echo ""
echo "📁 Creando directorios..."
mkdir -p openclaw-config openclaw-workspace openclaw-workspace-luxury-horizon openclaw-config/tokens

# ── 2. Onboarding si no hay token ─────────────────────────────────────────────
if [ -z "$OPENCLAW_GATEWAY_TOKEN" ] || ! grep -q "OPENCLAW_GATEWAY_TOKEN=.\+" .env 2>/dev/null; then
  echo ""
  echo "🔑 No hay gateway token. Ejecutando onboarding..."
  docker compose run --rm --no-deps --entrypoint node openclaw-gateway \
    dist/index.js onboard --non-interactive --accept-risk \
    --mode local --auth-choice "${AI_PROVIDER:-openrouter}-api-key"

  # Extraer token generado y guardarlo en .env
  TOKEN=$(python3 -c "
import json
with open('openclaw-config/openclaw.json') as f:
    d = json.load(f)
print(d['gateway']['auth']['token'])
" 2>/dev/null || echo "")

  if [ -n "$TOKEN" ]; then
    sed -i '' "s/OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$TOKEN/" .env
    echo "✓ Token guardado en .env"
  fi
else
  echo "✓ Gateway token encontrado"
fi

# ── 3. Aplicar config del provider ───────────────────────────────────────────
echo ""
echo "⚙️  Aplicando provider: ${AI_PROVIDER:-openrouter} / modelo: ${AI_MODEL:-default}"
./switch-provider.sh

# ── 4. Instalar plugin de WhatsApp ────────────────────────────────────────────
echo ""
echo "📱 Instalando plugin de WhatsApp..."
docker compose run --rm openclaw-cli plugins install @openclaw/whatsapp
docker compose restart openclaw-gateway
sleep 3

# ── 5. Registrar MCP servers ──────────────────────────────────────────────────
echo ""
echo "🔌 Registrando MCP servers..."
docker compose run --rm openclaw-cli mcp set filesystem \
  '{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/app/Context"]}'

docker compose run --rm openclaw-cli mcp set google-calendar \
  '{"command":"npx","args":["-y","@cocal/google-calendar-mcp"],"env":{"GOOGLE_OAUTH_CREDENTIALS":"/home/node/.openclaw/credentials/gcp-oauth.keys.json","GOOGLE_CALENDAR_MCP_TOKEN_PATH":"/home/node/.openclaw/tokens/google-calendar-token.json"}}'

# ── 6. Crear agente luxury-horizon si no existe ───────────────────────────────
echo ""
AGENT_DIR="openclaw-config/agents/luxury-horizon/agent"

if [ -d "$AGENT_DIR" ] && [ "$(ls -A $AGENT_DIR 2>/dev/null)" ]; then
  echo "✓ Agente luxury-horizon ya existe"
else
  echo "🤖 Creando agente luxury-horizon..."
  mkdir -p "$AGENT_DIR"
  cp agents/luxury-horizon/SOUL.md     "$AGENT_DIR/"
  cp agents/luxury-horizon/IDENTITY.md "$AGENT_DIR/"
  cp agents/luxury-horizon/USER.md     "$AGENT_DIR/"
  cp agents/luxury-horizon/AGENTS.md   "$AGENT_DIR/"

  # Workspace dedicado del agente
  cp agents/luxury-horizon/SOUL.md     openclaw-workspace-luxury-horizon/
  cp agents/luxury-horizon/IDENTITY.md openclaw-workspace-luxury-horizon/
  cp agents/luxury-horizon/USER.md     openclaw-workspace-luxury-horizon/
  cp agents/luxury-horizon/AGENTS.md   openclaw-workspace-luxury-horizon/

  # Copiar auth-profiles del agente principal
  if [ -f "openclaw-config/agents/main/agent/auth-profiles.json" ]; then
    cp openclaw-config/agents/main/agent/auth-profiles.json "$AGENT_DIR/"
  fi

  echo "✓ Archivos del agente copiados"

  # Registrar agente y binding en openclaw.json
  python3 - <<PYEOF
import json

with open('openclaw-config/openclaw.json') as f:
    cfg = json.load(f)

# Agente
agents_list = cfg.setdefault('agents', {}).setdefault('list', [])
if not any(a.get('id') == 'luxury-horizon' for a in agents_list):
    agents_list.append({
        "id": "luxury-horizon",
        "agentDir": "/home/node/.openclaw/agents/luxury-horizon/agent",
        "workspace": "/home/node/.openclaw/workspace-luxury-horizon"
    })

# Binding al canal WhatsApp
bindings = cfg.setdefault('bindings', [])
if not any(b.get('agentId') == 'luxury-horizon' for b in bindings):
    bindings.append({
        "agentId": "luxury-horizon",
        "match": {"channel": "whatsapp"}
    })

# Allowlist WhatsApp
cfg.setdefault('channels', {}).setdefault('whatsapp', {}).update({
    "dmPolicy": "allowlist",
    "allowFrom": ["+573126322306"],
    "enabled": True
})

with open('openclaw-config/openclaw.json', 'w') as f:
    json.dump(cfg, f, indent=2)

print("✓ Agente y binding registrados en openclaw.json")
PYEOF
fi

# ── 7. Reinicio final ─────────────────────────────────────────────────────────
echo ""
echo "🚀 Reiniciando gateway..."
docker compose restart openclaw-gateway

echo ""
echo "==================================="
echo "✅ Setup completado."
echo ""
echo "Próximos pasos:"
echo "  1. Vincula WhatsApp: docker compose run --rm openclaw-cli channels login --channel whatsapp"
echo "  2. Accede al dashboard: http://localhost:18789"
echo "==================================="
EOF

chmod +x /Users/ederbarrios/Projects/luxuryhorizon/Openclaw/setup.sh