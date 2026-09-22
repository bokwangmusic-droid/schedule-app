export type AppRole = 'trainer' | 'member';

export type TrainerSession = {
  role: 'trainer';
  trainerId: string;
};

export type MemberSession = {
  role: 'member';
  memberId: string;
};

export type AppSession = TrainerSession | MemberSession;

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  trainer: '강사',
  member: '회원',
};

export function memberHomeRoute(memberId: string) {
  return {
    pathname: '/member-view/[id]' as const,
    params: { id: memberId },
  };
}

export function roleHomeRoute(session: AppSession) {
  if (session.role === 'member') {
    return memberHomeRoute(session.memberId);
  }

  return { pathname: '/' as const };
}
