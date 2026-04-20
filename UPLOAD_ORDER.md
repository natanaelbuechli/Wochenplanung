# GitHub Upload Reihenfolge

Dieser Ordner ist bereits bereinigt fuer GitHub.

Nicht enthalten sind bewusst:

- `.env.local`
- `node_modules`
- `.next`
- lokale Cache-Dateien

## Einfachste Reihenfolge

Wenn GitHub mehrere Dateien/Folder gleichzeitig annimmt, kannst du diese Reihenfolge nehmen:

1. `package.json`
2. `package-lock.json`
3. `tsconfig.json`
4. `next.config.ts`
5. `next-env.d.ts`
6. `.gitignore`
7. `.env.example`
8. `README.md`
9. Ordner `app`
10. Ordner `components`
11. Ordner `lib`
12. Ordner `supabase`

## Abhaken beim manuellen Hochladen

- [ ] `package.json`
- [ ] `package-lock.json`
- [ ] `tsconfig.json`
- [ ] `next.config.ts`
- [ ] `next-env.d.ts`
- [ ] `.gitignore`
- [ ] `.env.example`
- [ ] `README.md`
- [ ] `app/layout.tsx`
- [ ] `app/page.tsx`
- [ ] `app/globals.css`
- [ ] `app/auth/callback/route.ts`
- [ ] `components/planner-app.tsx`
- [ ] `lib/types.ts`
- [ ] `lib/supabase/browser.ts`
- [ ] `lib/supabase/server.ts`
- [ ] `supabase/schema.sql`

## Danach auf GitHub

Wenn alles oben ist, brauchst du in Vercel spaeter trotzdem noch die echten Env-Werte:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Diese Werte kommen nicht in GitHub, sondern erst in die Deployment-Einstellungen.
