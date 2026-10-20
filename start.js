// One command to run everything: node start.js  (or npm start)
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const dirs = { server: join(root, "server"), client: join(root, "client") };
const tool = { server: "nodemon", client: "vite" };

const keyFile = join(dirs.server, "firebase-service-account.json");
if (!existsSync(keyFile)) {
  // Firebase saves the key as <project>-firebase-adminsdk-xxxx.json. If it's in Downloads, use it.
  const downloads = join(homedir(), "Downloads");
  try {
    const found = readdirSync(downloads)
      .filter(f => /firebase-adminsdk.*\.json$/i.test(f) && f.toLowerCase().includes("morrow-notes-app"))
      .map(f => ({ f, t: statSync(join(downloads, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)[0];
    if (found) {
      copyFileSync(join(downloads, found.f), keyFile);
      console.log(`\nFound ${found.f} in Downloads and copied it to server/firebase-service-account.json\n`);
    }
  } catch {}
}
if (!existsSync(keyFile))
  console.warn("\n⚠  server/firebase-service-account.json is missing. Download it from Firebase (Project settings > Service accounts > Generate new private key), put it in your Downloads folder and run npm start again.\n");

// ---- Database: make sure server/.env points at MongoDB Atlas, asking for the password once ----
const ATLAS_HOST = "cluster-morrow-notes.vmiegno.mongodb.net";
const ATLAS_USER = "raghavmalodia12_db_user";
const envFile = join(dirs.server, ".env");
const readEnv = () => (existsSync(envFile) ? readFileSync(envFile, "utf8") : "");
function setEnv(key, value) {
  let text = readEnv();
  const line = `${key}=${value}`;
  text = new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), () => line) : text + (text && !text.endsWith("\n") ? "\n" : "") + line + "\n";
  writeFileSync(envFile, text);
}
const currentUri = (readEnv().match(/^MONGODB_URI=(.*)$/m) || [])[1]?.trim() || "";
const needsPassword = !currentUri || /<db_password>|YOUR_PASSWORD|127\.0\.0\.1|localhost/.test(currentUri);
if (needsPassword) {
  if (!process.stdin.isTTY) {
    console.warn("\n⚠  MONGODB_URI in server/.env is not set up. Run npm start in a terminal to enter your Atlas password.\n");
  } else {
    console.log(`\nDatabase setup: enter the password for the Atlas user "${ATLAS_USER}".`);
    console.log("(Atlas > Security > Database Access > Edit > Edit Password, if you don't have it. Typing is hidden.)\n");
    const password = await askHidden("Atlas password: ");
    if (password) {
      const uri = `mongodb+srv://${ATLAS_USER}:${encodeURIComponent(password)}@${ATLAS_HOST}/morrow_notes?retryWrites=true&w=majority&appName=cluster-morrow-notes`;
      setEnv("MONGODB_URI", uri);
      if (!/^PORT=/m.test(readEnv())) setEnv("PORT", "5002");
      if (!/^CLIENT_ORIGINS=/m.test(readEnv())) setEnv("CLIENT_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173");
      console.log("\nSaved to server/.env\n");
    }
  }
}
function askHidden(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let value = "";
    process.stdout.write(prompt);
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\u0003") { process.stdout.write("\n"); process.exit(); }
        if (c === "\r" || c === "\n") { stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); process.stdout.write("\n"); return resolve(value.trim()); }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1); else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

function missingDeps(cwd) {
  const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(d => !existsSync(join(cwd, "node_modules", d, "package.json")));
}

// Install whenever any package listed in package.json is missing (first run, or after an update adds new ones).
function needsInstall(name, cwd) {
  if (!existsSync(join(cwd, "node_modules", ".bin", tool[name]))) return true;
  const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some(dep => !existsSync(join(cwd, "node_modules", dep)));
}

for (const [name, cwd] of Object.entries(dirs)) {
  if (needsInstall(name, cwd)) {
    console.log(`Installing ${name} packages...`);
    const r = spawnSync(npm, ["install"], { cwd, stdio: "inherit", shell: isWin });
    if (r.status !== 0) { console.error(`npm install failed in ${name}`); process.exit(1); }
  }
}

const procs = Object.entries(dirs).map(([name, cwd]) => {
  const p = spawn(npm, ["run", "dev"], { cwd, stdio: "inherit", shell: isWin });
  p.on("exit", (code) => { console.log(`${name} stopped (${code})`); shutdown(); });
  return p;
});
function shutdown() { procs.forEach((p) => { try { p.kill(); } catch {} }); process.exit(); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
console.log("\nStarting backend and frontend. Open http://localhost:5173  (Ctrl+C to stop)\n");
