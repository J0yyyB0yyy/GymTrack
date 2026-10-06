import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, BarChart3, Check, ChevronLeft, ChevronUp, ChevronDown, Clock3,
  Copy, Dumbbell, Flame, History, Play, Plus, RotateCcw, Save, Settings,
  Trash2, Trophy, User, X, Zap, Star, Search, LayoutDashboard, TrendingUp,
  CalendarDays, Download, Upload, ChevronRight, Filter
} from "lucide-react";

type SetEntry = {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
  warmup?: boolean;
};

type Exercise = { id: string; name: string; muscle: string; custom?: boolean };
type WorkoutExercise = { id: string; exercise: Exercise; sets: SetEntry[] };
type Workout = {
  id: string;
  name: string;
  date: string;
  duration: number;
  startedAt?: string;
  notes?: string;
  exercises: WorkoutExercise[];
  finished: boolean;
};
type Template = { id: string; name: string; exercises: string[]; setCounts?: number[] };

type PRRecord = {
  weight: number;
  reps: number;
  volume: number;
  estimated1RM: number;
  weightDate: string;
  repsDate: string;
  volumeDate: string;
  estimated1RMDate: string;
};

const EXERCISES: Exercise[] = [
  {id:"bench",name:"Bench Press",muscle:"Chest"},
  {id:"incline-bench",name:"Incline Bench Press",muscle:"Chest"},
  {id:"db-bench",name:"Dumbbell Bench Press",muscle:"Chest"},
  {id:"fly",name:"Dumbbell Fly",muscle:"Chest"},
  {id:"lat-pulldown",name:"Lat Pulldown",muscle:"Back"},
  {id:"pullup",name:"Pull Up",muscle:"Back"},
  {id:"row",name:"Barbell Row",muscle:"Back"},
  {id:"cable-row",name:"Seated Cable Row",muscle:"Back"},
  {id:"deadlift",name:"Deadlift",muscle:"Back"},
  {id:"ohp",name:"Overhead Press",muscle:"Shoulders"},
  {id:"db-press",name:"Dumbbell Shoulder Press",muscle:"Shoulders"},
  {id:"lateral",name:"Lateral Raise",muscle:"Shoulders"},
  {id:"rear-delt",name:"Rear Delt Fly",muscle:"Shoulders"},
  {id:"curl",name:"Barbell Curl",muscle:"Biceps"},
  {id:"db-curl",name:"Dumbbell Curl",muscle:"Biceps"},
  {id:"hammer",name:"Hammer Curl",muscle:"Biceps"},
  {id:"pushdown",name:"Tricep Pushdown",muscle:"Triceps"},
  {id:"skull",name:"Skull Crushers",muscle:"Triceps"},
  {id:"overhead-tricep",name:"Overhead Tricep Extension",muscle:"Triceps"},
  {id:"squat",name:"Squat",muscle:"Legs"},
  {id:"leg-press",name:"Leg Press",muscle:"Legs"},
  {id:"rdl",name:"Romanian Deadlift",muscle:"Legs"},
  {id:"leg-extension",name:"Leg Extension",muscle:"Legs"},
  {id:"leg-curl",name:"Leg Curl",muscle:"Legs"},
  {id:"calf",name:"Calf Raise",muscle:"Legs"},
  {id:"plank",name:"Plank",muscle:"Core"}
];

const uid = () => Math.random().toString(36).slice(2, 10);
const nowISO = () => new Date().toISOString();

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function emptySets(n = 3): SetEntry[] {
  return Array.from({length:n}, () => ({
    id: uid(), weight: 0, reps: 0, completed: false
  }));
}

function estimate1RM(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}


type AnalyticsPoint = {
  date: string;
  volume: number;
  reps: number;
  estimated1RM: number;
};

