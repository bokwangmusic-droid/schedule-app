export type ScheduleItem = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  memo: string | null;
  color: string | null;
  memberId: string | null;
  memberName: string | null;
  memberPtTotalSessions: number | null;
  memberPtRemainingSessions: number | null;
  isAllDay: boolean;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateScheduleInput = {
  title: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  color?: string | null;
  memberId?: string | null;
  isAllDay?: boolean;
};

export type UpdateScheduleInput = CreateScheduleInput;
