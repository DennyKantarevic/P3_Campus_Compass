# p3-campus-compass

UF Campus Navigator is a web app for planning walking routes across the University of Florida campus. It combines an interactive Leaflet map with class scheduling tools so students can estimate routes, walking time, distance, and class-to-class travel gaps.

## Features

- Interactive UF campus map with OpenStreetMap tiles.
- Campus location markers with selectable route start and destination.
- Walking routes, step summaries, estimated walking time, and distance.
- Class and custom event schedule planner.
- Class gap alerts for tight back-to-back walks.
- UF-themed dark interface with orange and blue accents.
- First-load Gator-themed loading screen.

## Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, usually `http://localhost:5173`.

## Test and Build

```bash
npm test
npm run build
```

## Deploy

This project is deployed with Vercel.

```bash
vercel link --project p3-campus-compass
vercel --prod
```