function exerciseAnalytics(workouts: Workout[], exerciseName: string): AnalyticsPoint[] {
  const byDay = new Map<string, AnalyticsPoint>();

  for (const workout of workouts) {
    if (!workout.finished) continue;
    for (const exercise of workout.exercises) {
      if (exercise.exercise.name !== exerciseName) continue;
      const completed = exercise.sets.filter(s => s.completed && (s.reps > 0 || s.weight > 0));
      if (!completed.length) continue;

      const day = new Date(workout.date).toLocaleDateString();
      const volume = completed.reduce((sum, s) => sum + (s.weight > 0 && s.reps > 0 ? s.weight * s.reps : 0), 0);
      const reps = completed.reduce((sum, s) => sum + (s.reps > 0 ? s.reps : 0), 0);
      const oneRM = completed.length ? Math.max(...completed.map(s => estimate1RM(s.weight, s.reps))) : 0;

      const existing = byDay.get(day);
      if (!existing) {
        byDay.set(day, {date: workout.date, volume, reps, estimated1RM: oneRM});
      } else {
        existing.volume += volume;
        existing.reps += reps;
        existing.estimated1RM = Math.max(existing.estimated1RM, oneRM);
      }
    }
  }

  return [...byDay.values()].sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

function overallStatistics(workouts: Workout[]) {
  const completed = workouts.filter(w => w.finished);
  const totalVolume = completed.reduce((sum, w) =>
    sum + w.exercises.reduce((a, e) =>
      a + e.sets.reduce((b, s) => b + (s.completed ? s.weight * s.reps : 0), 0), 0), 0);

  const totalSets = completed.reduce((sum, w) =>
    sum + w.exercises.reduce((a, e) =>
      a + e.sets.filter(s => s.completed).length, 0), 0);

  const totalReps = completed.reduce((sum, w) =>
    sum + w.exercises.reduce((a, e) =>
      a + e.sets.reduce((b, s) => b + (s.completed ? s.reps : 0), 0), 0), 0);

  const muscleVolume: Record<string, number> = {};
  completed.forEach(w => w.exercises.forEach(e => {
    const v = e.sets.reduce((s, set) => s + (set.completed ? set.weight * set.reps : 0), 0);
    muscleVolume[e.exercise.muscle] = (muscleVolume[e.exercise.muscle] || 0) + v;
  }));

  const uniqueDays = new Set(completed.map(w => new Date(w.date).toLocaleDateString()));

  return {sessions: completed.length, totalVolume, totalSets, totalReps, muscleVolume, uniqueDays: uniqueDays.size};
}

function calculatePRs(workouts: Workout[]): Record<string, PRRecord> {
  const result: Record<string, PRRecord> = {};
  for (const workout of workouts) {
    if (!workout.finished) continue;

    for (const exercise of workout.exercises) {
      const completed = exercise.sets.filter(s => s.completed && (s.reps > 0 || s.weight > 0));
      if (!completed.length) continue;

      const weighted = completed.filter(s => s.weight > 0 && s.reps > 0);
      const sessionVolume = weighted.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const bestSet = weighted.length ? weighted.reduce((best, s) =>
        s.weight > best.weight ? s : best, weighted[0]) : null;
      const bestRepSet = completed.reduce((best, s) =>
        s.reps > best.reps ? s : best, completed[0]);
      const best1RMSet = weighted.length ? weighted.reduce((best, s) =>
        estimate1RM(s.weight, s.reps) > estimate1RM(best.weight, best.reps) ? s : best,
        weighted[0]) : null;

      const current = result[exercise.exercise.name] ?? {
        weight: 0, reps: 0, volume: 0, estimated1RM: 0,
        weightDate: "", repsDate: "", volumeDate: "", estimated1RMDate: ""
      };

      if (bestSet && bestSet.weight > current.weight) {
        current.weight = bestSet.weight;
        current.weightDate = workout.date;
      }
      if (bestRepSet.reps > current.reps) {
        current.reps = bestRepSet.reps;
        current.repsDate = workout.date;
      }
      if (sessionVolume > current.volume) {
        current.volume = sessionVolume;
        current.volumeDate = workout.date;
      }

      const oneRM = best1RMSet ? estimate1RM(best1RMSet.weight, best1RMSet.reps) : 0;
      if (oneRM > current.estimated1RM) {
        current.estimated1RM = oneRM;
        current.estimated1RMDate = workout.date;
      }

      result[exercise.exercise.name] = current;
    }
  }
  return result;
}

function weeklyStatistics(workouts: Workout[]) {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diff);
  const completed = workouts.filter(w => w.finished && new Date(w.date) >= start);
  const sets = completed.reduce((sum, w) => sum + w.exercises.reduce((a, e) => a + e.sets.filter(s => s.completed).length, 0), 0);
  const totalVolume = completed.reduce((sum, w) => sum + w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.completed ? s.weight * s.reps : 0), 0), 0), 0);
  return {workouts: completed.length, sets, totalVolume};
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [workouts, setWorkouts] = useState<Workout[]>(() => load("gymtrack.workouts", []));
  const [templates, setTemplates] = useState<Template[]>(() => load("gymtrack.templates", []));
  const [customExercises, setCustomExercises] = useState<Exercise[]>(() => load("gymtrack.customExercises", []));
  const [favorites, setFavorites] = useState<string[]>(() => load("gymtrack.favoriteExercises", []));
  const [recentExercises, setRecentExercises] = useState<string[]>(() => load("gymtrack.recentExercises", []));
  const [active, setActive] = useState<Workout | null>(null);
  const [rest, setRest] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [defaultRest, setDefaultRest] = useState(() => load("gymtrack.defaultRest", 90));
  const [weight, setWeight] = useState(() => load("gymtrack.bodyWeight", 70));
  const [dark, setDark] = useState(() => load("gymtrack.dark", true));
  const [modal, setModal] = useState<"exercise"|"templates"|"saveTemplate"|"createExercise"|null>(null);
  const [query, setQuery] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseMuscle, setExerciseMuscle] = useState("Chest");
  const [touchStart, setTouchStart] = useState<{x:number;y:number}|null>(null);
  const [pageDirection, setPageDirection] = useState<"left"|"right">("left");
  const [templateName, setTemplateName] = useState("");
  const [toast, setToast] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [detailExercise, setDetailExercise] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => save("gymtrack.workouts", workouts), [workouts]);
  useEffect(() => save("gymtrack.templates", templates), [templates]);
  useEffect(() => save("gymtrack.customExercises", customExercises), [customExercises]);
  useEffect(() => save("gymtrack.favoriteExercises", favorites), [favorites]);
  useEffect(() => save("gymtrack.recentExercises", recentExercises), [recentExercises]);
  useEffect(() => save("gymtrack.bodyWeight", weight), [weight]);
  useEffect(() => save("gymtrack.dark", dark), [dark]);
  useEffect(() => save("gymtrack.defaultRest", defaultRest), [defaultRest]);

  useEffect(() => {
    if (!timerRunning || rest <= 0) return;
    const timer = window.setInterval(() => {
      setRest(current => {
        if (current <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning, rest]);

  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const update = () => setElapsed(active.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000)) : active.duration * 60);
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [active?.id, active?.startedAt, active?.duration]);

  const allExercises = useMemo(() => [...EXERCISES, ...customExercises], [customExercises]);
  const exerciseById = useMemo(() => new Map(allExercises.map(e => [e.id, e])), [allExercises]);

  const volume = useMemo(
    () => workouts.reduce((total, workout) =>
      total + workout.exercises.reduce((a, exercise) =>
        a + exercise.sets.reduce((b, set) =>
          b + (set.completed ? set.weight * set.reps : 0), 0), 0), 0),
    [workouts]
  );

  const prs = useMemo(() => calculatePRs(workouts), [workouts]);
  const week = useMemo(() => weeklyStatistics(workouts), [workouts]);
  const weightPRs = useMemo(
    () => Object.fromEntries(Object.entries(prs).map(([name, record]) => [name, record.weight])),
    [prs]
  );

  const showToast = (message: string, ms = 2000) => {
    setToast(message);
    window.setTimeout(() => setToast(""), ms);
  };

  const previousFor = (exercise: Exercise): SetEntry[] => {
    const found = workouts.find(
      w => w.finished && w.exercises.some(e => e.exercise.id === exercise.id)
    );
    const previous = found?.exercises.find(e => e.exercise.id === exercise.id);
    return previous
      ? previous.sets.map(s => ({...s, id: uid(), completed: false}))
      : emptySets();
  };

  const startWorkout = (template?: Template) => {
    const exercises = (template?.exercises ?? [])
      .map(id => exerciseById.get(id))
      .filter(Boolean) as Exercise[];

    setActive({
      id: uid(),
      name: template?.name || "Workout",
      date: nowISO(),
      duration: 0,
      startedAt: nowISO(),
      notes: "",
      finished: false,
      exercises: exercises.map((exercise, index) => ({
        id: uid(),
        exercise,
        sets: template?.setCounts?.[index] ? previousFor(exercise).slice(0, template.setCounts![index]) : previousFor(exercise)
      }))
    });
    if (exercises.length) setRecentExercises(prev => [...exercises.map(e => e.id), ...prev.filter(id => !exercises.some(e => e.id === id))].slice(0, 8));
    setRest(0);
    setTimerRunning(false);
    setPage("workout");
  };

  const addExercise = (exercise: Exercise) => {
    if (!active) return;
    setActive({
      ...active,
      exercises: [
        ...active.exercises,
        {id: uid(), exercise, sets: previousFor(exercise)}
      ]
    });
    setRecentExercises(prev => [exercise.id, ...prev.filter(id => id !== exercise.id)].slice(0, 8));
    setModal(null);
    setQuery("");
  };

  const updateSet = (
    exerciseId: string,
    setId: string,
    field: "weight"|"reps"|"completed"|"warmup",
    value: number|boolean
  ) => {
    if (!active) return;

    let startedRest = false;
    const nextExercises = active.exercises.map(exercise => {
      if (exercise.id !== exerciseId) return exercise;
      return {
        ...exercise,
        sets: exercise.sets.map(set => {
          if (set.id !== setId) return set;
          if (field === "completed" && value === true && !set.completed) startedRest = true;
          return {...set, [field]: value};
        })
      };
    });

    setActive({...active, exercises: nextExercises});

    if (startedRest) {
      setRest(defaultRest);
      setTimerRunning(true);
    }
  };

  const addSet = (exerciseId: string, copyLast = false, preset?: {weight:number; reps:number; completed?:boolean}) => {
    if (!active) return;
    setActive({
      ...active,
      exercises: active.exercises.map(exercise => {
        if (exercise.id !== exerciseId) return exercise;
        const last = exercise.sets[exercise.sets.length - 1];
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              id: uid(),
              weight: preset ? preset.weight : (copyLast ? (last?.weight || 0) : 0),
              reps: preset ? preset.reps : (copyLast ? (last?.reps || 0) : 0),
              completed: preset?.completed ?? false,
              warmup: copyLast ? !!last?.warmup : false
            }
          ]
        };
      })
    });
    if (preset?.completed) {
      setRest(defaultRest);
      setTimerRunning(true);
    }
  };

  const removeSet = (exerciseId: string, setId: string) => {
    if (!active) return;
    setActive({
      ...active,
      exercises: active.exercises.map(exercise =>
        exercise.id === exerciseId
          ? {...exercise, sets: exercise.sets.length > 1
              ? exercise.sets.filter(set => set.id !== setId)
              : exercise.sets}
          : exercise
      )
    });
  };

  const moveExercise = (index: number, direction: number) => {
    if (!active) return;
    const exercises = [...active.exercises];
    const target = index + direction;
    if (target < 0 || target >= exercises.length) return;
    [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
    setActive({...active, exercises});
  };

  const completedSetCount = active?.exercises.reduce((sum, e) => sum + e.sets.filter(s => s.completed).length, 0) ?? 0;
  const totalSetCount = active?.exercises.reduce((sum, e) => sum + e.sets.length, 0) ?? 0;

  const exitWorkout = () => {
    if (active?.exercises.length &&
        !window.confirm("Leave this workout? Your unsaved changes will be lost.")) return;
    setTimerRunning(false);
    setRest(0);
    setActive(null);
    setPage("dashboard");
  };

  const finishWorkout = () => {
    if (!active || !active.exercises.length) {
      showToast("Add at least one exercise first.");
      return;
    }

    const finished: Workout = {
      ...active,
      finished: true,
      duration: Math.max(1, active.startedAt ? Math.round((Date.now() - new Date(active.startedAt).getTime()) / 60000) : active.duration)
    };

    const before = calculatePRs(workouts);
    const after = calculatePRs([finished, ...workouts]);

    setWorkouts([finished, ...workouts]);
    setActive(null);
    setTimerRunning(false);
    setRest(0);
    setPage("dashboard");

    const newPRs = Object.entries(after).filter(([name, record]) => {
      const old = before[name];
      if (!old) return true;
      return record.weight > old.weight ||
        record.reps > old.reps ||
        record.volume > old.volume ||
        record.estimated1RM > old.estimated1RM;
    });

    showToast(
      newPRs.length
        ? `Workout saved · ${newPRs.length} new PR${newPRs.length === 1 ? "" : "s"} 🏆`
        : "Workout saved! 💪",
      2800
    );
  };

  const saveTemplate = () => {
    if (!active || !active.exercises.length) {
      showToast("Add at least one exercise first.");
      return;
    }
    const name = templateName.trim() || active.name || "Workout template";
    setTemplates([
      {
        id: uid(),
        name,
        exercises: active.exercises.map(e => e.exercise.id),
        setCounts: active.exercises.map(e => Math.max(1, e.sets.length))
      },
      ...templates
    ]);
    setModal(null);
    setTemplateName("");
    showToast("Template saved");
  };

  const deleteWorkout = (id: string) => setWorkouts(workouts.filter(w => w.id !== id));

  const createCustomExercise = () => {
    const name = exerciseName.trim();
    if (!name) { showToast("Enter an exercise name."); return; }
    if (allExercises.some(e => e.name.toLowerCase() === name.toLowerCase())) {
      showToast("An exercise with that name already exists.");
      return;
    }
    const exercise: Exercise = { id: `custom-${uid()}`, name, muscle: exerciseMuscle, custom: true };
    setCustomExercises(prev => [...prev, exercise]);
    setRecentExercises(prev => [exercise.id, ...prev.filter(id => id !== exercise.id)].slice(0, 8));
    setExerciseName("");
    setExerciseMuscle("Chest");
    setModal(null);
    showToast(`${name} added`);
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev]);
  };

  const deleteCustomExercise = (id: string) => {
    const exercise = customExercises.find(e => e.id === id);
    if (!exercise) return;
    const used = workouts.some(w => w.exercises.some(e => e.exercise.id === id));
    const message = used
      ? `${exercise.name} is used in workout history. Remove it from the exercise library? Existing history will be kept.`
      : `Delete ${exercise.name}?`;
    if (!window.confirm(message)) return;
    setCustomExercises(prev => prev.filter(e => e.id !== id));
    setFavorites(prev => prev.filter(x => x !== id));
    setRecentExercises(prev => prev.filter(x => x !== id));
  };

  const openExerciseDetail = (name: string, from: "exercises" | "progress" = "exercises") => {
    setDetailExercise(name);
    setPage(`exerciseDetail:${from}`);
  };

  const exportBackup = () => {
    const backup = {
      app: "GymTrack",
      version: 32,
      exportedAt: nowISO(),
      data: {
        workouts,
        templates,
        customExercises,
        favorites,
        recentExercises,
        bodyWeight: weight,
        defaultRest,
        dark
      }
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gymtrack-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exported");
  };

  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const data = parsed?.data;
        if (!data || !Array.isArray(data.workouts) || !Array.isArray(data.templates) || !Array.isArray(data.customExercises)) {
          throw new Error("Invalid backup");
        }
        if (!window.confirm("Import this backup? It will replace your current GymTrack data.")) return;
        setWorkouts(data.workouts);
        setTemplates(data.templates);
        setCustomExercises(data.customExercises);
        setFavorites(Array.isArray(data.favorites) ? data.favorites : []);
        setRecentExercises(Array.isArray(data.recentExercises) ? data.recentExercises : []);
        if (typeof data.bodyWeight === "number") setWeight(data.bodyWeight);
        if (typeof data.defaultRest === "number") setDefaultRest(data.defaultRest);
        if (typeof data.dark === "boolean") setDark(data.dark);
        setActive(null);
        setDetailExercise(null);
        setPage("dashboard");
        showToast("Backup imported");
      } catch {
        showToast("That file is not a valid GymTrack backup.", 3000);
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const navPages = ["dashboard", "history", "progress", "exercises", "profile"];
  const goToPage = (next: string) => {
    const currentIndex = navPages.indexOf(page);
    const nextIndex = navPages.indexOf(next);
    if (currentIndex >= 0 && nextIndex >= 0 && currentIndex !== nextIndex) {
      setPageDirection(nextIndex > currentIndex ? "left" : "right");
    }
    setPage(next);
  };
  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (page === "workout") return;
    const target = e.target as HTMLElement;
    if (target.closest("input,textarea,select,button,a,[data-no-swipe],.chartWrap")) return;
    const touch = e.changedTouches[0];
    setTouchStart({x: touch.clientX, y: touch.clientY});
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (!touchStart || page === "workout") return;
    const target = e.target as HTMLElement;
    if (target.closest("input,textarea,select,button,a,[data-no-swipe],.chartWrap")) { setTouchStart(null); return; }
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    setTouchStart(null);
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    const currentIndex = navPages.indexOf(page);
    const nextIndex = currentIndex + (dx < 0 ? 1 : -1);
    if (nextIndex >= 0 && nextIndex < navPages.length) goToPage(navPages[nextIndex]);
  };

  return (
    <div className={dark ? "app dark" : "app"}>
      <header className="topbar">
        <div className="brand">
          <div className="brandIcon"><Dumbbell size={20}/></div>
          <span>GymTrack</span>
        </div>
        {rest > 0 && (
          <button
            className="timerPill"
            onClick={() => setTimerRunning(running => !running)}
            title={timerRunning ? "Pause rest timer" : "Resume rest timer"}
          >
            <Clock3 size={16}/>
            {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}
          </button>
        )}
        <button className="iconBtn" onClick={() => goToPage("profile")} aria-label="Settings">
          <Settings size={20}/>
        </button>
      </header>

      <main className={`content pageTransition pageTransition-${pageDirection}`} key={page} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {page === "dashboard" &&
          <Dashboard
            total={workouts.length}
            volume={volume}
            prs={weightPRs}
            prRecords={prs}
            start={() => startWorkout()}
            templates={templates}
            openTemplates={() => setModal("templates")}
            recent={workouts.slice(0, 3)}
            week={week}
          />}
        {page === "workout" && active &&
          <WorkoutPage
            active={active}
            setActive={setActive}
            exit={exitWorkout}
            addExercise={() => setModal("exercise")}
            finish={finishWorkout}
            saveTemplate={() => setModal("saveTemplate")}
            addSet={addSet}
            removeSet={removeSet}
            updateSet={updateSet}
            moveExercise={moveExercise}
            rest={rest}
            setRest={setRest}
            running={timerRunning}
            setRunning={setTimerRunning}
            defaultRest={defaultRest}
            setDefaultRest={setDefaultRest}
            elapsed={elapsed}
            completedSets={completedSetCount}
            totalSets={totalSetCount}
          />}
        {page === "history" && <HistoryPage workouts={workouts} remove={deleteWorkout}/>}
        {page === "progress" && <ProgressPage prs={prs} workouts={workouts} exercises={allExercises} openDetail={(name) => openExerciseDetail(name, "progress")}/>}
        {page === "exercises" && <ExercisesPage exercises={allExercises} favorites={favorites} recent={recentExercises} toggleFavorite={toggleFavorite} deleteCustom={deleteCustomExercise} openCreate={() => setModal("createExercise")} openDetail={(name) => openExerciseDetail(name, "exercises")}/>}
        {page.startsWith("exerciseDetail:") && detailExercise && <ExerciseDetailPage name={detailExercise} record={prs[detailExercise] || makeEmptyPR()} workouts={workouts} back={() => { const from = page.split(":")[1]; setDetailExercise(null); setPage(from || "exercises"); }} />}
        {page === "profile" &&
          <Profile
            weight={weight}
            setWeight={setWeight}
            dark={dark}
            setDark={setDark}
            defaultRest={defaultRest}
            setDefaultRest={setDefaultRest}
            exportBackup={exportBackup}
            importBackup={() => importInputRef.current?.click()}
          />}
        <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={e => { const file = e.target.files?.[0]; if (file) importBackup(file); }} />
      </main>

      {page !== "workout" &&
        <nav className="nav">
          <NavItem icon={<LayoutDashboard/>} label="Dashboard" active={page === "dashboard"} click={() => goToPage("dashboard")}/>
          <NavItem icon={<History/>} label="History" active={page === "history"} click={() => goToPage("history")}/>
          <NavItem icon={<TrendingUp/>} label="Progress" active={page === "progress"} click={() => goToPage("progress")}/>
          <NavItem icon={<Dumbbell/>} label="Exercises" active={page === "exercises"} click={() => goToPage("exercises")}/>
          <NavItem icon={<User/>} label="Profile" active={page === "profile"} click={() => goToPage("profile")}/>
        </nav>}

      {modal === "exercise" &&
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modalHead">
              <h2>Add exercise</h2>
              <button className="iconBtn" onClick={() => setModal(null)}><X/></button>
            </div>
            <input
              autoFocus
              className="search"
              placeholder="Search exercises..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <div className="exerciseList">
              <button className="primary exerciseCreateButton" onClick={() => {setModal("createExercise");setExerciseName(query);setQuery("")}}><Plus size={16}/> Create custom exercise</button>
              {allExercises.filter(e =>
                (e.name + " " + e.muscle).toLowerCase().includes(query.toLowerCase())
              ).map(e =>
                <button className="exerciseOption" key={e.id} onClick={() => addExercise(e)}>
                  <span><span className="exerciseOptionName">{e.name}</span>{e.custom && <small className="customBadge">Custom</small>}</span>
                  <small>{e.muscle}</small>
                </button>
              )}
            </div>
          </div>
        </div>}

      {modal === "createExercise" &&
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal smallModal" onClick={e => e.stopPropagation()}>
            <div className="modalHead"><h2>Add custom exercise</h2><button className="iconBtn" onClick={() => setModal(null)}><X/></button></div>
            <label className="formLabel">Exercise name</label>
            <input autoFocus className="search" placeholder="e.g. Incline Cable Fly" value={exerciseName} onChange={e => setExerciseName(e.target.value)}/>
            <label className="formLabel">Muscle group</label>
            <select className="search selectInput" value={exerciseMuscle} onChange={e => setExerciseMuscle(e.target.value)}>
              {["Chest","Back","Shoulders","Biceps","Triceps","Legs","Core"].map(m => <option key={m}>{m}</option>)}
            </select>
            <button className="primary" onClick={createCustomExercise}><Plus size={17}/> Save exercise</button>
          </div>
        </div>}

      {modal === "templates" &&
        <TemplateModal
          templates={templates}
          exercises={allExercises}
          start={startWorkout}
          remove={id => setTemplates(templates.filter(t => t.id !== id))}
          close={() => setModal(null)}
        />}

      {modal === "saveTemplate" &&
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal smallModal" onClick={e => e.stopPropagation()}>
            <div className="modalHead">
              <h2>Save workout template</h2>
              <button className="iconBtn" onClick={() => setModal(null)}><X/></button>
            </div>
            <input
              autoFocus
              className="search"
              placeholder="Template name"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
            />
            <button className="primary" onClick={saveTemplate}>
              <Save size={17}/> Save template
            </button>
          </div>
        </div>}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function NavItem({icon,label,active,click}:{
  icon:React.ReactNode; label:string; active:boolean; click:()=>void
}) {
  return <button className={active ? "navItem active" : "navItem"} onClick={click}>{icon}<span>{label}</span></button>;
}

function Dashboard({
  total, volume, prs, prRecords, start, recent, templates, openTemplates, week
}:{
  total:number;
  volume:number;
  prs:Record<string,number>;
  prRecords:Record<string,PRRecord>;
  start:()=>void;
  recent:Workout[];
  templates:Template[];
  openTemplates:()=>void;
  week:{workouts:number;sets:number;totalVolume:number};
}) {
  return <section>
    <div className="hero">
      <div>
        <p className="eyebrow">YOUR TRAINING</p>
        <h1>Keep showing up.</h1>
        <p className="muted">Track the work. Watch the numbers move.</p>
      </div>
      <div className="heroActions">
        <button className="primary big" onClick={start}><Play size={18}/> Start workout</button>
        <button className="secondary big" onClick={openTemplates}><Copy size={17}/> Templates {templates.length ? `(${templates.length})` : ""}</button>
      </div>
    </div>

    <div className="dashboardSummary">
      <div className="summaryHeading"><h2>This week</h2><span>Your recent training at a glance</span></div>
      <div className="stats dashboardStats">
        <Stat icon={<Dumbbell/>} label="Workouts" value={week.workouts}/>
        <Stat icon={<Check/>} label="Completed sets" value={week.sets}/>
        <Stat icon={<Zap/>} label="Volume" value={week.totalVolume >= 1000 ? (week.totalVolume/1000).toFixed(1)+"k kg" : Math.round(week.totalVolume)+" kg"}/>
      </div>
    </div>

    <div className="sectionTitle"><h2>Recent workouts</h2></div>
    {recent.length === 0
      ? <Empty icon={<Dumbbell/>} text="No workouts yet. Start your first session!"/>
      : <div className="cards">{recent.map(w =>
          <div className="workoutCard" key={w.id}>
            <div className="cardIcon"><Dumbbell/></div>
            <div><strong>{w.name}</strong><p>{new Date(w.date).toLocaleDateString()} · {w.exercises.length} exercises</p></div>
            <span className="cardArrow">›</span>
          </div>
        )}</div>}

    <div className="sectionTitle"><h2>Personal records</h2><p className="muted">Your strongest logged numbers.</p></div>
    {Object.keys(prRecords).length === 0
      ? <Empty icon={<Trophy/>} text="Complete workouts to start collecting PRs."/>
      : <div className="prGrid">
          {Object.entries(prRecords).slice(0, 6).map(([name, record]) =>
            <div className="prCard" key={name}>
              <Trophy size={17}/>
              <div>
                <strong>{name}</strong>
                <span>{record.weight} kg · {record.reps} reps · 1RM ~ {Math.round(record.estimated1RM)} kg</span>
              </div>
            </div>
          )}
        </div>}
    <div className="dashboardHint"><TrendingUp size={17}/><div><strong>Keep an eye on Progress</strong><span>Track exercise trends and PRs from the Progress tab.</span></div></div>
  </section>;
}

function Stat({icon,label,value}:{icon:React.ReactNode,label:string,value:React.ReactNode}) {
  return <div className="stat"><div className="statIcon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function Empty({icon,text}:{icon:React.ReactNode,text:string}) {
  return <div className="empty">{icon}<p>{text}</p></div>;
}

function WorkoutPage({
  active,setActive,exit,addExercise,finish,saveTemplate,addSet,removeSet,updateSet,moveExercise,
  rest,setRest,running,setRunning,defaultRest,setDefaultRest,elapsed,completedSets,totalSets
}:{
  active:Workout;
  setActive:React.Dispatch<React.SetStateAction<Workout|null>>;
  exit:()=>void;
  addExercise:()=>void;
  finish:()=>void;
  saveTemplate:()=>void;
  addSet:(id:string,copyLast?:boolean,preset?:{weight:number;reps:number;completed?:boolean})=>void;
  removeSet:(a:string,b:string)=>void;
  updateSet:(a:string,b:string,c:"weight"|"reps"|"completed"|"warmup",d:number|boolean)=>void;
  moveExercise:(i:number,d:number)=>void;
  rest:number;
  setRest:(n:number)=>void;
  running:boolean;
  setRunning:(b:boolean)=>void;
  defaultRest:number;
  setDefaultRest:(n:number)=>void;
  elapsed:number;
  completedSets:number;
  totalSets:number;
}) {
  const presets = [30,60,90,120,180];

  return <section>
    <div className="workoutTop">
      <div className="workoutTitleArea">
        <button className="back dashboardBack" onClick={exit}><ChevronLeft/> Dashboard</button>
        <input className="workoutName" value={active.name} onChange={e => setActive({...active,name:e.target.value})}/>
        <div className="workoutMeta"><span><Clock3 size={13}/> {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}</span><span>{completedSets}/{totalSets} sets complete</span></div>
      </div>
      <div className="workoutActions">
        <button className="secondary" onClick={saveTemplate}><Save size={16}/> Save template</button>
        <button className="primary" onClick={finish}><Check size={17}/> Finish</button>
      </div>
    </div>

    <div className="workoutProgress"><span style={{width: `${totalSets ? Math.min(100, completedSets / totalSets * 100) : 0}%`}}/></div>

    <div className="restBar">
      <div><Clock3 size={18}/><strong>Rest timer</strong><span className="restHint">Auto-starts after completing a set</span></div>
      <div className="restControls">
        {presets.map(seconds =>
          <button key={seconds} className={defaultRest === seconds ? "selected" : ""} onClick={() => setDefaultRest(seconds)}>
            {seconds >= 60 ? `${seconds/60}m` : `${seconds}s`}
          </button>
        )}
        <button className="timerAction" onClick={() => setRest(r => r + 30)} disabled={rest === 0}>+30</button>
        <button className="timerAction" onClick={() => setRunning(r => !r)} disabled={rest === 0}>{running ? "Pause" : "Resume"}</button>
        <button className="reset" onClick={() => {setRest(0);setRunning(false)}}>Skip</button>
      </div>
      <strong className={rest > 0 ? "restActive" : "restIdle"}>{Math.floor(rest/60)}:{String(rest%60).padStart(2,"0")}</strong>
    </div>

    <div className="workoutNotes">
      <label>Workout notes</label>
      <textarea placeholder="How did the workout go? Add anything you want to remember..." value={active.notes || ""} onChange={e => setActive({...active, notes:e.target.value})}/>
    </div>

    {!active.exercises.length
      ? <div className="empty large"><Dumbbell/><h3>No exercises yet</h3><p>Add exercises to start logging.</p><button className="primary" onClick={addExercise}><Plus/> Add exercise</button></div>
      : <div className="exerciseStack">
          {active.exercises.map((exercise,index) =>
            <ExerciseCard
              key={exercise.id}
              ex={exercise}
              index={index}
              total={active.exercises.length}
              addSet={addSet}
              removeSet={removeSet}
              updateSet={updateSet}
              move={moveExercise}
              remove={id => setActive({...active, exercises: active.exercises.filter(x => x.id !== id)})}
            />)}
          <button className="addExercise" onClick={addExercise}><Plus/> Add exercise</button>
        </div>}
  </section>;
}

function ExerciseCard({
  ex,index,total,addSet,removeSet,updateSet,move,remove
}:{
  ex:WorkoutExercise;
  index:number;
  total:number;
  addSet:(id:string,copyLast?:boolean,preset?:{weight:number;reps:number;completed?:boolean})=>void;
  removeSet:(a:string,b:string)=>void;
  updateSet:(a:string,b:string,c:"weight"|"reps"|"completed"|"warmup",d:number|boolean)=>void;
  move:(i:number,d:number)=>void;
  remove:(id:string)=>void;
}) {
  const previous = ex.sets.filter(s => s.weight > 0 || s.reps > 0)[0];
  const [quickWeight, setQuickWeight] = useState(previous?.weight || 0);
  const [quickReps, setQuickReps] = useState(previous?.reps || 0);
  return <div className="exerciseCard">
    <div className="exerciseHead">
      <div>
        <span className="exerciseNum">{String(index+1).padStart(2,"0")}</span>
        <div><h3>{ex.exercise.name}</h3><small>{ex.exercise.muscle}{previous ? ` · Previous: ${previous.weight || "BW"} kg × ${previous.reps} reps` : " · No previous data"}</small></div>
      </div>
      <div className="exerciseTools">
        <button className="iconBtn" title="Move up" disabled={index===0} onClick={() => move(index,-1)}><ChevronUp size={17}/></button>
        <button className="iconBtn" title="Move down" disabled={index===total-1} onClick={() => move(index,1)}><ChevronDown size={17}/></button>
        <button className="delete exerciseDelete" title="Remove exercise" onClick={() => window.confirm(`Remove ${ex.exercise.name}?`) && remove(ex.id)}><Trash2 size={17}/></button>
      </div>
    </div>

    <div className="setHeader"><span>SET</span><span>WEIGHT (KG)</span><span>REPS</span><span></span></div>

    {ex.sets.map((set,index) =>
      <div className={set.completed ? "setRow done" : "setRow"} key={set.id}>
        <span className="setNo">{index+1}</span>
        <input type="number" min="0" step="0.5" value={set.weight || ""} placeholder="0"
          onChange={e => updateSet(ex.id,set.id,"weight",Number(e.target.value))}/>
        <input type="number" min="0" value={set.reps || ""} placeholder="0"
          onChange={e => updateSet(ex.id,set.id,"reps",Number(e.target.value))}/>
        <div className="setActions">
          <button className="checkBtn" onClick={() => updateSet(ex.id,set.id,"completed",!set.completed)}>
            {set.completed ? <Check/> : ""}
          </button>
          <button className="removeSet" title="Remove set" onClick={() => removeSet(ex.id,set.id)}><X size={14}/></button>
        </div>
      </div>)}

    <div className="quickSet">
      <span>Quick set</span>
      <input type="number" min="0" step="0.5" value={quickWeight || ""} placeholder="kg" onChange={e => setQuickWeight(Number(e.target.value))}/>
      <input type="number" min="0" value={quickReps || ""} placeholder="reps" onChange={e => setQuickReps(Number(e.target.value))}/>
      <button className="primary" onClick={() => { if (quickReps <= 0 && quickWeight <= 0) return; addSet(ex.id, false, {weight:quickWeight,reps:quickReps,completed:true}); }}><Plus size={14}/> Log set</button>
    </div>
    <div className="setButtons">
      <button className="addSet" onClick={() => addSet(ex.id)}><Plus size={15}/> Add set</button>
      <button className="addSet" onClick={() => addSet(ex.id,true)}><Copy size={15}/> Duplicate last</button>
    </div>
  </div>;
}

function TemplateModal({templates,exercises,start,remove,close}:{
  templates:Template[]; exercises:Exercise[]; start:(t?:Template)=>void; remove:(id:string)=>void; close:()=>void
}) {
  return <div className="overlay" onClick={close}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modalHead"><h2>Workout templates</h2><button className="iconBtn" onClick={close}><X/></button></div>
      {!templates.length
        ? <Empty icon={<Copy/>} text="Save a workout as a template and it will appear here."/>
        : <div className="templateList">{templates.map(t =>
            <div className="templateCard" key={t.id}>
              <div><strong>{t.name}</strong><span>{t.exercises.length} exercises · {t.setCounts?.reduce((a,n) => a+n, 0) || "Previous"} sets · {t.exercises.map(id => exercises.find(e => e.id === id)?.name).filter(Boolean).slice(0,3).join(" · ")}{t.exercises.length > 3 ? " · …" : ""}</span></div>
              <div className="templateActions">
                <button className="primary" onClick={() => {close();start(t)}}><Play size={15}/> Start</button>
                <button className="secondary templateDuplicate" onClick={() => start({...t,id:uid(),name:`${t.name} Copy`})}><Copy size={15}/></button>
                <button className="delete" onClick={() => remove(t.id)}><Trash2 size={16}/></button>
              </div>
            </div>)}</div>}
    </div>
  </div>;
}

function ExercisesPage({exercises,favorites,recent,toggleFavorite,deleteCustom,openCreate,openDetail}:{
  exercises:Exercise[]; favorites:string[]; recent:string[]; toggleFavorite:(id:string)=>void; deleteCustom:(id:string)=>void; openCreate:()=>void; openDetail:(name:string)=>void
}) {
  const [query,setQuery] = useState("");
  const favoriteExercises = favorites.map(id => exercises.find(e => e.id === id)).filter(Boolean) as Exercise[];
  const recentExercises = recent.map(id => exercises.find(e => e.id === id)).filter(Boolean) as Exercise[];
  const filtered = exercises.filter(e => (e.name + " " + e.muscle).toLowerCase().includes(query.toLowerCase()));
  const renderCard = (e:Exercise) => <div className="libraryExercise" key={e.id} onClick={() => openDetail(e.name)} role="button" tabIndex={0} onKeyDown={ev => { if (ev.key === "Enter") openDetail(e.name); }}>
    <div className="libraryExerciseMain"><div className="cardIcon"><Dumbbell size={18}/></div><div><strong>{e.name}</strong><span>{e.muscle}{e.custom ? " · Custom" : ""}</span></div></div>
    <div className="libraryActions">
      <button className={favorites.includes(e.id) ? "favoriteBtn active" : "favoriteBtn"} title={favorites.includes(e.id) ? "Remove favorite" : "Add favorite"} onClick={ev => {ev.stopPropagation();toggleFavorite(e.id)}}><Star size={18} fill={favorites.includes(e.id) ? "currentColor" : "none"}/></button>
      {e.custom && <button className="delete" title="Delete custom exercise" onClick={ev => {ev.stopPropagation();deleteCustom(e.id)}}><Trash2 size={17}/></button>}
      <ChevronRight size={17} className="libraryChevron"/>
    </div>
  </div>;
  return <section>
    <div className="pageHead exerciseLibraryHead"><div><p className="eyebrow">YOUR EXERCISE LIBRARY</p><h1>Exercises</h1><p className="muted">Build your library with favorites and custom exercises.</p></div><button className="primary" onClick={openCreate}><Plus size={17}/> Add exercise</button></div>
    <div className="librarySearch"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search exercises..."/></div>
    {!query && favoriteExercises.length > 0 && <><div className="sectionTitle"><h2>Favorites</h2></div><div className="libraryList">{favoriteExercises.map(renderCard)}</div></>}
    {!query && recentExercises.length > 0 && <><div className="sectionTitle"><h2>Recently used</h2></div><div className="libraryList">{recentExercises.map(renderCard)}</div></>}
    <div className="sectionTitle"><h2>{query ? "Search results" : "All exercises"}</h2><p className="muted">{filtered.length} exercises</p></div>
    {filtered.length ? <div className="libraryList">{filtered.map(renderCard)}</div> : <Empty icon={<Search/>} text="No exercises match your search."/>}
  </section>;
}

function HistoryPage({workouts,remove}:{workouts:Workout[];remove:(id:string)=>void}) {
  const [month,setMonth] = useState(() => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1); });
  const [selected,setSelected] = useState<string | null>(null);
  const [query,setQuery] = useState("");
  const monthLabel = month.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const monthStart = new Date(month.getFullYear(),month.getMonth(),1);
  const firstDay = (monthStart.getDay()+6)%7;
  const daysInMonth = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const calendarDays = Array.from({length:firstDay+daysInMonth},(_,i)=> i<firstDay ? null : i-firstDay+1);
  const dayKey = (y:number,m:number,d:number) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const workoutDay = new Map<string,Workout[]>();
  workouts.filter(w=>w.finished).forEach(w=>{
    const d=new Date(w.date); const key=dayKey(d.getFullYear(),d.getMonth(),d.getDate());
    workoutDay.set(key,[...(workoutDay.get(key)||[]),w]);
  });
  const selectedWorkouts = (selected ? workoutDay.get(selected) || [] : []).filter(w => {
    const q=query.trim().toLowerCase();
    return !q || (w.name+" "+w.exercises.map(e=>e.exercise.name).join(" ")).toLowerCase().includes(q);
  });
  const visibleWorkouts = workouts.filter(w => {
    const q=query.trim().toLowerCase();
    return !q || (w.name+" "+w.exercises.map(e=>e.exercise.name).join(" ")).toLowerCase().includes(q);
  });
  const shiftMonth=(delta:number)=>setMonth(new Date(month.getFullYear(),month.getMonth()+delta,1));
  return <section>
    <div className="pageHead"><div><p className="eyebrow">YOUR LOG</p><h1>Workout history</h1><p className="muted">Browse your training by day or search the log.</p></div></div>
    <div className="historyTools">
      <div className="librarySearch"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search workouts or exercises..."/></div>
      <div className="calendarNav"><button className="iconBtn" onClick={()=>shiftMonth(-1)}><ChevronLeft/></button><strong>{monthLabel}</strong><button className="iconBtn" onClick={()=>shiftMonth(1)}><ChevronRight/></button></div>
    </div>
    <div className="calendarCard">
      <div className="calendarWeek">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><span key={d}>{d}</span>)}</div>
      <div className="calendarGrid">{calendarDays.map((day,i)=>{
        if(!day) return <div className="calendarCell empty" key={`e-${i}`}/>;
        const key=dayKey(month.getFullYear(),month.getMonth(),day); const count=workoutDay.get(key)?.length||0;
        const isSelected=selected===key;
        const isToday=dayKey(new Date().getFullYear(),new Date().getMonth(),new Date().getDate())===key;
        return <button key={key} className={`calendarCell ${count?"hasWorkout":""} ${isSelected?"selected":""} ${isToday?"today":""}`} onClick={()=>setSelected(isSelected?null:key)}>
          <span>{day}</span>{count>0 && <i>{count}</i>}
        </button>;
      })}</div>
      <div className="calendarLegend"><span><i className="dot"/> Workout logged</span><span><i className="todayDot"/> Today</span></div>
    </div>

    {selected && <div className="sectionTitle"><h2>{new Date(selected+"T12:00:00").toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</h2><p className="muted">{selectedWorkouts.length} matching workout{selectedWorkouts.length===1?"":"s"}</p></div>}
    <div className="historyList">
      {(selected ? selectedWorkouts : visibleWorkouts).map(w =>
        <div className="historyCard" key={w.id}>
          <div className="historyMain"><div className="cardIcon"><Dumbbell/></div>
            <div><h3>{w.name}</h3><p>{new Date(w.date).toLocaleString()} · {w.exercises.length} exercises{w.duration ? ` · ${w.duration} min` : ""}</p>
              {w.notes && <p className="historyNote">{w.notes}</p>}
              <div className="miniTags">{w.exercises.slice(0,4).map(e => <span key={e.id}>{e.exercise.name}</span>)}</div>
            </div>
          </div>
          <button className="delete" onClick={() => window.confirm("Delete this workout?") && remove(w.id)}><Trash2 size={17}/></button>
        </div>)}
      {!(selected ? selectedWorkouts : visibleWorkouts).length && <Empty icon={<CalendarDays/>} text={selected ? "No workouts match this search on the selected day." : "No workouts match your search."}/>}
    </div>
  </section>;
}

