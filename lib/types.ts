export const DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag"
] as const;

export const TIMES = ["Morgen", "Nachmittag"] as const;

export type Day = (typeof DAYS)[number];
export type TimeSlot = (typeof TIMES)[number];

export type Week = {
  id: string;
  kw: number;
  start_date: string;
  archived: boolean;
};

export type Entry = {
  id: string;
  week_id: string;
  day: Day;
  time: TimeSlot;
  content: string;
};

export type Appointment = {
  id: string;
  week_id: string;
  day: Day;
  title: string;
  time_label: string | null;
};

export type Todo = {
  id: string;
  text: string;
  completed: boolean;
  assigned_to: string | null;
  position: number;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
};
