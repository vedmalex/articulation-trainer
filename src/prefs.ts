export type Prefs = {
  theme: "light" | "dark";
  scale: number;
  bpm: number;
  textBpm: number;
  rounds: number;
  manual: boolean;
  pulse: boolean;
  portion: number;
};

const KEY = "articulation-prefs";

const DEFAULTS: Prefs = {
  theme: "light",
  scale: 1,
  bpm: 60,
  textBpm: 120,
  rounds: 3,
  manual: false,
  pulse: true,
  portion: 0.45,
};

export function loadPrefs(): Prefs {
  let stored: Partial<Prefs> = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw) as Partial<Prefs>;
  } catch {
    stored = {};
  }
  const legacyTheme = localStorage.getItem("theme");
  const legacyScale = Number(localStorage.getItem("scale"));
  const theme = stored.theme === "dark" || stored.theme === "light"
    ? stored.theme
    : legacyTheme === "dark" ? "dark" : DEFAULTS.theme;
  const scale = finiteIn(stored.scale, 0.8, 2) ?? finiteIn(legacyScale, 0.8, 2) ?? DEFAULTS.scale;
  return {
    theme,
    scale,
    bpm: finiteIn(stored.bpm, 30, 240) ?? DEFAULTS.bpm,
    textBpm: finiteIn(stored.textBpm, 30, 240) ?? Math.min(240, (finiteIn(stored.bpm, 30, 240) ?? DEFAULTS.bpm) * 2),
    rounds: finiteIn(stored.rounds, 1, 12) ?? DEFAULTS.rounds,
    manual: typeof stored.manual === "boolean" ? stored.manual : DEFAULTS.manual,
    pulse: typeof stored.pulse === "boolean" ? stored.pulse : DEFAULTS.pulse,
    portion: finiteIn(stored.portion, 0.2, 1) ?? DEFAULTS.portion,
  };
}

export function savePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...loadPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

function finiteIn(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
