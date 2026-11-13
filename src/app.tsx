import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  type Category,
  exerciseById,
  exercisesIn,
  programById,
  programPlaylist,
  programs,
} from "./catalog";
import {
  cancel,
  createPlayer,
  beatMs,
  exercisePlanMs,
  pause,
  previewWordIndex,
  skipStep,
  remainingExerciseMs,
  start,
  tick,
  type PlayerState,
} from "./machine";
import { displayRows } from "./syllables";
import { clearSessions, listSessions, saveSession, type SessionRecord } from "./store";
import { loadPrefs, savePrefs } from "./prefs";

function isTextExercise(exercise: { id: string; category: string }): boolean {
  return exercise.id.endsWith("-phrase") || exercise.category === "tongue_twisters";
}

type Route =
  | { name: "home" }
  | { name: "list"; category: Category }
  | { name: "train"; id: string; queue?: string; at?: number }
  | { name: "history" };

function readRoute(): Route {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [path, query] = hash.split("?");
  const params = new URLSearchParams(query ?? "");
  const bits = path.split("/").filter(Boolean);
  if (bits[0] === "train" && bits[1]) {
    return {
      name: "train",
      id: decodeURIComponent(bits[1]),
      queue: params.get("queue") ?? undefined,
      at: params.get("at") ? Number(params.get("at")) : undefined,
    };
  }
  if (bits[0] === "list" && bits[1]) return { name: "list", category: bits[1] as Category };
  if (bits[0] === "history") return { name: "history" };
  return { name: "home" };
}

function toggleFullscreen() {
  if (!document.fullscreenElement) return document.documentElement.requestFullscreen();
  return document.exitFullscreen();
}

const lists: { category: Category; title: string }[] = [
  { category: "vowels", title: "Гласные" },
  { category: "consonants", title: "Согласные" },
  { category: "tongue_twisters", title: "Скороговорки" },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    vowels: "M4 19 10 5l6 14M6.5 14h7M18 8h2m-1-1v2",
    consonants: "M5 5h7a4 4 0 0 1 0 8H5zm0 8h8a3 3 0 0 1 0 6H5z",
    tongue_twisters: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
    history: "M4 6v5h5M4.5 11a8 8 0 1 1 2 6M12 7v5l3 2",
    moon: "M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z",
    sun: "M12 4v2m0 12v2M4 12h2m12 0h2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    screen: "M4 9V4h5m6 0h5v5M20 15v5h-5M9 20H4v-5",
    arrow: "M5 12h14m-5-5 5 5-5 5",
  };
  return <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [theme, setTheme] = useState(() => loadPrefs().theme);
  const [scale, setScale] = useState(() => loadPrefs().scale);
  const [manual, setManual] = useState(() => loadPrefs().manual);
  const [pulseOn, setPulseOn] = useState(() => loadPrefs().pulse);
  const [rounds, setRounds] = useState(() => loadPrefs().rounds);
  const [portion, setPortion] = useState(() => loadPrefs().portion);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    savePrefs({ theme: theme === "dark" ? "dark" : "light" });
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--scale", String(scale));
    savePrefs({ scale });
  }, [scale]);

  return (
    <div class="shell">
      <header class="top">
        <a class="brand" href="#/">Артикуляция</a>
        <div class="tools">
          <button class="ghost" type="button" onClick={() => setScale(scale >= 1.45 ? 1 : Number((scale + 0.15).toFixed(2)))} aria-label="Крупнее текст">
            А+
          </button>
          <button class="ghost" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} />
            {theme === "dark" ? "Светлая" : "Тёмная"}
          </button>
          <button class="ghost" type="button" onClick={() => void toggleFullscreen()}>
            <Icon name="screen" />
            Экран
          </button>
        </div>
      </header>
      <details class="settings">
        <summary>Настройки</summary>
        <div class="settings-content">
          <label class="field">Режим
            <select value={manual ? "manual" : "timed"} onChange={(event) => {
              const value = (event.currentTarget as HTMLSelectElement).value === "manual";
              setManual(value);
              savePrefs({ manual: value });
            }}>
              <option value="timed">По пульсу</option>
              <option value="manual">Вручную</option>
            </select>
          </label>
          <label class="field">Рамка
            <select value={pulseOn ? "on" : "off"} onChange={(event) => {
              const value = (event.currentTarget as HTMLSelectElement).value === "on";
              setPulseOn(value);
              savePrefs({ pulse: value });
            }}>
              <option value="on">Пульс</option>
              <option value="off">Без пульса</option>
            </select>
          </label>
          <label class="field">Порция в слове: {Math.round(portion * 100)}%
            <input type="range" min={20} max={100} step={5} value={Math.round(portion * 100)} onInput={(event) => {
              const value = Number((event.currentTarget as HTMLInputElement).value) / 100;
              setPortion(value); savePrefs({ portion: value });
            }} />
          </label>
          <label class="field">Повторы в серии
            <select value={rounds} onChange={(event) => {
              const value = Number((event.currentTarget as HTMLSelectElement).value);
              setRounds(value); savePrefs({ rounds: value });
            }}>
              {Array.from({ length: 12 }, (_, index) => <option value={index + 1}>{index + 1}</option>)}
            </select>
          </label>
        </div>
      </details>
      {route.name === "home" && <Home />}
      {route.name === "list" && <Catalog category={route.category} />}
      {route.name === "train" && (
        <Trainer exerciseId={route.id} queue={route.queue} at={route.at ?? 0} manual={manual} pulseOn={pulseOn} rounds={rounds} portion={portion} />
      )}
      {route.name === "history" && <History />}
      <footer class="license-note">
        © 2026 <a href="https://github.com/vedmalex">Веданта-крит дас (Алексей Ведмеденко)</a>. Тексты упражнений: <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/deed.ru">CC BY-NC-ND 4.0</a>. Коммерческое использование — с разрешения автора.
      </footer>
    </div>
  );
}

