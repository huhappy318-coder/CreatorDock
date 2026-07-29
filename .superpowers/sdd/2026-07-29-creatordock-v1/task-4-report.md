# Task 4 Report: PWA and Windows Shortcut Helper

## Status and commit

Task 4 implementation is complete on `codex/creatordock-v1`.

Implementation commit:

```text
11ca43a feat: add PWA and Windows shortcut helper
```

This report is committed separately so it can truthfully include the
implementation commit hash without creating an impossible self-referential
commit hash.

## Delivered scope

### PWA

- Added relative `base: './'`, manifest `start_url: './'`, and `scope: './'`
  for GitHub Pages-compatible subdirectory hosting.
- Kept development service-worker behavior explicitly disabled and production
  registration explicit through `virtual:pwa-register/react`.
- Switched to prompt-based updates and added an accessible in-app status
  prompt with `Reload now` and `Dismiss update` actions.
- Configured Workbox with an empty runtime cache list. The generated worker
  precaches only built CreatorDock HTML, CSS, JavaScript, manifest, SVG, PNG,
  and ICO assets and provides the local `index.html` navigation fallback.
- Added SVG, 64/192/512 PNG, maskable PNG, Apple touch PNG, and ICO assets.
- Added a real generated shortcut-export Blob-content assertion to the
  existing component flow.

### Windows helper

- Added `scripts/New-CreatorDockShortcuts.ps1`.
- Added the self-contained Windows PowerShell 5.1 assertion suite
  `scripts/Test-CreatorDockShortcuts.ps1`.
- Validates the Task 2 `ShortcutExport` v1 JSON contract and rejects:
  - unknown or missing schema versions;
  - a non-array `shortcuts` value;
  - missing required entry fields;
  - non-HTTP(S), malformed, or credential-bearing URLs;
  - browser targets other than `default`, `chrome`, or `edge`;
  - non-boolean `createShortcut`;
  - profile names other than `Default` or `Profile N`;
  - a profile on a system/default target.
- Detects Chrome and Edge from the standard Program Files and Program Files
  (x86) locations plus current-user and local-machine App Paths entries.
- Enumerates only immediate directory names matching `Default` or `Profile N`
  under each browser user-data root. It does not open profile files or read
  display names, accounts, cookies, credentials, tokens, or email addresses.
- Creates `.lnk` files through `WScript.Shell` in the explicit output
  directory.
- Chrome/Edge shortcuts use a validated executable, an optional validated
  `--profile-directory="<name>"` argument, and a normalized HTTP(S) URL.
- System shortcuts call the Windows URL handler directly through
  `rundll32.exe url.dll,FileProtocolHandler "<validated URL>"`; no shell
  command evaluation or user-text execution is used.
- Sanitizes filenames, protects reserved Windows names, truncates long names,
  skips existing shortcuts unless `-Force` is explicit, and returns a
  structured created/skipped summary.
- `-SelfTest` creates only harmless `https://example.com/` shortcuts inside a
  uniquely named temporary directory, reopens every `.lnk`, checks target,
  arguments, and URL, and removes only that exact validated temporary root.

## TDD evidence

### Frontend update prompt

Initial RED:

```text
npm test -- src/pwa-update.test.tsx src/main.test.tsx
1 failed suite: Failed to resolve import "./pwa-update"
12 existing component tests passed
```

The generated shortcut export test also read the actual Blob through
`FileReader` and compared it with a hand-written literal v1 document.

First GREEN:

```text
npm test -- src/pwa-update.test.tsx src/main.test.tsx
2 test files passed
13 tests passed
```

Dismissal received a second RED/GREEN cycle:

```text
RED: expected the update status prompt not to remain in the document
GREEN: 2 test files passed, 13 tests passed
```

The final test observes the real prompt DOM: it checks the accessible status,
invokes both explicit actions, and verifies dismissal removes the prompt.

### PowerShell helper

Initial RED:

```text
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass \
  -File .\scripts\Test-CreatorDockShortcuts.ps1

Shortcut helper is missing:
...\scripts\New-CreatorDockShortcuts.ps1
```

First GREEN:

```text
Passed: true
Assertions: 19
DetectedBrowserPaths: chrome, edge
```

Self-review then found that a single object in `shortcuts` was being accepted
even though the schema requires an array. A new failing case first produced:

