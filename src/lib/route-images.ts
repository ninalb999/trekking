import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';

import { getSupabase } from '@/lib/supabase';

const ROUTE_IMAGES_BUCKET = 'route-images';

export type RouteImageSelection = {
  uri: string;
  contentType: string;
  extension: string;
};

function extensionFor(asset: ImagePicker.ImagePickerAsset) {
  const fromName = asset.fileName?.split('.').at(-1)?.toLowerCase();
  const fromMime = asset.mimeType?.split('/').at(-1)?.toLowerCase();
  const extension = fromName || fromMime || 'jpg';
  return extension === 'jpeg' ? 'jpg' : extension.replace(/[^a-z0-9]/g, '') || 'jpg';
}

export async function pickRouteImage(): Promise<RouteImageSelection | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Necesitamos permiso para seleccionar una fotografía.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.85,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const extension = extensionFor(asset);
  return {
    uri: asset.uri,
    extension,
    contentType: asset.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
  };
}

export async function uploadRouteMainImage(routeId: string, image: RouteImageSelection) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(routeId)) {
    throw new Error('La ruta debe estar guardada antes de subir su fotografía.');
  }

  const response = await fetch(image.uri);
  if (!response.ok) throw new Error('No se pudo leer la fotografía seleccionada.');
  const path = `${routeId}/${Crypto.randomUUID()}.${image.extension}`;
  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage
    .from(ROUTE_IMAGES_BUCKET)
    .upload(path, await response.arrayBuffer(), { contentType: image.contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase.from('routes').update({ main_image_path: path }).eq('id', routeId);
  if (updateError) {
    await supabase.storage.from(ROUTE_IMAGES_BUCKET).remove([path]);
    throw updateError;
  }
  return path;
}