function Home() {
  const prefs = loadPrefs();
  return (
    <main>
      <h1>Тренировка речи без аккаунта.</h1>
      <p class="lede">
        Гласные, группы согласных и скороговорки. Темп и пульс рамки задают подачу, не оценку произношения. Всё остаётся в браузере.
      </p>
      <p class="meta">Темп: упражнения {prefs.bpm} BPM · тексты {prefs.textBpm} BPM · {prefs.rounds} сер. · порция {Math.round(prefs.portion * 100)}%</p>
      <nav class="nav" aria-label="Разделы">
        {lists.map((item) => (
          <a class="chip" href={`#/list/${item.category}`}><Icon name={item.category} />{item.title}</a>
        ))}
        <a class="chip" href="#/history"><Icon name="history" />История</a>
      </nav>
      <section class="grid">
        {programs.map((program) => {
          const playlist = programPlaylist(program);
          const first = playlist[0];
          if (!first) return null;
          const total = playlist.reduce(
            (sum, item) => sum + exercisePlanMs(item.exercise.elements.length, item.exercise.wordStarts, isTextExercise(item.exercise) ? prefs.textBpm : prefs.bpm, prefs.rounds, prefs.portion),
            0,
          );
          return (
            <a class="card" href={`#/train/${first.exercise.id}?queue=${program.id}&at=0`}>
              <span class="card-arrow"><Icon name="arrow" /></span>
              <strong>{program.title}</strong>
              <span>{formatLeft(total)} при этом темпе · план {program.durationMinutesTarget} мин · {program.steps.length} блоков</span>
            </a>
          );
        })}
      </section>
    </main>
  );
}

function Catalog({ category }: { category: Category }) {
  const items = exercisesIn(category);
  const title = lists.find((item) => item.category === category)?.title ?? "Упражнения";
  return (
    <main>
      <h1>{title}</h1>
      <div class="grid">
        {items.map((exercise) => (
          <a class="card" href={`#/train/${exercise.id}`}>
            <strong>{exercise.title}</strong>
            <span>{exercise.group ? `${exercise.group} · ` : ""}сложность {exercise.difficulty}</span>
          </a>
        ))}
      </div>
    </main>
  );
}

