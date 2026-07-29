# CreatorDock v1 Implementation Plan

## Global Constraints

- Work only inside `C:\Users\huawei\Documents\CreatorDock`.
- Keep the app static: no backend, login handling, analytics scraping, cloud
  sync, automatic publishing, extension, Electron, or Tauri.
- Never store or inspect credentials, cookies, tokens, or browser account data.
- Accept only HTTP(S) destination URLs.
- Browser/profile selection affects generated Windows shortcuts only.
- Follow test-driven development for production behavior.
- Do not publish a GitHub repository or push a remote without explicit approval.

## Task 1: Project foundation and verified platform catalog

Create the React + TypeScript + Vite test/build foundation, a restrained visual
mockup, PWA metadata, and a typed catalog for Xiaohongshu, WeChat Official
Accounts, WeChat Channels, Bilibili, Douyin, X/Twitter, Kuaishou, Weibo, Zhihu,
Toutiao, Baijiahao, Juejin, and CSDN. Verify official entry URLs where possible;
mark any uncertain preset explicitly instead of guessing.

Tests must first demonstrate catalog uniqueness, HTTP(S) URLs, and required
platform coverage before the implementation is written.

## Task 2: Versioned configuration domain

Implement `PlatformPreset`, `LaunchEntry`, `CreatorDockConfig`, and
`ShortcutExport`. Add defaults, URL validation, add/edit/delete/reorder,
search/filter helpers, storage loading with corruption recovery, schema
migration, JSON import/export, theme, and density settings.

Tests must be written and observed failing before each production behavior.
Invalid imports must not replace the last valid configuration.

## Task 3: Responsive creator workbench

Implement the warm-light responsive dashboard, sidebar groups, top search,
adaptive card grid, empty states, add/edit dialog, delete confirmation,
reordering controls, theme and density toggles, configuration import/export,
reset confirmation, and shortcut-export action.

Use accessible semantic controls, visible focus, keyboard-operable ordering,
and isolated external links. Add component tests for the primary user flows.

## Task 4: PWA and Windows shortcut helper

Complete installable PWA behavior, offline application shell, update prompt,
GitHub Pages base-path support, and the optional PowerShell shortcut helper.

The helper must detect standard Chrome/Edge executable locations and profile
directory names, read only the shortcut export schema, write `.lnk` files to a
caller-selected directory, and support a self-test that creates shortcuts in a
temporary directory then reopens them to verify target, arguments, and URL.

## Task 5: Open-source handoff and end-to-end verification

Add MIT License, bilingual README, privacy and threat boundaries, platform
catalog maintenance instructions, Windows helper instructions, and GitHub
Pages workflow. Add browser-level checks for persistence, duplicate accounts,
import/export, keyboard behavior, manifest delivery, and base-path assets.

Run the full unit/component suite, lint/type checking, production build, local
HTTP preview, and Windows shortcut self-test. Create the local CreatorDock main
shortcut plus two WeChat Official Account shortcuts only after the temporary
shortcut validation succeeds. Do not log in or operate any platform account.

