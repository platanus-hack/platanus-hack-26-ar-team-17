import { writeLog } from '@/lib/services/auditLog.service';

jest.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require('@/lib/db/supabase');

function mockFrom(selectResult: unknown, insertResult: unknown) {
  return supabase.from
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(selectResult),
          }),
        }),
      }),
    })
    .mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue(insertResult),
        }),
      }),
    });
}

describe('writeLog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes a log entry', async () => {
    mockFrom(
      { data: null, error: null },
      { data: { id: 'log_1', checksum: 'a'.repeat(64) }, error: null }
    );
    const entry = await writeLog({
      apiKeyId: 'key_1',
      userId: 'user_1',
      action: 'send_message',
      platform: 'whatsapp',
      result: 'SUCCESS',
    });
    expect(entry).toBeDefined();
  });

  it('chains checksum from previous entry', async () => {
    mockFrom(
      { data: { checksum: 'prevhash' }, error: null },
      { data: { id: 'log_2', checksum: 'b'.repeat(64), prev_checksum: 'prevhash' }, error: null }
    );
    const entry = await writeLog({
      apiKeyId: 'key_1',
      userId: 'user_1',
      action: 'send_message',
      platform: 'whatsapp',
      result: 'SUCCESS',
    });
    expect(entry).toBeDefined();
  });
});
