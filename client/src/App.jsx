import { useEffect, useMemo, useState } from 'react';
import { apiCreateBucket, apiGetState, apiMoveImage } from './api.js';
import { formatBytes } from './format.js';

function BucketCard({ bucket, limits, draggedImage, onDropToBucket }) {
  const fullByCount = bucket.photoCount >= limits.maxBucketPhotos;
  const fullByBytes = bucket.totalBytes >= limits.maxBucketBytes;
  const isFull = fullByCount || fullByBytes;

  const wouldExceed = useMemo(() => {
    if (!draggedImage) return false;
    const nextCount = bucket.photoCount + 1;
    const nextBytes = bucket.totalBytes + draggedImage.sizeBytes;
    return nextCount > limits.maxBucketPhotos || nextBytes > limits.maxBucketBytes;
  }, [bucket.photoCount, bucket.totalBytes, draggedImage, limits.maxBucketBytes, limits.maxBucketPhotos]);

  const canAccept = !!draggedImage && !wouldExceed;

  return (
    <div
      className={`bucket ${isFull ? 'bucket--full' : ''} ${draggedImage ? (canAccept ? 'bucket--can' : 'bucket--no') : ''}`}
      onDragOver={(e) => {
        if (canAccept) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (!canAccept) return;
        onDropToBucket(bucket.name);
      }}
      title={
        isFull
          ? 'Bucket is at capacity'
          : draggedImage
            ? canAccept
              ? 'Drop to move'
              : 'Dropping would exceed bucket caps'
            : 'Drag an image here'
      }
    >
      <div className="bucket__title">Bucket {bucket.name}</div>
      <div className="bucket__meta">
        <div>
          Photos: <b>{bucket.photoCount}</b> / {limits.maxBucketPhotos}
        </div>
        <div>
          Size: <b>{formatBytes(bucket.totalBytes)}</b> / {formatBytes(limits.maxBucketBytes)}
        </div>
      </div>
      <div className="bucket__bar">
        <div
          className="bucket__barFill"
          style={{
            width: `${Math.min(100, (bucket.totalBytes / limits.maxBucketBytes) * 100)}%`
          }}
        />
      </div>
      {isFull ? <div className="bucket__badge">FULL</div> : null}
    </div>
  );
}

function ImageCard({ img, onDragStart, onDragEnd }) {
  const src = `/api/image?name=${encodeURIComponent(img.name)}`;
  return (
    <div className="imageCard" draggable onDragStart={() => onDragStart(img)} onDragEnd={onDragEnd}>
      <img className="imageCard__img" src={src} alt={img.name} loading="lazy" />
      <div className="imageCard__caption" title={img.name}>
        {img.name}
      </div>
      <div className="imageCard__sub">{formatBytes(img.sizeBytes)}</div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [draggedImage, setDraggedImage] = useState(null);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const st = await apiGetState();
      setState(st);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const totals = useMemo(() => {
    if (!state) return { remaining: 0, bucketCount: 0 };
    return { remaining: state.images.length, bucketCount: state.buckets.length };
  }, [state]);

  async function createBucket() {
    try {
      await apiCreateBucket();
      await refresh();
    } catch (e) {
      alert(String(e?.message ?? e));
    }
  }

  async function dropToBucket(bucketName) {
    if (!draggedImage) return;
    const bucket = state?.buckets?.find((b) => b.name === bucketName);
    if (!bucket) return;

    const nextCount = bucket.photoCount + 1;
    const nextBytes = bucket.totalBytes + draggedImage.sizeBytes;
    if (nextCount > state.limits.maxBucketPhotos || nextBytes > state.limits.maxBucketBytes) {
      alert('That move would exceed the bucket caps.');
      return;
    }

    try {
      await apiMoveImage({ imageName: draggedImage.name, bucketName });
      setDraggedImage(null);
      await refresh();
    } catch (e) {
      alert(String(e?.message ?? e));
      setDraggedImage(null);
      await refresh();
    }
  }

  return (
    <div className="app">
      <header className="bucketBar">
        <div className="bucketBar__row">
          <div className="bucketBar__left">
            <div className="title">image-sort</div>
            {state ? (
              <div className="subtitle">
                Remaining: <b>{totals.remaining}</b> images · Buckets: <b>{totals.bucketCount}</b>
              </div>
            ) : null}
          </div>
          <div className="bucketBar__right">
            <button className="btn" onClick={createBucket} disabled={!state || loading}>
              + New bucket
            </button>
            <button className="btn btn--ghost" onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        </div>

        {!collapsed && state ? (
          <div className="bucketBar__buckets">
            {state.buckets.length === 0 ? (
              <div className="hint">No buckets yet. Click “New bucket”.</div>
            ) : null}
            {state.buckets.map((b) => (
              <BucketCard
                key={b.name}
                bucket={b}
                limits={state.limits}
                draggedImage={draggedImage}
                onDropToBucket={dropToBucket}
              />
            ))}
          </div>
        ) : null}
      </header>

      <main className="main">
        {error ? (
          <div className="error">
            <b>Error:</b> {error}
            <div className="error__hint">
              Make sure the server is running and that <code>IMAGE_ROOT</code> is set.
            </div>
            <button className="btn" onClick={refresh}>
              Retry
            </button>
          </div>
        ) : null}

        {loading && !state ? <div className="hint">Loading…</div> : null}

        {state ? (
          <div className="grid">
            {state.images.map((img) => (
              <ImageCard
                key={img.name}
                img={img}
                onDragStart={(im) => setDraggedImage(im)}
                onDragEnd={() => setDraggedImage(null)}
              />
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
