const STORAGE_KEY = "wc16_tracker_v1";
const OWNER_UNLOCK_KEY = "wc16_owner_unlocked_v1";

// Note: this is not secure security (PIN is in client JS). It prevents casual edits.
const OWNER_PIN = "01279";

let OWNER_UNLOCKED = false;

const EXAMPLE_TEAMS = [
  "Algarve",
  "Catalunya",
  "Fuji",
  "Hockenheimring",
  "Imola",
  "Knockhill",
  "Misano",
  "Monza",
  "Mugello",
  "Bathurst",
  "Red Bull Ring",
  "Road America",
  "Road Atlanta",
  "Sebring",
  "Spa",
  "Zandvoort",
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function makeId(prefix, index) {
  return `${prefix}_${index}`;
}

function normalizeTeamName(s) {
  return (s ?? "").toString().trim().replace(/\s+/g, " ");
}

function shuffle(array, rng = Math.random) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function encodeStateToHash(state) {
  const json = JSON.stringify(state);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `#s=${b64}`;
}

function decodeStateFromHash() {
  const m = window.location.hash.match(/(?:^|#)s=([^&]+)/);
  if (!m) return null;
  try {
    const json = decodeURIComponent(escape(atob(m[1])));
    const state = JSON.parse(json);
    return state && typeof state === "object" ? state : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state && typeof state === "object" ? state : null;
  } catch {
    return null;
  }
}

function emptyBracket() {
  const mkMatches = (count) =>
    Array.from({ length: count }, () => ({
      teams: ["", ""],
      winner: null, // 0 | 1 | null
    }));

  return {
    r16: mkMatches(8),
    qf: mkMatches(4),
    sf: mkMatches(2),
    f: mkMatches(1),
  };
}

function buildState() {
  return {
    teams: Array.from({ length: 16 }, () => ""),
    ui: {
      teamsCollapsed: false,
    },
    branding: {
      logoUrl: "./assets/clio-sof-logo.png",
      heroUrl: "./assets/clio-stats-hero.png",
    },
    bracket: emptyBracket(),
  };
}

function getDOM() {
  return {
    brandLogo: document.getElementById("brandLogo"),
    teamsCard: document.getElementById("teamsCard"),
    btnOwnerMode: document.getElementById("btnOwnerMode"),
    btnToggleTeams: document.getElementById("btnToggleTeams"),
    teamsGrid: document.getElementById("teamsGrid"),
    btnFillExample: document.getElementById("btnFillExample"),
    btnShuffleSeed: document.getElementById("btnShuffleSeed"),
    btnGenerate: document.getElementById("btnGenerate"),
    btnResetAll: document.getElementById("btnResetAll"),
    btnResetWinners: document.getElementById("btnResetWinners"),
    btnShare: document.getElementById("btnShare"),
    roundR16: document.getElementById("roundR16"),
    roundQF: document.getElementById("roundQF"),
    roundSF: document.getElementById("roundSF"),
    roundF: document.getElementById("roundF"),
    championBadge: document.getElementById("championBadge"),
    matchTemplate: document.getElementById("matchTemplate"),
  };
}

function coerceState(maybeState) {
  const base = buildState();
  if (!maybeState) return base;

  const teams = Array.isArray(maybeState.teams) ? maybeState.teams : base.teams;
  base.teams = Array.from({ length: 16 }, (_, i) => normalizeTeamName(teams[i] ?? ""));

  const ui = maybeState.ui && typeof maybeState.ui === "object" ? maybeState.ui : base.ui;
  base.ui = {
    teamsCollapsed: Boolean(ui.teamsCollapsed),
  };

  const branding =
    maybeState.branding && typeof maybeState.branding === "object" ? maybeState.branding : base.branding;
  base.branding = {
    logoUrl: (branding.logoUrl ?? "").toString().trim(),
    heroUrl: (branding.heroUrl ?? "").toString().trim(),
  };

  const b = maybeState.bracket && typeof maybeState.bracket === "object" ? maybeState.bracket : null;
  const coerceRound = (key, count) => {
    const src = b && Array.isArray(b[key]) ? b[key] : [];
    const out = Array.from({ length: count }, (_, i) => {
      const m = src[i] ?? {};
      const teams2 = Array.isArray(m.teams) ? m.teams : ["", ""];
      const winner = m.winner === 0 || m.winner === 1 ? m.winner : null;
      return { teams: [normalizeTeamName(teams2[0] ?? ""), normalizeTeamName(teams2[1] ?? "")], winner };
    });
    return out;
  };

  base.bracket = {
    r16: coerceRound("r16", 8),
    qf: coerceRound("qf", 4),
    sf: coerceRound("sf", 2),
    f: coerceRound("f", 1),
  };

  return base;
}

function ensureHeroLayer(dom) {
  if (document.getElementById("heroBg")) return;
  const hero = document.createElement("div");
  hero.id = "heroBg";
  hero.className = "heroBg";
  hero.style.display = "none";
  document.body.prepend(hero);
}

function applyBranding(dom, state) {
  ensureHeroLayer(dom);

  const logoUrl = (state.branding?.logoUrl ?? "").toString().trim();
  const heroUrl = (state.branding?.heroUrl ?? "").toString().trim();

  if (dom.brandLogo) {
    if (logoUrl) {
      dom.brandLogo.src = logoUrl;
      dom.brandLogo.alt = "Logo";
      dom.brandLogo.classList.add("isOn");
    } else {
      dom.brandLogo.removeAttribute("src");
      dom.brandLogo.alt = "";
      dom.brandLogo.classList.remove("isOn");
    }
  }

  const hero = document.getElementById("heroBg");
  if (hero) {
    if (heroUrl) {
      hero.style.backgroundImage = `url("${heroUrl.replaceAll('"', "%22")}")`;
      hero.style.display = "block";
    } else {
      hero.style.backgroundImage = "";
      hero.style.display = "none";
    }
  }
}

function seedR16FromTeams(state) {
  const teams = state.teams.map(normalizeTeamName);
  const allFilled = teams.every((t) => t.length > 0);
  if (!allFilled) return { ok: false, reason: "Please enter all 16 team names." };

  const normalizedLower = teams.map((t) => t.toLowerCase());
  const unique = new Set(normalizedLower);
  if (unique.size !== 16) return { ok: false, reason: "Team names must be unique." };

  const matches = [];
  for (let i = 0; i < 16; i += 2) {
    matches.push({ teams: [teams[i], teams[i + 1]], winner: null });
  }

  state.bracket = emptyBracket();
  state.bracket.r16 = matches;
  return { ok: true };
}

function propagate(state) {
  const b = state.bracket;

  const pushRound = (srcRound, dstRound) => {
    for (let i = 0; i < dstRound.length; i++) {
      const mA = srcRound[i * 2];
      const mB = srcRound[i * 2 + 1];

      const t0 = mA.winner === 0 ? mA.teams[0] : mA.winner === 1 ? mA.teams[1] : "";
      const t1 = mB.winner === 0 ? mB.teams[0] : mB.winner === 1 ? mB.teams[1] : "";

      const old = dstRound[i];
      const teamsChanged = old.teams[0] !== t0 || old.teams[1] !== t1;
      if (teamsChanged) {
        old.teams = [t0, t1];
        old.winner = null;
      }
    }
  };

  pushRound(b.r16, b.qf);
  pushRound(b.qf, b.sf);
  pushRound(b.sf, b.f);
}

function getChampion(state) {
  const final = state.bracket.f[0];
  if (!final) return "";
  if (final.winner === 0) return final.teams[0] || "";
  if (final.winner === 1) return final.teams[1] || "";
  return "";
}

function renderTeams(dom, state) {
  dom.teamsGrid.innerHTML = "";
  for (let i = 0; i < 16; i++) {
    const input = document.createElement("input");
    input.className = "teamInput";
    input.placeholder = `Team ${i + 1}`;
    input.value = state.teams[i] ?? "";
    input.id = makeId("team", i);
    input.autocomplete = "off";
    input.spellcheck = false;

    input.addEventListener("input", () => {
      state.teams[i] = normalizeTeamName(input.value);
      saveState(state);
    });

    input.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text/plain");
      if (!text) return;
      const lines = text
        .split(/\r?\n/)
        .map(normalizeTeamName)
        .filter(Boolean);
      if (lines.length < 2) return;

      e.preventDefault();
      for (let j = 0; j < lines.length; j++) {
        const idx = i + j;
        if (idx >= 16) break;
        state.teams[idx] = lines[j];
      }
      saveState(state);
      renderTeams(dom, state);
    });

    dom.teamsGrid.appendChild(input);
  }
}

function renderRound(dom, state, roundKey, containerEl) {
  const round = state.bracket[roundKey];
  containerEl.innerHTML = "";

  for (let i = 0; i < round.length; i++) {
    const matchData = round[i];
    const node = dom.matchTemplate.content.firstElementChild.cloneNode(true);

    const btn0 = node.querySelector('button[data-side="0"]');
    const btn1 = node.querySelector('button[data-side="1"]');
    const statusEl = node.querySelector('[data-role="status"]');
    const clearBtn = node.querySelector('button[data-role="clear"]');

    const name0 = btn0.querySelector(".teamBtn__name");
    const name1 = btn1.querySelector(".teamBtn__name");

    const t0 = normalizeTeamName(matchData.teams[0]);
    const t1 = normalizeTeamName(matchData.teams[1]);

    const setBtn = (btn, nameEl, teamName) => {
      if (!teamName) {
        btn.classList.add("teamBtn--empty");
        nameEl.textContent = "—";
        btn.disabled = true;
      } else {
        btn.classList.remove("teamBtn--empty");
        nameEl.textContent = teamName;
        btn.disabled = false;
      }
    };

    setBtn(btn0, name0, t0);
    setBtn(btn1, name1, t1);

    const winner = matchData.winner;
    const applyWinnerStyles = () => {
      node.classList.remove("isWinner");
      btn0.classList.remove("isLoser");
      btn1.classList.remove("isLoser");
      btn0.style.outline = "";
      btn1.style.outline = "";

      if (winner === 0) {
        node.classList.add("isWinner");
        btn1.classList.add("isLoser");
        btn0.style.outline = "2px solid rgba(52,211,153,.35)";
        statusEl.textContent = "Winner: " + (t0 || "—");
      } else if (winner === 1) {
        node.classList.add("isWinner");
        btn0.classList.add("isLoser");
        btn1.style.outline = "2px solid rgba(52,211,153,.35)";
        statusEl.textContent = "Winner: " + (t1 || "—");
      } else {
        statusEl.textContent = "";
      }
    };

    const pick = (side) => {
      if (!matchData.teams[side]) return;
      matchData.winner = side;
      propagate(state);
      saveState(state);
      renderAll(dom, state);
    };

    btn0.addEventListener("click", () => pick(0));
    btn1.addEventListener("click", () => pick(1));

    clearBtn.addEventListener("click", () => {
      matchData.winner = null;
      propagate(state);
      saveState(state);
      renderAll(dom, state);
    });

    applyWinnerStyles();
    containerEl.appendChild(node);
  }
}

function renderChampion(dom, state) {
  const champ = getChampion(state);
  dom.championBadge.textContent = champ || "—";
  dom.championBadge.classList.toggle("badge--filled", Boolean(champ));
  dom.championBadge.classList.toggle("badge--empty", !champ);
}

function renderAll(dom, state) {
  applyBranding(dom, state);
  if (dom.teamsCard) dom.teamsCard.classList.toggle("isCollapsed", Boolean(state.ui?.teamsCollapsed));
  if (dom.btnToggleTeams) {
    const collapsed = Boolean(state.ui?.teamsCollapsed);
    dom.btnToggleTeams.textContent = collapsed ? "Expand" : "Minimise";
    dom.btnToggleTeams.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
  renderTeams(dom, state);
  renderRound(dom, state, "r16", dom.roundR16);
  renderRound(dom, state, "qf", dom.roundQF);
  renderRound(dom, state, "sf", dom.roundSF);
  renderRound(dom, state, "f", dom.roundF);
  renderChampion(dom, state);
}

function resetWinners(state) {
  const b = state.bracket;
  for (const k of ["r16", "qf", "sf", "f"]) {
    for (const m of b[k]) m.winner = null;
  }
  propagate(state);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function toast(message) {
  const el = document.createElement("div");
  el.textContent = message;
  el.style.position = "fixed";
  el.style.right = "16px";
  el.style.bottom = "16px";
  el.style.padding = "10px 12px";
  el.style.borderRadius = "12px";
  el.style.border = "1px solid rgba(255,255,255,.14)";
  el.style.background = "rgba(0,0,0,.55)";
  el.style.backdropFilter = "blur(10px)";
  el.style.color = "rgba(255,255,255,.9)";
  el.style.fontSize = "12px";
  el.style.zIndex = "999";
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 250ms ease";
  }, 1400);
  setTimeout(() => el.remove(), 1750);
}

function loadOwnerUnlocked() {
  let unlocked = false;
  try {
    unlocked = localStorage.getItem(OWNER_UNLOCK_KEY) === "1";
  } catch {
    unlocked = false;
  }
  OWNER_UNLOCKED = unlocked;
  document.documentElement.dataset.owner = unlocked ? "1" : "0";
}

function isOwnerUnlocked() {
  return OWNER_UNLOCKED;
}

function setOwnerUnlocked(unlocked) {
  OWNER_UNLOCKED = unlocked;
  document.documentElement.dataset.owner = unlocked ? "1" : "0";
  try {
    if (unlocked) localStorage.setItem(OWNER_UNLOCK_KEY, "1");
    else localStorage.removeItem(OWNER_UNLOCK_KEY);
  } catch {
    // If storage is blocked (common on some file:// / privacy setups),
    // we still keep the session unlocked in-memory.
  }
}

function applyOwnerModeButton(dom) {
  const unlocked = isOwnerUnlocked();
  if (!dom.btnOwnerMode) return;

  dom.btnOwnerMode.textContent = unlocked ? "Lock edits" : "Owner mode";
  dom.btnOwnerMode.title = unlocked ? "Lock and hide editing controls" : "Unlock edit mode";
}

function wireUI(dom, state) {
  if (dom.btnOwnerMode) {
    dom.btnOwnerMode.addEventListener("click", () => {
      const unlocked = isOwnerUnlocked();
      if (unlocked) {
        setOwnerUnlocked(false);
        applyOwnerModeButton(dom);
        toast("Edit mode locked.");
        return;
      }

      const pin = window.prompt("Enter owner PIN to unlock edit mode:");
      if (pin == null) return;
      if (pin === OWNER_PIN) {
        setOwnerUnlocked(true);
        applyOwnerModeButton(dom);
        toast("Edit mode unlocked.");
      } else {
        toast("Incorrect PIN.");
      }
    });
  }

  if (dom.btnToggleTeams && dom.teamsCard) {
    dom.btnToggleTeams.addEventListener("click", () => {
      state.ui.teamsCollapsed = !state.ui.teamsCollapsed;
      saveState(state);
      renderAll(dom, state);
    });
  }

  dom.btnFillExample.addEventListener("click", () => {
    state.teams = shuffle(EXAMPLE_TEAMS);
    saveState(state);
    renderAll(dom, state);
  });

  dom.btnShuffleSeed.addEventListener("click", () => {
    const current = state.teams.map(normalizeTeamName);
    const filled = current.filter(Boolean);
    const shuffled = shuffle(filled);
    const out = Array.from({ length: 16 }, (_, i) => shuffled[i] ?? "");
    state.teams = out;
    saveState(state);
    renderAll(dom, state);
  });

  dom.btnGenerate.addEventListener("click", () => {
    const res = seedR16FromTeams(state);
    if (!res.ok) {
      toast(res.reason);
      return;
    }
    propagate(state);
    saveState(state);
    renderAll(dom, state);
  });

  dom.btnResetWinners.addEventListener("click", () => {
    resetWinners(state);
    saveState(state);
    renderAll(dom, state);
    toast("Winners cleared.");
  });

  dom.btnResetAll.addEventListener("click", () => {
    const fresh = buildState();
    state.teams = fresh.teams;
    state.ui = fresh.ui;
    state.branding = fresh.branding;
    state.bracket = fresh.bracket;
    window.location.hash = "";
    saveState(state);
    renderAll(dom, state);
    toast("Reset complete.");
  });

  dom.btnShare.addEventListener("click", async () => {
    const shareState = {
      teams: state.teams,
      branding: state.branding,
      bracket: state.bracket,
    };
    const hash = encodeStateToHash(shareState);
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    const ok = await copyText(url);
    toast(ok ? "Link copied!" : "Could not copy link.");
  });
}

function init() {
  const dom = getDOM();
  loadOwnerUnlocked();
  applyOwnerModeButton(dom);

  const fromHash = decodeStateFromHash();
  const fromStorage = loadState();

  const state = coerceState(fromHash || fromStorage);
  propagate(state);
  saveState(state);

  wireUI(dom, state);
  renderAll(dom, state);

  window.addEventListener("hashchange", () => {
    const incoming = decodeStateFromHash();
    if (!incoming) return;
    const next = coerceState(incoming);
    state.teams = next.teams;
    state.bracket = next.bracket;
    propagate(state);
    saveState(state);
    renderAll(dom, state);
    toast("Loaded from link.");
  });
}

document.addEventListener("DOMContentLoaded", init);

