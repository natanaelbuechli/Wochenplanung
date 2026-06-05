"use client";

import { FormEvent, TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, Session, User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { DAYS, TIMES, type Day, type Entry, type Profile, type TimeSlot, type Todo, type Week } from "@/lib/types";

const supabase = createBrowserSupabaseClient();

type EntryDrafts = Record<string, string>;
type TodoDrafts = Record<string, string>;

function getEntryKey(day: Day, time: TimeSlot) {
  return `${day}-${time}`;
}

function isSlotAvailable(day: Day, time: TimeSlot) {
  const disabledAfternoons: Day[] = ["Montag", "Mittwoch", "Freitag"];
  return !(time === "Nachmittag" && disabledAfternoons.includes(day));
}

function getShortDayLabel(day: Day) {
  const labels: Record<Day, string> = {
    Montag: "Mo",
    Dienstag: "Di",
    Mittwoch: "Mi",
    Donnerstag: "Do",
    Freitag: "Fr"
  };

  return labels[day];
}

function getShortTimeLabel(time: TimeSlot) {
  return time === "Morgen" ? "AM" : "PM";
}

function getDayDateLabel(weekStartDate: string, day: Day) {
  const offsets: Record<Day, number> = {
    Montag: 0,
    Dienstag: 1,
    Mittwoch: 2,
    Donnerstag: 3,
    Freitag: 4
  };

  const [year, month, dayOfMonth] = weekStartDate.split("-").map(Number);
  const date = new Date(year, month - 1, dayOfMonth);
  date.setDate(date.getDate() + offsets[day]);

  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function getNextAssignee(options: string[], currentValue: string | null) {
  const values = ["", ...options];
  const currentIndex = values.findIndex((value) => value === (currentValue ?? ""));
  const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % values.length;
  return values[nextIndex] || null;
}

function getAssigneeLabel(name: string | null) {
  if (!name) {
    return "Alle";
  }

  const cleaned = name.trim();
  if (!cleaned) {
    return "Alle";
  }

  return `${cleaned.slice(0, 3)}.`;
}

function buildEntryDrafts(entries: Entry[]) {
  return entries.reduce<EntryDrafts>((acc, entry) => {
    acc[getEntryKey(entry.day, entry.time)] = entry.content ?? "";
    return acc;
  }, {});
}

function buildTodoDrafts(todos: Todo[]) {
  return todos.reduce<TodoDrafts>((acc, todo) => {
    acc[todo.id] = todo.text ?? "";
    return acc;
  }, {});
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(date));
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekStartDate() {
  const now = new Date();
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = current.getDay();
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + distanceToMonday);
  return formatLocalDate(current);
}

function getCurrentDayLabel(): Day | null {
  const labels: Record<number, Day | null> = {
    0: null,
    1: "Montag",
    2: "Dienstag",
    3: "Mittwoch",
    4: "Donnerstag",
    5: "Freitag",
    6: null
  };

  return labels[new Date().getDay()] ?? null;
}

function getDisplayName(user: User | null) {
  if (!user?.email) {
    return "Teammitglied";
  }

  return user.user_metadata.display_name || user.email.split("@")[0];
}

function getNextWeekData(weeks: Week[]) {
  const latestWeek = [...weeks].sort((a, b) => a.start_date.localeCompare(b.start_date)).at(-1);
  const baseDate = latestWeek ? new Date(latestWeek.start_date) : new Date();

  if (!latestWeek) {
    const day = baseDate.getDay();
    const distanceToMonday = day === 0 ? -6 : 1 - day;
    baseDate.setDate(baseDate.getDate() + distanceToMonday);
  } else {
    baseDate.setDate(baseDate.getDate() + 7);
  }

  const normalized = new Date(Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()));
  const thursday = new Date(normalized);
  thursday.setUTCDate(normalized.getUTCDate() + 4 - (normalized.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return {
    kw: weekNumber,
    start_date: normalized.toISOString().slice(0, 10)
  };
}

export function PlannerApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryDrafts, setEntryDrafts] = useState<EntryDrafts>({});
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoDrafts, setTodoDrafts] = useState<TodoDrafts>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [todoDraft, setTodoDraft] = useState("");
  const [showOtherTodos, setShowOtherTodos] = useState(false);
  const [showCompletedTodos, setShowCompletedTodos] = useState(false);
  const [showArchivedWeeks, setShowArchivedWeeks] = useState(false);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [entriesByWeek, setEntriesByWeek] = useState<Record<string, Entry[]>>({});
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragAnimating, setIsDragAnimating] = useState(false);
  const saveTimers = useRef<Record<string, number>>({});
  const todoSaveTimers = useRef<Record<string, number>>({});
  const selectedWeekIdRef = useRef<string | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const swipeLockedRef = useRef<"horizontal" | "vertical" | null>(null);
  const plannerViewportRef = useRef<HTMLDivElement | null>(null);

  const activeWeek = useMemo(
    () => weeks.find((week) => week.id === selectedWeekId) ?? null,
    [selectedWeekId, weeks]
  );

  const sortedWeeks = useMemo(() => {
    const currentWeekStart = getCurrentWeekStartDate();

    return [...weeks].sort((a, b) => {
      if (a.archived !== b.archived) {
        return a.archived ? 1 : -1;
      }

      const aIsCurrent = a.start_date === currentWeekStart;
      const bIsCurrent = b.start_date === currentWeekStart;

      if (aIsCurrent && !bIsCurrent) {
        return -1;
      }

      if (!aIsCurrent && bIsCurrent) {
        return 1;
      }

      return a.start_date.localeCompare(b.start_date);
    });
  }, [weeks]);

  const activeWeeks = useMemo(() => sortedWeeks.filter((week) => !week.archived), [sortedWeeks]);
  const archivedWeeks = useMemo(
    () => sortedWeeks.filter((week) => week.archived).sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [sortedWeeks]
  );
  const currentWeekStart = useMemo(() => getCurrentWeekStartDate(), []);
  const currentDayLabel = useMemo(() => getCurrentDayLabel(), []);

  const activeWeekIndex = useMemo(
    () => activeWeeks.findIndex((week) => week.id === selectedWeekId),
    [activeWeeks, selectedWeekId]
  );
  const previousActiveWeek = activeWeekIndex > 0 ? activeWeeks[activeWeekIndex - 1] : null;
  const nextActiveWeek =
    activeWeekIndex >= 0 && activeWeekIndex < activeWeeks.length - 1
      ? activeWeeks[activeWeekIndex + 1]
      : null;

  const assignableUsers = useMemo(() => {
    const profileNames = profiles
      .map((profile) => profile.display_name || profile.email.split("@")[0])
      .filter(Boolean);
    const todoNames = todos.map((todo) => todo.assigned_to).filter(Boolean) as string[];
    const currentUserName = getDisplayName(session?.user ?? null);

    return Array.from(new Set([...profileNames, ...todoNames, currentUserName])).sort((a, b) =>
      a.localeCompare(b, "de")
    );
  }, [profiles, session?.user, todos]);

  const currentUserName = getDisplayName(session?.user ?? null);

  const visibleOpenTodos = useMemo(
    () =>
      todos.filter(
        (todo) =>
          !todo.completed &&
          (!todo.assigned_to || todo.assigned_to === currentUserName)
      ),
    [currentUserName, todos]
  );

  const otherOpenTodos = useMemo(
    () =>
      todos.filter(
        (todo) =>
          !todo.completed &&
          todo.assigned_to &&
          todo.assigned_to !== currentUserName
      ),
    [currentUserName, todos]
  );

  const completedTodos = useMemo(() => todos.filter((todo) => todo.completed), [todos]);

  async function bootstrap() {
    setError("");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      setError(sessionError.message);
    }

    const currentSession = sessionData.session ?? null;
    setSession(currentSession);
    setLoading(false);

    if (!currentSession) {
      setWeeks([]);
      setSelectedWeekId(null);
      setEntries([]);
      setEntryDrafts({});
      setEntriesByWeek({});
      setTodos([]);
      setTodoDrafts({});
      setProfiles([]);
      return;
    }

    const [weeksResult, todosResult, profilesResult] = await Promise.all([
      supabase.from("weeks").select("*").order("start_date", { ascending: false }),
      supabase.from("todos").select("*").order("completed", { ascending: true }).order("id", { ascending: false }),
      supabase.from("profiles").select("*").order("display_name", { ascending: true })
    ]);

    if (weeksResult.error) {
      setError(weeksResult.error.message);
    } else {
      setWeeks(weeksResult.data ?? []);

      if (!selectedWeekIdRef.current) {
        const initialWeek =
          weeksResult.data?.find((week) => !week.archived && week.start_date === currentWeekStart) ??
          weeksResult.data?.find((week) => !week.archived) ??
          weeksResult.data?.[0] ??
          null;
        setSelectedWeekId(initialWeek?.id ?? null);
      }
    }

    if (todosResult.error) {
      setError(todosResult.error.message);
    } else {
      setTodos(todosResult.data ?? []);
      setTodoDrafts((current) => {
        const incoming = buildTodoDrafts(todosResult.data ?? []);
        const nextDrafts = { ...incoming };

        Object.keys(current).forEach((todoId) => {
          if (todoSaveTimers.current[todoId]) {
            nextDrafts[todoId] = current[todoId];
          }
        });

        return nextDrafts;
      });
    }

    if (profilesResult.error) {
      setError(profilesResult.error.message);
    } else {
      setProfiles(profilesResult.data ?? []);
    }

  }

  async function loadEntries(weekId: string | null) {
    if (!weekId) {
      setEntries([]);
      setEntryDrafts({});
      return;
    }

    const { data, error: entriesError } = await supabase
      .from("entries")
      .select("*")
      .eq("week_id", weekId);

    if (entriesError) {
      setError(entriesError.message);
      return;
    }

    setEntries(data ?? []);
    setEntriesByWeek((current) => ({
      ...current,
      [weekId]: data ?? []
    }));
    setEntryDrafts(buildEntryDrafts(data ?? []));
  }

  async function loadWeekEntriesIntoCache(weekId: string | null) {
    if (!weekId) {
      return;
    }

    const { data, error: entriesError } = await supabase
      .from("entries")
      .select("*")
      .eq("week_id", weekId);

    if (entriesError) {
      setError(entriesError.message);
      return;
    }

    setEntriesByWeek((current) => ({
      ...current,
      [weekId]: data ?? []
    }));
  }

  useEffect(() => {
    selectedWeekIdRef.current = selectedWeekId;
  }, [selectedWeekId]);

  useEffect(() => {
    async function recoverSessionFromUrl() {
      if (typeof window === "undefined") {
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }

        window.history.replaceState({}, "", "/");
        await bootstrap();
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        window.history.replaceState({}, "", "/");
        await bootstrap();
        return;
      }

      if (tokenHash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as
            | "signup"
            | "invite"
            | "magiclink"
            | "recovery"
            | "email_change"
            | "email"
        });

        if (verifyError) {
          setError(verifyError.message);
          return;
        }

        window.history.replaceState({}, "", "/");
        await bootstrap();
      }
    }

    recoverSessionFromUrl().catch((authError: Error) => {
      setError(authError.message);
    });

    bootstrap().catch((bootstrapError: Error) => {
      setError(bootstrapError.message);
      setLoading(false);
    });

    const authSubscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        const displayName = getDisplayName(nextSession.user);
        supabase.from("profiles").upsert(
          {
            id: nextSession.user.id,
            email: nextSession.user.email,
            display_name: displayName
          },
          { onConflict: "id" }
        ).then(() => bootstrap());
      } else {
        setWeeks([]);
        setSelectedWeekId(null);
        setEntries([]);
        setEntryDrafts({});
        setEntriesByWeek({});
        setTodos([]);
        setTodoDrafts({});
        setProfiles([]);
      }
    });

    const realtimeChannel: RealtimeChannel = supabase
      .channel("planner-room")
      .on("postgres_changes", { event: "*", schema: "public", table: "weeks" }, () => {
        bootstrap();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, () => {
        loadEntries(selectedWeekIdRef.current).catch((entryError: Error) => setError(entryError.message));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "todos" }, () => {
        bootstrap();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        bootstrap();
      })
      .subscribe();

    return () => {
      authSubscription.data.subscription.unsubscribe();
      supabase.removeChannel(realtimeChannel);
      Object.values(saveTimers.current).forEach((timer) => window.clearTimeout(timer));
      Object.values(todoSaveTimers.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    loadEntries(selectedWeekId).catch((entryError: Error) => setError(entryError.message));
  }, [selectedWeekId, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    [previousActiveWeek?.id ?? null, nextActiveWeek?.id ?? null].forEach((weekId) => {
      if (!weekId || entriesByWeek[weekId]) {
        return;
      }

      loadWeekEntriesIntoCache(weekId).catch((entryError: Error) => setError(entryError.message));
    });
  }, [entriesByWeek, nextActiveWeek?.id, previousActiveWeek?.id, session]);

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAuthInfo("");

    const redirectTo =
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}/auth/callback?next=/`;

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
        emailRedirectTo: redirectTo
      }
    });

    if (authError) {
      setError(authError.message);
      return;
    }

    setAuthInfo("Magic Link wurde verschickt. Bitte die Mail oeffnen und den Link bestaetigen.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
  }

  function handleEntryChange(day: Day, time: TimeSlot, value: string) {
    if (!activeWeek) {
      return;
    }

    const key = getEntryKey(day, time);
    setEntryDrafts((current) => ({
      ...current,
      [key]: value
    }));
    setEntriesByWeek((current) => {
      const weekEntries = current[activeWeek.id] ?? [];
      const existingEntry = weekEntries.find((entry) => entry.day === day && entry.time === time);

      if (existingEntry) {
        return {
          ...current,
          [activeWeek.id]: weekEntries.map((entry) =>
            entry.day === day && entry.time === time
              ? {
                  ...entry,
                  content: value
                }
              : entry
          )
        };
      }

      return {
        ...current,
        [activeWeek.id]: [
          ...weekEntries,
          {
            id: `draft-${activeWeek.id}-${day}-${time}`,
            week_id: activeWeek.id,
            day,
            time,
            content: value
          }
        ]
      };
    });
    setSavingKey(key);

    const currentTimer = saveTimers.current[key];
    if (currentTimer) {
      window.clearTimeout(currentTimer);
    }

    saveTimers.current[key] = window.setTimeout(async () => {
      const { error: upsertError } = await supabase.from("entries").upsert(
        {
          week_id: activeWeek.id,
          day,
          time,
          content: value
        },
        { onConflict: "week_id,day,time" }
      );

      if (upsertError) {
        setError(upsertError.message);
      } else {
        setSavingKey((current) => (current === key ? null : current));
      }
    }, 450);
  }

  async function createWeek() {
    setError("");
    const nextWeek = getNextWeekData(weeks);
    const { data, error: weekError } = await supabase
      .from("weeks")
      .insert({
        ...nextWeek,
        archived: false
      })
      .select()
      .single();

    if (weekError) {
      setError(weekError.message);
      return;
    }

    if (data) {
      setWeeks((current) => [data, ...current.filter((week) => week.id !== data.id)]);
      setSelectedWeekId(data.id);
    }
  }

  async function archiveWeek() {
    if (!activeWeek || activeWeek.archived) {
      return;
    }

    const nextSelectedWeek =
      activeWeeks.find((week) => week.id !== activeWeek.id)?.id ??
      archivedWeeks[0]?.id ??
      null;

    setWeeks((current) =>
      current.map((week) =>
        week.id === activeWeek.id
          ? {
              ...week,
              archived: true
            }
          : week
      )
    );
    setSelectedWeekId(nextSelectedWeek);

    const { error: archiveError } = await supabase
      .from("weeks")
      .update({ archived: true })
      .eq("id", activeWeek.id);

    if (archiveError) {
      setError(archiveError.message);
      bootstrap().catch((bootstrapError: Error) => setError(bootstrapError.message));
    }
  }

  async function restoreWeek(weekId: string) {
    setWeeks((current) =>
      current.map((week) =>
        week.id === weekId
          ? {
              ...week,
              archived: false
            }
          : week
      )
    );
    setSelectedWeekId(weekId);

    const { error: restoreError } = await supabase
      .from("weeks")
      .update({ archived: false })
      .eq("id", weekId);

    if (restoreError) {
      setError(restoreError.message);
      bootstrap().catch((bootstrapError: Error) => setError(bootstrapError.message));
    }
  }

  async function createTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!todoDraft.trim()) {
      return;
    }

    const { data, error: todoError } = await supabase
      .from("todos")
      .insert({
        text: todoDraft.trim(),
        completed: false,
        assigned_to: getDisplayName(session?.user ?? null)
      })
      .select()
      .single();

    if (todoError) {
      setError(todoError.message);
      return;
    }

    if (data) {
      setTodos((current) => [data, ...current.filter((todo) => todo.id !== data.id)]);
      setTodoDrafts((current) => ({
        ...current,
        [data.id]: data.text
      }));
    }

    setTodoDraft("");
  }

  async function updateTodo(todoId: string, patch: Partial<Todo>) {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              ...patch
            }
          : todo
      )
    );

    const { error: todoError } = await supabase.from("todos").update(patch).eq("id", todoId);
    if (todoError) {
      setError(todoError.message);
      bootstrap().catch((bootstrapError: Error) => setError(bootstrapError.message));
    }
  }

  function handleTodoTextChange(todoId: string, value: string) {
    setTodoDrafts((current) => ({
      ...current,
      [todoId]: value
    }));

    const currentTimer = todoSaveTimers.current[todoId];
    if (currentTimer) {
      window.clearTimeout(currentTimer);
    }

    todoSaveTimers.current[todoId] = window.setTimeout(async () => {
      const { error: todoError } = await supabase.from("todos").update({ text: value }).eq("id", todoId);

      if (todoError) {
        setError(todoError.message);
        return;
      }

      delete todoSaveTimers.current[todoId];
    }, 350);
  }

  async function cycleTodoAssignee(todo: Todo) {
    await updateTodo(todo.id, {
      assigned_to: getNextAssignee(assignableUsers, todo.assigned_to ?? null)
    });
  }

  function autoResizeTodoField(element: HTMLTextAreaElement) {
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }

  function getWeekDrafts(week: Week | null) {
    if (!week) {
      return {};
    }

    if (week.id === selectedWeekId) {
      return entryDrafts;
    }

    return buildEntryDrafts(entriesByWeek[week.id] ?? []);
  }

  function renderWeekColumns(week: Week | null) {
    if (!week) {
      return <div className="planner-placeholder" />;
    }

    const drafts = getWeekDrafts(week);
    const isCurrentCalendarWeek = week.start_date === currentWeekStart;

    return (
      <div className="planning-table">
        {DAYS.map((day) => (
          <article
            className={`day-column ${isCurrentCalendarWeek && currentDayLabel === day ? "current-day" : ""}`}
            data-day={day}
            key={`${week.id}-${day}`}
          >
            <div className="day-header">
              <strong>{getShortDayLabel(day)}</strong>
              <span className="day-date">{getDayDateLabel(week.start_date, day)}</span>
            </div>
            {TIMES.map((time) => {
              if (!isSlotAvailable(day, time)) {
                return null;
              }

              const key = getEntryKey(day, time);
              const isEditable = week.id === selectedWeekId;

              return (
                <label className="day-cell" key={`${week.id}-${key}`}>
                  <textarea
                    placeholder={isEditable ? "Eintragen..." : ""}
                    readOnly={!isEditable}
                    value={drafts[key] ?? ""}
                    onChange={(event) => handleEntryChange(day, time, event.target.value)}
                  />
                </label>
              );
            })}
          </article>
        ))}
      </div>
    );
  }

  function selectRelativeWeek(direction: "prev" | "next") {
    if (activeWeekIndex === -1) {
      return;
    }

    const offset = direction === "next" ? 1 : -1;
    const targetWeek = activeWeeks[activeWeekIndex + offset];

    if (targetWeek) {
      setSelectedWeekId(targetWeek.id);
    }
  }

  function handlePlannerTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    swipeStartXRef.current = touch?.clientX ?? null;
    swipeStartYRef.current = touch?.clientY ?? null;
    swipeLockedRef.current = null;
    setIsDragAnimating(false);
  }

  function handlePlannerTouchMove(event: TouchEvent<HTMLElement>) {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - swipeStartXRef.current;
    const deltaY = touch.clientY - swipeStartYRef.current;

    if (!swipeLockedRef.current) {
      if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) {
        return;
      }

      swipeLockedRef.current =
        Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    if (swipeLockedRef.current === "horizontal") {
      setDragOffset(deltaX);
      event.preventDefault();
    }
  }

  function handlePlannerTouchEnd(event: TouchEvent<HTMLElement>) {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) {
      return;
    }

    const touch = event.changedTouches[0];
    const endX = touch?.clientX ?? swipeStartXRef.current;
    const endY = touch?.clientY ?? swipeStartYRef.current;
    const deltaX = endX - swipeStartXRef.current;
    const deltaY = endY - swipeStartYRef.current;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    const swipeMode = swipeLockedRef.current;
    swipeLockedRef.current = null;

    if (swipeMode !== "horizontal") {
      setDragOffset(0);
      return;
    }

    if (Math.abs(deltaX) <= Math.abs(deltaY)) {
      setIsDragAnimating(true);
      setDragOffset(0);
      window.setTimeout(() => setIsDragAnimating(false), 220);
      return;
    }

    const viewportWidth = plannerViewportRef.current?.offsetWidth ?? 0;
    const threshold = Math.max(50, viewportWidth * 0.18);

    if (Math.abs(deltaX) < threshold) {
      setIsDragAnimating(true);
      setDragOffset(0);
      window.setTimeout(() => setIsDragAnimating(false), 220);
      return;
    }

    if (deltaX < 0) {
      if (!nextActiveWeek || viewportWidth === 0) {
        setIsDragAnimating(true);
        setDragOffset(0);
        window.setTimeout(() => setIsDragAnimating(false), 220);
        return;
      }

      setIsDragAnimating(true);
      setDragOffset(-viewportWidth);
      window.setTimeout(() => {
        setSelectedWeekId(nextActiveWeek.id);
        setDragOffset(0);
        setIsDragAnimating(false);
      }, 220);
    } else {
      if (!previousActiveWeek || viewportWidth === 0) {
        setIsDragAnimating(true);
        setDragOffset(0);
        window.setTimeout(() => setIsDragAnimating(false), 220);
        return;
      }

      setIsDragAnimating(true);
      setDragOffset(viewportWidth);
      window.setTimeout(() => {
        setSelectedWeekId(previousActiveWeek.id);
        setDragOffset(0);
        setIsDragAnimating(false);
      }, 220);
    }
  }

  function handleWeekArrow(direction: "prev" | "next") {
    if (isDragAnimating) {
      return;
    }

    selectRelativeWeek(direction);
  }

  if (loading) {
    return (
      <main className="planner-shell">
        <section className="loading-card">
          <h1>Wochenplanung wird geladen</h1>
          <p className="muted">Verbindung zu Supabase und Live-Daten wird aufgebaut.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="planner-shell">
        <section className="auth-card">
          <h1>Kindergarten Wochenplanung</h1>
          <p>
            Die App ist bewusst schlank gehalten: anmelden, direkt schreiben und alle Aenderungen
            live im Team sehen.
          </p>
          <form className="auth-form" onSubmit={sendMagicLink}>
            <input
              type="email"
              placeholder="E-Mail-Adresse"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              required
            />
            <button type="submit">Magic Link senden</button>
          </form>
          {authInfo ? <p className="status-pill live">{authInfo}</p> : null}
          {error ? <div className="error-box">{error}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="planner-shell">
      <header className="app-header">
        <div>
          <h1 className="planner-title">Kindergarten Wochenplanung</h1>
          <p className="muted">
            Eingeloggt als <strong>{getDisplayName(session.user)}</strong>. Alle Aenderungen werden
            live synchronisiert.
          </p>
        </div>
        <div className="header-actions">
          <span className="status-pill live">{savingKey ? "Speichert..." : "Live verbunden"}</span>
          <button className="secondary" onClick={createWeek} type="button">
            Neue Woche erstellen
          </button>
          <button onClick={signOut} type="button">
            Abmelden
          </button>
        </div>
      </header>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="planner-layout">
        <aside className="panel">
          <div className="section-title">
            <h2>Wochen</h2>
          </div>
          <div className="weeks-list">
            {weeks.length === 0 ? (
              <div className="empty-state">
                Noch keine Woche vorhanden. Mit dem Button oben kann direkt die naechste KW angelegt
                werden.
              </div>
            ) : (
              <>
                <select
                  className="week-select"
                  onChange={(event) => setSelectedWeekId(event.target.value || null)}
                  value={selectedWeekId ?? ""}
                >
                  <option value="">Woche waehlen</option>
                  {activeWeeks.map((week) => (
                    <option key={week.id} value={week.id}>
                      {`KW ${week.kw} - ${formatDate(week.start_date)}`}
                    </option>
                  ))}
                </select>
                {activeWeek && !activeWeek.archived ? (
                  <button className="text-toggle" onClick={archiveWeek} type="button">
                    Woche ins Archiv verschieben
                  </button>
                ) : null}
                {archivedWeeks.length > 0 ? (
                  <div className="todo-toggle-block">
                    <button
                      className="text-toggle"
                      onClick={() => setShowArchivedWeeks((current) => !current)}
                      type="button"
                    >
                      {showArchivedWeeks
                        ? `Archiv ausblenden (${archivedWeeks.length})`
                        : `Archiv anzeigen (${archivedWeeks.length})`}
                    </button>
                    {showArchivedWeeks ? (
                      <div className="weeks-list nested">
                        {archivedWeeks.map((week) => (
                          <div
                            key={week.id}
                            className={`week-card ${selectedWeekId === week.id ? "active" : ""}`}
                          >
                            <button
                              className="week-card-button"
                              onClick={() => setSelectedWeekId(week.id)}
                              type="button"
                            >
                              <strong>{`KW ${week.kw}`}</strong>
                              <span className="week-meta">Start: {formatDate(week.start_date)}</span>
                            </button>
                            <button
                              className="restore-week-button"
                              onClick={() => restoreWeek(week.id)}
                              type="button"
                            >
                              Wiederherstellen
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>

        <section
          className="panel planning-panel"
          onTouchEnd={handlePlannerTouchEnd}
          onTouchMove={handlePlannerTouchMove}
          onTouchStart={handlePlannerTouchStart}
        >
          <div className="section-title">
            <div>
              <h2>{activeWeek ? `Planung fuer KW ${activeWeek.kw}` : "Planung"}</h2>
              <p className="muted">
                {activeWeek
                  ? `Wochenstart ${formatDate(activeWeek.start_date)}`
                  : "Bitte zuerst eine Woche auswaehlen oder erstellen."}
              </p>
            </div>
            {activeWeeks.length > 1 ? (
              <div className="week-nav" aria-label="Wochen wechseln">
                <button
                  className="week-nav-button"
                  disabled={activeWeekIndex <= 0}
                  onClick={() => handleWeekArrow("prev")}
                  type="button"
                >
                  ←
                </button>
                <button
                  className="week-nav-button"
                  disabled={activeWeekIndex === -1 || activeWeekIndex >= activeWeeks.length - 1}
                  onClick={() => handleWeekArrow("next")}
                  type="button"
                >
                  →
                </button>
              </div>
            ) : null}
          </div>

          {activeWeek ? (
            <div className="planner-grid" ref={plannerViewportRef}>
              <div
                className={`planning-track ${isDragAnimating ? "animating" : ""}`}
                style={{ transform: `translateX(calc(-100% + ${dragOffset}px))` }}
              >
                <div className="planning-slide">{renderWeekColumns(previousActiveWeek)}</div>
                <div className="planning-slide">{renderWeekColumns(activeWeek)}</div>
                <div className="planning-slide">{renderWeekColumns(nextActiveWeek)}</div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Sobald eine Woche gewaehlt ist, erscheint hier die Montag-bis-Freitag-Planung.
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="section-title">
            <h2>To-dos</h2>
          </div>

          <form className="todo-create" onSubmit={createTodo}>
            <input
              type="text"
              placeholder="Neues To-do notieren..."
              value={todoDraft}
              onChange={(event) => setTodoDraft(event.target.value)}
            />
            <button type="submit">To-do hinzufuegen</button>
          </form>

          <div className="todos-list">
            {visibleOpenTodos.length === 0 && otherOpenTodos.length === 0 && completedTodos.length === 0 ? (
              <div className="empty-state">Noch keine To-dos vorhanden.</div>
            ) : (
              <>
                {visibleOpenTodos.map((todo) => (
                  <article className="todo-item" key={todo.id}>
                    <div className="todo-topline">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={(event) =>
                          updateTodo(todo.id, {
                            completed: event.target.checked
                          })
                        }
                      />
                      <textarea
                        className="todo-text"
                        rows={1}
                        value={todoDrafts[todo.id] ?? todo.text}
                        onChange={(event) => {
                          autoResizeTodoField(event.currentTarget);
                          handleTodoTextChange(todo.id, event.target.value);
                        }}
                        onInput={(event) => autoResizeTodoField(event.currentTarget)}
                      />
                    </div>
                    <div className="todo-controls">
                      <button
                        className="assign-chip"
                        onClick={() => cycleTodoAssignee(todo)}
                        type="button"
                      >
                        {getAssigneeLabel(todo.assigned_to)}
                      </button>
                    </div>
                  </article>
                ))}

                {otherOpenTodos.length > 0 ? (
                  <div className="todo-toggle-block">
                    <button
                      className="text-toggle"
                      onClick={() => setShowOtherTodos((current) => !current)}
                      type="button"
                    >
                      {showOtherTodos
                        ? `To-dos der Stellenpartnerin ausblenden (${otherOpenTodos.length})`
                        : `To-dos der Stellenpartnerin anzeigen (${otherOpenTodos.length})`}
                    </button>
                    {showOtherTodos ? (
                      <div className="todos-list nested">
                        {otherOpenTodos.map((todo) => (
                          <article className="todo-item todo-item-secondary" key={todo.id}>
                            <div className="todo-topline">
                              <input
                                type="checkbox"
                                checked={todo.completed}
                                onChange={(event) =>
                                  updateTodo(todo.id, {
                                    completed: event.target.checked
                                  })
                                }
                              />
                              <textarea
                                className="todo-text"
                                rows={1}
                                value={todoDrafts[todo.id] ?? todo.text}
                                onChange={(event) => {
                                  autoResizeTodoField(event.currentTarget);
                                  handleTodoTextChange(todo.id, event.target.value);
                                }}
                                onInput={(event) => autoResizeTodoField(event.currentTarget)}
                              />
                            </div>
                            <div className="todo-controls">
                              <button
                                className="assign-chip"
                                onClick={() => cycleTodoAssignee(todo)}
                                type="button"
                              >
                                {getAssigneeLabel(todo.assigned_to)}
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {completedTodos.length > 0 ? (
                  <div className="todo-toggle-block">
                    <button
                      className="text-toggle"
                      onClick={() => setShowCompletedTodos((current) => !current)}
                      type="button"
                    >
                      {showCompletedTodos
                        ? `Erledigte To-dos ausblenden (${completedTodos.length})`
                        : `Erledigte To-dos anzeigen (${completedTodos.length})`}
                    </button>
                    {showCompletedTodos ? (
                      <div className="todos-list nested">
                        {completedTodos.map((todo) => (
                          <article className="todo-item completed" key={todo.id}>
                            <div className="todo-topline">
                              <input
                                type="checkbox"
                                checked={todo.completed}
                                onChange={(event) =>
                                  updateTodo(todo.id, {
                                    completed: event.target.checked
                                  })
                                }
                              />
                              <textarea
                                className="todo-text"
                                rows={1}
                                value={todoDrafts[todo.id] ?? todo.text}
                                onChange={(event) => {
                                  autoResizeTodoField(event.currentTarget);
                                  handleTodoTextChange(todo.id, event.target.value);
                                }}
                                onInput={(event) => autoResizeTodoField(event.currentTarget)}
                              />
                            </div>
                            <div className="todo-controls">
                              <button
                                className="assign-chip"
                                onClick={() => cycleTodoAssignee(todo)}
                                type="button"
                              >
                                {getAssigneeLabel(todo.assigned_to)}
                              </button>
                              <div className="todo-meta">Erledigt</div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
