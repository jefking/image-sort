## image-sort

Local web app to sort a large folder of images into numbered “bucket” subfolders.

### What it does

- Reads images from a single folder (`IMAGE_ROOT`)
- Buckets are subfolders under that same folder, named `1`, `2`, `3`, …
- Drag an image onto a bucket to **move the file on disk** into that bucket folder
- Enforces bucket caps:
  - **≤ 1200 photos**
  - **≤ 4 GiB** (4 × 1024³ bytes)

### Prereqs

- Node.js 18+ recommended

### Configure

Set the image folder you want to sort:

- Example (your case): `IMAGE_ROOT=/home/jef/Pictures/theframe`

### Run (dev)

In one terminal:

1. `cd server`
2. `npm install`
3. `IMAGE_ROOT=/home/jef/Pictures/theframe npm run dev`

In another terminal:

1. `cd client`
2. `npm install`
3. `npm run dev`

Then open the Vite URL (usually):

- http://localhost:5173

### Notes / assumptions

- The UI shows **only images still in the root** of `IMAGE_ROOT`.
- Supported extensions: jpg/jpeg/png/gif/webp/bmp/tif/tiff.
- If a file with the same name already exists in a bucket, the move is blocked (no overwrite).
