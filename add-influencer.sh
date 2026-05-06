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

echo "==> Actualizando nginx.conf..."
# Agregar subdominio al bloque HTTP si no está ya
if ! grep -q "$DOMAIN" nginx.conf; then
  # Añadir al server_name del bloque HTTP
  sed -i "s/server_name luxuryhorizon.lat\(.*\);/server_name luxuryhorizon.lat\1 $DOMAIN;/" nginx.conf

  # Agregar bloque HTTPS al final del archivo
  cat >> nginx.conf <<NGINX

# ── HTTPS: Influencer — $NAME ────────────────────────────────────────────────
server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    root /usr/share/nginx/html/website/influencers/$NAME;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }
}
NGINX

  echo "    Bloque nginx agregado para $DOMAIN"
else
  echo "    $DOMAIN ya existe en nginx.conf, no se modifica"
fi

echo "==> Reiniciando nginx con el nuevo certificado..."
docker compose up -d --build

echo ""
echo "Listo! Visita https://$DOMAIN"
