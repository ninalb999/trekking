import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';

import { getSupabase } from '@/lib/supabase';
import {
  assertRouteImageSize,
  isUuid,
  routeImageExtension,
  routeImageMime,
  type RouteImageMime,
} from '@/lib/route-image-validation';

const ROUTE_IMAGES_BUCKET = 'route-images';

export type RouteImageSelection = {
  uri: string;
  contentType: RouteImageMime;
  extension: string;
  fileSize?: number;
};

export async function pickRouteImage(): Promise<RouteImageSelection | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Necesitamos permiso para seleccionar una fotografía.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.85,
    base64: process.env.EXPO_OS === 'web',
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const contentType = routeImageMime(asset.mimeType, asset.fileName);
  assertRouteImageSize(asset.fileSize);
  let uri = asset.uri;
  if (process.env.EXPO_OS === 'web') {
    if (!asset.base64) throw new Error('No se pudo conservar la fotografia.');
    uri = `data:${contentType};base64,${asset.base64}`;
  } else {
    const file = new File(Paths.document, `trekking-${Crypto.randomUUID()}.${routeImageExtension(contentType)}`);
    await new File(uri).copy(file);
    uri = file.uri;
  }
  return {
    uri,
    extension: routeImageExtension(contentType),
    contentType,
    fileSize: asset.fileSize,
  };
}

export async function uploadRouteMainImage(routeId: string, image: RouteImageSelection) {
  if (!isUuid(routeId)) {
    throw new Error('La ruta debe estar guardada antes de subir su fotografía.');
  }
  const contentType = routeImageMime(image.contentType);
  assertRouteImageSize(image.fileSize);

  const supabase = getSupabase();
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .select('main_image_path')
    .eq('id', routeId)
    .maybeSingle();
  if (routeError) throw routeError;
  if (!route) throw new Error('No se encontró una ruta propia para asociar la fotografía.');

  const contents = process.env.EXPO_OS === 'web'
    ? await (await fetch(image.uri)).arrayBuffer()
    : await new File(image.uri).arrayBuffer();
  assertRouteImageSize(contents.byteLength);
  const path = `${routeId}/${Crypto.randomUUID()}.${routeImageExtension(contentType)}`;
  const { error: uploadError } = await supabase.storage
    .from(ROUTE_IMAGES_BUCKET)
    .upload(path, contents, { contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { data: updatedRoute, error: updateError } = await supabase
    .from('routes')
    .update({ main_image_path: path })
    .eq('id', routeId)
    .select('id')
    .maybeSingle();
  if (updateError || !updatedRoute) {
    const { error: rollbackError } = await supabase.storage.from(ROUTE_IMAGES_BUCKET).remove([path]);
    if (rollbackError) throw new Error('No se pudo asociar ni retirar la fotografía subida.');
    if (updateError) throw updateError;
    throw new Error('La ruta dejó de estar disponible antes de asociar la fotografía.');
  }

  let replacementCleanupFailed = false;
  if (route.main_image_path && route.main_image_path !== path) {
    const { error } = await supabase.storage.from(ROUTE_IMAGES_BUCKET).remove([route.main_image_path]);
    replacementCleanupFailed = Boolean(error);
  }
  return { path, replacementCleanupFailed };
}
