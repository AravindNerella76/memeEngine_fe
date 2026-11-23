# Meme Generator Frontend (`memeEngine_fe`)

Interactive React web frontend for the Meme Generator Engine, styled with Tailwind CSS and bundled with Vite.

## Features

- **Meme Creation Form**: Select archetypes (Trending News, Facts Collage, Comparison Columns, Movie Review, Stacked Comparison), input titles, badges, watermarks, tags, and custom text slots.
- **Image Uploads**: Upload topic images and reaction images with real-time preview and crop aspect ratio controls.
- **Reaction library** (`/reactions`): your reaction pictures filed by situation, emotion and subject. Import whole folders at once (each sub-folder becomes a folder), search by folder or tag, and pick one in a tap from the row under the reaction slot of both meme forms. Pictures are stored in the backend's database, so they are on every device.
- **Reaction framing**: when a reaction picture is made of stacked frames the studio asks which to use (both side by side, either frame alone, or the whole picture, each shown as a small picture) and keeps Generate closed until you answer. A live preview can be dragged (or nudged with the arrow keys), and a warning appears when the picture is too small to look sharp. The studio's copy of the rules (`lib/reactionPlan.js`) matches the backend's exactly.
- **Multilingual Support**: Supports Telugu and English scripts with font options.
- **Interactive Result Viewer**: Live preview, download as JPEG or PNG, toggle comparison views, and trigger versioned regenerations.
- **Meme Gallery**: View saved memes, inspect version histories, and manage saved records.

## Sign-in

The studio needs the owner's login (created once on the server with `npm run auth:create-owner` in `memeEngine_be`).
`src/auth/` holds `AuthProvider` (session state), `Gate` (studio vs sign-in page), the sign-in form and the
password field. All backend calls go through `apiFetch` (`src/api.js`), which sends the session cookie and tells
the app when the session ended, so a sign-in dialog appears over the page instead of losing your work. The API
base defaults to the page's own address (Vite proxies `/api` and `/output` in development; set
`VITE_PROXY_TARGET` to test against another backend).

## Design system

The look comes from the memes themselves: ink black, the `#FFE500` marker yellow, white on warm paper, with "sticker" hard shadows on hero moments and calm hairlines in dense forms.

- **Tokens** are CSS variables in `src/index.css` (RGB triplets, so `bg-ink/60` works) and are mapped to Tailwind names in `tailwind.config.js`: `ink`, `paper`, `surface`, `line`, `muted`, `marker`, `ok`/`bad`/`warn`/`info`. Never hardcode hex colours in components.
- **Primitives** live in `src/ui/` and are imported from `'../ui'`: `Button` (one yellow `primary` per screen), `Card`, `Badge`, `Field`/`Input`, `Dialog` (focus trap, Esc, scroll lock), `useConfirm()` (replaces `window.confirm`), `useToast()`, `Skeleton`, `EmptyState`, `Disclosure`, `Chips`, `ImageDrop`, `Alert`.
- **Real status, not decoration**: the sidebar reads `/api/system/status` (`StatusProvider`). Do not add hardcoded "online" badges.
- **Long work**: wrap it in `useBusyGuard(active)` so closing the tab or navigating away asks first.
- Identity details (handle, WhatsApp number, URLs) are in `src/brand.js`.

## How the app stays fast (and how to extend it without breaking that)

**Adding a page** is one entry in `src/app/routes.jsx` (`PAGES`): path, label, icon, group, `component: lazyPage(() => import(...))`. The sidebar, the phone tab bar, the router, idle prefetching and the Ctrl+K palette all read that list, so nothing else needs editing. Optional `prefetch: () => warm('/api/...')` asks for the page's data while its code is still downloading. Only the landing page is bundled with the app (`eagerPage`); keep it to one.

**Adding a Ctrl+K command** is one object in `ACTIONS` in `src/app/commands.js`. Pages and settings sections appear in the palette by themselves.

**Keyboard shortcuts** (press `?` in the studio for the full list) come from one listener in `src/app/shortcuts.jsx`. A page adds its own with `useShortcuts([{ keys, label, run, when }])`; they show up in the `?` sheet by themselves, page keys first. Give a page a `key` in `PAGES` and "G then that letter" opens it. Prefer `run: () => press('name')` with `data-key-action="name"` on the real button: the key then clicks it, so confirmations and disabled states behave exactly as for the mouse, and the button visibly presses (or shakes when it can't be used). Rules the listener enforces: nothing fires over a dialog (unless it names that dialog), single keys never fire while typing or while an Indic input method is composing, and keys are hidden on touch screens. The key syntax lives in `src/app/keys.js`.

**Adding a settings section**: titles in `SECTION_INFO` (`components/settings/settingsModel.js`), the form component, one line in `SECTIONS` in `SettingsPage.jsx`.

What is in place, and the rules that keep it working:

- **Code splitting.** Every page except the landing one is its own file, fetched on first need and prefetched one at a time while the browser is idle (never on data-saver or slow connections). `vite.config.js` groups shared code into a few long-lived files (`react`, `router`, `icons`, `vendor`, `ui`) that the HTML preloads in parallel; a new release leaves the vendor files cached. Do not import a page component directly from another file.
- **Requests.** `src/lib/queryCache.js` (`cachedJSON`, `warm`, `invalidate`) shares identical in-flight requests and serves very recent answers. Call `invalidate('/api/...')` after anything that changes that data. `index.html` starts the sign-in check before any script has loaded, and `main.jsx` starts the current page's code and data in parallel.
- **Long lists.** The gallery pages the backend (`/api/memes/list`, 24 at a time, a lean record per meme), shows small JPEG thumbnails (`/api/memes/:id/thumb`, made when a meme is saved), loads more on scroll, renders updates as transitions and skips layout of off-screen cards (`content-visibility`). New list screens should do the same.
- **Re-render discipline.** Anything that ticks (clocks, progress) lives in its own small component (`ui/Elapsed.jsx`), never in a big form's state.
- **Fonts** are self-hosted (`src/fonts.js`); only the two used by the first screen are preloaded. The logo is an SVG path, so the 120 KB Telugu font is only fetched where Telugu text is shown.
- **Offline.** `public/sw.js` keeps the app shell, built files and sample pictures so the studio opens without a connection (never `/api`, `/output` or `/uploads`). `ui/Online.jsx` (`useOnline`, `useAvailability`) tells screens whether the internet and the server are reachable, and buttons that need them disable themselves with the reason. Banners in `App.jsx` explain the three situations: no internet, no server, server down. To turn the service worker off for a browser: `localStorage.setItem('meme_engine_offline_shell','off')` and reload.
- **Failures.** `app/ErrorBoundary.jsx` keeps the menu usable when one page crashes or its files cannot be downloaded, with Try again. `app/useScrollRestoration.js` starts new pages at the top and returns to your place on Back or reload.

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Lucide React

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`. Make sure the backend server (`memeEngine_be`) is running on `http://localhost:3000`.

