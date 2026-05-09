import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

jest.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));
jest.mock('@/lib/services/token.service', () => ({
  issueUserToken: jest.fn().mockResolvedValue('mock.user.token'),
}));

const { supabase } = require('@/lib/db/supabase');

function makeReq(path: string, body: object) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/auth/register', () => {
  it('creates a user and returns a user_session token', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: null }) }) }),
    });
    supabase.from.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: 'user_1', email: 'a@b.com' }, error: null }) }) }),
    });

    const res = await register(makeReq('/api/auth/register', { email: 'a@b.com', password: 'password123' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.token).toBeDefined();
    expect(body.userId).toBe('user_1');
  });

  it('returns 409 if email already taken', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: 'u1' }, error: null }) }) }),
    });
    const res = await register(makeReq('/api/auth/register', { email: 'a@b.com', password: 'password123' }));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    const hashed = await bcrypt.hash('password123', 1);
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: 'u1', email: 'a@b.com', password: hashed }, error: null }) }) }),
    });

    const res = await login(makeReq('/api/auth/login', { email: 'a@b.com', password: 'password123' }));
    expect(res.status).toBe(200);
    expect((await res.json()).token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const hashed = await bcrypt.hash('correct', 1);
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: 'u1', password: hashed }, error: null }) }) }),
    });

    const res = await login(makeReq('/api/auth/login', { email: 'a@b.com', password: 'wrong' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/register — edge cases', () => {
  it('returns 400 when email is not a valid email address', async () => {
    const res = await register(makeReq('/api/auth/register', { email: 'not-an-email', password: 'password123' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  it('returns 400 when password is fewer than 8 characters', async () => {
    const res = await register(makeReq('/api/auth/register', { email: 'a@b.com', password: 'short' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when email field is missing', async () => {
    const res = await register(makeReq('/api/auth/register', { password: 'password123' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when body has no fields at all', async () => {
    const res = await register(makeReq('/api/auth/register', {}));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login — edge cases', () => {
  it('returns 401 for non-existent email (avoids 404 for user enumeration)', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    });

    const res = await login(makeReq('/api/auth/login', { email: 'noone@b.com', password: 'password123' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when email field is missing', async () => {
    const res = await login(makeReq('/api/auth/login', { password: 'password123' }));
    expect(res.status).toBe(400);
  });
});
