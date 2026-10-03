# CreatorDock Creator Loop v2 Design

## Goal

Make CreatorDock valuable to an individual creator every day by turning one
idea into a small, platform-aware content package while keeping model keys,
drafts, and style data local to the device.

## Product promise

> 写一次想法，得到适合不同平台的内容草稿；平台入口、模型和个人风格都在本机掌控。

The home workbench remains the account and destination launcher (A). The AI
area adds a content-package mode that adapts one brief to selected destinations
(B). The existing local model and style configuration becomes an explicit
two-step setup path rather than a hidden prerequisite (C).

## Scope for this increment

1. Preserve the existing single-draft flow and all existing local storage keys.
2. Add a local-only content-package record with a brief, selected destinations,
   generated variants, and per-variant status.
3. Let the AI workbench derive target choices from the user's existing launch
   entries, so the platform list never drifts from the workbench.
4. Generate one platform-specific prompt per selected target and render each
   returned variant in a reviewable card.
5. Add a first-use setup card linking directly to model and personal-style
   dialogs. Do not introduce accounts, a server, automatic publishing, or API
   proxying.

## Non-goals

- No login, cloud sync, team permissions, publishing automation, analytics, or
  platform scraping.
- No new model provider or API protocol.
- No migration or deletion of existing writing history, AI config, or workbench
  config.

## UX flow

1. The creator opens the existing two-column workbench and chooses “内容包”.
2. CreatorDock preselects up to three existing destination entries and lets the
   creator add or remove targets without leaving the page.
3. The creator writes one brief and starts generation. The app validates the
   local model and passphrase using the existing path.
4. The app sends a separate, explicit platform-adapted task to the creator's
   configured provider. Results are stored locally as they arrive.
5. The creator reviews each variant, copies it, or starts a new package. The
   original single-draft mode remains available for focused editing.

## Data boundaries

`src/contentPackage.ts` owns schema validation and local persistence for package
records. It must accept malformed storage by returning an empty list, cap the
history at 20 packages, and never store API keys. `src/aiWorkbench.tsx` owns
the current package UI and invokes the existing `createLLMClient` only with
user-supplied model credentials already unlocked in memory.

## Success criteria

- A new user can see the two setup actions without opening a settings panel.
- A creator can select at least two existing platform entries and generate a
  separate visible result for each selected target.
- Reloading the page retains the last 20 package records and never includes an
  API key in the serialized package data.
- Existing single-mode writing, model settings, style settings, all unit tests,
  type checking, and production build remain green.
