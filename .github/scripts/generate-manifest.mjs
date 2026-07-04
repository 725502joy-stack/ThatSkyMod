import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = "Assets";
const OUT_FILE = `${ASSETS_DIR}/manifest.json`;

const OWNER = "XeTrinityz";
const REPO = "ThatSkyMod";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

const githubUserCache = new Map();

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full.split("\\").join("/"));
    }
  }
  return files;
}

function gitLog(path) {
  // One line per commit, newest first:
  // <sha>|<author date ISO>|<author name>|<parent hashes>
  const out = execFileSync(
    "git",
    [
      "log",
      "--follow",
      "--no-merges",
      "--format=%H|%aI|%an|%P",
      "--",
      path,
    ],
    {
      encoding: "utf8",
    },
  ).trim();

  return out
    ? out.split("\n").map((line) => {
        const [sha, date, author, parents = ""] = line.split("|");

        return {
          sha,
          date,
          author,
          parents: parents ? parents.split(" ") : [],
        };
      })
    : [];
}

export function selectContributionFromHistory(history) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry.parents.length <= 1) {
      return entry;
    }
  }

  return history[history.length - 1] ?? null;
}

function githubRequest(path) {
  if (!GITHUB_TOKEN) {
    return null;
  }

  try {
    const response = execFileSync(
      "curl",
      [
        "-fsSL",
        "-H",
        "Accept: application/vnd.github+json",
        "-H",
        `Authorization: Bearer ${GITHUB_TOKEN}`,
        `https://api.github.com${path}`,
      ],
      {
        encoding: "utf8",
      },
    );

    return JSON.parse(response);
  } catch {
    return null;
  }
}

function resolveGitHubDisplayName(commit) {
  if (!commit?.sha || !GITHUB_TOKEN) {
    return commit?.author ?? null;
  }

  const commitInfo = githubRequest(
    `/repos/${OWNER}/${REPO}/commits/${commit.sha}`,
  );

  const login = commitInfo?.author?.login;

  if (!login) {
    return commit.author;
  }

  if (githubUserCache.has(login)) {
    return githubUserCache.get(login);
  }

  const user = githubRequest(`/users/${login}`);

  const displayName = user?.name || login;

  githubUserCache.set(login, displayName);

  return displayName;
}

let existing = {};
if (existsSync(OUT_FILE)) {
  try {
    existing = JSON.parse(readFileSync(OUT_FILE, "utf8")).items ?? {};
  } catch {
    existing = {};
  }
}

const items = {};
const files = walk(ASSETS_DIR)
  .filter((f) => f !== OUT_FILE)
  .sort();

for (const file of files) {
  const log = gitLog(file);
  if (log.length === 0) continue;

  const updated = log[0].date;
  const contribution = selectContributionFromHistory(log);

  const added = contribution?.date ?? log[log.length - 1].date;
  const author = resolveGitHubDisplayName(contribution);

  const prev = existing[file] ?? {};

  items[file] = {
    ...(prev.description ? { description: prev.description } : {}),
    author: prev.author ?? author,
    added,
    updated,
    ...(prev.rating != null ? { rating: prev.rating } : {}),
    ...(prev.rating_count != null ? { rating_count: prev.rating_count } : {}),
  };
}

writeFileSync(OUT_FILE, JSON.stringify({ items }, null, 2) + "\n");
console.log(`Wrote ${OUT_FILE} with ${Object.keys(items).length} items.`);
