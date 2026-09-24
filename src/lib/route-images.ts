import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { Alert, Platform } from 'react-native';

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

type ImageSource = 'camera' | 'library';

function chooseImageSource(): Promise<ImageSource | null> {
  if (Platform.OS === 'web') return Promise.resolve('library');
  return new Promise(resolve => {
    Alert.alert('Agregar fotografía', '¿Cómo quieres agregar la foto de la ruta?', [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
      { text: 'Tomar foto', onPress: () => resolve('camera') },
      { text: 'Elegir de galería', onPress: () => resolve('library') },
    ]);
  });
}

export async function pickRouteImage(): Promise<RouteImageSelection | null> {
  const source = await chooseImageSource();
  if (!source) return null;

  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(source === 'camera'
      ? 'Necesitamos permiso para usar la cámara y tomar la fotografía.'
      : 'Necesitamos permiso para seleccionar una fotografía.');
  }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    })
    : await ImagePicker.launchImageLibraryAsync({
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

export async function uploadRoutePointImage(routeId: string, image: RouteImageSelection) {
  if (!isUuid(routeId)) throw new Error('La ruta debe estar guardada antes de subir la fotografía del punto.');
  const contentType = routeImageMime(image.contentType);
  assertRouteImageSize(image.fileSize);
  const contents = process.env.EXPO_OS === 'web'
    ? await (await fetch(image.uri)).arrayBuffer()
    : await new File(image.uri).arrayBuffer();
  assertRouteImageSize(contents.byteLength);
  const path = `${routeId}/${Crypto.randomUUID()}.${routeImageExtension(contentType)}`;
  const { error } = await getSupabase().storage
    .from(ROUTE_IMAGES_BUCKET)
    .upload(path, contents, { contentType, upsert: false });
  if (error) throw error;
  return { path };
}

export async function getRouteImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase().storage
    .from(ROUTE_IMAGES_BUCKET)
    .createSignedUrl(path, 15 * 60);
  if (error) throw error;
  return data.signedUrl;
}
