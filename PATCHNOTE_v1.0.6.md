# UniCreate - Patch Notes v1.0.6

Date: 2026-03-01
Release tag: `v1.0.6`
Repository: `drrakendu78/UniCreate`

## Highlights

- Sticky navigation buttons — Back/Continue buttons now stay visible at the bottom of the screen while scrolling through long pages.

## Changes

### 1) Sticky navigation bar (QoL)
- Navigation buttons (Back / Continue / Submit) are now **sticky at the bottom** of the viewport on all step pages.
- When content is longer than the screen, buttons remain always accessible without scrolling down.
- Frosted glass effect (`backdrop-blur-sm`) for a clean, modern look.
- Full-width bar extends edge-to-edge (`-mx-6 px-6`) within the content container.

Impacted files:
- `src/pages/StepInstaller.tsx`
- `src/pages/StepMetadata.tsx`
- `src/pages/StepReview.tsx`
- `src/pages/StepSubmit.tsx`

### 2) Version bump
- App version updated to `1.0.6`.

Impacted files:
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`

## Build artifacts and SHA256 checksums

Checksums below match binaries produced by `npm run tauri build`.

| File | Size (bytes) | SHA256 |
|---|---:|---|
| `UniCreate_1.0.6_x64-setup.exe` | 16,550,837 | `3f2a47f374eab53ecbedcddf9e4f9f1d0c0f20b00bc3255b77f268d48dc390b9` |
| `UniCreate_1.0.6_x64_en-US.msi` | 19,931,136 | `9eda94a33deb8379a9c916cc060aa2cf54e710fcade75448f7d0a054e06f075b` |
| `UniCreate_1.0.6_x64_portable.exe` | 25,069,056 | `203f40501b446e2ce386cb48954ad9fb27db7c9e5c986b2922224264a3bbd81f` |
