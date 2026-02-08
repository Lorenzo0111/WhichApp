<div align="center">

[🇮🇹 Italiano](https://github.com/Lorenzo0111/WhichApp/tree/italian) - [🇬🇧 English](https://github.com/Lorenzo0111/WhichApp)

# <div style="display: flex; align-items: center; justify-content: center; gap: 10px;"><img src="https://raw.githubusercontent.com/Lorenzo0111/WhichApp/main/app/assets/adaptive-icon.png" alt="WhichApp" width="50"> WhichApp</div>

[![Bun](https://img.shields.io/badge/Runtime-Bun-%23FBF0DF?style=for-the-badge&logo=bun)](https://bun.sh/)
[![Expo](https://img.shields.io/badge/Mobile-Expo-%23000020?style=for-the-badge&logo=expo)](https://expo.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

**A mobile-first, end-to-end encrypted messaging app**

</div>

---

## ✨ Features

### 🎯 Core Functionality

- **End-to-End Encryption** - Messages are encrypted on device with RSA. Each user has a keypair; public keys are stored on the server, private keys stay in the app (Expo Secure Store) and can be exported/imported via QR codes
- **Real-Time Messaging** - WebSocket-based delivery with online/offline presence for contacts you share a chat with
- **Multi-Device Support** - Message queue for sessions that are offline when a message is sent; messages are delivered when that device reconnects
- **Account & Auth** - Email/password authentication via [Better Auth](https://www.better-auth.com/), with username support and one-time tokens for WebSocket and API access
- **Native Mobile App** - Expo (React Native) app for iOS and Android with Expo Router, local SQLite cache for messages, and optional Face ID for key access

### 🛠️ Tech Stack

| Layer    | Technologies                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo | [Turbo](https://turbo.build/), [Bun](https://bun.sh/)                                                                                                                            |
| API      | [Elysia](https://elysiajs.com/) on Bun, [Better Auth](https://www.better-auth.com/) (Expo adapter), [Drizzle ORM](https://orm.drizzle.team/), SQLite                             |
| App      | [Expo](https://expo.dev/) (SDK 54), [Expo Router](https://expo.github.io/router/), [Uniwind](https://uniwind.dev/), [Eden](https://elysiajs.com/eden/overview.html) client |
| Crypto   | Custom RSA in the app; server only stores and relays encrypted content                                                                                                           |

### 🔒 Security

- **Private keys** never leave the device except when you explicitly export them (QR). The server only stores public keys and encrypted message blobs
- Use a strong `BETTER_AUTH_SECRET` in production and HTTPS for `BETTER_AUTH_URL`
- The app uses `expo-secure-store` (and optional Face ID) for key material

---

## 🚀 Quick Start

1. **Install** dependencies from the repo root:
   ```bash
   bun install
   ```
2. **Configure** the API: in `api/` create a `.env` (see `api/.env.example`):
   ```env
   BETTER_AUTH_SECRET="<a-long-random-secret>"
   BETTER_AUTH_URL="http://127.0.0.1:3000"
   DB_FILE_NAME="database.sqlite"
   ```
3. **Run** API migrations:
   ```bash
   cd api && bun run db:migrate
   ```
4. **Configure** the app: in `app/` create a `.env` with `EXPO_PUBLIC_API_URL="http://<your-machine-ip>:3000"` (use your LAN IP so the device/emulator can reach the API)
5. **Start** everything:
   ```bash
   bun run dev
   ```
6. **Enjoy!** API runs at http://localhost:3000; use the Expo dev client to run the app on simulator or device

### Prerequisites

- [Bun](https://bun.sh/) (v1.3.x)
- For the app: Xcode (iOS), Android Studio / SDK (Android), [Expo CLI](https://docs.expo.dev/get-started/installation/) as needed

---

## 📁 Project Structure

```
WhichApp/
├── api/                 # Backend (Elysia + Better Auth + Drizzle)
│   ├── src/
│   │   ├── db/schema.ts # Users, sessions, chats, chat members, message queue
│   │   ├── lib/auth/    # Better Auth config, plugins (e.g. public keys)
│   │   ├── routes/      # users, chats, uploads
│   │   └── index.ts     # App entry, WebSocket /ws, auth mount
│   ├── drizzle/        # SQLite migrations
│   ├── Dockerfile
│   └── start.sh        # migrate + start
├── app/                # Expo app (iOS/Android)
│   ├── src/
│   │   ├── app/        # Expo Router: (public), (private)/(tabs), chats, export, no-keys
│   │   ├── components/ # UI, chat, import (QR scan), home
│   │   ├── hooks/      # websocket, secrets, keyboard
│   │   ├── lib/        # auth, crypto (RSA), db (local SQLite), fetcher (Eden)
│   │   └── db/         # Local message schema
│   └── drizzle/       # Local DB migrations
├── package.json        # Workspaces: app, api
├── turbo.json
└── bun.lock
```

---

## 🏗️ Building & Production

- **API** - Use the multi-stage `api/Dockerfile`: it prunes the monorepo, installs production dependencies, and runs `api/start.sh` (migrate + start). Expose port 3000 and set `BETTER_AUTH_URL` to your public API URL
- **App** - Use [EAS Build](https://docs.expo.dev/build/introduction/) (see `app/eas.json` and `app/app.json`). Set `EXPO_PUBLIC_API_URL` in EAS secrets or env to your deployed API URL

### Migrations

When the API schema changes:

```bash
cd api && bun run db:migrate
```

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

---

## 📄 License

See the [LICENSE](LICENSE) file for details.

> **📌 Note:** This app is not intended for production use. It is a school project published for educational purposes.

---

<div align="center">

Made with ❤️ by [@Lorenzo0111](https://github.com/Lorenzo0111)

</div>
