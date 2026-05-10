import * as readline from 'node:readline';

export function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function promptHidden(question: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(question);

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw === true;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let buf = '';
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\n' || c === '\r' || c === '') {
          if (stdin.setRawMode) stdin.setRawMode(wasRaw);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(buf.trim());
          return;
        }
        if (c === '') {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (c === '' || c === '\b') {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += c;
      }
    };
    stdin.on('data', onData);
  });
}

export async function confirm(question: string, defaultYes = false): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const ans = (await prompt(`${question} ${hint} `)).toLowerCase();
  if (!ans) return defaultYes;
  return ans === 'y' || ans === 'yes';
}
