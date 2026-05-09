import { supabase } from '../db/supabase';

// The live `users` table uses different column names than this service exposes.
// We keep a stable internal API and map at the boundary:
//   public verification_status  <-> db kyc_status (APPROVED <-> VERIFIED)
//   public didit_kyc_session_id <-> db didit_session_id
//   public user_id (Supabase auth user id) <-> db auth_user_id

export interface ProfileInput {
  user_id: string;
  email: string;
  google_sub: string | null;
  full_name: string | null;
  picture_url: string | null;
  dni: string | null;
  didit_kyc_session_id: string;
  verification_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface Profile extends ProfileInput {
  id: string;
  enrolled_at?: string;
  updated_at?: string;
}

type UsersRow = {
  id: string;
  email: string;
  auth_user_id: string | null;
  google_sub: string | null;
  full_name: string | null;
  picture_url: string | null;
  dni: string | null;
  didit_session_id: string | null;
  kyc_status: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';
  created_at?: string;
  kyc_verified_at?: string | null;
};

function statusToDb(s: 'PENDING' | 'APPROVED' | 'REJECTED'): 'PENDING' | 'VERIFIED' | 'REJECTED' {
  return s === 'APPROVED' ? 'VERIFIED' : s;
}

function statusFromDb(s: UsersRow['kyc_status']): 'PENDING' | 'APPROVED' | 'REJECTED' {
  if (s === 'VERIFIED') return 'APPROVED';
  if (s === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

function rowToProfile(row: UsersRow): Profile {
  return {
    id: row.id,
    user_id: row.auth_user_id ?? '',
    email: row.email,
    google_sub: row.google_sub,
    full_name: row.full_name,
    picture_url: row.picture_url,
    dni: row.dni,
    didit_kyc_session_id: row.didit_session_id ?? '',
    verification_status: statusFromDb(row.kyc_status),
    enrolled_at: row.created_at,
  };
}

export async function getProfileByUserId(authUserId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();
  return data ? rowToProfile(data as UsersRow) : null;
}

export async function createProfile(input: ProfileInput): Promise<Profile> {
  const dbStatus = statusToDb(input.verification_status ?? 'PENDING');
  const { data, error } = await supabase
    .from('users')
    .insert({
      auth_user_id: input.user_id,
      email: input.email,
      google_sub: input.google_sub,
      full_name: input.full_name,
      picture_url: input.picture_url,
      dni: input.dni,
      didit_session_id: input.didit_kyc_session_id,
      kyc_status: dbStatus,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToProfile(data as UsersRow);
}

export async function updateProfileFromKycResult(
  authUserId: string,
  fields: { dni: string; full_name: string | null; verification_status: 'APPROVED' | 'REJECTED' },
): Promise<void> {
  const dbStatus = statusToDb(fields.verification_status);
  const update: Record<string, unknown> = {
    dni: fields.dni,
    full_name: fields.full_name,
    kyc_status: dbStatus,
  };
  if (fields.verification_status === 'APPROVED') {
    update.kyc_verified_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from('users')
    .update(update)
    .eq('auth_user_id', authUserId);
  if (error) throw new Error(error.message);
}