```text
Invalid shortcuts-shape input should be rejected.
Expected an error matching 'array'.
```

After the minimal schema-shape fix:

```text
Passed: true
Assertions: 20
DetectedBrowserPaths: chrome, edge
```

The controlled creation assertions use the running PowerShell executable as a
harmless injected browser target, create real `.lnk` objects in the test temp
directory, reopen them through `WScript.Shell`, and compare literal expected
targets and arguments.

## Detected browser and profile directory evidence

Only executable paths and allowed directory names were observed:

```text
Chrome executable:
C:\Program Files\Google\Chrome\Application\chrome.exe

Edge executable:
C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe

Chrome profile directory names:
Default
Profile 1
Profile 2
Profile 3
Profile 4
Profile 5
Profile 6
Profile 7
Profile 8
Profile 9
Profile 11

Edge profile directory names:
Default
```

No profile contents or browser identities were read.

## Shortcut self-test result

Final `-SelfTest` result:

```text
Passed: true
CreatedCount: 3
TemporaryDirectoryRemoved: true

CreatorDock system self-test:
TargetMatches: true
ArgumentsMatch: true
UrlMatches: true

CreatorDock chrome self-test:
ProfileDirectoryName: Default
TargetMatches: true
ArgumentsMatch: true
UrlMatches: true

CreatorDock edge self-test:
ProfileDirectoryName: Default
TargetMatches: true
ArgumentsMatch: true
UrlMatches: true
```

A separate residual scan after both the assertion test and self-test found:

```text
ResidualCreatorDockTempDirectories: 0
```

No Desktop path was used for output. No shortcut was launched.

## PWA verification

Final frontend suite:

```text
npm test
4 test files passed
36 tests passed
```

Final production build:

```text
npm run build
tsc -b passed
vite build passed
35 modules transformed
PWA generateSW completed
20 precache entries
dist/manifest.webmanifest generated
dist/sw.js generated
```

Generated artifact audit:

```text
Name: CreatorDock
Display: standalone
StartUrl: ./
Scope: ./
ThemeColor: #f7f3ec
IconCount: 4
MissingIconCount: 0
PrecacheCount: 20
ThirdPartyPrecacheCount: 0
```

All generated precache URLs were relative CreatorDock assets. Workbox
`runtimeCaching` is explicitly empty, so third-party destination pages are not
cached, proxied, or prefetched.

Generated PNG dimensions were decoded successfully:

```text
apple-touch-icon-180x180.png  180 x 180
maskable-icon-512x512.png     512 x 512
pwa-192x192.png               192 x 192
pwa-512x512.png               512 x 512
pwa-64x64.png                  64 x 64
```

Deterministic server checks used Vite's programmatic API and closed each
server before continuing:

```text
dev:
HTTP 200
root element present
source entry present

preview:
HTTP 200
manifest HTTP 200
root element present
relative asset and manifest paths present
```

## Safety checks

- PowerShell tests and self-test wrote only to GUID-named directories directly
  beneath the Windows temporary path.
- Both scripts remove only their exact `$testRoot` or validated
  `$temporaryRoot` with `Remove-Item -LiteralPath`.
- The self-test validates that its deletion target is an immediate child of
  the temp directory and matches `CreatorDock-SelfTest-<32 hex characters>`
  before creating it.
- The helper contains no `Start-Process`, `Invoke-Item`, browser launch,
  platform launch, login, network request, Desktop output default, or remote
  publishing action.
- `Get-ChildItem` is used only once in production code, with `-Directory`,
  against the explicit Chrome/Edge user-data root, and returns only allowed
  immediate directory names.
- `Get-Content` reads only the caller-supplied shortcut-export JSON.
- `git diff --check` exited 0 before the implementation commit.
- No dependency was added or upgraded, and no remote push was performed.

## Operational observations

- The first PNG generator invocation incorrectly supplied `public` both as the
  root and as part of the input path. It failed with an ENOENT before creating
  any file. The corrected root-relative input generated the assets listed
  above.
- Two attempted one-line Node artifact audits were rejected by Windows command
  quoting before producing a result. The audit was switched to native
  PowerShell parsing and passed. No source or artifact was modified by either
  failed audit command.
- An attempted hidden background server check was rejected by command policy
  before execution. The final check used Vite's in-process API and cleanly
  closed both servers.

