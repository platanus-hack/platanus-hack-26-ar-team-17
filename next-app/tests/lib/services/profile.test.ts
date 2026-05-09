jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import {
  getProfileByUserId,
  createProfile,
  updateProfileFromKycResult,
  ProfileInput,
} from '@/lib/services/profile.service';
const { supabase } = require('@/lib/db/supabase');

beforeEach(() => jest.clearAllMocks());

describe('getProfileByUserId', () => {
  it('queries users by auth_user_id and maps the row to a Profile', async () => {
    let capturedColumn: string | null = null;
    let capturedValue: string | null = null;
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: (col: string, val: string) => {
          capturedColumn = col;
          capturedValue = val;
          return {
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'row1',
                email: 'a@b.com',
                auth_user_id: 'u1',
                google_sub: 'gs',
                full_name: 'Ada',
                picture_url: null,
                dni: '12345678',
                didit_session_id: 'sess1',
                kyc_status: 'VERIFIED',
              },
              error: null,
            }),
          };
        },
      }),
    });
    const profile = await getProfileByUserId('u1');
    expect(capturedColumn).toBe('auth_user_id');
    expect(capturedValue).toBe('u1');
    expect(profile?.user_id).toBe('u1');
    expect(profile?.didit_kyc_session_id).toBe('sess1');
    expect(profile?.verification_status).toBe('APPROVED');
  });

  it('returns null when no row exists', async () => {
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    });
    expect(await getProfileByUserId('missing')).toBeNull();
  });
});

describe('createProfile', () => {
  const input: ProfileInput = {
    user_id: 'u1',
    email: 'a@b.com',
    google_sub: 'gsub',
    full_name: null,
    picture_url: null,
    dni: null,
    didit_kyc_session_id: 'sess_1',
  };

  it('inserts mapped columns and returns a profile with PENDING status', async () => {
    let captured: Record<string, unknown> | null = null;
    supabase.from.mockReturnValueOnce({
      insert: (payload: Record<string, unknown>) => {
        captured = payload;
        return {
          select: () => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'row1',
                email: 'a@b.com',
                auth_user_id: 'u1',
                google_sub: 'gsub',
                full_name: null,
                picture_url: null,
                dni: null,
                didit_session_id: 'sess_1',
                kyc_status: 'PENDING',
              },
              error: null,
            }),
          }),
        };
      },
    });
    const profile = await createProfile(input);
    expect(captured!.auth_user_id).toBe('u1');
    expect(captured!.didit_session_id).toBe('sess_1');
    expect(captured!.kyc_status).toBe('PENDING');
    expect(profile.verification_status).toBe('PENDING');
  });

  it('throws on supabase error', async () => {
    supabase.from.mockReturnValueOnce({
      insert: () => ({
        select: () => ({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
        }),
      }),
    });
    await expect(createProfile(input)).rejects.toThrow('boom');
  });
});

describe('updateProfileFromKycResult', () => {
  it('writes kyc_status=VERIFIED and kyc_verified_at when APPROVED', async () => {
    let captured: Record<string, unknown> | null = null;
    let capturedColumn: string | null = null;
    supabase.from.mockReturnValueOnce({
      update: (payload: Record<string, unknown>) => {
        captured = payload;
        return {
          eq: (col: string) => {
            capturedColumn = col;
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    });
    await updateProfileFromKycResult('u1', { dni: '12345678', full_name: 'Ada', verification_status: 'APPROVED' });
    expect(capturedColumn).toBe('auth_user_id');
    expect(captured!.kyc_status).toBe('VERIFIED');
    expect(captured!.dni).toBe('12345678');
    expect(captured!.full_name).toBe('Ada');
    expect(captured!.kyc_verified_at).toBeDefined();
  });

  it('writes kyc_status=REJECTED without kyc_verified_at when REJECTED', async () => {
    let captured: Record<string, unknown> | null = null;
    supabase.from.mockReturnValueOnce({
      update: (payload: Record<string, unknown>) => {
        captured = payload;
        return { eq: jest.fn().mockResolvedValue({ data: null, error: null }) };
      },
    });
    await updateProfileFromKycResult('u1', { dni: '', full_name: null, verification_status: 'REJECTED' });
    expect(captured!.kyc_status).toBe('REJECTED');
    expect(captured!.kyc_verified_at).toBeUndefined();
  });
});
