# ARTX Hub for Windows

The desktop app opens **https://artx-hub.vercel.app/** in a dedicated, sandboxed window. Sign in with your existing Hub account. The site and desktop app use the same hosted applications and cloud data. New accounts require approval and do not inherit the owner's workspace.

## Install

1. Open the [official releases](https://github.com/Kauadsouza/ARTX-Hub/releases/latest).
2. Download `ARTX-Hub-Setup-1.0.0-x64.exe`, not GitHub's source ZIP.
3. Run the installer and open the ARTX Hub shortcut.
4. Sign in with your existing account. Use each application's sync indicator before changing devices.

Requires Windows 10/11 x64 and internet. No Node.js, Python or Git is needed to use the Hub app. This is a Windows EXE, not an Android APK; phones use the website/PWA. Condor is installed separately and keeps its local permissions and private memory separate.

## Security boundaries

- HTTPS only for the Hub and its known embedded applications.
- Sandboxing, context isolation, web security and cookie encryption enabled.
- No preload bridge, Node integration, embedded terminals or privileged IPC exposed to the website.
- Navigation is restricted; external HTTPS links and the exact `condor://open` protocol require a native confirmation.
- Device access denied by default. Audio-only English practice requires approval for the study origin.
- Downloads use a save dialog and are never automatically executed.
- No credentials, browser profiles, private documents, database copies or environment files are included in the package.
- Electron fuses disable RunAsNode, Node options, debugging arguments and extra file-protocol privileges. ASAR integrity is enforced.

The installer currently has **no publisher code-signing certificate**. SHA-256 checksums and GitHub build attestations help verify origin, but do not replace Windows Authenticode. Do not disable antivirus or Windows protection to install it; the website remains available. Updates to web content arrive through the hosted site. Native runtime updates require a new release: use **Ajuda → Versões e atualizações**.

## Build

```powershell
cd desktop
npm.cmd ci
npm.cmd test
npm.cmd run dist
```

Output: `release/ARTX-Hub-Setup-1.0.0-x64.exe`. The package allowlist includes only `src/`, `assets/` and package metadata. Publish a `desktop-v<package version>` tag to build the installer on a clean GitHub Windows runner; the release workflow verifies the version, audits dependencies and attaches the installer, checksums and build provenance.

See [account and PC recovery](../docs/RECOVERY.md).
