#!/bin/bash
# Uso: ./add-influencer.sh alejandra
# Obtiene el certificado SSL para el subdominio del influencer

set -e

NAME=$1
DOMAIN="${NAME}.luxuryhorizon.lat"
EMAIL="ederb1.1c@gmail.com"

if [ -z "$NAME" ]; then
  echo "Uso: ./add-influencer.sh <nombre>"
  echo "Ejemplo: ./add-influencer.sh alejandra"
  exit 1
fi

echo "==> Parando nginx brevemente (~30 seg)..."
docker compose stop website

echo "==> Obteniendo certificado SSL para $DOMAIN..."
docker run --rm \
  -p 80:80 \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --standalone \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo "==> Reiniciando nginx con el nuevo certificado..."
docker compose up -d --build

echo ""
echo "Listo! Visita https://$DOMAIN"
