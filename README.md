# Stereo Vue

An instrument for the rendering of any photograph into the illusion of depth, after Wheatstone’s stereoscope (MDCCCXXXII).

Take or upload a photograph. Stereo Vue estimates relief, then prepares:

- a **stereograph** (side-by-side, for a parlour viewer — turn the telephone upon its side)
- an **anaglyph** (red and cyan spectacles)
- a **living plate** (a short wiggle GIF)

Works in the browser. After the depth engine has loaded, it may be used without a further connexion.

## Run locally

Requires **Node 22**.

```bash
npm install
npm run dev
```

Open the address printed in the terminal (usually `http://localhost:8080`).

## GitHub

1. Create a new repository (for example `stereo-vue`).
2. Unzip this project, then:

```bash
git init
git add .
git commit -m "Stereo Vue"
git branch -M main
git remote add origin https://github.com/YOUR-USER/stereo-vue.git
git push -u origin main
```

Do not commit `node_modules`.

## Vercel

1. Sign in at [vercel.com](https://vercel.com) and **Add New → Project**.
2. Import the GitHub repository. The repository **root** must be this project (the folder that contains `package.json` and `vite.config.ts`).
3. Settings:
   - **Framework Preset:** Other
   - **Build Command:** `vite build`
   - **Install Command:** `npm install`
   - **Node.js:** 22.x
   - **Root Directory:** leave blank
4. Environment variable:
   - `VITE_AUTH_ENABLED` = `false`
5. Deploy.

Leave the Output Directory blank.

If the build says it cannot find `scripts/with-app-env.mjs`, the `scripts` folder was not pushed. Unzip again and push the **entire** folder, including `scripts/`.

Or, with the Vercel CLI:

```bash
npm i -g vercel
vercel
```

## Notes

- Camera and album require **HTTPS** (Vercel provides this).
- Depth estimation runs in the visitor’s browser. The first visit may download a small model.
- Preserve to Album uses the telephone’s share sheet, or a file download on a computer.
- Optional **Made with Stereo Vue** stamp is off unless the visitor turns it on before preserving.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local parlour (port 8080) |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript |
