# Media Button SPA

## Overview

A media container web app with view and play routes: `/view` and `/view/config` for YouTube videos; `/play` and `/play/config` for audio files (mp3, mp4, wav, ogg, etc.). Both feature interactive button containers that redirect users to an external website, with comprehensive customization options including shape control, scaling, 3D shadows, color pickers, loop controls, transport controls, volume management, and visibility toggle with inline controls.

## Routes
- `/view` — Standalone YouTube view (no settings overlay)
- `/view/config` — YouTube video player with settings (YouTube IFrame API, `client/src/pages/home.tsx`)
- `/play` — Standalone audio play (no settings overlay)
- `/play/config` — Audio file player with settings (HTML5 `<audio>` + Web Audio API visualizer, `client/src/pages/play.tsx`)
- `/` — Redirects to `/view/config`

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **Styling**: Tailwind CSS with CSS variables for theming
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **State Management**: TanStack React Query for server state
- **Build Tool**: Vite with hot module replacement

The frontend follows a standard React SPA structure:
- Entry point at `client/src/main.tsx`
- App component handles routing via `client/src/App.tsx`
- Pages stored in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/`
- Utility functions and hooks in respective `lib/` and `hooks/` directories

### Backend Architecture
- **Framework**: Express 5 with TypeScript
- **Runtime**: Node.js with tsx for TypeScript execution
- **API Pattern**: RESTful endpoints prefixed with `/api`
- **Build System**: Custom esbuild script for production bundling

Server structure:
- `server/index.ts`: Main entry point, middleware setup
- `server/routes.ts`: API route registration
- `server/storage.ts`: Data access layer with storage interface
- `server/vite.ts`: Development server with Vite integration
- `server/static.ts`: Production static file serving

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Stored in `./migrations` directory
- **Current Storage**: In-memory storage implementation (`MemStorage` class) with interface ready for database swap
- **Database Push**: Use `npm run db:push` to sync schema with database

The storage layer uses an interface pattern (`IStorage`) allowing easy switching between in-memory and database implementations.

### Path Aliases
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets` → `./attached_assets`

## External Dependencies

### Database
- **PostgreSQL**: Required for production (connection via `DATABASE_URL` environment variable)
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### UI Framework
- **Radix UI**: Full suite of accessible UI primitives
- **shadcn/ui**: Pre-built component library (new-york style variant)
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### Frontend Libraries
- **TanStack React Query**: Data fetching and caching
- **React Hook Form + Zod**: Form handling with validation
- **Wouter**: Lightweight routing
- **date-fns**: Date utilities
- **embla-carousel-react**: Carousel component
- **cmdk**: Command menu component
- **vaul**: Drawer component

### Build & Development
- **Vite**: Frontend build tool with React plugin
- **esbuild**: Server-side bundling
- **tsx**: TypeScript execution for Node.js
- **drizzle-kit**: Database migration tooling