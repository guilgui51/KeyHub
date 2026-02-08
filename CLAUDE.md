# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TranslationApp** (package name "Share") is a desktop Electron app built with Electron Forge, Vite, React, and TypeScript. It is being repurposed from a previous "fair sharing/distribution" app into a new translation-focused application. The UI is in French.

## Commands

- **Dev server:** `npm start` (runs `electron-forge start` with Vite HMR)
- **Build:** `npm run package` (packages the app)
- **Make installers:** `npm run make` (creates platform installers via Squirrel/ZIP/Deb/RPM)
- **Lint:** `npm run lint` (ESLint for .ts/.tsx files)
- **Prisma Studio:** `npm run studio` (opens Prisma Studio for the SQLite database)
- **Prisma migrations:** `npx prisma migrate dev` / `npx prisma generate`

## Architecture

### Electron Process Model (3 layers)

1. **Main process** (`src/main.ts`): Creates the BrowserWindow, registers IPC handlers. Entry point for Electron.
2. **Preload** (`src/preload.ts`): Bridges main↔renderer via `contextBridge`. Dynamically builds a typed `window.api` object from the `IpcChannels` type.
3. **Renderer** (`src/renderer.tsx`): React app using HashRouter with a Layout (Navbar + Outlet) pattern.

### IPC Pattern

Each domain has its own file in `src/ipc/` that exports:
- A type (e.g., `SettingsIPC`) mapping channel names to function signatures
- A `register*Handlers()` function using `ipcMain.handle()`

All channel types are merged into `IpcChannels` in `src/ipc/index.ts`. When adding a new IPC channel:
1. Create/edit a file in `src/ipc/` with the type and handler registration
2. Add the type to the `IpcChannels` union in `src/ipc/index.ts`
3. Call the register function in `registerAllIpcHandlers()`
4. Add the channel name to the `channels` array in `src/preload.ts`

### Global Types

`forge.env.d.ts` declares:
- `AppSettings` interface (global)
- `Window.api` type derived from `IpcChannels`
- PNG module declarations

### Settings Storage

App settings use a JSON file stored at `app.getPath("userData")/settings.json` (see `src/settings.ts`). Not Prisma — this is a simple read/write JSON pattern.

### Database (Prisma + SQLite)

- Schema in `prisma/schema.prisma` (currently empty, just the generator/datasource)
- Client initialization in `prisma/index.ts` — handles dev vs production DB paths and Squirrel install/update DB reset
- The `prisma/index.ts` file also exports `isDev` used by the main process

### Frontend

- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin), dark theme (gray-950 background)
- **Icons:** FontAwesome (`@fortawesome/react-fontawesome`)
- **Routing:** `react-router-dom` with HashRouter
- **Shared components:** `src/components/shared/` (e.g., `modal.tsx`)
- **Charts:** Recharts (available, from old project)
- **PDF export:** jspdf + jspdf-autotable (available, from old project)

### Reference Code

- `src/components/_old_components/`: Old React components from the previous "Share" app — use as examples for component patterns, Prisma usage from renderer, and UI conventions.
- `src/ipc/_old_backend/`: Old IPC handler files — use as examples for the IPC registration pattern with Prisma queries.

### Packaging

Electron Forge config in `forge.config.ts` bundles Prisma client via a `prePackage` hook that copies `.prisma` and `@prisma` into `node_modules_copy/`. The SQLite DB (`prisma/app.db`) is included as an extra resource.
