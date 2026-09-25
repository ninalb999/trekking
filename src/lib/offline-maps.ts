import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Directory, DownloadTask, File, Paths, type DownloadPauseState } from 'expo-file-system';

export type OfflineRegionStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'paused'
  | 'installed'
  | 'error'
  | 'update_available';

export type OfflineRegion = {
  id: string;
  name: string;
  bounds: [[number, number], [number, number]];
  minZoom: number;
  maxZoom: number;
  filePath: string | null;
  size: number;
  version: string;
  status: OfflineRegionStatus;
  downloadedAt: number | null;
  downloadUrl?: string;
  error?: string;
  progress?: number;
  resumeState?: DownloadPauseState;
};

export type OfflineTile = {
  dataUri: string;
  mimeType: string;
};

const REGION_KEY = 'trekking:offline-region:v1:';
const MAPS_DIRECTORY = 'offline-maps';
const readers = new Map<string, MbtilesReader>();
const downloadTasks = new Map<string, DownloadTask>();

function regionKey(id: string) { return REGION_KEY + id; }
function safeId(id: string) { return id.replace(/[^a-zA-Z0-9_-]/g, '_'); }
function mapsDirectory() { return new Directory(Paths.document, MAPS_DIRECTORY); }

async function persistRegion(region: OfflineRegion) {
  await AsyncStorage.setItem(regionKey(region.id), JSON.stringify(region));
}

export async function getOfflineRegion(id: string) {
  const value = await AsyncStorage.getItem(regionKey(id));
  return value ? JSON.parse(value) as OfflineRegion : null;
}

export async function getInstalledRegions(): Promise<OfflineRegion[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(REGION_KEY));
  const rows = await AsyncStorage.multiGet(keys);
  return rows.flatMap(([, value]) => value ? [JSON.parse(value) as OfflineRegion] : [])
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function isRegionInstalled(regionId: string) {
  const region = await getOfflineRegion(regionId);
  return Boolean(region?.status === 'installed' && region.filePath && new File(region.filePath).exists);
}

export function getStorageUsage() {
  const directory = mapsDirectory();
  return directory.exists ? directory.size ?? 0 : 0;
}

export function getMapFile(regionId: string) {
  return new File(mapsDirectory(), `${safeId(regionId)}.mbtiles`);
}

export async function verifyRegion(regionId: string) {
  const region = await getOfflineRegion(regionId);
  if (!region?.filePath) return false;
  try {
    await validateMbtiles(new File(region.filePath));
    const verified = { ...region, status: 'installed' as const, size: new File(region.filePath).size, error: undefined };
    await persistRegion(verified);
    return true;
  } catch (cause) {
    await persistRegion({ ...region, status: 'error', error: cause instanceof Error ? cause.message : 'MBTiles inválido.' });
    return false;
  }
}

export async function downloadRegion(
  region: OfflineRegion,
  onProgress?: (progress: number) => void,
) {
  if (Platform.OS === 'web') throw new Error('La descarga de mapas offline está disponible en Android y iOS.');
  if (!region.downloadUrl) throw new Error('Esta región no tiene un paquete MBTiles configurado.');
  const directory = mapsDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const destination = getMapFile(region.id);
  const temporary = new File(directory, `${safeId(region.id)}.mbtiles.part`);
  if (destination.exists) {
    const installed = { ...region, filePath: destination.uri, size: destination.size, status: 'installed' as const, downloadedAt: Date.now(), progress: 1, error: undefined };
    await persistRegion(installed);
    return installed;
  }
  const stored = await getOfflineRegion(region.id);
  if (stored?.status !== 'paused' && temporary.exists) temporary.delete();
  let lastProgressWrite = 0;
  const onDownloadProgress = ({ bytesWritten, totalBytes }: { bytesWritten: number; totalBytes: number }) => {
    const progress = totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : 0;
    onProgress?.(progress);
    if (Date.now() - lastProgressWrite > 800) {
      lastProgressWrite = Date.now();
      void persistRegion({ ...region, filePath: temporary.uri, status: 'downloading', progress, size: bytesWritten });
    }
  };
  const actualTask = stored?.status === 'paused' && stored.resumeState
    ? DownloadTask.fromSavable(stored.resumeState, {
      sessionType: 'background',
      onProgress: onDownloadProgress,
    })
    : File.createDownloadTask(region.downloadUrl, temporary, {
    sessionType: 'background',
    onProgress: onDownloadProgress,
  });
  downloadTasks.set(region.id, actualTask);
  await persistRegion({ ...region, filePath: temporary.uri, status: 'downloading', progress: 0, error: undefined });
  try {
    const downloaded = await actualTask.downloadAsync();
    if (!downloaded) {
      const paused = await getOfflineRegion(region.id);
      if (paused?.status === 'paused') return paused;
      throw new Error('La descarga quedó pausada antes de completarse.');
    }
    await validateMbtiles(downloaded);
    if (destination.exists) destination.delete();
    await downloaded.move(destination);
    const installed = { ...region, filePath: destination.uri, size: destination.size, status: 'installed' as const, downloadedAt: Date.now(), progress: 1, error: undefined };
    await persistRegion(installed);
    return installed;
  } catch (cause) {
    if (temporary.exists) temporary.delete();
    const failed = { ...region, filePath: null, status: 'error' as const, progress: 0, error: cause instanceof Error ? cause.message : 'No se pudo descargar el mapa.' };
    await persistRegion(failed);
    throw cause;
  } finally {
    downloadTasks.delete(region.id);
    actualTask.release();
  }
}

