# Nicht auf GitHub hochladen

Diese Dinge gehoeren bewusst nicht ins Repo:

- `.env.local`
- `node_modules`
- `.next`

Grund:

- `.env.local` enthaelt echte Projekt-Zugangsdaten
- `node_modules` wird spaeter mit `npm install` neu erzeugt
- `.next` ist nur ein lokaler Build-Ordner
