# CLAUDE.md — Spesa (Lista della Spesa Intelligente)

## Cos'è
Web app responsive (PWA) per gestire la lista della spesa con sincronizzazione
multi-dispositivo. Lista base permanente organizzata in sezioni/sottosezioni,
da cui si genera una lista temporanea ("sessione di spesa") senza alterare la base.
Al termine, riepilogo con statistiche.

## Ambiente
- **Percorso progetto**: `C:\Users\a.polizzi\Desktop\App\Spesa`
- **OS**: Windows, VS Code, terminale PowerShell.
- File client Supabase: `src/lib/supabase.ts`. Chiavi in `.env` (mai committate).

## Stack
- **Frontend**: React + Vite + TypeScript
- **Stile**: CSS custom (tema scuro, primary `#7e47ff`) — niente librerie UI pesanti
- **Backend / DB / Auth**: Supabase (Postgres, Auth, Realtime, RLS)
- **Hosting**: Netlify (deploy automatico da repo Git)
- **PWA**: manifest.json + service worker per uso offline e "Aggiungi a Home" su iOS Safari

## Architettura dati (vedi supabase_schema.sql)
- `sections` → `subsections` → `items` = la LISTA BASE permanente.
- `shopping_sessions` + `session_items` = la lista TEMPORANEA di una spesa.
- Gli `items` NON contengono lo stato selezionato/comprato: quello vive nei
  `session_items`. Così la lista base resta intatta tra una spesa e l'altra.
- `session_items` salva uno **snapshot** di `name` e `section_name`: lo storico
  resta coerente anche se la lista base viene modificata in seguito.
- **RLS attiva**: ogni query è filtrata per `auth.uid()`. Sempre passare `user_id`
  in insert.
- **Realtime** abilitato su items e session_items per il sync live tra dispositivi.

## Flussi utente
1. **Lista base** (tab 1): sezioni collassabili, tocca articolo per selezionarlo,
   aggiungi/modifica/elimina articoli inline. Salvataggio automatico su Supabase.
2. **Inizia spesa**: crea una `shopping_session` 'active' e popola `session_items`
   dagli articoli selezionati.
3. **Da comprare** (tab 2): mostra i session_items raggruppati per reparto, barra
   di avanzamento, spunta "comprato". Realtime: spunte visibili sugli altri device.
4. **Completa spesa**: session → 'completed', modale riepilogo (comprati / totale / %).

## Convenzioni importanti
- ⚠️ **Stringhe italiane: usare SEMPRE i backtick** (template literal), MAI apici
  singoli. Gli apostrofi italiani (es. `un'occasione`, `dell'utente`) rompono il
  parsing dentro stringhe con apici singoli. Es: `` const t = `un'occasione` ``
- Chiavi Supabase in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`),
  mai hardcoded nel codice committato.
- Ordinamento elementi tramite campo `position` (int), non per data.
- Preferenza generale dell'autore: per i refactor ampi, file completi anziché diff.

## Roadmap / espansioni previste
- Cronologia spese (query su `shopping_sessions` completed)
- Quantità e prezzi per articolo
- Esportazione dati (CSV/PDF)
- Condivisione lista tra più utenti (lista familiare)
- Notifiche / promemoria

## Stato attuale
Esiste un prototipo standalone in HTML+localStorage (single file) usato per
validare la UX. Da qui si porta la logica in React e si sostituisce localStorage
con le chiamate Supabase.
