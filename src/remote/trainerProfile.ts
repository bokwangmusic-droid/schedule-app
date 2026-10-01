import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseHeaders } from './supabaseConfig';

export type TrainerProfile = {
  auth_user_id: string;
  name: string;
  bio: string | null;
  specialties: string | null;
  certifications: string | null;
  career: string | null;
  education: string | null;
  awards: string | null;
  instagram: string | null;
  profile_photo_url: string | null;
  updated_at: string | null;
};

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string; msg?: string; error?: string };
    return body.message || body.msg || body.error || '프로필 요청에 실패했어요.';
  } catch {
    return '프로필 요청에 실패했어요.';
  }
}

export async function fetchTrainerProfile(accessToken: string, trainerId: string) {
  const response = await fetch(
    SUPABASE_URL +
      '/rest/v1/trainers?auth_user_id=eq.' +
      encodeURIComponent(trainerId) +
      '&select=auth_user_id,name,bio,specialties,certifications,career,education,awards,instagram,profile_photo_url,updated_at&limit=1',
    { headers: supabaseHeaders(accessToken) },
  );
  if (!response.ok) throw new Error(await readError(response));
  const rows = (await response.json()) as TrainerProfile[];
  return rows[0] ?? null;
}

export async function saveTrainerProfile(
  accessToken: string,
  trainerId: string,
  input: Omit<TrainerProfile, 'auth_user_id' | 'updated_at'>,
) {
  const response = await fetch(
    SUPABASE_URL + '/rest/v1/trainers?auth_user_id=eq.' + encodeURIComponent(trainerId),
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(accessToken), Prefer: 'return=representation' },
      body: JSON.stringify({ ...input, updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  const rows = (await response.json()) as TrainerProfile[];
  if (!rows[0]) throw new Error('강사 프로필을 저장하지 못했어요.');
  return rows[0];
}

export async function uploadTrainerProfilePhoto(
  accessToken: string,
  trainerId: string,
  uri: string,
) {
  const localResponse = await fetch(uri);
  const blob = await localResponse.blob();
  const path = trainerId + '/avatar.jpg';
  const response = await fetch(
    SUPABASE_URL + '/storage/v1/object/trainer-profiles/' + path,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': blob.type || 'image/jpeg',
        'x-upsert': 'true',
      },
      body: blob,
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  return (
    SUPABASE_URL +
    '/storage/v1/object/public/trainer-profiles/' +
    path +
    '?v=' +
    Date.now()
  );
}
