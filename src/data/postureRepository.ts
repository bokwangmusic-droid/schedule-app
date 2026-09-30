import type { SQLiteDatabase } from 'expo-sqlite';

export type PostureAssessment = {
  id: string;
  memberId: string;
  assessedDate: string;
  frontPhotoUri: string | null;
  sidePhotoUri: string | null;
  backPhotoUri: string | null;
  frontNotes: string | null;
  sideNotes: string | null;
  backNotes: string | null;
  coachFeedback: string | null;
};

type Row = {
  id: string; member_id: string; assessed_date: string;
  front_photo_uri: string | null; side_photo_uri: string | null; back_photo_uri: string | null;
  front_notes: string | null; side_notes: string | null; back_notes: string | null; coach_feedback: string | null;
};

function id() { return `posture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function map(r: Row): PostureAssessment {
  return { id:r.id, memberId:r.member_id, assessedDate:r.assessed_date, frontPhotoUri:r.front_photo_uri, sidePhotoUri:r.side_photo_uri, backPhotoUri:r.back_photo_uri, frontNotes:r.front_notes, sideNotes:r.side_notes, backNotes:r.back_notes, coachFeedback:r.coach_feedback };
}
export async function listPostureAssessments(db: SQLiteDatabase, memberId: string) {
  return (await db.getAllAsync<Row>('SELECT * FROM posture_assessments WHERE member_id = ? ORDER BY assessed_date DESC, created_at DESC', [memberId])).map(map);
}
export async function createPostureAssessment(db: SQLiteDatabase, memberId: string, assessedDate: string) {
  const now = new Date().toISOString(); const newId=id();
  await db.runAsync('INSERT INTO posture_assessments (id, member_id, assessed_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [newId, memberId, assessedDate, now, now]);
  return newId;
}
export async function updatePostureAssessment(db: SQLiteDatabase, assessmentId: string, patch: Partial<Pick<PostureAssessment,'frontPhotoUri'|'sidePhotoUri'|'backPhotoUri'|'frontNotes'|'sideNotes'|'backNotes'|'coachFeedback'>>) {
  const pairs: string[]=[]; const values: Array<string|null>=[];
  const keys: Array<[keyof typeof patch,string]>=[['frontPhotoUri','front_photo_uri'],['sidePhotoUri','side_photo_uri'],['backPhotoUri','back_photo_uri'],['frontNotes','front_notes'],['sideNotes','side_notes'],['backNotes','back_notes'],['coachFeedback','coach_feedback']];
  for(const [key,col] of keys){ if(patch[key] !== undefined){pairs.push(`${col} = ?`);values.push(patch[key] ?? null);} }
  if(!pairs.length)return; pairs.push('updated_at = ?');values.push(new Date().toISOString());values.push(assessmentId);
  await db.runAsync(`UPDATE posture_assessments SET ${pairs.join(', ')} WHERE id = ?`, values);
}
