# CreatorDock Creator Loop v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only “one idea → multi-platform content package” workflow and a visible first-use setup path without breaking the existing launcher or single-draft flow.

**Architecture:** A small pure `contentPackage` module owns the package schema, prompt construction, and bounded local history. `AiWorkbench` receives the existing launch entries from `App`, derives selectable targets, and keeps package generation beside the current single-writing path. Styling adds only the package controls, variant cards, and setup card to the existing warm editorial visual system.

**Tech Stack:** React 19, TypeScript, Vitest, existing localStorage adapters, existing `createLLMClient` provider abstraction, CSS in `src/styles.css`.

**Spec:** `docs/superpowers/specs/2026-08-18-creatordock-creator-loop-design.md`

## Global Constraints

- Keep all credentials, drafts, style samples, and package records local; no new network endpoint.
- Preserve existing `creatordock.*` storage keys and single-writing behavior.
- Do not add dependencies or change package-lock.json.
- Package generation must reuse the configured model and existing provider client.
- Keep HTTP(S)-only destination validation and existing platform-entry semantics.
- Every implementation task ends with its focused test before moving on.

---

### Task 1: Add the local content-package domain module

**Files:**
- Create: `src/contentPackage.ts`
- Test: `src/contentPackage.test.ts`

**Interfaces:**
- `ContentPackageTarget = { id: string; label: string; platformPresetId?: string }`
- `ContentPackageVariant = { id: string; target: ContentPackageTarget; output: string; status: 'generating' | 'complete' | 'error'; error?: string }`
- `ContentPackageRecord = { id: string; brief: string; targets: ContentPackageTarget[]; variants: ContentPackageVariant[]; createdAt: string; updatedAt: string }`
- `loadContentPackages(storage): ContentPackageRecord[]`
- `saveContentPackages(storage, packages): void`
- `createContentPackage(brief, targets): ContentPackageRecord`
- `buildPlatformTask(brief, target): string`

- [ ] **Step 1: Write failing tests** for platform task wording, package creation, bounded history, malformed JSON recovery, and API-key exclusion.
- [ ] **Step 2: Run `node node_modules/vitest/vitest.mjs run src/contentPackage.test.ts` and observe the missing-module failure.**
- [ ] **Step 3: Implement the schema guards, prompt builder, and 20-record local persistence.** Store only the declared package fields.
- [ ] **Step 4: Re-run the focused test and verify all assertions pass.**
- [ ] **Step 5: Commit with `git add src/contentPackage.ts src/contentPackage.test.ts && git commit -m "feat: add local content package model"`.**

### Task 2: Thread existing destination entries into the AI workbench

**Files:**
- Modify: `src/main.tsx` at the `AiWorkbench` call
- Modify: `src/aiWorkbench.tsx` props and imports
- Test: `src/aiWorkbench.test.tsx`

**Interfaces:**
- `AiWorkbenchProps = { language?: LanguageSetting; entries?: readonly LaunchEntry[] }`
- `ContentPackageTarget` is derived from each entry's stable `id`, `displayName`, and optional `platformPresetId`.

- [ ] **Step 1: Add a failing render test** that mounts `AiWorkbench` with two entries and expects both target labels in package mode.
- [ ] **Step 2: Run the focused test and observe the current component lacks the `entries` prop and target controls.**
- [ ] **Step 3: Pass `config.entries` from `App` and add target derivation with a three-target default selection persisted in component state only.**
- [ ] **Step 4: Re-run `src/aiWorkbench.test.tsx` and verify the existing writing tests still pass.**
- [ ] **Step 5: Commit the prop and target plumbing.**

### Task 3: Implement package generation and local review cards

**Files:**
- Modify: `src/aiWorkbench.tsx`
- Modify: `src/writingHistory.ts` only if a shared timestamp helper is required; otherwise leave unchanged
- Test: `src/aiWorkbench.test.tsx`

**Interfaces:**
- `mode: 'single' | 'package'`
- `selectedTargetIds: string[]`
- `contentPackages: ContentPackageRecord[]`
- `generateContentPackage(): Promise<void>` calls `createLLMClient(...).generateText({ task: buildPlatformTask(...), style, styleEnabled: true, humanization, skills })` once per selected target.

- [ ] **Step 1: Add failing tests** for package-mode target validation and rendering one completed variant per target using a mocked client.
- [ ] **Step 2: Run the focused tests and capture the expected failure before implementation.**
- [ ] **Step 3: Add the mode switch, target chips, brief input reuse, package generation state, and per-target error isolation.** A failed target becomes an error card while other targets remain visible.
- [ ] **Step 4: Persist each completed package with `saveContentPackages(localStorage, next)` and render recent packages below the current package.
- [ ] **Step 5: Re-run focused AI tests and the full unit suite.**
- [ ] **Step 6: Commit with `feat: add multi-platform content package workflow`.**

### Task 4: Add the first-use setup card and visual treatment

**Files:**
- Modify: `src/aiWorkbench.tsx`
- Modify: `src/styles.css`
- Test: `src/aiWorkbench.test.tsx`

**Interfaces:**
- The setup card is visible only when no model or no personal style is configured.
- Its buttons call the existing `setActiveDialog('model')` and `setActiveDialog('style')` handlers.

- [ ] **Step 1: Add a failing accessibility test** for the setup card and both direct action labels when AI config is empty.
- [ ] **Step 2: Run the focused test and observe the missing card.**
- [ ] **Step 3: Add the card with two short setup steps, package mode as the primary action, and styles for selected targets, mode buttons, package variants, and empty/error states.**
- [ ] **Step 4: Run focused tests plus `node node_modules/typescript/bin/tsc -b --pretty false`.**
- [ ] **Step 5: Run the production build and `node scripts/check-dist.mjs`.**
- [ ] **Step 6: Commit with `feat: improve creator first-use path`.**

### Task 5: Browser verification and handoff

**Files:**
- No source changes unless a browser-discovered defect is directly tied to Tasks 1–4.

- [ ] **Step 1: Start the Vite preview and use Playwright to verify default home, package target selection, setup card, and add-entry flow.**
- [ ] **Step 2: Capture a current-home and package-mode screenshot.**
- [ ] **Step 3: Confirm `git status --short --branch` contains only intended commits/files and report test output honestly.**
