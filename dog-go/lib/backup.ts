/**
 * Backup / restore everything (dogs, walks, trinkets, settings, walk photos) as one JSON file.
 * Android: written to the cache dir and handed to the share sheet (save to Drive, Files, email…).
 * Browser: downloaded.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { AppData, Settings } from './types';
import { loadPhotos, savePhoto } from './storage';

export interface BackupFile {
  app: 'dog-go';
  version: 2;
  exportedAt: string;
  data: AppData;
  settings: Settings;
  photos: Record<string, string>;
}

export async function exportBackup(data: AppData, settings: Settings): Promise<{ native: boolean; name: string }> {
  const ids = data.walks.flatMap((w) => (w.photos ?? []).map((p) => p.id));
  const photos = await loadPhotos(ids);
  const file: BackupFile = { app: 'dog-go', version: 2, exportedAt: new Date().toISOString(), data, settings, photos };
  const json = JSON.stringify(file);
  const name = `dog-go-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Dog-go backup', text: 'Keep this file somewhere safe (Drive, Files…).', files: [res.uri] });
    return { native: true, name };
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { native: false, name };
}

export async function readBackup(file: File): Promise<BackupFile> {
  const parsed = JSON.parse(await file.text()) as Partial<BackupFile>;
  if (parsed.app !== 'dog-go' || !parsed.data || !Array.isArray(parsed.data.dogs)) {
    throw new Error('BAD_FILE');
  }
  return parsed as BackupFile;
}

export async function restorePhotos(photos: Record<string, string>) {
  for (const [id, url] of Object.entries(photos ?? {})) await savePhoto(id, url);
}
