FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy site files
COPY biolink/     /usr/share/nginx/html/biolink/
COPY website/     /usr/share/nginx/html/website/
COPY robots.txt   /usr/share/nginx/html/robots.txt
COPY sitemap.xml  /usr/share/nginx/html/sitemap.xml

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
