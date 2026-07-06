"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { DAYS, type Appointment, type Day, type Entry, type TimeSlot, type Week } from "@/lib/types";

const supabase = createBrowserSupabaseClient();

type PrintCell = {
  date: Date;
  dateLabel: string;
  inMonth: boolean;
  morning: string;
  afternoon: string;
  appointments: Appointment[];
};

type PrintWeek = {
  week: Week;
  cells: Record<Day, PrintCell>;
};

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

function parseDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatCellDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(date: Date, direction: -1 | 1) {
  return new Date(date.getFullYear(), date.getMonth() + direction, 1);
}

function getEntryContent(entries: Entry[], day: Day, time: TimeSlot) {
  return entries.find((entry) => entry.day === day && entry.time === time)?.content ?? "";
}

function buildPrintWeeks(
  weeks: Week[],
  entriesByWeek: Record<string, Entry[]>,
  appointmentsByWeek: Record<string, Appointment[]>,
  monthDate: Date
) {
  const targetMonth = monthDate.getMonth();
  const targetYear = monthDate.getFullYear();

  return weeks
    .filter((week) => !week.archived)
    .map((week) => {
      const weekStart = parseDate(week.start_date);
      const entries = entriesByWeek[week.id] ?? [];
      const appointments = appointmentsByWeek[week.id] ?? [];

      const cells = DAYS.reduce<Record<Day, PrintCell>>((acc, day, index) => {
        const cellDate = addDays(weekStart, index);
        acc[day] = {
          date: cellDate,
          dateLabel: formatCellDate(cellDate),
          inMonth: cellDate.getMonth() === targetMonth && cellDate.getFullYear() === targetYear,
          morning: getEntryContent(entries, day, "Morgen"),
          afternoon: getEntryContent(entries, day, "Nachmittag"),
          appointments: appointments.filter((appointment) => appointment.day === day)
        };
        return acc;
      }, {} as Record<Day, PrintCell>);

      return {
        week,
        cells
      };
    })
    .filter((printWeek) => DAYS.some((day) => printWeek.cells[day].inMonth))
    .sort((a, b) => a.week.start_date.localeCompare(b.week.start_date));
}