function getTrackedExerciseNames(workouts: Workout[]) {
  const names = new Set<string>();
  for (const workout of workouts) {
    if (!workout.finished) continue;
    for (const exercise of workout.exercises) {
      const hasLoggedSet = exercise.sets.some(s => s.completed && (s.reps > 0 || s.weight > 0));
      if (hasLoggedSet) names.add(exercise.exercise.name);
    }
  }
  return [...names];
}

function makeEmptyPR(): PRRecord {
  return {weight:0,reps:0,volume:0,estimated1RM:0,weightDate:"",repsDate:"",volumeDate:"",estimated1RMDate:""};
}

function ProgressPage({prs,workouts,exercises,openDetail}:{prs:Record<string,PRRecord>;workouts:Workout[];exercises:Exercise[];openDetail:(name:string)=>void}) {
  const names = getTrackedExerciseNames(workouts);
  const [search,setSearch] = useState("");
  const [muscleFilter,setMuscleFilter] = useState("All");
  const order = ["Chest","Back","Shoulders","Biceps","Triceps","Legs","Core"];
  const muscleForName = (name:string) => exercises.find(e => e.name === name)?.muscle || workouts.flatMap(w => w.exercises).find(e => e.exercise.name === name)?.exercise.muscle || "Core";
  const filteredNames = names.filter(name => {
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
    const matchesMuscle = muscleFilter === "All" || muscleForName(name) === muscleFilter;
    return matchesSearch && matchesMuscle;
  });
  const grouped = order
    .map(m => ({muscle:m, exercises:filteredNames.filter(n => muscleForName(n) === m)}))
    .filter(g => g.exercises.length);

  return <section>
    <div className="pageHead"><div><p className="eyebrow">YOUR NUMBERS</p><h1>Progress</h1></div></div>

    <div className="progressSummary">
      <div><Flame/><strong>{workouts.filter(w=>w.finished).length}</strong><span>sessions logged</span></div>
      <div><Trophy/><strong>{names.length}</strong><span>exercises tracked</span></div>
    </div>

    <div className="sectionTitle"><h2>Exercise progress</h2><p className="muted">Search or filter an exercise, then open its detail page.</p></div>
    <div className="progressFilters">
      <div className="librarySearch"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tracked exercises..."/></div>
      <select className="filterSelect" value={muscleFilter} onChange={e=>setMuscleFilter(e.target.value)}><option>All</option>{order.map(m=><option key={m}>{m}</option>)}</select>
    </div>

    {!names.length
      ? <Empty icon={<BarChart3/>} text="Complete a set to start tracking your progress."/>
      : <div className="muscleGroups">{grouped.map(group =>
          <div className="muscleGroup" key={group.muscle}>
            <div className="muscleGroupHead"><h2>{group.muscle}</h2><span>{group.exercises.length} {group.exercises.length === 1 ? "exercise" : "exercises"}</span></div>
            <div className="progressList">{group.exercises.map(name => {
              const record = prs[name];
              const latest = exerciseAnalytics(workouts,name).at(-1);
              return <button className="progressCard clickable" key={name} onClick={() => openDetail(name)}>
                <div><strong>{name}</strong><span>{record?.weight ? `${record.weight} kg PR · ` : ""}{record?.reps ? `${record.reps} rep PR · ` : ""}{latest ? `${latest.reps} reps logged` : ""}</span></div>
                <div className="progressValue">{record?.weight ? <>{record.weight} <small>kg</small></> : <>{latest?.reps || 0} <small>reps</small></>}</div>
              </button>;
            })}</div>
          </div>)}</div>}
  </section>;
}

