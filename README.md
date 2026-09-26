# ARTX Hub

**English** · [Português](README.pt-BR.md) · [Español](README.es.md)

A private command centre that brings Kauã's systems — video production, language study, university planning, the public site and the local assistant — into one interface, **without merging their codebases, databases or security boundaries**.

[Open the Hub](https://artx-hub.vercel.app) · [Download for Windows](https://github.com/Kauadsouza/ARTX-Hub/releases/latest) · Authentication required

---

## Why it exists

Five separate systems become five forgotten tabs, five logins and five places where a task can go missing. Merging them into one monolith would fix that and create a worse problem: a bug in the video studio would take the study app down with it.

The Hub is an **orchestration layer**. Each product keeps its own deployment, its own database and its own lifecycle; the Hub gives them a common door and a common session.

## What it connects

| System | Purpose | Integration |
| --- | --- | --- |
| [Site KauaArtx](https://github.com/Kauadsouza/Site-KauaArtx) | Public bilingual presence and personal brand | External application |
| [Video Studio](https://github.com/Kauadsouza/KauaArtx-Video-Studio) | YouTube ideas, scripts and publishing | Embedded, with the Hub session |
| [Idiomas](https://github.com/Kauadsouza/SAT-simulado) | English and Spanish: daily study and exams | Embedded, with the Hub session |
| [University Path](https://github.com/Kauadsouza/University-Path) | UK undergraduate application planning | Embedded, with the Hub session |
| Cursos | Free courses with the lessons embedded, progress per lesson and attached certificates | Embedded, with the Hub session |

## Windows application

The installer comes from the official releases and uses the **same account** as the website — there is no second password. It carries no private data and no credentials: it is an Electron shell that opens the hosted Hub, so any change to the site appears without reinstalling.

From version 1.0.1 it **updates itself**: it checks the GitHub release, downloads in the background and asks before restarting — it never interrupts someone mid-task. This matters because the Hub's content refreshes on its own but the Electron runtime around it does not; without that channel, a security fix would only arrive if someone reinstalled by hand.

See [desktop setup and security](desktop/README.md) and [recovering access on another PC](docs/RECOVERY.md).

## Access control

The owner signs in with a Supabase account. Everyone else creates an account and stays **pending until approved** — and approval is per system: you can grant only Videos, only Idiomas, or whatever fits. Nothing is granted by default, and each account's data stays separate.

## Engineering decisions worth noting

- **Orchestration, not a monolith.** Each embedded system receives the session over `postMessage` with a verified origin, instead of sharing a database.
- **Owner-scoped Row Level Security**, covering Storage objects as well as tables — not only the rows.
- **No service credential in the browser.** Only the Supabase URL and publishable key reach the client.
- **Hardened Electron:** sandbox, context isolation, and fuses disabling `runAsNode`, CLI inspection and loading outside the asar.
- **Releases with provenance.** The build verifies that the tag matches the version, generates SHA256SUMS and emits a GitHub build-provenance attestation. The installer is not yet Authenticode-signed — that is stated in the release itself rather than hidden.
- **Recovery documented honestly**, including what signing in does *not* bring back.
- **Functions next to the data.** Vercel Functions are pinned to `pdx1` (Portland) in `vercel.json`, the same region as the Supabase database; the default Washington region added a cross-country round trip to every query.

## Tech stack

Next.js 16, React 19, TypeScript, Supabase Auth/PostgreSQL, Electron and Vercel.

## Local development

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Required public configuration:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_VIDEOS_URL
NEXT_PUBLIC_SAT_URL
```

Only public Supabase values belong in browser variables. Never use a `service_role` key in this application.

Optional: `ANTHROPIC_API_KEY` enables Jade, the Hub's intelligence. Without it, the tab explains that it is not configured yet and everything else keeps working.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev
```

## Repository map

```text
desktop/          Electron application and its release chain
docs/             Access recovery and procedures
src/app/          Application shell, routes and global styles
src/components/   Hub, dashboards and system workspaces
src/lib/          Project registry, Supabase client and shared data
supabase/         Owner-scoped database and storage policies
tests/            Behaviour and integration checks
```

## Status

Personal infrastructure in active use. The source is public for anyone who wants to review it; the deployed Hub and its data are private by design.

Built and maintained by [Kauã Diniz Souza](https://github.com/Kauadsouza).
