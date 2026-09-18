import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';

import { getSupabase } from '@/lib/supabase';
import { routeImageExtension, routeImageMime, type RouteImageMime } from '@/lib/route-image-validation';

const PROFILE_IMAGES_BUCKET = 'profile-images';
const PENDING_PROFILE_IMAGE_KEY = 'trekking.pending-profile-image.v1';
const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type ProfileImageSelection = {
  uri: string;
  contentType: RouteImageMime;
  extension: string;
  fileSize?: number;
};

function assertProfileImageSize(bytes: number | null | undefined) {
  if (bytes !== null && bytes !== undefined && (!Number.isFinite(bytes) || bytes <= 0)) {
    throw new Error('La foto seleccionada está vacía o no se puede leer.');
  }
  if (bytes !== null && bytes !== undefined && bytes > PROFILE_IMAGE_MAX_BYTES) {
    throw new Error('La foto de perfil debe pesar como máximo 2 MB.');
  }
}

export async function pickProfileImage(): Promise<ProfileImageSelection | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Necesitamos permiso para seleccionar tu foto de perfil.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: process.env.EXPO_OS === 'web',
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const contentType = routeImageMime(asset.mimeType, asset.fileName);
  assertProfileImageSize(asset.fileSize);
  let uri = asset.uri;
  if (process.env.EXPO_OS === 'web') {
    if (!asset.base64) throw new Error('No se pudo conservar la foto seleccionada.');
    uri = `data:${contentType};base64,${asset.base64}`;
  } else {
    const file = new File(Paths.document, `trekking-profile-${Crypto.randomUUID()}.${routeImageExtension(contentType)}`);
    await new File(uri).copy(file);
    uri = file.uri;
  }

  return { uri, contentType, extension: routeImageExtension(contentType), fileSize: asset.fileSize };
}

export function savePendingProfileImage(image: ProfileImageSelection) {
  return AsyncStorage.setItem(PENDING_PROFILE_IMAGE_KEY, JSON.stringify(image));
}

export function clearPendingProfileImage() {
  return AsyncStorage.removeItem(PENDING_PROFILE_IMAGE_KEY);
}

async function takePendingProfileImage() {
  const stored = await AsyncStorage.getItem(PENDING_PROFILE_IMAGE_KEY);
  if (!stored) return null;
  await AsyncStorage.removeItem(PENDING_PROFILE_IMAGE_KEY);
  return JSON.parse(stored) as ProfileImageSelection;
}

export async function uploadPendingProfileImage(userId: string) {
  const image = await takePendingProfileImage();
  if (!image) return false;
  try {
    await uploadProfileImage(userId, image);
    return true;
  } catch (error) {
    await savePendingProfileImage(image);
    throw error;
  }
}

export async function uploadProfileImage(userId: string, image: ProfileImageSelection) {
  const contentType = routeImageMime(image.contentType);
  assertProfileImageSize(image.fileSize);
  const contents = process.env.EXPO_OS === 'web'
    ? await (await fetch(image.uri)).arrayBuffer()
    : await new File(image.uri).arrayBuffer();
  assertProfileImageSize(contents.byteLength);

  const supabase = getSupabase();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error('No se encontró el perfil asociado a la cuenta.');

  const path = `${userId}/${Crypto.randomUUID()}.${routeImageExtension(contentType)}`;
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .upload(path, contents, { contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  if (updateError || !updated) {
    await supabase.storage.from(PROFILE_IMAGES_BUCKET).remove([path]);
    if (updateError) throw updateError;
    throw new Error('No se pudo asociar la foto con tu perfil.');
  }

  if (profile.avatar_path && profile.avatar_path !== path) {
    await supabase.storage.from(PROFILE_IMAGES_BUCKET).remove([profile.avatar_path]);
  }
  return path;
}
