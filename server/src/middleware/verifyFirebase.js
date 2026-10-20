import admin from "firebase-admin";
import { readFileSync } from "node:fs";

export function ensureFirebaseAdmin() {
  if (admin.apps.length) return;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (error) {
    throw new Error(`Firebase Admin setup failed. Add server/firebase-service-account.json or set FIREBASE_SERVICE_ACCOUNT_PATH. ${error.message}`);
  }
}

export async function verifyFirebase(req, res, next) {
  try {
    if (!admin.apps.length) ensureFirebaseAdmin();
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: "The server isn't connected to Firebase yet. Add server/firebase-service-account.json for this project and restart." });
  }
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ message: "Sign in to continue." });
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.user = { uid: decoded.uid, email: decoded.email || "", name: decoded.name || "", picture: decoded.picture || "" };
    next();
  } catch (error) {
    console.error("Authentication failed:", error.message);
    const wrongProject = /aud|audience|project/i.test(error.message);
    res.status(401).json({ message: wrongProject
      ? "The server's Firebase key is from a different project than the app. Download a new key from the morrow-notes-app project and restart."
      : "Your session could not be verified. Please sign in again." });
  }
}
