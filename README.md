<div align="center">

[🇮🇹 Italiano](https://github.com/Lorenzo0111/WhichApp/tree/italian) - [🇬🇧 English](https://github.com/Lorenzo0111/WhichApp)

# <div style="display: flex; align-items: center; justify-content: center; gap: 10px;"><img src="https://raw.githubusercontent.com/Lorenzo0111/WhichApp/main/app/assets/adaptive-icon.png" alt="WhichApp" width="50"> WhichApp</div>

[![Bun](https://img.shields.io/badge/Runtime-Bun-%23FBF0DF?style=for-the-badge&logo=bun)](https://bun.sh/)
[![Expo](https://img.shields.io/badge/Mobile-Expo-%23000020?style=for-the-badge&logo=expo)](https://expo.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

**Un’app di messaggistica mobile-first con crittografia end-to-end**

</div>

---

## ✨ Funzionalità

### 🎯 Funzionalità principali

- **Crittografia end-to-end** – I messaggi sono crittografati sul dispositivo con RSA. Ogni utente ha una coppia di chiavi; le chiavi pubbliche sono salvate sul server, le chiavi private restano nell’app (Expo Secure Store) e possono essere esportate/importate tramite codici QR
- **Messaggistica in tempo reale** – Consegna basata su WebSocket con presenza online/offline per i contatti con cui condividi una chat
- **Supporto multi-dispositivo** – Coda messaggi per le sessioni offline al momento dell’invio; i messaggi vengono consegnati quando il dispositivo si riconnette
- **Account e autenticazione** – Autenticazione email/password tramite [Better Auth](https://www.better-auth.com/), con supporto username e token monouso per accesso WebSocket e API
- **App mobile nativa** – App Expo (React Native) per iOS e Android con Expo Router, cache SQLite locale per i messaggi e Face ID opzionale per l’accesso alle chiavi

### 🛠️ Stack tecnologico

| Livello  | Tecnologie                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo | [Turbo](https://turbo.build/), [Bun](https://bun.sh/)                                                                                                                            |
| API      | [Elysia](https://elysiajs.com/) su Bun, [Better Auth](https://www.better-auth.com/) (adapter Expo), [Drizzle ORM](https://orm.drizzle.team/), SQLite                             |
| App      | [Expo](https://expo.dev/) (SDK 54), [Expo Router](https://expo.github.io/router/), [Uniwind](https://uniwind.pages.dev/), client [Eden](https://elysiajs.com/eden/overview.html) |
| Crypto   | RSA personalizzato nell’app; il server memorizza e inoltra solo contenuti crittografati                                                                                          |

### 🔒 Sicurezza

- Le **chiavi private** non lasciano mai il dispositivo, tranne quando le esporti esplicitamente (QR). Il server memorizza solo chiavi pubbliche e blob di messaggi crittografati
- In produzione usa un `BETTER_AUTH_SECRET` robusto e HTTPS per `BETTER_AUTH_URL`
- L’app usa `expo-secure-store` (e Face ID opzionale) per il materiale delle chiavi

---

## 🚀 Avvio rapido

1. **Installa** le dipendenze dalla root del repo:
   ```bash
   bun install
   ```
2. **Configura** l’API: in `api/` crea un file `.env` (vedi `api/.env.example`):
   ```env
   BETTER_AUTH_SECRET="<un-segreto-lungo-e-casuale>"
   BETTER_AUTH_URL="http://127.0.0.1:3000"
   DB_FILE_NAME="database.sqlite"
   ```
3. **Esegui** le migrazioni dell’API:
   ```bash
   cd api && bun run db:migrate
   ```
4. **Configura** l’app: in `app/` crea un `.env` con `EXPO_PUBLIC_API_URL="http://<ip-della-tua-macchina>:3000"` (usa l’IP della tua LAN così dispositivo/emulatore possono raggiungere l’API)
5. **Avvia** tutto:
   ```bash
   bun run dev
   ```
6. **Pronto!** L’API è disponibile su http://localhost:3000; usa il client di sviluppo Expo per eseguire l’app su simulatore o dispositivo

### Prerequisiti

- [Bun](https://bun.sh/) (v1.3.x)
- Per l’app: Xcode (iOS), Android Studio / SDK (Android), [Expo CLI](https://docs.expo.dev/get-started/installation/) se necessario

---

## 📁 Struttura del progetto

```
WhichApp/
├── api/                 # Backend (Elysia + Better Auth + Drizzle)
│   ├── src/
│   │   ├── db/schema.ts # Utenti, sessioni, chat, membri chat, coda messaggi
│   │   ├── lib/auth/    # Config Better Auth, plugin (es. chiavi pubbliche)
│   │   ├── routes/      # users, chats, uploads
│   │   └── index.ts     # Entry point app, WebSocket /ws, mount auth
│   ├── drizzle/        # Migrazioni SQLite
│   ├── Dockerfile
│   └── start.sh        # migrate + start
├── app/                # App Expo (iOS/Android)
│   ├── src/
│   │   ├── app/        # Expo Router: (public), (private)/(tabs), chats, export, no-keys
│   │   ├── components/ # UI, chat, import (scan QR), home
│   │   ├── hooks/      # websocket, secrets, keyboard
│   │   ├── lib/        # auth, crypto (RSA), db (SQLite locale), fetcher (Eden)
│   │   └── db/         # Schema messaggi locale
│   └── drizzle/       # Migrazioni DB locale
├── package.json        # Workspaces: app, api
├── turbo.json
└── bun.lock
```

---

## 🏗️ Build e produzione

- **API** – Usa il multi-stage `api/Dockerfile`: esegue il prune del monorepo, installa le dipendenze di produzione e lancia `api/start.sh` (migrate + start). Esponi la porta 3000 e imposta `BETTER_AUTH_URL` con l’URL pubblico dell’API
- **App** – Usa [EAS Build](https://docs.expo.dev/build/introduction/) (vedi `app/eas.json` e `app/app.json`). Imposta `EXPO_PUBLIC_API_URL` nei segreti EAS o nelle variabili d’ambiente con l’URL dell’API deployata

### Migrazioni

Quando cambia lo schema dell’API:

```bash
cd api && bun run db:migrate
```

---

## 🤝 Contribuire

I contributi sono benvenuti! Puoi:

- Segnalare bug
- Suggerire funzionalità
- Inviare pull request
- Migliorare la documentazione

---

## 📄 Licenza

Per i dettagli vedi il file [LICENSE](LICENSE).

> **📌 Nota:** Questa app non è pensata per l’uso in produzione. È un progetto scolastico pubblicato a scopo didattico.

---

<div align="center">

Fatto con ❤️ da [@Lorenzo0111](https://github.com/Lorenzo0111)

</div>
