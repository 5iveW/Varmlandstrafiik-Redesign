// MapLibre v6 finds its web worker next to its own module file, which the
// bundler moves. This copies the (self-contained) worker into public/ so it is
// served at /maplibre-gl-worker.mjs; LiveMap points MapLibre there. Runs on
// every `npm install`, so the worker always matches the installed version.
import { copyFileSync } from "node:fs";

copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
