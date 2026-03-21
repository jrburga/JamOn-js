# JamOn-js

Online collaborative jam session — JavaScript port of [JamOn](https://github.com/jrburga/JamOn) (Python/Kivy).

## Stack

- **Frontend**: Vite + React 18, Tone.js (audio), HTML Canvas (track rendering)
- **Backend**: Node.js + Express + Socket.io
- **Tests**: Vitest (client, 90 tests) · Jest (server, 18 tests)

## Local development

```bash
# Install all workspace dependencies
npm install

# Start both server (port 3001) and client (port 5173) concurrently
npm run dev
```

Open `http://localhost:5173` in your browser.

**Multiplayer on a local network**: share your machine's LAN IP with other players and create a `client/.env.local` file:

```
VITE_SERVER_URL=http://192.168.x.x:3001
```

## Running tests

```bash
npm run test --workspace=client   # Vitest — game logic & networking (90 tests)
npm run test --workspace=server   # Jest   — HTTP & WebSocket integration (18 tests)
```

## Deploy to Railway

### One-click deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Manual deploy

1. Create a free account at [railway.app](https://railway.app)
2. Install the Railway CLI: `npm i -g @railway/cli`
3. From the project root:

```bash
railway login
railway init          # create a new project
railway up            # build & deploy
```

4. Railway automatically sets `PORT`. No other environment variables are required — the server serves the built React client from the same origin.

5. Once deployed, Railway gives you a public URL like `https://jamon-js-production.up.railway.app`. Share it with your band!

### Environment variables (Railway dashboard)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | auto | set by Railway | Server listen port |
| `NODE_ENV` | auto | set by Railway | Set to `production` |

No `VITE_SERVER_URL` is needed in production — the client and server share the same origin.

## Architecture

```
JamOn-js/
├── server/          Node.js + Express + Socket.io backend
│   └── index.js     Room management, WebSocket protocol, static file serving
└── client/          Vite + React frontend
    └── src/
        ├── game/    Instrument.js · Pattern.js · Quantizer.js
        ├── networking/Client.js   Socket.io client wrapper
        ├── scenes/  MainMenu · WaitingRoom · Practice
        └── components/Track.jsx   Canvas-based track renderer
```
