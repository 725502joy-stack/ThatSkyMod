import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = "Assets";
const OUT_FILE = `${ASSETS_DIR}/manifest.json`;
const REPO = process.env.GITHUB_REPOSITORY || "XeTrinityz/ThatSkyMod";
const API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const MAX_HISTORY_SCAN = 50;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full.split("\\").join("/"));
  }
  return files;
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function api(path) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "thatskymod-manifest-generator",
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, { headers });
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
    throw new Error(
      `GitHub API rate limit exhausted (resets ${new Date(reset).toISOString()}). ` +
        "Set GITHUB_TOKEN to raise the limit.",
    );
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res.json();
}

async function commitsForPath(path) {
  const out = [];
  const encoded = encodePath(path);
  for (let page = 1; ; page += 1) {
    const batch = await api(`/repos/${REPO}/commits?path=${encoded}&per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100 || out.length >= 1000) break;
  }
  return out;
}

const displayNameCache = new Map();
async function displayName(login) {
  if (!login) return null;
  if (displayNameCache.has(login)) return displayNameCache.get(login);
  let name = login;
  try {
    const user = await api(`/users/${encodeURIComponent(login)}`);
    if (user && typeof user.name === "string" && user.name.trim()) name = user.name.trim();
  } catch {
    /* profile unavailable — fall back to the login */
  }
  displayNameCache.set(login, name);
  return name;
}

async function creatingCommit(path, commits) {
  const scan = Math.min(commits.length, MAX_HISTORY_SCAN);
  for (let i = 0; i < scan; i += 1) {
    const detail = await api(`/repos/${REPO}/commits/${commits[i].sha}`);
    const file = (detail.files || []).find(
      (f) => f.filename === path || f.previous_filename === path,
    );
    if (file && (file.status === "added" || file.status === "renamed")) return commits[i];
  }
  return commits[commits.length - 1] ?? null;
}

async function main() {
  let existing = {};
  if (existsSync(OUT_FILE)) {
    try {
      existing = JSON.parse(readFileSync(OUT_FILE, "utf8")).items ?? {};
    } catch {
      existing = {};
    }
  }

  const files = walk(ASSETS_DIR)
    .filter((f) => f !== OUT_FILE)
    .sort();

  const items = {};
  for (const file of files) {
    const commits = await commitsForPath(file);
    if (commits.length === 0) continue; 
    const updated = commits[0].commit.author.date;
    const addCommit = await creatingCommit(file, commits);
    if (!addCommit) continue;
    const added = addCommit.commit.author.date;

    const login = addCommit.author?.login ?? null;
    const author = login ? await displayName(login) : (addCommit.commit.author.name ?? null);

    const prev = existing[file] ?? {};
    items[file] = {
      ...(prev.description ? { description: prev.description } : {}),
      author,
      added,
      updated,
      ...(prev.rating != null ? { rating: prev.rating } : {}),
      ...(prev.rating_count != null ? { rating_count: prev.rating_count } : {}),
    };
  }

  writeFileSync(OUT_FILE, JSON.stringify({ items }, null, 2) + "\n");
  console.log(`Wrote ${OUT_FILE} with ${Object.keys(items).length} items.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
