import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseConfig';

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string; msg?: string; error?: string };
    return body.message || body.msg || body.error || '증빙서류 업로드에 실패했어요.';
  } catch {
    return '증빙서류 업로드에 실패했어요.';
  }
}

export async function uploadTrainerVerificationDocument(
  accessToken: string,
  trainerId: string,
  uri: string,
  originalName = 'verification.jpg',
) {
  const localResponse = await fetch(uri);
  const blob = await localResponse.blob();
  const extensionMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
  const extension = extensionMatch?.[1]?.toLowerCase() || (blob.type.includes('png') ? 'png' : 'jpg');
  const path = trainerId + '/verification-' + Date.now() + '.' + extension;

  const response = await fetch(
    SUPABASE_URL + '/storage/v1/object/trainer-verification/' + path,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': blob.type || 'image/jpeg',
        'x-upsert': 'false',
      },
      body: blob,
    },
  );

  if (!response.ok) throw new Error(await readError(response));

  return {
    path,
    name: originalName || '증빙서류',
  };
}
