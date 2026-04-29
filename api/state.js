import { kv } from "@vercel/kv";

const KEY = "wc16:sharedState:v1";
const META_KEY = "wc16:sharedStateMeta:v1";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

function getOwnerPinFromRequest(req, body) {
  const headerPin =
    req.headers["x-owner-pin"] ??
    req.headers["x-owner-token"] ??
    req.headers["x-owner"] ??
    null;

  if (typeof headerPin === "string" && headerPin.trim()) return headerPin.trim();
  if (body && typeof body.ownerPin === "string" && body.ownerPin.trim()) return body.ownerPin.trim();
  return null;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return null;
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  noStore(res);

  if (req.method === "GET") {
    const [state, meta] = await kv.mget(KEY, META_KEY);
    return json(res, 200, {
      ok: true,
      state: state ?? null,
      rev: meta?.rev ?? 0,
      updatedAt: meta?.updatedAt ?? null,
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const ownerPinEnv = (process.env.OWNER_PIN ?? "").toString();
  if (!ownerPinEnv) return json(res, 500, { ok: false, error: "OWNER_PIN not configured" });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }

  const ownerPin = getOwnerPinFromRequest(req, body);
  if (!ownerPin || ownerPin !== ownerPinEnv) return json(res, 401, { ok: false, error: "Unauthorized" });

  if (body?.op === "verify") {
    return json(res, 200, { ok: true });
  }

  const state = body?.state ?? null;
  if (!state || typeof state !== "object") return json(res, 400, { ok: false, error: "Missing state" });

  const incomingRev = Number(body?.rev ?? 0) || 0;
  const meta = (await kv.get(META_KEY)) ?? { rev: 0, updatedAt: null };
  const currentRev = Number(meta?.rev ?? 0) || 0;

  // Basic lost-update protection: allow overwrite if client is up-to-date.
  if (incomingRev && incomingRev !== currentRev) {
    return json(res, 409, { ok: false, error: "Revision conflict", rev: currentRev, updatedAt: meta?.updatedAt ?? null });
  }

  const nextRev = currentRev + 1;
  const updatedAt = new Date().toISOString();

  await kv.mset(
    KEY,
    state,
    META_KEY,
    {
      rev: nextRev,
      updatedAt,
    },
  );

  return json(res, 200, { ok: true, rev: nextRev, updatedAt });
}

