#!/bin/sh

WORKSPACE="/root/.openclaw/workspace"
CONTEXT_DIR="/app/Context"

mkdir -p "$WORKSPACE"

# Inyectar context-main.txt como SOUL.md (personalidad y flujo del agente)
if [ -f "$CONTEXT_DIR/context-main.txt" ]; then
  cp "$CONTEXT_DIR/context-main.txt" "$WORKSPACE/SOUL.md"
  echo "[entrypoint] SOUL.md actualizado desde context-main.txt"
fi

# Copiar el CSV de servicios al workspace para que el agente pueda referenciarlo
if [ -f "$CONTEXT_DIR/Servicios.csv" ]; then
  cp "$CONTEXT_DIR/Servicios.csv" "$WORKSPACE/servicios.csv"
  echo "[entrypoint] Servicios.csv copiado al workspace"
fi

echo "[entrypoint] Contexto cargado. Iniciando app..."
exec node src/index.js
