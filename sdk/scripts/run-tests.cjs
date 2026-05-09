const assert = require('assert');
const { spawnSync } = require('child_process');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function main() {
  run(process.execPath, ['./node_modules/typescript/bin/tsc']);

  const client = require('../dist/http/client');
  const calls = [];
  client.post = async (url, body) => {
    calls.push({ url, body });
    return { allowed: body.token === 'ak_valid' && body.hash === 'hash_valid' };
  };

  delete process.env.ZERO_API_KEY;
  delete process.env.ZERO_USER_HASH;
  delete process.env.ZERO_PLATFORM;

  const { validate } = require('../dist/pipeline/validateKey');
  const validateResult = await validate({
    token: 'ak_valid',
    hash: 'hash_valid',
    action: 'send_message',
    platform: 'whatsapp',
    platformApiUrl: 'https://api.example.com',
  });

  assert.deepStrictEqual(validateResult, { allowed: true });
  assert.deepStrictEqual(calls[0], {
    url: 'https://api.example.com/api/validate',
    body: {
      token: 'ak_valid',
      hash: 'hash_valid',
      action: 'send_message',
      platform: 'whatsapp',
    },
  });

  const { ZeroGateSDK } = require('../dist/index');
  process.env.ZERO_PLATFORM = 'whatsapp';

  const sdk = new ZeroGateSDK({ apiKey: 'ak_valid', userHash: 'hash_valid' });
  const sdkResult = await sdk.run();
  assert.deepStrictEqual(sdkResult, { allowed: true });
  assert.strictEqual(calls[1].url, 'https://next-app-ochre-zeta.vercel.app/api/validate');
  assert.strictEqual(calls[1].body.platform, 'whatsapp');

  assert.throws(() => new ZeroGateSDK({ userHash: 'hash_valid' }), /Missing apiKey/);
  assert.throws(() => new ZeroGateSDK({ apiKey: 'ak_valid' }), /Missing userHash/);

  console.log('SDK smoke tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
