export async function apiGetState() {
  const res = await fetch('/api/state');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load state');
  return data;
}

export async function apiCreateBucket() {
  const res = await fetch('/api/buckets', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to create bucket');
  return data;
}

export async function apiMoveImage({ imageName, bucketName }) {
  const res = await fetch('/api/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageName, bucketName })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Move failed');
  return data;
}
