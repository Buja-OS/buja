# Buja on Render (or any Docker host): PHP 8.3 + Apache, same layout as cPanel.
# The routing and security rules that live in .htaccess on cPanel are baked into Apache here,
# so this image works even if the .htaccess files are absent from the repository.
FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql && a2enmod rewrite headers

# Render gives the port in $PORT (default 10000); make Apache listen there.
ENV PORT=10000
RUN sed -i 's/Listen 80/Listen ${PORT}/' /etc/apache2/ports.conf \
 && sed -i 's/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/' /etc/apache2/sites-available/000-default.conf

# App rules: HTTPS behind the proxy, app shell fallback, /api front controller, config blocked, headers.
RUN printf '%s\n' \
 '<Directory /var/www/html>' \
 '  Options -Indexes' \
 '  AllowOverride All' \
 '  RewriteEngine On' \
 '  RewriteCond %{HTTP:X-Forwarded-Proto} =http' \
 '  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]' \
 '  RewriteRule ^p(/.*)?$ p/index.php [QSA,L]' \
 '  RewriteRule ^sitemap\.xml$ p/index.php?path=sitemap [L]' \
 '  RewriteRule ^robots\.txt$ p/index.php?path=robots [L]' \
 '  RewriteCond %{REQUEST_FILENAME} !-f' \
 '  RewriteCond %{REQUEST_FILENAME} !-d' \
 '  RewriteRule ^ index.html [L]' \
 '</Directory>' \
 '<Directory /var/www/html/api>' \
 '  RewriteEngine On' \
 '  RewriteBase /api/' \
 '  RewriteCond %{REQUEST_FILENAME} !-f' \
 '  RewriteRule ^ index.php [QSA,L]' \
 '  <FilesMatch "^(config\.php|config\.sample\.php|routes\.php)$">' \
 '    Require all denied' \
 '  </FilesMatch>' \
 '</Directory>' \
 'Header set X-Content-Type-Options "nosniff"' \
 'Header set X-Frame-Options "SAMEORIGIN"' \
 'Header set Referrer-Policy "strict-origin-when-cross-origin"' \
 '<FilesMatch "\.(html|webmanifest|css|js)$">' \
 '  Header set Cache-Control "no-cache"' \
 '</FilesMatch>' \
 '<FilesMatch "\.(svg|woff2|png|jpg|webp)$">' \
 '  Header set Cache-Control "public, max-age=604800"' \
 '</FilesMatch>' \
 '<FilesMatch "^sw\.js$">' \
 '  Header set Cache-Control "no-cache"' \
 '  Header set Service-Worker-Allowed "/"' \
 '</FilesMatch>' \
 'AddType application/manifest+json .webmanifest' \
 'AddType image/svg+xml .svg' \
 > /etc/apache2/conf-available/buja.conf && a2enconf buja

COPY public_html/ /var/www/html/

# No file manager on Render: config.php is the sample, which reads environment variables.
RUN cp /var/www/html/api/config.sample.php /var/www/html/api/config.php \
 && chown -R www-data:www-data /var/www/html

EXPOSE 10000
