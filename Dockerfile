# Buja on Render (or any Docker host): PHP 8.3 + Apache, same layout as cPanel.
FROM php:8.3-apache
RUN docker-php-ext-install pdo_mysql && a2enmod rewrite headers \
 && sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf
# Render gives the port in $PORT (default 10000); make Apache listen there.
ENV PORT=10000
RUN sed -i 's/Listen 80/Listen ${PORT}/' /etc/apache2/ports.conf \
 && sed -i 's/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/' /etc/apache2/sites-available/000-default.conf
COPY public_html/ /var/www/html/
# No file manager on Render: config.php is the sample, which reads environment variables.
RUN cp /var/www/html/api/config.sample.php /var/www/html/api/config.php \
 && chown -R www-data:www-data /var/www/html
EXPOSE 10000
