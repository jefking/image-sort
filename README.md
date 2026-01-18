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

Optional (mostly useful for testing):

- `MAX_BUCKET_PHOTOS` (default `1200`)
- `MAX_BUCKET_BYTES` (default `4294967296` = 4 GiB)

### Run (dev)

In one terminal:

1. `cd server`
2. `npm install`
3. `IMAGE_ROOT=/home/jef/Pictures/theframe npm run dev`

If port `5174` is already taken, pick a different one:

- `IMAGE_ROOT=/home/jef/Pictures/theframe PORT=6174 npm run dev`

In another terminal:

1. `cd client`
2. `npm install`
3. `npm run dev`

If you changed the server port, point the client proxy at it:

- `VITE_API_TARGET=http://localhost:6174 npm run dev`

Then open the Vite URL (usually):

- http://localhost:5173

### Notes / assumptions

- The UI shows **only images still in the root** of `IMAGE_ROOT`.
- Supported extensions: jpg/jpeg/png/gif/webp/bmp/tif/tiff.
- If a file with the same name already exists in a bucket, the move is blocked (no overwrite).
