# Morrow Notes — MERN Notes with Firebase Google Login

This version keeps the existing notes workspace design and adds Firebase Google sign-in, per-user note ownership, profile settings, theme preference, and avatar uploads.

## Requirements

- Node.js 18 or newer
- MongoDB (local) or MongoDB Atlas
- A Firebase project with a registered Web app
- Google provider enabled in Firebase Authentication

## 1. Configure MongoDB

Copy `server/.env.example` to `server/.env`.

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and set `MONGODB_URI` to your local MongoDB connection string or Atlas connection string. Keep this file private.

## 2. Configure Firebase Web Authentication

1. Open the Firebase Console and create/select your project.
2. In Project settings, add/register a Web app.
3. Copy the Web app configuration values.
4. In Authentication → Sign-in method, enable **Google**.
5. In Authentication → Settings / Authorized domains, ensure `localhost` is listed for local development.

Copy `client/.env.example` to `client/.env` and fill in the Firebase Web app values:

```bash
cd client
cp .env.example .env
```

The `VITE_FIREBASE_*` values are the Web app configuration. Do not put a Firebase Admin private key in the client folder.

## 3. Configure Firebase Admin for the backend

1. In Firebase Console → Project settings → Service accounts, generate a new private key.
2. Save the downloaded JSON as `server/firebase-service-account.json`.
3. Never share this file or commit it to Git. It is excluded by `.gitignore`.

Alternatively, set `FIREBASE_SERVICE_ACCOUNT_PATH` in `server/.env` to the path of the service-account JSON file.

## 4. Install and start the backend

From the project root:

```bash
cd server
npm install
npm run dev
```

The API should be available at `http://localhost:5002`. Check `http://localhost:5002/api/health` to see whether MongoDB is connected.

## 5. Install and start the frontend

Open a second terminal from the project root:

```bash
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Features

- Google sign-in and sign-out through Firebase Authentication
- Backend validates Firebase ID tokens for profile and notes endpoints
- Notes are filtered and modified by the verified Firebase UID
- Account switching clears the previous account's notes from the UI and ignores stale account responses
- Profile display name and theme preference stored in MongoDB
- Avatar upload accepts JPG, PNG, WEBP, or GIF files up to 10 MB
- Existing note search, colors, create/edit/delete flows, and layout retained

## Important notes

- Existing notes created before authentication have no `ownerUid`, so they will not appear in a signed-in account. They are not automatically assigned to a user because doing so without an explicit owner could expose private data. Back up your database before any migration.
- Avatar files are stored locally in `server/src/uploads/avatars`. This is suitable for local development; ephemeral hosting requires persistent file storage or a cloud object store.
- Before exposing this app publicly, configure production CORS origins, HTTPS, persistent avatar storage, and secure environment-variable handling.
- Keep `server/.env`, `client/.env`, and `server/firebase-service-account.json` private.
