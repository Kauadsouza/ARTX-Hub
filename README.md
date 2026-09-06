# ARTX Hub

ARTX Hub is a private command centre for Kaua's independent products, studies and creator workflow. It brings every system into one focused interface without merging their codebases, databases or security boundaries.

[Open the live Hub](https://artx-hub.vercel.app) · Authentication required

## What it connects

| System | Purpose | Integration |
| --- | --- | --- |
| Site KauaArtx | Public bilingual content platform and personal brand | External application |
| KauaArtx Video Studio | YouTube ideas, scripts and publishing workflow | Authenticated embedded application |
| SAT & English | English learning and SAT, ACT and TOEFL practice | Authenticated embedded application |
| University Path | UK Computer Science application planning | Authenticated embedded application |
| Condor | Local-first personal AI system | Local overview and organisation layer |

## Core capabilities

- One private dashboard for systems, notes, tasks and current priorities.
- Supabase authentication with owner-scoped data and Row Level Security.
- Shared Hub session for compatible embedded applications.
- Responsive PWA experience for desktop and mobile.
- Local export and recovery paths for important planning data.
- Security headers, no public sign-up flow and no service-role credentials in the client.

## Architecture

The Hub is an orchestration layer, not a monolith. Each connected product remains independently deployable and keeps its own source code, data model and runtime. Condor's operational interface and computer permissions remain local to the owner's PC; the Hub never receives Condor memory, files or device-control access.

## Tech stack

Next.js 16, React 19, TypeScript, Supabase Auth/PostgreSQL, CSS and Vercel.

## Local development

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Required public client configuration:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_VIDEOS_URL
NEXT_PUBLIC_SAT_URL
```

Only Supabase public/publishable client values belong in browser variables. Never use a `service_role` key in this application.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev
```

## Repository map

```text
src/app/          Next.js application shell and global styles
src/components/   Hub, dashboards and system workspaces
src/lib/          Project registry, Supabase client and shared data
supabase/         Owner-scoped database and storage policies
tests/            Behaviour and integration-focused checks
```

## Status

Active personal infrastructure. The source is public for portfolio review, while the deployed Hub and its data remain private by design.

Built and maintained by [Kauã Diniz Souza](https://github.com/Kauadsouza).
