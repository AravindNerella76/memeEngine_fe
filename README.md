# Meme Generator Frontend (`memeEngine_fe`)

Interactive React web frontend for the Meme Generator Engine, styled with Tailwind CSS and bundled with Vite.

## Features

- **Meme Creation Form**: Select archetypes (Trending News, Facts Collage, Comparison Columns, Movie Review, Stacked Comparison), input titles, badges, watermarks, tags, and custom text slots.
- **Image Uploads**: Upload topic images and reaction images with real-time preview and crop aspect ratio controls.
- **Multilingual Support**: Supports Telugu and English scripts with font options.
- **Interactive Result Viewer**: Live preview, download as JPEG or PNG, toggle comparison views, and trigger versioned regenerations.
- **Meme Gallery**: View saved memes, inspect version histories, and manage saved records.

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

