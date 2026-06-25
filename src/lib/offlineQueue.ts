'use client';

// Tiny offline outbox for reports captured without connectivity.
export interface QueuedReport {
  location: string;
  notes: string;
  language: string;
  lat?: number;
  lng?: number;
  imageDataUrl: string;
  queuedAt: number;
}

const KEY = 'ch_offline_queue';

export function getQueue(): QueuedReport[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function setQueue(q: QueuedReport[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function enqueueReport(item: QueuedReport) {
  const q = getQueue();
  q.push(item);
  setQueue(q);
  window.dispatchEvent(new Event('ch-queue-changed'));
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
