# Buja Phase 1: putting it on your hosting

Everything here is done in a browser through cPanel. No command line.
Time needed: about 20 minutes the first time.

## What is in the zip

```
public_html/        the whole app: upload this folder's CONTENTS to your web root
  index.html        app shell
  manifest.webmanifest, sw.js, offline.html
  css/  js/  assets/
  api/              PHP backend (config.sample.php inside: you will copy and edit it)
  .htaccess         HTTPS redirect, routing, cache and security headers
migrations/001_init.sql   creates the database tables
DEPLOY.md          this guide
README.md          what Phase 1 contains and how the code is organised
```

## Step 1: create the database (cPanel > MySQL Databases)

1. Under **Create New Database**, type `buja` and click **Create Database**. cPanel will name it something like `yourname_buja`. Write that full name down.
2. Under **MySQL Users**, create a user called `buja` with a strong password (use the generator). Write the full username (`yourname_buja`) and password down.
3. Under **Add User To Database**, pick the user and the database, click **Add**, tick **ALL PRIVILEGES**, click **Make Changes**.

## Step 2: create the tables (cPanel > phpMyAdmin)

1. Open phpMyAdmin and click your `yourname_buja` database in the left column.
2. Click the **SQL** tab at the top.
3. Open `migrations/001_init.sql` from the zip in Notepad or any text editor, copy everything, paste it into the SQL box, click **Go**.
4. You should see three tables appear on the left: `users`, `sessions`, `rate_limits`.

## Step 3: upload the files (cPanel > File Manager)

1. Open File Manager and go into `public_html`. If a placeholder `index.html` or `default.html` is there, delete it.
2. Click **Upload**, choose `buja-phase1.zip` from your computer, wait for 100%.
3. Back in File Manager, right-click the zip, choose **Extract**, and extract it right there.
4. You will now have a folder called `public_html` inside `public_html`. Open it, select all its contents (Select All), click **Move**, and set the destination to `/public_html`. Then delete the now-empty inner `public_html` folder and the zip.
5. Turn on hidden files if you cannot see `.htaccess`: Settings (top right) > tick **Show Hidden Files (dotfiles)**.

## Step 4: configure the API

1. In File Manager open `public_html/api`.
2. Right-click `config.sample.php` > **Copy** > name it `config.php`.
3. Right-click `config.php` > **Edit**. Fill in:
   - `dbname=` the database name from Step 1, and the user and password.
   - `jwt_secret`: a long random string. Easiest: go to https://generate-secret.vercel.app/64 and paste the result.
   - `app_origin`: your site, for example `https://buja.ng`, no trailing slash.
   - `google_client_id`: leave empty for now (Step 6).
4. Save.

## Step 5: check it works

1. Visit `https://yourdomain.com/api/health` in a browser. You should see `{"ok":true,...,"db":"ok",...}`.
   - `db: unreachable` means Step 1 or Step 4 has a typo in the database name, user or password.
   - A blank page or 500 means `config.php` is missing or has a syntax error (a missing quote or comma).
2. Visit `https://yourdomain.com/`. You should see the Buja welcome screen. Create an account, choose a district, land on Home. That account is now in your real database (phpMyAdmin > users).
3. On your phone, open the site in Chrome, tap the menu, **Add to Home screen**. It installs as an app.

## Step 6: Google sign-in (optional in Phase 1)

1. Go to https://console.cloud.google.com, create a project called Buja.
2. **APIs & Services > OAuth consent screen**: External, app name Buja, your email, save.
3. **APIs & Services > Credentials > Create Credentials > OAuth client ID > Web application**.
   - Authorised JavaScript origins: `https://yourdomain.com`
   - Save, copy the **Client ID** (ends in `.apps.googleusercontent.com`).
4. Paste it into `api/config.php` as `google_client_id`.
5. Edit `public_html/index.html` and add this line inside `<head>`:
   `<meta name="google-client-id" content="PASTE-YOUR-CLIENT-ID-HERE">`
6. Reload the site. Continue with Google now opens the Google chooser.

## If something breaks

- **Everything shows "Preview mode"**: the app could not reach `/api/health`. Check Step 5 point 1.
- **Sign in works on the computer but not the phone**: make sure you are on `https://`. Cookies are HTTPS-only.
- **"Too many attempts"**: the rate limiter. Wait 15 minutes, or in phpMyAdmin empty the `rate_limits` table.
- Send me a screenshot of the error and the URL you were on, and I will diagnose from that.

## Updating to the next phase

Each phase ships a new zip plus a new numbered SQL file (002, 003...). Upload and extract the zip the same way (it only replaces files it contains, your `config.php` is never in the zip), then run the new SQL file in phpMyAdmin. Bump `VERSION` in `sw.js` is done for you in each zip.
