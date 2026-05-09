import https from 'https';
import { URL } from 'url';

export async function post<T>(url: string, body: unknown): Promise<T> {
  const parsed = new URL(url);

  if (parsed.protocol !== 'https:') {
    throw new Error('HTTPS required — HTTP is not allowed for security reasons');
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      protocol: 'https:',
      rejectUnauthorized: true,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw) as T);
        } catch {
          reject(new Error('Invalid JSON response from Platform API'));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