## Self-review and limitations

- The implementation stays within the static-PWA and optional-PowerShell
  boundary; it adds no backend, protocol handler, extension, Electron, or
  Tauri behavior.
- Tests cover the externally observable update prompt, export Blob, validation
  errors, profile-name enumeration boundary, filename sanitization, overwrite
  behavior, actual shortcut serialization, and self-test cleanup.
- Actual detected Chrome and Edge executables were used only by `-SelfTest` as
  `.lnk` targets. Neither executable nor any generated shortcut was launched.
- The Task 4 run did not perform a real browser installation click, offline
  browser session, accessibility screen-reader session, or GitHub Pages
  deployment. The built manifest, generated worker, relative paths, local
  dev/preview delivery, and accessible component behavior were verified
  directly; deployment and broader browser-level checks remain Task 5 scope.
- Workbox emits repeated precache entries for some public assets because they
  are both explicitly included and matched by the local glob. The build
  succeeds and all entries remain local; this is not a safety or correctness
  issue, but Task 5 may choose to de-duplicate the generated list if desired.

## Review fix Round 1/5

Review source:
`.superpowers/sdd/2026-07-29-creatordock-v1/task-4-review.md`.

Scope was limited to the three Important findings. The Minor duplicate
precache finding was intentionally left unchanged for final review, as
directed.

### Desktop-backed temporary directory refusal

The public self-test previously checked only the candidate's parent and GUID
leaf. It now resolves the self-test candidate and Desktop boundary before
browser detection, profile enumeration, or any `New-Item`.

The test maps both `TEMP` and `TMP` to a controlled temp-only “Pretend Desktop”
directory and lets the self-test use its normal `[IO.Path]::GetTempPath()`
default. Fixed GUIDs make both filesystem outcomes directly observable.

RED:

```text
A Desktop-backed temporary root must be refused.
Wrong error: A parameter cannot be found that matches parameter name
'TemporaryParent'.
```

GREEN behavior:

```text
- A nonexistent CreatorDock-SelfTest-<fixed GUID> candidate remained absent.
- A pre-existing CreatorDock-SelfTest-<fixed GUID> candidate remained present.
- Both calls failed with "Refusing Desktop-backed self-test directory".
- TEMP and TMP were restored in finally.
```

The controlled “Pretend Desktop” lives under the assertion suite's GUID-named
temp root. The real Desktop was not written or enumerated.

### Accurate assertion accounting

The assertion suite no longer reports a hard-coded count.
`Assert-Equal` and `Assert-Throws` increment one shared counter for every
executed assertion, and the final JSON reads that counter.

The original report's two historical counts were corrected:

```text
Initial helper GREEN: 19 executed assertions
Schema-array GREEN: 20 executed assertions
```

The four new Desktop boundary assertions produce the current result:

```text
Passed: true
Assertions: 24
```

### Optional PWA chunk rejection

The app previously waited for `import('./pwa-register')` before creating its
React root.

RED:

```text
npm test -- src/startup.test.tsx
1 failed
Unable to find role="heading" and name "Begin where your work lives."
Vitest caught 1 unhandled rejection:
PWA registration chunk unavailable
```

GREEN:

```text
npm test -- src/startup.test.tsx src/pwa-update.test.tsx src/main.test.tsx
3 test files passed
14 tests passed
```

`App` is now rendered immediately. A successful dynamic import adds
`PwaUpdatePrompt` to the same React root; a rejected optional import is caught
without unmounting or gating the local application.

### Final Round 1 verification

```text
npm test
5 test files passed
37 tests passed

npm run build
TypeScript build passed
Vite production build passed
35 modules transformed
PWA generateSW completed
20 precache entries

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass \
  -File .\scripts\Test-CreatorDockShortcuts.ps1
Passed: true
Assertions: 24

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass \
  -File .\scripts\New-CreatorDockShortcuts.ps1 -SelfTest
Passed: true
CreatedCount: 3
TemporaryDirectoryRemoved: true
All target/argument/URL checks: true

ResidualCreatorDockTempDirectories: 0
git diff --check: exit 0
```

No Desktop output, browser/platform launch, profile-content read, dependency
change, remote push, or Minor-finding change was made. The Round 1 commit hash
is reported in the task handoff after the final commit.