export function MonthPrintView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [entriesByWeek, setEntriesByWeek] = useState<Record<string, Entry[]>>({});
  const [appointmentsByWeek, setAppointmentsByWeek] = useState<Record<string, Appointment[]>>({});
  const [monthDate, setMonthDate] = useState(() => {
    const currentWeekStart = getCurrentWeekStartDate();
    return parseDate(currentWeekStart);
  });

  useEffect(() => {
    async function loadPrintView() {
      setError("");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      if (!sessionData.session) {
        const { error: anonymousAuthError } = await supabase.auth.signInAnonymously();
        if (anonymousAuthError) {
          setError("Anonymer Zugriff ist in Supabase noch nicht aktiviert.");
          setLoading(false);
          return;
        }
      }

      const { data: weeksData, error: weeksError } = await supabase
        .from("weeks")
        .select("*")
        .order("start_date", { ascending: true });

      if (weeksError) {
        setError(weeksError.message);
        setLoading(false);
        return;
      }

      const activeWeeks = (weeksData ?? []).filter((week) => !week.archived);
      setWeeks(activeWeeks);

      if (activeWeeks.length === 0) {
        setLoading(false);
        return;
      }

      const weekIds = activeWeeks.map((week) => week.id);

      const [entriesResult, appointmentsResult] = await Promise.all([
        supabase.from("entries").select("*").in("week_id", weekIds),
        supabase.from("appointments").select("*").in("week_id", weekIds)
      ]);

      if (entriesResult.error) {
        setError(entriesResult.error.message);
      } else {
        const nextEntries = (entriesResult.data ?? []).reduce<Record<string, Entry[]>>((acc, entry) => {
          acc[entry.week_id] = [...(acc[entry.week_id] ?? []), entry];
          return acc;
        }, {});
        setEntriesByWeek(nextEntries);
      }

      if (appointmentsResult.error) {
        setError(appointmentsResult.error.message);
      } else {
        const nextAppointments = (appointmentsResult.data ?? []).reduce<Record<string, Appointment[]>>(
          (acc, appointment) => {
            acc[appointment.week_id] = [...(acc[appointment.week_id] ?? []), appointment];
            return acc;
          },
          {}
        );
        setAppointmentsByWeek(nextAppointments);
      }

      setLoading(false);
    }

    loadPrintView().catch((loadError: Error) => {
      setError(loadError.message);
      setLoading(false);
    });
  }, []);

  const monthKey = useMemo(() => getMonthKey(monthDate), [monthDate]);

  useEffect(() => {
    if (weeks.length === 0) {
      return;
    }

    const hasAnyWeekForMonth = weeks.some((week) => {
      const weekStart = parseDate(week.start_date);
      return DAYS.some((_, index) => getMonthKey(addDays(weekStart, index)) === monthKey);
    });

    if (!hasAnyWeekForMonth) {
      const nextAvailableWeek = weeks.find((week) => {
        const weekStart = parseDate(week.start_date);
        return DAYS.some((_, index) => addDays(weekStart, index) >= monthDate);
      });

      if (nextAvailableWeek) {
        setMonthDate(parseDate(nextAvailableWeek.start_date));
      }
    }
  }, [monthDate, monthKey, weeks]);

  const printWeeks = useMemo(
    () => buildPrintWeeks(weeks, entriesByWeek, appointmentsByWeek, monthDate),
    [appointmentsByWeek, entriesByWeek, monthDate, weeks]
  );

  return (
    <main className="print-shell">
      <header className="print-header">
        <div>
          <Link className="print-back-link" href="/">
            Zur Planung
          </Link>
          <h1>Monatsuebersicht {formatMonthLabel(monthDate)}</h1>
          <p className="muted">Druckfreundliche Ansicht im Querformat.</p>
        </div>
        <div className="print-actions">
          <button className="print-month-button" onClick={() => setMonthDate(shiftMonth(monthDate, -1))} type="button">
            ←
          </button>
          <button className="print-month-button" onClick={() => setMonthDate(shiftMonth(monthDate, 1))} type="button">
            →
          </button>
          <button className="print-button" onClick={() => window.print()} type="button">
            Drucken
          </button>
        </div>
      </header>

      {error ? <div className="error-box">{error}</div> : null}

      {loading ? (
        <section className="print-panel">
          <p className="muted">Druckansicht wird geladen.</p>
        </section>
      ) : printWeeks.length === 0 ? (
        <section className="print-panel">
          <p className="muted">Fuer diesen Monat gibt es noch keine Wochen mit Planung.</p>
        </section>
      ) : (
        <section className="print-panel print-landscape-sheet">
          <div className="print-grid-header">
            <div className="print-kw-head">KW</div>
            {DAYS.map((day) => (
              <div className="print-day-head" key={day}>
                {day}
              </div>
            ))}
          </div>

          <div className="print-grid-body">
            {printWeeks.map((printWeek) => (
              <div className="print-week-row" key={printWeek.week.id}>
                <div className="print-kw-cell">{`KW ${printWeek.week.kw}`}</div>
                {DAYS.map((day) => {
                  const cell = printWeek.cells[day];
                  return (
                    <article
                      className={`print-day-cell ${cell.inMonth ? "" : "is-muted"}`}
                      key={`${printWeek.week.id}-${day}`}
                    >
                      <div className="print-day-date">{cell.dateLabel}</div>
                      {cell.morning ? <p className="print-entry-line">{cell.morning}</p> : null}
                      {cell.afternoon ? <p className="print-entry-line secondary">{cell.afternoon}</p> : null}
                      {cell.appointments.map((appointment) => (
                        <p className="print-appointment-line" key={appointment.id}>
                          {appointment.time_label ? `${appointment.time_label} ` : ""}
                          {appointment.title}
                        </p>
                      ))}
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
