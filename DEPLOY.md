# Guida al Deploy — Spesa App

## Come funziona la pipeline

```
Modifica codice  →  git commit  →  git push  →  Netlify build  →  Live su web + telefono
     (locale)         (locale)    (GitHub)       (automatico)       (~2 minuti)
```

Netlify è collegato al repo GitHub (`HoSonnoo/spesa`, branch `main`).
Ogni push su `main` avvia un build automatico e aggiorna il sito entro 1–3 minuti.

---

## Procedura standard (ogni volta che vuoi pubblicare modifiche)

### 1. Verifica le modifiche locali

```powershell
git status
```

Mostra i file modificati ma non ancora committati.

### 2. Aggiungi i file al commit

```powershell
# Aggiunge solo i file sorgente (sicuro)
git add src/

# Oppure file specifici:
git add src/App.tsx src/components/NomeComponente.tsx
```

> Non usare `git add .` o `git add -A` senza verificare prima `git status`:
> potresti includere file `.env` o altri file da non committare.

### 3. Crea il commit

```powershell
git commit -m "feat: descrizione breve della modifica"
```

Convenzioni per il messaggio:
- `feat:` nuova funzionalità
- `fix:` correzione bug
- `style:` modifiche CSS/UI senza logica
- `refactor:` ristrutturazione codice

### 4. Pubblica su GitHub (e Netlify)

```powershell
git push origin main
```

Dopo il push, Netlify parte automaticamente.

### 5. Controlla il deploy

- Apri [app.netlify.com](https://app.netlify.com) e vai sul sito `spesa`
- Nella sezione **Deploys** vedi lo stato in tempo reale
- Quando compare il bollino verde "Published", il sito è aggiornato

---

## Verifica rapida da terminale

```powershell
# Stato del branch locale vs remoto
git status

# Ultimi commit (per vedere cosa è già pushato)
git log --oneline -5

# Differenza tra locale e remoto
git diff origin/main..HEAD
```

---

## Problemi comuni

### Il build Netlify fallisce

1. Vai su [app.netlify.com](https://app.netlify.com) → sito → **Deploys** → clicca sul deploy rosso → leggi il log
2. Causa più comune: errore TypeScript. Riproduci localmente con:
   ```powershell
   npm run build
   ```
3. Correggi l'errore, poi ri-commit e ri-push.

### Il sito è vecchio sul telefono (cache)

Sul telefono: tieni premuto il tasto ricarica (o vai su Impostazioni del browser → Svuota cache).
Se usi la PWA installata dalla home, chiudila completamente e riaprila.

### Ho committato un file sbagliato

```powershell
# Rimuovi un file dall'ultimo commit (senza perdere le modifiche locali)
git reset HEAD~1 --soft
git restore --staged <file-da-non-committare>
git commit -m "messaggio originale"
git push origin main --force-with-lease
```

> Usa `--force-with-lease` al posto di `--force`: è più sicuro, fallisce se qualcun altro ha pushato.

---

## Variabili d'ambiente (.env)

Le chiavi Supabase stanno in `.env` (mai committato, sta in `.gitignore`).
Se fai una nuova installazione o cambii le chiavi:

1. Crea/aggiorna il file `.env` in locale:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

2. Aggiorna anche le **environment variables su Netlify**:
   [app.netlify.com](https://app.netlify.com) → sito → **Site configuration** → **Environment variables**

---

## Repo GitHub

- URL: `https://github.com/HoSonnoo/spesa`
- Branch principale: `main`
- Clonare su un nuovo PC: `git clone https://github.com/HoSonnoo/spesa.git`
