#!/bin/bash
# Usage: ./clear-session.sh +573153828958
#        ./clear-session.sh all

set -e

SESSIONS_FILE="openclaw-config/agents/luxury-horizon/sessions/sessions.json"

if [ ! -f "$SESSIONS_FILE" ]; then
  echo "No hay sesiones guardadas."
  exit 0
fi

if [ "$1" = "all" ]; then
  echo "{}" > "$SESSIONS_FILE"
  echo "✓ Todas las sesiones eliminadas"
elif [ -n "$1" ]; then
  PHONE="$1"
  SESSION_KEY="agent:luxury-horizon:whatsapp:direct:$PHONE"
  python3 - <<PYEOF
import json

with open('$SESSIONS_FILE') as f:
    sessions = json.load(f)

if '$SESSION_KEY' in sessions:
    del sessions['$SESSION_KEY']
    with open('$SESSIONS_FILE', 'w') as f:
        json.dump(sessions, f, indent=2)
    print("✓ Sesión eliminada para $PHONE")
else:
    print("No se encontró sesión para $PHONE")
    print("Sesiones activas:", list(sessions.keys()))
PYEOF
else
  echo "Uso:"
  echo "  ./clear-session.sh +573153828958   — borra sesión de un número"
  echo "  ./clear-session.sh all             — borra todas las sesiones"
  echo ""
  echo "Sesiones activas:"
  python3 -c "
import json
with open('$SESSIONS_FILE') as f:
    s = json.load(f)
for k in s.keys():
    print(' -', k)
"
fi
