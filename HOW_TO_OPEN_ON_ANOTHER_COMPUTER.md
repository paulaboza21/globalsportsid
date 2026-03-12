# How To Open This App On Another Computer

## 1. Install the tools

Install:
- Node.js
- VS Code

Optional for Android testing:
- Android Studio

## 2. Get the project files

Use one of these options:

### Option A: GitHub

Clone the repo:

```bash
git clone https://github.com/paulaboza21/globalsportsid.git
```

### Option B: USB backup

Copy this folder to the other computer:

`C:\Global\GlobalSportsID-FullBackup`

## 3. Open the project in VS Code

Open the app folder in VS Code.

## 4. Make sure `.env` exists

- If you used the USB backup, `.env` should already be there.
- If you used GitHub, create a `.env` file and add your real Supabase values.

You can use `.env.example` as the guide.

## 5. Install packages

Open the terminal in VS Code and run:

```bash
npm install
```

## 6. Start the app

Run:

```bash
npx expo start -c
```

## 7. Open the app

After Expo starts:

- Press `w` for web
- Press `a` for Android emulator

## 8. Edit the app

Edit the files normally in VS Code and save your changes.

## 9. Save your new changes

Run:

```bash
git add .
git commit -m "backup"
git push
```

## Notes

- Keep `.env` private.
- Do not upload `.env` publicly.
- Keep both GitHub and USB backups updated.