function ExerciseDetailPage({name,record,workouts,back}:{name:string;record:PRRecord;workouts:Workout[];back:()=>void}) {
  return <ExerciseProgress name={name} record={record} workouts={workouts} back={back} backLabel="Exercises"/>;
}

function ExerciseProgress({name,record,workouts,back,backLabel="Progress"}:{
  name:string; record:PRRecord; workouts:Workout[]; back:()=>void; backLabel?:string
}) {
  const [range,setRange] = useState("All");
  const cutoff = useMemo(() => {
    if (range === "All") return 0;
    const days = Number(range.replace("M", "")) * 30;
    return Date.now() - days * 86400000;
  }, [range]);
  const points = workouts
    .flatMap(w => w.exercises
      .filter(e => e.exercise.name === name)
      .flatMap(e => e.sets
        .filter(s => s.completed && (s.weight > 0 || s.reps > 0))
        .map(s => ({date:w.date,weight:s.weight,reps:s.reps}))))
    .filter(p => !cutoff || +new Date(p.date) >= cutoff)
    .sort((a,b) => +new Date(a.date) - +new Date(b.date));

  const analytics = exerciseAnalytics(workouts,name).filter(p => !cutoff || +new Date(p.date) >= cutoff);
  const weightedPoints = points.filter(p => p.weight > 0 && p.reps > 0);
  const totalVolume = analytics.reduce((sum,p)=>sum+p.volume,0);
  const totalReps = analytics.reduce((sum,p)=>sum+p.reps,0);
  const bestRecentWeight = weightedPoints.length ? Math.max(...weightedPoints.map(p=>p.weight)) : 0;

  return <section>
    <div className="pageHead exerciseDetailHead">
      <div>
        <button className="back" onClick={back}><ChevronLeft/> {backLabel}</button>
        <p className="eyebrow">EXERCISE DETAIL</p>
        <h1>{name}</h1>
        <p className="muted">Your completed sets, trends, and PRs for this exercise.</p>
      </div>
    </div>

    <div className="rangeBar"><span>Time range</span><div>{["1M","3M","6M","1Y","All"].map(r=><button key={r} className={range===r?"rangeBtn active":"rangeBtn"} onClick={()=>setRange(r)}>{r}</button>)}</div></div>

    <div className="stats prStats">
      <Stat icon={<Trophy/>} label="Weight PR" value={record.weight ? record.weight + " kg" : "—"}/>
      <Stat icon={<Activity/>} label="Rep PR" value={record.reps ? record.reps + " reps" : "—"}/>
      <Stat icon={<Zap/>} label="Range volume" value={totalVolume ? (totalVolume >= 1000 ? (totalVolume/1000).toFixed(1)+"k kg" : Math.round(totalVolume)+" kg") : "—"}/>
      <Stat icon={<Flame/>} label="Range best weight" value={bestRecentWeight ? bestRecentWeight+" kg" : "—"}/>
    </div>

    <WeightChart points={weightedPoints}/>
    <ExerciseAnalyticsCharts points={analytics}/>

    <div className="sectionTitle"><h2>PR details</h2></div>
    <div className="prDetailGrid">
      <div className="prDetail"><strong>Weight PR</strong><span>{record.weight ? record.weight + " kg" : "—"}</span><small>{record.weightDate ? new Date(record.weightDate).toLocaleDateString() : "Not available"}</small></div>
      <div className="prDetail"><strong>Rep PR</strong><span>{record.reps ? record.reps + " reps" : "—"}</span><small>{record.repsDate ? new Date(record.repsDate).toLocaleDateString() : "Not available"}</small></div>
      <div className="prDetail"><strong>Volume PR</strong><span>{record.volume ? Math.round(record.volume) + " kg" : "—"}</span><small>{record.volumeDate ? new Date(record.volumeDate).toLocaleDateString() : "Not available"}</small></div>
      <div className="prDetail"><strong>Estimated 1RM</strong><span>{record.estimated1RM ? Math.round(record.estimated1RM) + " kg" : "—"}</span><small>{record.estimated1RMDate ? new Date(record.estimated1RMDate).toLocaleDateString() : "Not available"}</small></div>
    </div>

    <div className="sectionTitle"><h2>Logged sets</h2><p className="muted">{points.length} completed set{points.length===1?"":"s"} · {totalReps} reps in range</p></div>
    <div className="historyList">
      {points.slice().reverse().map((point,i) =>
        <div className="historyCard" key={point.date + "-" + i}>
          <div className="historyMain"><div className="cardIcon"><Dumbbell/></div>
            <div><h3>{new Date(point.date).toLocaleDateString()}</h3><p>{point.weight > 0 ? `${point.weight} kg × ${point.reps || 0} reps` : `${point.reps || 0} reps`}</p></div>
          </div>
        </div>)}
      {!points.length && <Empty icon={<BarChart3/>} text="No completed sets in this time range."/>}
    </div>
  </section>;
}

