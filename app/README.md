# Kancelář řemeslníků online

Webová aplikace pro faktury a účetnictví (Vite + TypeScript + Supabase).
Ovládání klávesnicí, vzhled „Budoucnost“ (výchozí) a retro DOS (F9). Ctrl+K = paleta příkazů.

## Vývoj
```bash
cp .env.example .env.local   # doplňte VITE_SUPABASE_KEY
npm install
npm run dev
```

## Nasazení na Cloudflare Pages
- Root directory: `app`
- Build command: `npm run build`
- Build output directory: `dist`
- Proměnné prostředí: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_AUTH_DISABLED` (`1` = bez přihlášení, anonymní účet)
