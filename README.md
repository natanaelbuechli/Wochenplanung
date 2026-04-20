# Kindergarten Wochenplanung

Kleine kollaborative Wochenplanungs-App fuer 2-4 Personen mit:

- Next.js Frontend
- Supabase Auth per Magic Link
- Supabase Postgres als Datenbank
- Supabase Realtime fuer Live-Updates

## 1. Projekt starten

```bash
npm install
npm run dev
```

Danach die Umgebungsvariablen aus `.env.example` in eine `.env.local` uebernehmen.

## 2. Supabase vorbereiten

1. Ein neues Supabase-Projekt erstellen.
2. Unter `SQL Editor` den Inhalt von [supabase/schema.sql](/Users/natanaelbuechli/Desktop/codex/kindergarten-wochenplanung/supabase/schema.sql) ausfuehren.
3. Unter `Authentication > Sign In / Providers` den E-Mail-Login aktiv lassen.
4. Unter `Authentication > URL Configuration` die Site URL setzen, z. B. `http://localhost:3000`.
5. Dieselbe URL bei Redirect URLs eintragen, damit der Magic-Link-Callback funktioniert.
6. `Project URL` und `anon public key` in `.env.local` eintragen.

## 3. Tabellen

Die Kernstruktur entspricht der gewuenschten App:

- `weeks`: Kalenderwochen und Startdatum
- `entries`: Inhalte pro Woche, Tag und Zeitfenster
- `todos`: globale To-dos

Zusaetzlich gibt es eine kleine Tabelle `profiles`, damit das To-do-Dropdown die Teammitglieder mit Namen anzeigen kann.

## 4. Verhalten der App

- Nur eingeloggte Benutzer sehen die eigentliche Planung.
- Wochen koennen links ausgewaehlt werden.
- Die Planung in der Mitte speichert automatisch mit kurzem Debounce.
- Rechts liegt die globale To-do-Liste mit Zuweisung an Teammitglieder.
- Alle Bereiche werden ueber Supabase Realtime live aktualisiert.

## 5. Wichtige Dateien

- `app/page.tsx`: Einstiegspunkt der App
- `components/planner-app.tsx`: Hauptlogik fuer Auth, Wochen, Planung, To-dos und Realtime
- `app/auth/callback/route.ts`: Magic-Link-Callback
- `supabase/schema.sql`: Datenbank, Policies und Realtime-Setup
