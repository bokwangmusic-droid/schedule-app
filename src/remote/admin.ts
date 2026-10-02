import { SUPABASE_URL, supabaseHeaders } from './supabaseConfig';

export type AdminTrainerApplication = {
  auth_user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gym_name: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  verification_document_path: string | null;
  verification_document_name: string | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_rejection_reason: string | null;
};

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string; msg?: string; error?: string };
    return body.message || body.msg || body.error || '관리자 요청에 실패했어요.';
  } catch {
    return '관리자 요청에 실패했어요.';
  }
}

export async function isCurrentUserAdmin(accessToken: string) {
  const response = await fetch(
    SUPABASE_URL + '/rest/v1/app_admins?select=auth_user_id&limit=1',
    { headers: supabaseHeaders(accessToken) },
  );
  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ auth_user_id: string }>;
  return rows.length > 0;
}

export async function listTrainerApplications(accessToken: string) {
  const response = await fetch(
    SUPABASE_URL +
      '/rest/v1/trainers?select=auth_user_id,name,email,phone,gym_name,verification_status,verification_document_path,verification_document_name,verification_submitted_at,verification_reviewed_at,verification_rejection_reason&verification_status=neq.approved&order=verification_submitted_at.desc.nullslast',
    { headers: supabaseHeaders(accessToken) },
  );
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AdminTrainerApplication[];
}

export async function createVerificationDocumentUrl(
  accessToken: string,
  path: string,
) {
  const response = await fetch(
    SUPABASE_URL +
      '/storage/v1/object/sign/trainer-verification/' +
      path.split('/').map(encodeURIComponent).join('/'),
    {
      method: 'POST',
      headers: supabaseHeaders(accessToken),
      body: JSON.stringify({ expiresIn: 300 }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signed = body.signedURL ?? body.signedUrl;
  if (!signed) throw new Error('증빙서류 보기 주소를 만들지 못했어요.');
  if (signed.startsWith('http')) return signed;
  return SUPABASE_URL + '/storage/v1' + signed;
}

export async function reviewTrainerApplication(
  accessToken: string,
  trainerId: string,
  decision: 'approved' | 'rejected',
  rejectionReason: string | null,
) {
  const response = await fetch(
    SUPABASE_URL + '/rest/v1/trainers?auth_user_id=eq.' + encodeURIComponent(trainerId),
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(accessToken),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        verification_status: decision,
        verification_reviewed_at: new Date().toISOString(),
        verification_rejection_reason:
          decision === 'rejected' ? rejectionReason?.trim() || '관리자 검토 후 반려됐어요.' : null,
      }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
}
