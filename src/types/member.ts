export type MemberItem = {
  id: string;
  name: string;
  phone: string | null;
  membershipStartDate: string | null;
  membershipEndDate: string | null;
  ptTotalSessions: number | null;
  ptRemainingSessions: number | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMemberInput = {
  name: string;
  phone?: string | null;
  membershipStartDate?: string | null;
  membershipEndDate?: string | null;
  ptTotalSessions?: number | null;
  ptRemainingSessions?: number | null;
  memo?: string | null;
};