function MiniLineChart({title, subtitle, values, unit}:{
  title:string; subtitle:string; values:{date:string,value:number}[]; unit:string
}) {
  if (!values.length) return <Empty icon={<BarChart3/>} text={`No ${title.toLowerCase()} data yet.`}/>;
  const W=900,H=300,PL=58,PR=22,PT=28,PB=45,innerW=W-PL-PR,innerH=H-PT-PB;
  const nums=values.map(v=>v.value), min=Math.min(...nums), max=Math.max(...nums);
  const pad=Math.max((max-min)*.15, max*.03, 1), minY=Math.max(0,min-pad), maxY=max+pad, range=maxY-minY||1;
  const x=(i:number)=>values.length===1?PL+innerW/2:PL+i/(values.length-1)*innerW;
  const y=(v:number)=>PT+(maxY-v)/range*innerH;
  const path=values.map((p,i)=>(i?"L":"M")+` ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  return <div className="chartCard analyticsChart">
    <div className="chartHeader"><div><h2>{title}</h2><p>{subtitle}</p></div><span className="chartLegend"><i/> {unit}</span></div>
    <div className="chartWrap"><svg viewBox={`0 0 ${W} ${H}`}>
      <line x1={PL} x2={W-PR} y1={PT+innerH} y2={PT+innerH} className="axisLine"/>
      <path d={path} className="chartLine"/>
      {values.map((p,i)=><g key={i}><circle cx={x(i)} cy={y(p.value)} r="4" className="chartDot"/><title>{new Date(p.date).toLocaleDateString()} · {p.value} {unit}</title></g>)}
      <text x={PL} y={H-12} className="axisText">{new Date(values[0].date).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</text>
      {values.length>1 && <text x={W-PR} y={H-12} textAnchor="end" className="axisText">{new Date(values[values.length-1].date).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</text>}
    </svg></div>
  </div>;
}

function ExerciseAnalyticsCharts({points}:{points:AnalyticsPoint[]}) {
  return <div className="analyticsStack">
    <MiniLineChart title="Volume progression" subtitle="Total completed-set volume per workout" values={points.map(p=>({date:p.date,value:p.volume}))} unit="kg"/>
    <MiniLineChart title="Rep progression" subtitle="Total completed reps per workout" values={points.map(p=>({date:p.date,value:p.reps}))} unit="reps"/>
    <MiniLineChart title="Estimated 1RM" subtitle="Highest estimated 1RM from each workout" values={points.map(p=>({date:p.date,value:p.estimated1RM}))} unit="kg"/>
  </div>;
}

function StatisticsPage({workouts,prs}:{workouts:Workout[];prs:Record<string,PRRecord>}) {
  const stats = overallStatistics(workouts);
  const muscleRows = Object.entries(stats.muscleVolume).sort((a,b)=>b[1]-a[1]);
  return <section>
    <div className="pageHead"><div><p className="eyebrow">YOUR TRAINING DATA</p><h1>Statistics</h1><p className="muted">A summary of your logged training history.</p></div></div>
    <div className="stats analyticsStats">
      <Stat icon={<Dumbbell/>} label="Sessions" value={stats.sessions}/>
      <Stat icon={<Zap/>} label="Total volume" value={stats.totalVolume >= 1000 ? (stats.totalVolume/1000).toFixed(1)+"k kg" : Math.round(stats.totalVolume)+" kg"}/>
      <Stat icon={<Activity/>} label="Completed sets" value={stats.totalSets}/>
      <Stat icon={<Flame/>} label="Total reps" value={stats.totalReps}/>
    </div>
    <div className="sectionTitle"><h2>Volume by muscle group</h2></div>
    {!muscleRows.length ? <Empty icon={<BarChart3/>} text="Complete workouts to build your statistics."/> :
      <div className="statRows">{muscleRows.map(([muscle,v]) => {
        const max=muscleRows[0][1]||1;
        return <div className="statRow" key={muscle}><div><strong>{muscle}</strong><span>{Math.round(v)} kg</span></div><div className="statBar"><i style={{width:`${Math.max(3, v/max*100)}%`}}/></div></div>;
      })}</div>}
    <div className="sectionTitle"><h2>Exercises tracked</h2><p className="muted">{Object.keys(prs).length} exercises have completed-set data.</p></div>
  </section>;
}

function WeightChart({points}:{points:{date:string,weight:number,reps:number}[]}) {
  if (!points.length) return <Empty icon={<BarChart3/>} text="Complete a weighted set to start your graph."/>;
  const byDay = new Map<string, typeof points[number]>();
  points.forEach(point => {
    const key = new Date(point.date).toLocaleDateString();
    const existing = byDay.get(key);
    if (!existing || point.weight > existing.weight) byDay.set(key, point);
  });

  const data = [...byDay.values()].sort((a,b) => +new Date(a.date) - +new Date(b.date));
  const W=900,H=360,PL=62,PR=24,PT=35,PB=52,innerW=W-PL-PR,innerH=H-PT-PB;
  const weights=data.map(p=>p.weight), minRaw=Math.min(...weights), maxRaw=Math.max(...weights);
  const pad=Math.max(2,(maxRaw-minRaw)*.15);
  const minY=Math.max(0,Math.floor((minRaw-pad)/2)*2);
  const maxY=Math.ceil((maxRaw+pad)/2)*2 || 2;
  const range=maxY-minY || 1;
  const x=(i:number)=>data.length===1?PL+innerW/2:PL+i/(data.length-1)*innerW;
  const y=(v:number)=>PT+(maxY-v)/range*innerH;
  const path=data.map((p,i)=>(i?"L":"M")+` ${x(i).toFixed(1)} ${y(p.weight).toFixed(1)}`).join(" ");
  const ticks=Array.from({length:5},(_,i)=>minY+range*i/4);
  const idx=data.length<=5?data.map((_,i)=>i):[0,Math.floor((data.length-1)/2),data.length-1];

  return <div className="chartCard">
    <div className="chartHeader"><div><h2>Weight progression</h2><p>Heaviest weight per workout date</p></div><span className="chartLegend"><i/> Weight (kg)</span></div>
    <div className="chartWrap"><svg viewBox={`0 0 ${W} ${H}`}>
      <defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopOpacity=".30"/><stop offset="100%" stopOpacity=".02"/></linearGradient></defs>
      {ticks.map((tick,i)=><g key={i}><line x1={PL} x2={W-PR} y1={y(tick)} y2={y(tick)} className="gridLine"/><text x={PL-10} y={y(tick)+4} textAnchor="end" className="axisText">{Math.round(tick)}</text></g>)}
      <line x1={PL} x2={W-PR} y1={PT+innerH} y2={PT+innerH} className="axisLine"/>
      <path d={`${path} L ${x(data.length-1)} ${PT+innerH} L ${x(0)} ${PT+innerH} Z`} className="areaFill"/>
      <path d={path} className="chartLine"/>
      {data.map((point,i)=><g key={i}><circle cx={x(i)} cy={y(point.weight)} r="5" className="chartDot"><title>{new Date(point.date).toLocaleDateString()} · {point.weight} kg × {point.reps} reps</title></circle>
        {idx.includes(i) && <text x={x(i)} y={H-19} textAnchor="middle" className="axisText">{new Date(point.date).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</text>}
      </g>)}
    </svg></div>
  </div>;
}

function Profile({
  weight,setWeight,dark,setDark,defaultRest,setDefaultRest,exportBackup,importBackup
}:{
  weight:number; setWeight:(n:number)=>void; dark:boolean; setDark:(b:boolean)=>void;
  defaultRest:number; setDefaultRest:(n:number)=>void; exportBackup:()=>void; importBackup:()=>void;
}) {
  const presets=[30,60,90,120,180];
  return <section>
    <div className="pageHead"><div><p className="eyebrow">SETTINGS</p><h1>Profile</h1></div></div>
    <div className="settingsCard">
      <div className="setting">
        <div><strong>Body weight</strong><span>Used for your personal tracking</span></div>
        <input className="smallInput" type="number" value={weight} onChange={e=>setWeight(Number(e.target.value))}/>
        <b>kg</b>
      </div>
      <div className="setting">
        <div><strong>Default rest</strong><span>Auto-starts after you complete a set</span></div>
        <select className="smallInput restSelect" value={defaultRest} onChange={e=>setDefaultRest(Number(e.target.value))}>
          {presets.map(s=><option key={s} value={s}>{s >= 60 ? `${s/60} min` : `${s} sec`}</option>)}
        </select>
      </div>
      <div className="setting">
        <div><strong>Dark theme</strong><span>Use a darker interface</span></div>
        <button className={dark ? "toggle on" : "toggle"} onClick={() => setDark(!dark)}><span/></button>
      </div>
    </div>
    <div className="backupCard">
      <div><strong>Data backup</strong><span>Export everything to a JSON file or restore a previous backup.</span></div>
      <div className="backupActions"><button className="secondary" onClick={exportBackup}><Download size={16}/> Export backup</button><button className="primary" onClick={importBackup}><Upload size={16}/> Import backup</button></div>
    </div>
    <div className="about"><Dumbbell/><div><strong>GymTrack</strong><p>Simple workout tracking, built to help you focus on the next rep.</p></div></div>
  </section>;
}

export default App;
