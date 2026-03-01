# UniCreate - Patch Notes v1.0.5

Date: 2026-03-01
Release tag: `v1.0.5`
Repository: `drrakendu78/UniCreate`

## Highlights

- Full internationalization (i18n) — English and French across all pages.
- Enterprise security features: ephemeral-only mode, configurable session timeout, audit log, proxy support, GPO-friendly policy config.
- New Settings page with 7 sections: Account, Security, Network, General, Updates, History, About.

## New Features

### 1) i18n — Full bilingual support (EN/FR)
- Dictionary-based translation system with `useT()` hook and `{var}` interpolation.
- All pages fully translated: Home, StepInstaller, StepMetadata, StepReview, StepSubmit, Settings, ProfileButton, App (update popup).
- Language selector in Settings.

Impacted files:
- `src/lib/i18n.ts` (new)
- `src/pages/Home.tsx`
- `src/pages/StepInstaller.tsx`
- `src/pages/StepMetadata.tsx`
- `src/pages/StepReview.tsx`
- `src/pages/StepSubmit.tsx`
- `src/pages/Settings.tsx`
- `src/components/ProfileButton.tsx`
- `src/App.tsx`
- `tsconfig.json` (ES2021 for `replaceAll`)

### 2) Enterprise security — "Never save session" mode
- New toggle in Settings > Security to force ephemeral-only sessions.
- When enabled, tokens are never stored in Windows Credential Manager.
- The "Remember session" checkbox is hidden in login modals.
- Activating it while connected clears the saved token immediately.

Impacted files:
- `src/stores/settings-store.ts`
- `src/pages/Settings.tsx`
- `src/components/ProfileButton.tsx`
- `src/pages/StepSubmit.tsx`

### 3) Configurable ephemeral session timeout
- Choose between 5, 10, 15, or 30 minutes (default: 15 min).
- Dynamic label shows actual timeout value everywhere.

Impacted files:
- `src/stores/settings-store.ts`
- `src/stores/auth-session-store.ts`
- `src/pages/Settings.tsx`
- `src/lib/i18n.ts`

### 4) Auto-lock on screen lock
- Session is cleared when the app regains visibility if the ephemeral timer has expired.
- Covers Win+L, sleep, and tab switching.

Impacted file:
- `src/App.tsx`

### 5) Token scope display
- Settings > Account shows `public_repo` badge with explanation.
- Confirms only public repository access is requested.

Impacted files:
- `src/pages/Settings.tsx`
- `src/lib/i18n.ts`

### 6) HTTP Proxy support
- Optional proxy URL in Settings > Network.
- Backend `reqwest` client uses configured proxy for all GitHub API calls.
- Falls back to system proxy when empty.

Impacted files:
- `src-tauri/src/github.rs` (proxy Mutex + `http_client()`)
- `src-tauri/src/lib.rs` (`set_proxy` command)
- `src/stores/settings-store.ts`
- `src/pages/Settings.tsx`
- `src/App.tsx`

### 7) Local audit log
- Every PR submission is logged to `%LOCALAPPDATA%\UniCreate\audit.log`.
- Format: `[timestamp] user=... package=... version=... pr=... type=new|update`
- Log entries are sanitized against injection (newlines stripped).
- "Open log" button in Settings > Security opens the log folder.

Impacted files:
- `src-tauri/src/lib.rs` (`write_audit_log`, `get_audit_log_path`, `open_audit_log_folder`)
- `src/pages/StepSubmit.tsx`
- `src/pages/Settings.tsx`

### 8) Deployable policy config (GPO-friendly)
- Place `unicreate.policy.json` next to the exe to enforce enterprise defaults.
- Supported keys: `neverSaveSession`, `ephemeralTimeoutMinutes`, `proxyUrl`, `autoCheckUpdates`, `language`.
- Values are validated at runtime (e.g. timeout must be 5/10/15/30).

Example:
```json
{
  "neverSaveSession": true,
  "ephemeralTimeoutMinutes": 5,
  "proxyUrl": "http://proxy.corp:8080",
  "autoCheckUpdates": false
}
```

Impacted files:
- `src-tauri/src/lib.rs` (`read_policy_config`)
- `src/App.tsx`

### 9) Settings page redesign
- 7 sections: Account, Security, Network, General, Updates, History, About.
- "Settings" label (translated) next to the gear icon in the header.

Impacted files:
- `src/pages/Settings.tsx`
- `src/App.tsx`

## Technical changes

- `tsconfig.json`: `lib` upgraded from ES2020 to ES2021 for `String.replaceAll()`.
- `github.rs`: Mutex for proxy URL with poison-safe `.unwrap_or_else(|e| e.into_inner())`.
- `auth-session-store.ts`: TTL now reads dynamically from settings store.
- `manifest-store.ts`: new `settings` step added to steps.

## Build artifacts and SHA256 checksums

Checksums below match binaries produced by `npm run tauri build`.

| File | Size (bytes) | SHA256 |
|---|---:|---|
| `UniCreate_1.0.5_x64-setup.exe` | 16,554,589 | `37744a223faef98939778d8aec1dd053436bd757bf9a98cdcd108d7607f47433` |
| `UniCreate_1.0.5_x64_en-US.msi` | 19,931,136 | `1bfa956e2c52971e464c28193a4b2554a4cef6b417691b4dbc52abc1a0adef4a` |
| `UniCreate_1.0.5_x64_portable.exe` | 25,069,056 | `d4df565dda4e72daa3f9a8378a5be0c12b26abf91d15184445e9ff2ee5f88b59` |
