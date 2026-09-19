# Buja on Render: the step-by-step guide

You need: a phone or laptop with a browser, your Google account, and about 30 minutes.
You do NOT need: a credit card, a domain, or a command line.

There are four websites in this story. Think of them like this:

- **GitHub** is a locker where the code files live.
- **TiDB Cloud** is a free MySQL database where user accounts are stored.
- **Render** is the computer that runs the app and gives it a web address.
- **Claude (this chat)** talks to Render for you once you connect it.

Do the parts in order. Each part ends with a "you should now see" check.

---

## Part 1: Get the files onto your computer

1. Download `buja-phase1-render.zip` from this chat.
2. Find it in Downloads. On Windows right-click it and choose **Extract All**. On a Mac double-click it.
3. You should now see a folder called `buja-phase1-render` with these inside it:
   `Dockerfile`, `render.yaml`, `.dockerignore`, `README.md`, `DEPLOY.md`, `DEPLOY-RENDER.md`, a folder `public_html`, and a folder `migrations`.

> A phone can do this too, but a laptop is easier for Part 2 because you drag folders.

---

## Part 2: Put the files in GitHub (the locker)

1. Go to **https://github.com** and click **Sign up**. Use your Google email. Pick any username, for example `azeez-buja`. Confirm the email GitHub sends you.
2. After signing in, click the green **New** button (or the **+** at the top right, then **New repository**).
3. Repository name: type `buja`. Leave it **Public** (Render's free plan needs public or a linked account; public is fine, there are no secrets in the files). Do NOT tick "Add a README". Click **Create repository**.
4. You are now on an almost empty page. Click the link that says **uploading an existing file**.
5. Open the `buja-phase1-render` folder on your computer. Select everything inside it (Ctrl+A on Windows, Cmd+A on Mac) and drag it all onto the GitHub page where it says "Drag files here". Wait until every file shows a green tick. This can take a minute because there are about 50 files.
6. Scroll down. In the box that says "Commit changes", type `Buja phase 1`. Click the green **Commit changes** button.
7. **You should now see** the file list on GitHub, including `Dockerfile` and a folder called `public_html`. If `public_html` is missing, the drag did not include the folder; repeat step 5 and make sure you selected the folder, not just the files in it.
8. Copy the address in your browser. It looks like `https://github.com/azeez-buja/buja`. Send it to me in this chat.

---

## Part 3: Create the free database (TiDB Cloud)

1. Go to **https://tidbcloud.com** and click **Sign up**. Choose **Sign up with Google**.
2. Once in, click **Create Cluster**. Choose **Serverless** (it is free). Pick the region closest to Europe, for example Frankfurt (eu-central-1). Cluster name: `buja`. Click **Create**.
3. Wait about a minute until the cluster shows as available, then click its name to open it.
4. Click the **Connect** button at the top right. A panel opens.
   - Where it says **Connect With**, choose **General**.
   - Click **Generate Password** (or **Reset Password**). Copy the password somewhere safe right now; it is only shown once.
   - The panel also shows **Host**, **Port** (4000) and **User**. Copy all three.
5. Now create the database and tables. Click **SQL Editor** (or **Chat2Query**) in the left menu.
   - Type `CREATE DATABASE buja;` and run it.
   - Then select `buja` as the current database (there is a dropdown for that), open the file `migrations/001_init.sql` from your computer in Notepad, copy everything, paste it into the editor, and run it.
6. **You should now see** three tables listed under `buja`: `users`, `sessions`, `rate_limits`.
7. Send me the **Host** and **User** in this chat. Keep the password to yourself for now; you will paste it into Render in Part 5.

---

## Part 4: Connect Render to this chat

1. Go to **https://render.com** and click **Get Started**. Sign up with Google. You may be asked to verify your email.
2. Back in this chat, click the **Render** connector card I sent earlier (or ask me to send it again) and click **Connect**. A Render window opens asking you to approve. Click **Approve**.
3. **You should now see** the card change to "Connected".

---

## Part 5: Create the app on Render (I do most of this)

1. Tell me: "Render is connected, the repo is https://github.com/YOURNAME/buja, host is ..., user is ...".
2. I will create the web service from your repo using the `Dockerfile`, set the environment variables, and start the first build. I cannot see or set your database password, so you do this one part yourself:
   - In Render, open the **buja** service, click **Environment** on the left.
   - Find `DB_PASS` and paste the TiDB password. Click **Save Changes**. Render redeploys automatically.
3. The first build takes 3 to 5 minutes. I can watch the logs from here and tell you when it is live.
4. Render gives you an address like `https://buja.onrender.com`. Tell me the exact address so I can set `APP_ORIGIN` to match it (cookies only work when this is exact).

---

## Part 6: Test it

1. Open `https://buja.onrender.com/api/health` (your address). **You should see** `{"ok":true, ... "db":"ok"}`.
   - If `db` says `unreachable`: the password in Part 5 step 2 is wrong, or Part 3 step 5 was skipped.
2. Open `https://buja.onrender.com` on your phone. Create an account, choose a district. Then open TiDB Cloud > SQL Editor and run `SELECT name, email, district FROM users;` **You should see** yourself. That is the real database.
3. On the phone, in Chrome, tap the menu and **Add to Home screen**. Buja installs as an app.

---

## Things to know about the free plan

- The app goes to sleep after 15 minutes of nobody using it. The first person to open it after that waits 30 to 60 seconds. This is fine for testing and goes away on the paid plan or on cPanel.
- Google sign-in needs Part 6 of `DEPLOY.md` (a Google client ID) plus the Render address added as an authorised origin. Do it after everything else works.
- Every time I give you a new phase, you upload the new files to GitHub the same way (drag onto the repository page, commit) and Render rebuilds by itself.

## If you get stuck

Send me a screenshot of the screen you are on and the exact address in the browser. Do not send passwords. I will tell you which step to redo.
