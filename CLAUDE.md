# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent npm projects in one repo. There is no root `package.json` and no test framework configured.

- `client/` — React 19 + Vite 7 SPA (ES modules). Deployed to Netlify (`netlify.toml` builds from `client/`, publishes `dist`).
- `server/` — Node.js Express + Socket.io API (CommonJS, `"type": "commonjs"` in `server/package.json`). Deployed to Render.

## Commands

All commands are run from `client/` or `server/` — never from the repo root.

```bash
# Client (port 5173)
cd client && npm install
cd client && npm run dev          # vite --host
cd client && npm run build        # outputs to client/dist
cd client && npm run lint         # eslint . (flat config, dist ignored)
cd client && npm run preview

# Server (port 3001)
cd server && npm install
cd server && npm run dev          # nodemon server.js
cd server && npm start            # node server.js
```

There are no unit tests. Verify changes by running both dev servers and exercising the feature in the browser.

## Environment variables

Both halves of the app degrade gracefully when env vars are missing, which masks misconfiguration — check the warnings printed at startup if features silently no-op.

- `client/.env`: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_CLOUDINARY_CLOUD_NAME`, optional `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`.
- `server/.env`: `PORT`, `MONGODB_URI`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

Allowed CORS origins are hardcoded in `server/config/cors.js` — adding a new deployment URL requires editing that file.

## Architecture

### Authentication (Clerk → Mongo bridge)

Clerk is the identity provider; MongoDB stores the app-level user. They're joined by `User.clerkId`.

1. Client gets a Clerk session token via `useAuth().getToken()`. `AuthContext` wires this into both Axios (`services/api.js` request interceptor) and the XHR upload service.
2. `AuthContext` calls `POST /api/auth/sync` on sign-in to upsert the Mongo `User` doc — this is what populates `dbUser` everywhere else in the client.
3. On the server, `clerkMiddleware` from `@clerk/express` is mounted globally in `server.js`. A wrapper normalizes `req.auth` to a plain `{ userId }` object (in v2 `req.auth` is a function — every controller assumes it's flat).
4. `middleware/authMiddleware.js` is the gatekeeper for protected routes: it checks `req.auth?.userId` (falling back to an `x-clerk-id` header).
5. **Webhook ordering is load-bearing**: `/api/webhooks` is mounted *before* `express.json()` in `server.js` so the raw body remains available for Clerk signature verification. Don't reorder these middleware registrations.

### Socket.io connection lifecycle

- Client (`contexts/SocketContext.jsx`) creates a single Socket.io connection keyed on `clerkId`. The token + clerkId are passed in `auth` during the handshake. A 45s heartbeat keeps the connection alive.
- Server (`socket/index.js`) runs `socketAuthMiddleware` which attaches `socket.clerkId`. On `connection`:
  - `socketEmitter.register(clerkId, socketId)` tracks the clerkId → Set\<socketId\> map (a user can have multiple sockets).
  - The socket joins a **personal room** `user:<mongoUserId>` that persists for the connection's lifetime. This is what call signaling targets — *don't* leave this room when switching chat rooms.
  - User is marked `isOnline: true` and friends are notified.
- `socketEmitter.emitToUser(clerkId, event, data)` lets HTTP controllers push real-time events to specific users. This is the bridge between REST and Socket.io — use it whenever a REST endpoint needs to notify another user (friend requests, etc.).
- On `join-room`, previous chat rooms are left but `socket.id` and any `user:*` rooms are preserved. Presence/offline broadcast only fires when the *last* socket for a clerkId disconnects.

### WebRTC calling (peer-to-peer, signaled via Socket.io)

`client/src/contexts/CallContext.jsx` owns the entire call state machine: `idle → outgoing/incoming → connecting → active`. Key behaviors that aren't obvious:

- The **caller** does not create the RTC offer until the callee accepts (`call:accepted` handler). This avoids capturing media for unanswered calls.
- ICE candidates that arrive before `setRemoteDescription` are buffered in `iceCandidateBuffer.current` and flushed after the description is set. Don't add candidates eagerly.
- `connectionState === "disconnected"` triggers an **ICE restart** (single-shot, guarded by `iceRestartRef`). Only `"failed"` actually ends the call.
- On socket reconnect during an active call, `rejoin-room` is re-emitted so signaling relay resumes.
- `ICE_SERVERS` in `utils/constants.js` uses Google STUN + a free openrelay TURN fallback. Override via `VITE_TURN_URL` for production.

### Client provider tree

`client/src/main.jsx` wraps the app in `ClerkProvider` + `BrowserRouter`. `App.jsx` then composes `AppProviders` in this exact order: **Auth → Socket → Theme → Chat → Call**. The order matters — `SocketProvider` reads from `AuthContext`, `CallProvider` reads from both, etc.

Routes split into a public `/auth` and a protected group wrapped in `ProtectedRoute` + `DesktopLayout` (sidebar + outlet on ≥768px, full-screen on mobile via `useMediaQuery`).

### Server structure

- `server.js` is a thin bootstrap only: middleware → routes → Socket.io → DB → Cloudinary → cron.
- `routes/*Routes.js` → `controllers/*Controller.js` — keep route files thin; business logic lives in controllers.
- `socket/{chat,call,presence}Handlers.js` register socket event listeners. They take `(io, socket, rooms)` where `rooms` is an in-memory `Map<roomId, {users: Set<socketId>}>` (volatile — does not survive restart).
- `socket/socketEmitter.js` is a module-scoped singleton that holds the `io` instance and the `clerkId → socketIds` map. Initialized once via `init(io)` from `socket/index.js`.
- `services/storyCleanupService.js` runs a `node-cron` job to expire stories — started from `server.js`.

### Persistence and media

- MongoDB connect is **non-blocking**: if `MONGODB_URI` is missing or unreachable, the server logs and sets `bufferCommands: false` so DB calls fail fast instead of hanging. Socket-only mode still works.
- Models live in `server/models/` — `User`, `Conversation`, `Message`, `Story`, `ProfilePost`, `FriendRequest`. `User.clerkId` is the unique external key; everything else references `User._id`.
- `chatHandlers.js` validates conversation IDs as 24-char hex before persisting (regex `/^[0-9a-fA-F]{24}$/`) — UUID-style room IDs are intentionally skipped to support ephemeral rooms that aren't backed by a `Conversation` doc.
- Uploads (`middleware/upload.js`) route through Cloudinary via `multer-storage-cloudinary`, falling back to in-memory storage when `CLOUDINARY_CLOUD_NAME` is unset. MIME type (not extension) is the primary discriminator between audio/video/image, with extension as fallback. Size cap is 25 MB.

### Styling

Tailwind v3 + SCSS coexist. Tailwind colors are mapped to CSS variables (`var(--primary)` etc.) defined in `client/src/index.css`. Theme switching toggles a `.theme-dark` class on `<html>` (managed by `ThemeContext`). SCSS partials live in `client/src/assets/style/` (loaded via `import "./assets/style/app.scss"` in `main.jsx`). Use the `cn()` helper from `client/src/lib/utils.js` for conditional class merging.

Path alias `@/` resolves to `client/src/` — configured in both `vite.config.js` and `jsconfig.json`.

## Conventions to follow

- Server is CommonJS (`require`/`module.exports`). Client is ESM (`import`/`export`). Don't mix.
- On the server, controllers expect `req.auth.userId` to be the Clerk ID — use `authMiddleware` on any route that needs the user identity and resolve the Mongo `User` inside the controller.
- For socket events that need cross-conversation delivery (e.g., notifying a friend not currently in the chat room), use `emitToUser(clerkId, ...)` from `socketEmitter` rather than `io.to(roomId)`.
- When adding a real-time feature that originates from an HTTP endpoint, follow the existing pattern: persist via Mongoose, then call `emitToUser` for live delivery.
