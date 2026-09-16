export type MemberItem = {
  id: string;
  name: string;
  phone: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMemberInput = {
  name: string;
  phone?: string | null;
  memo?: string | null;
};
