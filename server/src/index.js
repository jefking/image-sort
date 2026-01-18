import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// Allow overrides for testing/dev; defaults match your requirements.
const MAX_BUCKET_PHOTOS = envInt('MAX_BUCKET_PHOTOS', 1200);
const MAX_BUCKET_BYTES = envInt('MAX_BUCKET_BYTES', 4 * 1024 * 1024 * 1024); // 4 GiB
const DEFAULT_PORT = 5174;

const IMAGE_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff'
]);

function getImageRoot() {
  const root = process.env.IMAGE_ROOT;
  if (!root) return null;
  return path.resolve(root);
}

function isSafeLeafName(name) {
  // Prevent path traversal and subpaths.
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name === path.basename(name) &&
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('..')
  );
}

function isBucketName(name) {
  return typeof name === 'string' && /^[0-9]+$/.test(name);
}

function isImageFileName(name) {
  const ext = path.extname(name).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listBuckets(root) {
  const ents = await fs.readdir(root, { withFileTypes: true });
  const buckets = ents
    .filter((e) => e.isDirectory() && isBucketName(e.name))
    .map((e) => e.name)
    .sort((a, b) => Number(a) - Number(b));
  return buckets;
}

async function listRootImages(root) {
  const ents = await fs.readdir(root, { withFileTypes: true });
  const files = ents
    .filter((e) => e.isFile() && isImageFileName(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const images = [];
  for (const name of files) {
    const p = path.join(root, name);
    const st = await fs.stat(p);
    images.push({ name, sizeBytes: st.size, mtimeMs: st.mtimeMs });
  }
  return images;
}

async function getBucketStats(root, bucketName) {
  const bucketPath = path.join(root, bucketName);
  const ents = await fs.readdir(bucketPath, { withFileTypes: true });
  const files = ents.filter((e) => e.isFile());

  let totalBytes = 0;
  let photoCount = 0;
  for (const f of files) {
    const p = path.join(bucketPath, f.name);
    const st = await fs.stat(p);
    totalBytes += st.size;
    if (isImageFileName(f.name)) photoCount += 1;
  }

  return {
    name: bucketName,
    photoCount,
    totalBytes
  };
}

async function getState(root) {
  const [images, bucketNames] = await Promise.all([
    listRootImages(root),
    listBuckets(root)
  ]);
  const buckets = [];
  for (const b of bucketNames) {
    buckets.push(await getBucketStats(root, b));
  }
  return {
    root,
    limits: { maxBucketPhotos: MAX_BUCKET_PHOTOS, maxBucketBytes: MAX_BUCKET_BYTES },
    images,
    buckets
  };
}

async function moveFileSafe(src, dest) {
  // Prefer rename; if cross-device, fall back to copy+unlink.
  try {
    await fs.rename(src, dest);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      await fs.copyFile(src, dest);
      await fs.unlink(src);
      return;
    }
    throw err;
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/state', async (req, res) => {
  const root = getImageRoot();
  if (!root) {
    return res.status(400).json({
      error: 'IMAGE_ROOT_NOT_SET',
      message: 'Set IMAGE_ROOT to the folder containing your images (e.g. /home/jef/Pictures/theframe).'
    });
  }
  try {
    const st = await fs.stat(root);
    if (!st.isDirectory()) throw new Error('IMAGE_ROOT is not a directory');
    return res.json(await getState(root));
  } catch (e) {
    return res.status(500).json({
      error: 'STATE_FAILED',
      message: String(e?.message ?? e)
    });
  }
});

app.post('/api/buckets', async (req, res) => {
  const root = getImageRoot();
  if (!root) return res.status(400).json({ error: 'IMAGE_ROOT_NOT_SET' });

  try {
    const existing = await listBuckets(root);
    const next = existing.length === 0 ? 1 : Math.max(...existing.map((n) => Number(n))) + 1;
    const name = String(next);
    const p = path.join(root, name);

    await fs.mkdir(p, { recursive: false });
    return res.json({ bucket: await getBucketStats(root, name) });
  } catch (e) {
    return res.status(500).json({ error: 'CREATE_BUCKET_FAILED', message: String(e?.message ?? e) });
  }
});

app.get('/api/image', async (req, res) => {
  const root = getImageRoot();
  if (!root) return res.status(400).json({ error: 'IMAGE_ROOT_NOT_SET' });

  const name = String(req.query.name ?? '');
  if (!isSafeLeafName(name) || !isImageFileName(name)) {
    return res.status(400).json({ error: 'INVALID_IMAGE_NAME' });
  }

  const p = path.join(root, name);
  try {
    // Only serve images still in the root folder.
    const st = await fs.stat(p);
    if (!st.isFile()) return res.status(404).end();
    return res.sendFile(p);
  } catch {
    return res.status(404).end();
  }
});

app.post('/api/move', async (req, res) => {
  const root = getImageRoot();
  if (!root) return res.status(400).json({ error: 'IMAGE_ROOT_NOT_SET' });

  const imageName = req.body?.imageName;
  const bucketName = req.body?.bucketName;

  if (!isSafeLeafName(imageName) || !isImageFileName(imageName)) {
    return res.status(400).json({ error: 'INVALID_IMAGE_NAME' });
  }
  if (!isBucketName(bucketName)) {
    return res.status(400).json({ error: 'INVALID_BUCKET_NAME' });
  }

  const src = path.join(root, imageName);
  const bucketPath = path.join(root, bucketName);
  const dest = path.join(bucketPath, imageName);

  try {
    if (!(await pathExists(bucketPath))) {
      return res.status(404).json({ error: 'BUCKET_NOT_FOUND' });
    }
    if (await pathExists(dest)) {
      return res.status(409).json({ error: 'DEST_ALREADY_EXISTS', message: 'A file with the same name already exists in that bucket.' });
    }

    const [srcStat, bucketStat] = await Promise.all([fs.stat(src), fs.stat(bucketPath)]);
    if (!srcStat.isFile()) return res.status(404).json({ error: 'IMAGE_NOT_FOUND' });
    if (!bucketStat.isDirectory()) return res.status(404).json({ error: 'BUCKET_NOT_FOUND' });

    const stats = await getBucketStats(root, bucketName);
    const newPhotoCount = stats.photoCount + 1;
    const newTotalBytes = stats.totalBytes + srcStat.size;

    if (newPhotoCount > MAX_BUCKET_PHOTOS) {
      return res.status(409).json({
        error: 'BUCKET_FULL_PHOTOS',
        message: `Bucket ${bucketName} cannot exceed ${MAX_BUCKET_PHOTOS} photos.`
      });
    }
    if (newTotalBytes > MAX_BUCKET_BYTES) {
      return res.status(409).json({
        error: 'BUCKET_FULL_BYTES',
        message: `Bucket ${bucketName} cannot exceed 4 GiB.`
      });
    }

    await moveFileSafe(src, dest);
    return res.json({ ok: true, bucket: await getBucketStats(root, bucketName), removed: imageName });
  } catch (e) {
    return res.status(500).json({ error: 'MOVE_FAILED', message: String(e?.message ?? e) });
  }
});

const port = Number(process.env.PORT ?? DEFAULT_PORT);
app.listen(port, () => {
  console.log(`[image-sort] server running on http://localhost:${port}`);
  console.log(`[image-sort] IMAGE_ROOT=${process.env.IMAGE_ROOT ?? '(not set)'}`);
});