export async function pauseDownload(regionId: string) {
  const task = downloadTasks.get(regionId);
  if (!task) throw new Error('No hay una descarga activa para pausar.');
  await task.pauseAsync();
  const region = await getOfflineRegion(regionId);
  if (region) await persistRegion({ ...region, status: 'paused', resumeState: task.savable() });
}

export async function resumeDownload(regionId: string, onProgress?: (progress: number) => void) {
  const region = await getOfflineRegion(regionId);
  if (!region?.resumeState || !region.downloadUrl) throw new Error('No existe una descarga pausada recuperable.');
  return downloadRegion(region, onProgress);
}

export async function getDownloadProgress(regionId: string) {
  const region = await getOfflineRegion(regionId);
  return region?.progress ?? 0;
}

export async function deleteRegion(regionId: string) {
  const region = await getOfflineRegion(regionId);
  readers.get(regionId)?.close();
  readers.delete(regionId);
  const file = region?.filePath ? new File(region.filePath) : getMapFile(regionId);
  if (file.exists) file.delete();
  if (region) await persistRegion({ ...region, filePath: null, size: 0, status: 'not_downloaded', downloadedAt: null, progress: 0, error: undefined });
}

export async function getTile(regionId: string, z: number, x: number, y: number): Promise<OfflineTile | null> {
  const region = await getOfflineRegion(regionId);
  if (!region || region.status !== 'installed' || !region.filePath) return null;
  let reader = readers.get(regionId);
  if (!reader) {
    reader = new MbtilesReader(new File(region.filePath));
    readers.set(regionId, reader);
  }
  return reader.getTile(z, x, y);
}

async function validateMbtiles(file: File) {
  if (!file.exists || file.size < 100) throw new Error('El paquete MBTiles está vacío o incompleto.');
  if (Platform.OS === 'web') return;
  const db = await SQLite.openDatabaseAsync(file.name, {}, file.parentDirectory.uri);
  try {
    const row = await db.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name='tiles'");
    if (!row?.count) throw new Error('El paquete no contiene la tabla MBTiles tiles.');
    const tile = await db.getFirstAsync<{ tile_data: Uint8Array }>('SELECT tile_data FROM tiles LIMIT 1');
    if (!tile?.tile_data?.length) throw new Error('El paquete MBTiles no contiene tiles.');
  } finally {
    await db.closeAsync();
  }
}

class MbtilesReader {
  private dbPromise: Promise<SQLite.SQLiteDatabase>;
  private metadataPromise: Promise<Record<string, string>>;
  constructor(private readonly file: File) {
    this.dbPromise = SQLite.openDatabaseAsync(file.name, {}, file.parentDirectory.uri);
    this.metadataPromise = this.loadMetadata();
  }
  async getTile(z: number, x: number, y: number): Promise<OfflineTile | null> {
    if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || x < 0 || y < 0) return null;
    const [db, metadata] = await Promise.all([this.dbPromise, this.metadataPromise]);
    const scheme = metadata.scheme?.toLowerCase() ?? 'tms';
    const tileRow = scheme === 'xyz' ? y : (2 ** z) - 1 - y;
    const row = await db.getFirstAsync<{ tile_data: Uint8Array }>(
      'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1',
      z, x, tileRow,
    );
    if (!row?.tile_data?.length) return null;
    const format = (metadata.format ?? 'png').toLowerCase();
    const mimeType = format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    return { mimeType, dataUri: `data:${mimeType};base64,${toBase64(row.tile_data)}` };
  }
  close() { void this.dbPromise.then(db => db.closeAsync()).catch(() => {}); }
  private async loadMetadata() {
    const db = await this.dbPromise;
    const rows = await db.getAllAsync<{ name: string; value: string }>('SELECT name, value FROM metadata');
    return Object.fromEntries(rows.map(row => [row.name, row.value]));
  }
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return globalThis.btoa(binary);
}