function Trainer({ exerciseId, queue, at, manual, pulseOn, rounds, portion }: { exerciseId: string; queue?: string; at: number; manual: boolean; pulseOn: boolean; rounds: number; portion: number }) {
  const program = queue ? programById(queue) : undefined;
  const playlist = useMemo(() => (program ? programPlaylist(program) : []), [program]);
  const slot = playlist[at];
  const exercise = exerciseById(exerciseId) ?? slot?.exercise;
  const [exerciseBpm, setExerciseBpm] = useState(() => loadPrefs().bpm);
  const [textBpm, setTextBpm] = useState(() => loadPrefs().textBpm);
  const isText = exercise ? isTextExercise(exercise) : false;
  const bpm = isText ? textBpm : exerciseBpm;
  const setBpm = isText ? setTextBpm : setExerciseBpm;
  const [rating, setRating] = useState<number | null>(null);
  const [saved, setSaved] = useState("");
  const [beat, setBeat] = useState(false);
  const [countLeft, setCountLeft] = useState<number | null>(null);
  const [clock, setClock] = useState(() => performance.now());
  const [previewWord, setPreviewWord] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const sessionId = useRef<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const length = exercise?.elements.length ?? 1;
  const [player, setPlayer] = useState<PlayerState>(() => createPlayer(length, rounds));
  const phaseRef = useRef(player.phase);
  const deadlineRef = useRef(player.deadline);
  const heldRef = useRef(player.held);
  const remainingRef = useRef(player.remainingMs);
  const playerRef = useRef(player);
  phaseRef.current = player.phase;
  deadlineRef.current = player.deadline;
  heldRef.current = player.held;
  remainingRef.current = player.remainingMs;
  playerRef.current = player;
  const next = playlist[at + 1];
  const manualRef = useRef(manual);
  manualRef.current = manual;
  const bpmRef = useRef(bpm);
  const portionRef = useRef(portion);
  const wordsRef = useRef<number[]>(exercise?.wordStarts ?? []);
  const elementsRef = useRef<string[]>(exercise?.elements ?? []);
  bpmRef.current = bpm;
  portionRef.current = portion;
  wordsRef.current = exercise?.wordStarts ?? [];
  elementsRef.current = exercise?.elements ?? [];
  const prevHref = useMemo(() => {
    if (!exercise) return null;
    if (queue) {
      const previous = playlist[at - 1];
      return previous ? `#/train/${previous.exercise.id}?queue=${queue}&at=${at - 1}` : null;
    }
    const list = exercisesIn(exercise.category);
    const index = list.findIndex((item) => item.id === exercise.id);
    const previous = list[index - 1];
    return previous ? `#/train/${previous.id}` : null;
  }, [exercise, queue, playlist, at]);
  const series = useMemo(() => {
    if (program && queue) {
      return playlist.map((item, index) => ({
        id: item.exercise.id,
        title: item.exercise.title,
        href: `#/train/${item.exercise.id}?queue=${queue}&at=${index}`,
      }));
    }
    if (!exercise) return [];
    return exercisesIn(exercise.category).map((item) => ({
      id: item.id,
      title: item.title,
      href: `#/train/${item.id}`,
    }));
  }, [program, queue, playlist, exercise]);
  const followHref = useMemo(() => {
    if (!exercise) return null;
    if (queue) {
      return next ? `#/train/${next.exercise.id}?queue=${queue}&at=${at + 1}` : null;
    }
    const list = exercisesIn(exercise.category);
    const index = list.findIndex((item) => item.id === exercise.id);
    const following = list[index + 1];
    return following ? `#/train/${following.id}` : null;
  }, [exercise, queue, next, at]);

  useEffect(() => {
    startedAt.current = null;
    sessionId.current = null;
    setRating(null);
    setSaved("");
    const fresh = createPlayer(exercise?.elements.length ?? 1, rounds);
    if (sessionStorage.getItem(RUN_KEY) === "1") {
      startedAt.current = Date.now();
      setPlayer(start(fresh, performance.now(), manualRef.current));
    } else {
      setPlayer(fresh);
    }
  }, [exercise?.id, rounds]);

  useEffect(() => {
    savePrefs({ bpm: exerciseBpm, textBpm });
  }, [exerciseBpm, textBpm]);

  const previousManual = useRef(manual);
  useEffect(() => {
    if (previousManual.current === manual) return;
    previousManual.current = manual;
    sessionStorage.removeItem(RUN_KEY);
    setPlayer((current) => {
      if (current.phase === "idle" || current.phase === "completed") return current;
      return {
        ...current,
        phase: "paused",
        held: "running",
        deadline: null,
        remainingMs: manual ? null : beatMs(bpm, current.index, current.length, exercise?.wordStarts ?? [], portion),
      };
    });
  }, [manual]);

  useEffect(() => {
    let frame = 0;
    let shownSecond = -1;
    let shownCount = -1;
    let shownPreview: number | null | undefined;
    const loop = (now: number) => {
      setPlayer((current) => {
        if (manual || current.phase === "paused" || current.phase === "idle" || current.phase === "completed") {
          return current;
        }
        return tick(current, now, (index) => beatMs(bpmRef.current, index, current.length, wordsRef.current, portionRef.current));
      });
      const preview = previewWordIndex(
        playerRef.current,
        now,
        wordsRef.current,
        bpmRef.current,
        portionRef.current,
        elementsRef.current,
      );
      if (preview !== shownPreview) {
        shownPreview = preview;
        setPreviewWord(preview);
      }
      const second = Math.floor(now / 1000);
      if (second !== shownSecond) {
        shownSecond = second;
        setClock(now);
      }
      const counting = phaseRef.current === "countdown"
        || phaseRef.current === "resting"
        || (phaseRef.current === "paused" && (heldRef.current === "countdown" || heldRef.current === "resting"));
      if (counting) {
        const leftMs = phaseRef.current === "paused"
          ? (remainingRef.current ?? 0)
          : (deadlineRef.current ?? now) - now;
        const count = Math.max(1, Math.ceil(leftMs / 1000));
        if (count !== shownCount) {
          shownCount = count;
          setCountLeft(count);
        }
      } else if (shownCount !== 0) {
        shownCount = 0;
        setCountLeft(null);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [manual, bpm]);

  useEffect(() => {
    const active = pulseOn && !manual && player.phase === "running";
    if (!active) {
      setBeat(false);
      return;
    }
    setBeat(true);
    const timer = window.setTimeout(() => setBeat(false), 160);
    return () => window.clearTimeout(timer);
  }, [pulseOn, manual, player.phase, player.index, player.round]);

  useEffect(() => {
    if (player.phase !== "completed") return;
    void remember();
  }, [player.phase, rating, bpm, rounds, exercise?.id]);

  useEffect(() => {
    if (player.phase !== "completed") return;
    if (!followHref) {
      sessionStorage.removeItem(RUN_KEY);
      return;
    }
    if (sessionStorage.getItem(RUN_KEY) !== "1") return;
    const timer = window.setTimeout(() => {
      location.hash = followHref;
    }, 600);
    return () => window.clearTimeout(timer);
  }, [player.phase, followHref]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggle();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        goBack();
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        const now = performance.now();
        setPlayer((current) => skipStep(current, 1, now, (index) => beatMs(bpmRef.current, index, current.length, wordsRef.current, portionRef.current), {
          manual,
          inWordPause: previewWord != null,
        }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!exercise) return <p>Упражнение не найдено.</p>;

  function goBack() {
    const phase = player.phase === "paused" ? player.held : player.phase;
    const atStart = player.phase === "completed" || ((phase === "idle" || phase === "countdown" || phase === "running") && player.index === 0 && player.round === 1 && previewWord == null);
    if (atStart && prevHref) {
      location.hash = prevHref;
      return;
    }
    const now = performance.now();
    setPlayer((current) => skipStep(current, -1, now, (index) => beatMs(bpm, index, current.length, exercise?.wordStarts ?? [], portion), {
      manual,
      inWordPause: previewWord != null,
    }));
  }

  function goForward() {
    setPlayer((current) => skipStep(current, 1, performance.now(), (index) => beatMs(bpm, index, current.length, exercise?.wordStarts ?? [], portion), {
      manual,
      inWordPause: previewWord != null,
    }));
  }

  function resetExercise() {
    sessionStorage.removeItem(RUN_KEY);
    startedAt.current = null;
    sessionId.current = null;
    setSaved("");
    setPlayer((current) => cancel(current));
  }

  function toggle() {
    const now = performance.now();
    setPlayer((current) => {
      if (current.phase === "running" || current.phase === "countdown" || current.phase === "resting") {
        sessionStorage.removeItem(RUN_KEY);
        return pause(current, now);
      }
      sessionStorage.setItem(RUN_KEY, "1");
      if (startedAt.current == null) startedAt.current = Date.now();
      return start(current, now, manual);
    });
  }

  async function remember() {
    if (!exercise || startedAt.current == null) return;
    const id = sessionId.current ?? crypto.randomUUID();
    sessionId.current = id;
    try {
      await saveSession({
        id,
        exerciseId: exercise.id,
        title: exercise.title,
        startedAt: new Date(startedAt.current).toISOString(),
        durationMs: Date.now() - startedAt.current,
        bpm,
        rounds,
        rating,
      });
      setSaved("Сохранено на этом устройстве.");
    } catch {
      setSaved("Браузер не записал историю. Занятие не сохранено.");
    }
  }

  const exerciseLeft = remainingExerciseMs(player, clock, exercise.wordStarts, bpm, portion);
  let blockLeft: number | null = null;
  if (slot) {
    blockLeft = exerciseLeft;
    for (let index = at + 1; index < playlist.length; index += 1) {
      if (playlist[index].stepTitle !== slot.stepTitle) break;
      const item = playlist[index].exercise;
      blockLeft += exercisePlanMs(item.elements.length, item.wordStarts, isTextExercise(item) ? textBpm : exerciseBpm, rounds, portion);
    }
  }

  return (
    <main class="train">
      <p class="meta">
        {program ? `${program.title} · ${slot?.stepTitle ?? ""}` : exercise.group}
        {` · упражнение ${formatLeft(exerciseLeft)}`}
        {blockLeft != null ? ` · блок ${formatLeft(blockLeft)}` : ""}
      </p>
      {series.length > 1 && (
        <nav class="series" aria-label="Упражнения серии">
          {series.map((item, index) => (
            <a
              class={item.id === exercise.id && (queue ? index === at : true) ? "current" : ""}
              href={item.href}
              title={item.title}
              aria-label={item.title}
              aria-current={item.id === exercise.id && (queue ? index === at : true) ? "true" : undefined}
              onClick={() => {
                if (item.id !== exercise.id && (player.phase === "running" || player.phase === "countdown" || player.phase === "resting")) {
                  sessionStorage.removeItem(RUN_KEY);
                }
              }}
            />
          ))}
        </nav>
      )}
      <h1 class="exercise-title">{exercise.title}</h1>
      <p class="meta">серия {player.round} из {player.rounds} · {label(player.phase)} · сложность {exercise.difficulty}</p>
      <nav class="series rounds" aria-label="Повторы серии">
        {Array.from({ length: player.rounds }, (_, index) => index + 1).map((round) => (
          <button
            class={round === player.round ? "current" : ""}
            type="button"
            title={`Повтор ${round}`}
            aria-label={`Повтор ${round}`}
            aria-current={round === player.round ? "true" : undefined}
            onClick={() => {
              setPlayer((current) => ({
                ...current,
                phase: "paused",
                round,
                deadline: null,
                held: "running",
                remainingMs: manual ? null : beatMs(bpm, current.index, current.length, exercise.wordStarts, portion),
              }));
              sessionStorage.removeItem(RUN_KEY);
            }}
          />
        ))}
      </nav>
      <nav class="series parts" aria-label="Части упражнения">
        {exercise.elements.map((token, index) => (
          <button
            class={index === player.index && player.phase !== "idle" && player.phase !== "countdown" ? "current" : ""}
            type="button"
            title={token}
            aria-label={token}
            aria-current={index === player.index && player.phase === "running" ? "true" : undefined}
            onClick={() => {
              setPlayer((current) => ({
                ...current,
                phase: "paused",
                index,
                deadline: null,
                held: "running",
                remainingMs: manual ? null : beatMs(bpm, index, current.length, exercise.wordStarts, portion),
              }));
              sessionStorage.removeItem(RUN_KEY);
            }}
          />
        ))}
      </nav>
      <div class="tempo-row"><label class="tempo-picker">
        <span>Темп {isText ? "текста" : "упражнений"}</span>
        <select value={bpm} onChange={(event) => setBpm(Number((event.currentTarget as HTMLSelectElement).value))}>
          {[...new Set([...Array.from({ length: 22 }, (_, index) => 30 + index * 10), bpm])].sort((a, b) => a - b).map((value) => (
            <option value={value}>{value} BPM</option>
          ))}
        </select>
      </label><button class="ghost" type="button" onClick={resetExercise}>Сброс</button></div>
      <div class="stage-navigation">
      <button class="ghost side-navigation" type="button" onClick={goBack} aria-label="Назад">‹</button>
      <div
        class="stage-wrap"
        aria-label={player.phase === "running" || player.phase === "countdown" || player.phase === "resting" ? "Пауза" : "Старт"}
        onClick={() => { if (swiped.current) { swiped.current = false; return; } toggle(); }}
        onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY }; swiped.current = false; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const touch = event.changedTouches[0];
          touchStart.current = null;
          if (!start || !touch) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
          swiped.current = true;
          if (dx < 0) goForward(); else goBack();
        }}
      >
      {(player.phase === "paused" || player.phase === "idle" || (player.phase === "completed" && !followHref)) && (
        <div class="pause-veil">
          {(player.phase === "paused" || player.phase === "idle") && (
            <p class="articulation-hint">Произносите чётко, активно двигайте губами и языком. Держите челюсть свободной, без напряжения.</p>
          )}
          {player.phase === "paused" && <PauseMark />}
          {player.phase === "idle" && <PlayMark />}
          {player.phase === "completed" && !followHref && (
            <button class="veil-restart" type="button" onClick={(event) => {
              event.stopPropagation();
              sessionStorage.removeItem(RUN_KEY);
              const first = series[0];
              if (!first || first.id === exercise.id) {
                startedAt.current = null;
                sessionId.current = null;
                setPlayer((current) => cancel(current));
                return;
              }
              location.hash = first.href;
            }}>
              <ReplayMark />
              <span>Серия закончена</span>
            </button>
          )}
        </div>
      )}
      {(player.phase === "countdown" || player.phase === "resting" || (player.phase === "paused" && (player.held === "countdown" || player.held === "resting"))) && (
        <p class="count-line" aria-hidden="true">{countLeft ?? 3}</p>
      )}
      <div class={`stage ${isText ? "stage-text" : ""}`} aria-live="polite">
        {displayRows(exercise.elements, exercise.wordStarts).map((line) => (
          <span class="word-line">
            {line.map((token) => {
              const syllable = previewWord == null && token.index === player.index && player.phase === "running";
              const preview = previewWord === token.word;
              const name = [
                "token",
                syllable ? "active" : "",
                syllable && beat ? "glow" : "",
                preview ? "preview" : "",
              ].filter(Boolean).join(" ");
              return <span class={name}>{token.text}</span>;
            })}
          </span>
        ))}
      </div>
      </div>
      <button class="ghost side-navigation" type="button" onClick={goForward} aria-label="Вперёд">›</button>
      </div>
      {exercise.note && <p class="meta">{exercise.note}</p>}
      <div class="controls">
        <button class="solid" type="button" onClick={toggle} aria-label="Старт или стоп">
          {player.phase === "running" || player.phase === "countdown" || player.phase === "resting" ? "Стоп" : "Старт"}
        </button>
      </div>
      {player.phase === "completed" && (
        <div class="controls" style={{ marginTop: 16 }}>
          <label class="field">Насколько было трудно
            <select value={rating ?? ""} onChange={(event) => {
              const value = Number((event.target as HTMLSelectElement).value);
              if (value >= 1 && value <= 5) setRating(value);
            }}>
              <option value="" disabled>оценка</option>
              {[1, 2, 3, 4, 5].map((value) => <option value={value}>{value}</option>)}
            </select>
          </label>
          {followHref && <p class="meta">Дальше откроется само, пока занятие не остановлено.</p>}
        </div>
      )}
      {saved && <p>{saved}</p>}
    </main>
  );
}

const RUN_KEY = "articulation-run";

function PlayMark() {
  return (
    <svg class="mark" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" />
      <path d="M26 20v24l20-12z" />
    </svg>
  );
}

function ReplayMark() {
  return (
    <svg class="mark replay" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" />
      <path d="M44 24a14 14 0 1 0 2.2 10" />
      <path d="M44 16v10H34" />
    </svg>
  );
}

function PauseMark() {
  return (
    <svg class="mark" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" />
      <path d="M24 20h6v24h-6zm10 0h6v24h-6z" />
    </svg>
  );
}

function formatLeft(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function label(phase: PlayerState["phase"]): string {
  const names: Record<PlayerState["phase"], string> = {
    idle: "ожидание",
    countdown: "отсчёт",
    running: "идёт",
    resting: "пауза между сериями",
    paused: "пауза",
    completed: "готово",
  };
  return names[phase];
}

function History() {
  const [rows, setRows] = useState<SessionRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listSessions().then(setRows).catch(() => setError("История недоступна в этом браузере."));
  }, []);

  async function wipe() {
    try {
      await clearSessions();
      setRows([]);
    } catch {
      setError("Удалить историю не удалось.");
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(rows ?? [], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "articulation-history.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <h1>История</h1>
      {error && <p class="notice">{error}</p>}
      {rows && rows.length === 0 && <p>Пока пусто.</p>}
      <ul class="history">
        {rows?.map((row) => (
          <li>
            <strong>{row.title}</strong>
            <div class="meta">{new Date(row.startedAt).toLocaleString()} · {row.bpm} BPM · {Math.round(row.durationMs / 1000)} с{row.rating ? ` · оценка ${row.rating}` : ""}</div>
          </li>
        ))}
      </ul>
      <div class="controls">
        <button class="ghost" type="button" onClick={download}>Экспорт JSON</button>
        <button class="ghost" type="button" onClick={() => void wipe()}>Удалить</button>
      </div>
    </main>
  );
}
