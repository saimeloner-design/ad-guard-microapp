#!/usr/bin/env node
// Vigila el deploy en Vercel de la rama actual y avisa con terminal-notifier.
// `main` → producción; `develop` → desarrollo (Preview con dominio fijo).
//
//   node scripts/notify-deploy.mjs           espera el deploy del commit HEAD
//   node scripts/notify-deploy.mjs --watch   avisa de cada deploy de la rama, sin terminar
//
// Credenciales: VERCEL_TOKEN o, si no está, la sesión del CLI de Vercel (`vercel login`).

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SITE_URLS = {
  main: "https://ad-guard-microapp.vercel.app",
  develop: "https://ad-guard-microapp-dev.vercel.app",
};
const POLL_MS = 5_000;
const TIMEOUT_MS = 20 * 60_000;
const AUTH_FILE = join(homedir(), "Library/Application Support/com.vercel.cli/auth.json");

const watch = process.argv.includes("--watch");
const root = new URL("..", import.meta.url).pathname;
const { projectId, orgId } = JSON.parse(readFileSync(join(root, ".vercel/project.json"), "utf8"));
const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const isProd = branch === "main";
const SITE_URL = SITE_URLS[branch] ?? SITE_URLS.develop;
const LABEL = isProd ? "producción" : "desarrollo";

function readToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const auth = JSON.parse(readFileSync(AUTH_FILE, "utf8"));
  // El token del CLI caduca; `vercel whoami` lo renueva con el refresh token.
  if (auth.expiresAt && auth.expiresAt * 1000 < Date.now() + 60_000) {
    execFileSync("vercel", ["whoami"], { stdio: "ignore" });
    return JSON.parse(readFileSync(AUTH_FILE, "utf8")).token;
  }
  return auth.token;
}

let token = readToken();

async function listDeployments() {
  const url = new URL("https://api.vercel.com/v6/deployments");
  url.search = new URLSearchParams({ projectId, teamId: orgId, target: isProd ? "production" : "preview", limit: "20" });
  let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) {
    if (!process.env.VERCEL_TOKEN) execFileSync("vercel", ["whoami"], { stdio: "ignore" });
    token = readToken();
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }
  if (!res.ok) throw new Error(`Vercel API ${res.status}: ${await res.text()}`);
  return (await res.json()).deployments.filter((d) => d.meta?.githubCommitRef === branch);
}

function notify({ title, message, open, sound }) {
  const r = spawnSync("terminal-notifier", [
    "-title", title, "-message", message, "-open", open, "-sound", sound, "-group", "ad-guard-deploy",
  ]);
  if (r.error) console.error("No se pudo ejecutar terminal-notifier:", r.error.message);
}

function report(d) {
  const sha = d.meta?.githubCommitSha?.slice(0, 7) ?? "?";
  const msg = d.meta?.githubCommitMessage?.split("\n")[0] ?? d.url;
  if (d.state === "READY") {
    console.log(`✅ Deploy listo (${sha}): ${msg}`);
    notify({ title: `✅ Deploy en ${LABEL}`, message: `${sha} · ${msg}`, open: SITE_URL, sound: "Glass" });
  } else {
    console.log(`❌ Deploy ${d.state} (${sha}): ${msg}`);
    notify({ title: `❌ Deploy ${d.state}`, message: `${sha} · ${msg}`, open: d.inspectorUrl, sound: "Basso" });
  }
}

const FINAL = new Set(["READY", "ERROR", "CANCELED"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHead() {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  console.log(`Esperando el deploy de ${LABEL} de ${sha.slice(0, 7)}…`);
  const deadline = Date.now() + TIMEOUT_MS;
  let lastState;
  while (Date.now() < deadline) {
    const d = (await listDeployments()).find((x) => x.meta?.githubCommitSha === sha);
    if (d && d.state !== lastState) console.log(`  estado: ${(lastState = d.state)}`);
    if (d && FINAL.has(d.state)) return report(d);
    await sleep(POLL_MS);
  }
  console.log("⏱️ Tiempo de espera agotado");
  notify({ title: "⏱️ Deploy sin terminar", message: `${sha.slice(0, 7)} tras 20 min`, open: SITE_URL, sound: "Basso" });
  process.exitCode = 1;
}

async function watchAll() {
  // Los deploys que ya habían terminado al arrancar no se notifican.
  const seen = new Set((await listDeployments()).filter((d) => FINAL.has(d.state)).map((d) => d.uid));
  console.log(`Vigilando deploys de ${LABEL} (Ctrl+C para salir)…`);
  for (;;) {
    await sleep(POLL_MS);
    try {
      for (const d of await listDeployments()) {
        if (FINAL.has(d.state) && !seen.has(d.uid)) {
          seen.add(d.uid);
          report(d);
        }
      }
    } catch (e) {
      console.error(e.message);
    }
  }
}

await (watch ? watchAll() : waitForHead());
