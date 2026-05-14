#!/bin/bash
set -e

set -a
source .env
set +a

PROVIDER=${AI_PROVIDER:-openrouter}
PROVIDER_FILE="providers/$PROVIDER.json"

if [ ! -f "$PROVIDER_FILE" ]; then
  echo "❌ Provider config not found: $PROVIDER_FILE"
  echo "   Available: $(ls providers/*.json | xargs -n1 basename | sed 's/.json//' | tr '\n' ' ')"
  exit 1
fi

echo "🔄 Switching to provider: $PROVIDER"
[ -n "$AI_MODEL" ] && echo "   Model: $AI_MODEL"

python3 - <<PYEOF
import json, os

with open('openclaw-config/openclaw.json') as f:
    current = json.load(f)

with open('$PROVIDER_FILE') as f:
    provider_cfg = json.load(f)

def deep_merge(base, override):
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result

merged = deep_merge(current, provider_cfg)

# Override model from .env if AI_MODEL is set
ai_model = os.environ.get('AI_MODEL', '').strip()
if ai_model:
    merged['agents']['defaults']['model'] = {'primary': ai_model}
    merged['agents']['defaults'].setdefault('models', {})[ai_model] = {}

with open('openclaw-config/openclaw.json', 'w') as f:
    json.dump(merged, f, indent=2)

# Update auth-profiles.json
auth_file = 'openclaw-config/agents/main/agent/auth-profiles.json'
with open(auth_file) as f:
    auth = json.load(f)

key_map = {
    'openrouter': ('OPENROUTER_API_KEY', 'openrouter:default', 'openrouter'),
    'gemini':     ('GEMINI_API_KEY',     'google:default',     'google'),
    'claude':     ('ANTHROPIC_API_KEY',  'anthropic:default',  'anthropic'),
    'groq':       ('GROQ_API_KEY',       'groq:default',       'groq'),
}

provider = '$PROVIDER'
if provider in key_map:
    env_var, profile_key, provider_name = key_map[provider]
    api_key = os.environ.get(env_var, '')
    if api_key:
        auth.setdefault('profiles', {})[profile_key] = {
            'type': 'api_key',
            'provider': provider_name,
            'key': api_key
        }
        with open(auth_file, 'w') as f:
            json.dump(auth, f, indent=2)
        print(f"✓ Auth profile updated for: {provider}")
    else:
        print(f"⚠ Warning: {env_var} not set in .env")

print(f"✓ Config updated for: {provider}")
PYEOF

docker compose restart openclaw-gateway
echo "✓ Gateway restarted with provider: $PROVIDER"
