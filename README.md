# Meme Generator Frontend (`memeEngine_fe`)

Interactive React web frontend for the Meme Generator Engine, styled with Tailwind CSS and bundled with Vite.

## Features

- **Meme Creation Form**: Select archetypes (Trending News, Facts Collage, Comparison Columns, Movie Review, Stacked Comparison), input titles, badges, watermarks, tags, and custom text slots.
- **Image Uploads**: Upload topic images and reaction images with real-time preview and crop aspect ratio controls.
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

