# Run Revzenta CRM locally — beginner guide

This is the plain-English version of the README's quick start. No experience needed —
follow one step at a time, in order.

---

## One-time: install Bun (the only thing you install)

1. **Open the Terminal app.** On a Mac: press `Cmd + Space`, type `Terminal`, press `Enter`.
2. **Type this and press Enter:**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
3. When it finishes, **close Terminal and open it again** (so the computer notices Bun is there).

You only do the three steps above once, ever.

---

## Every time you want to run the app

4. **Get the code onto your computer** (first time only). In Terminal, type and press Enter:
   ```bash
   git clone https://github.com/higherpowerc/Revzenta-CRM.git
   ```
   You'll now have a folder called `Revzenta-CRM`.

5. **Step into the folder.** Type and press Enter:
   ```bash
   cd Revzenta-CRM
   ```
   You'll do this step every time before running.

6. **Install the app's pieces** (first time only). Type and press Enter:
   ```bash
   bun install
   ```
   This prints a list of packages and takes a few seconds.

7. **Create your login file.** Type and press Enter:
   ```bash
   cp .env.example .env
   ```
   (Nothing visibly happens — that's correct.)

8. **Set your admin email + password.** Type and press Enter:
   ```bash
   nano .env
   ```
   This opens a text editor. Find the two lines:
   ```
   ADMIN_EMAIL=owner@elevate.studio
   ADMIN_PASSWORD=change-me-to-a-strong-password
   ```
   Change the email to yours and the password to anything (at least 8 characters). Then:
   - Press `Ctrl + O`, then `Enter` (this saves)
   - Press `Ctrl + X` (this closes)

9. **Build the app.** Type and press Enter:
   ```bash
   bun run build
   ```
   It should end with something like `build rc=0` — that means it worked.

10. **Start the app.** Type and press Enter:
    ```bash
    bun run start:local
    ```
    You'll see a line ending in `listening on http://localhost:3001`. Leave Terminal open.

11. **Open it in your browser.** Go to **http://localhost:3001**.

12. **Log in** with the email and password you set in step 8.

---

**To stop the app later:** go back to Terminal and press `Ctrl + C`.

> **Note:** the app must use port `3001` locally — port `3000` is the live agency site and must never be used. The `start:local` script sets this for you automatically.
