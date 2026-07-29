# CreatorDock v1 Design

## Product

CreatorDock is an installable creator launchpad. It gathers links for multiple
creator accounts without storing credentials, signing users in, publishing
content, or collecting platform analytics.

The public web app is a static PWA. A separate optional Windows helper creates
browser-profile-bound `.lnk` shortcuts for Chrome and Edge.

## Experience

The interface uses a restrained creator-workbench style: warm light surfaces,
generous spacing, strong typography, and platform colors only as accents.
Users can search, group, add, edit, delete, and reorder launch cards. The same
platform may appear any number of times with different account labels.

The initial catalog includes Xiaohongshu, WeChat Official Accounts, WeChat
Channels, Bilibili, Douyin, X/Twitter, Kuaishou, Weibo, Zhihu, Toutiao,
Baijiahao, Juejin, and CSDN. Custom HTTP(S) links are also supported.

## Architecture

- React, TypeScript, and Vite power a single-page application.
- A versioned local configuration persists in browser storage.
- JSON import/export provides backup and migration without cloud accounts.
- The PWA caches only the application shell, never third-party destinations.
- GitHub Actions validates and builds the app for GitHub Pages.
- A PowerShell helper consumes a shortcut-only export and creates `.lnk` files.

Browser selection on an entry applies only to generated Windows shortcuts.
Normal card clicks are ordinary isolated external links because web pages
cannot reliably select another browser profile.

## Data and Security

Only `http:` and `https:` URLs are accepted. Export files contain labels, URLs,
browser choices, profile directory names, layout settings, and ordering. They
never contain passwords, cookies, tokens, or browser account identities.

Invalid stored or imported data is rejected without replacing the last valid
configuration. Resetting requires explicit confirmation.

## Completion Criteria

- Multiple entries for the same platform persist across reloads.
- Search, grouping, editing, deletion, ordering, theme, and density work with
  keyboard-accessible controls on desktop and mobile layouts.
- JSON export/import round-trips a valid configuration.
- The production build contains a valid PWA manifest and works under a
  GitHub Pages base path.
- The Windows helper detects installed Chrome/Edge paths and profile directory
  names without inspecting credentials, then creates verifiable shortcuts.
- Automated tests, production build, local HTTP preview, and shortcut smoke
  tests complete successfully.

