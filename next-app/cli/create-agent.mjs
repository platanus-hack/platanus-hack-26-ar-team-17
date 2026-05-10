#!/usr/bin/env node
/**
 * Crea el primer (y único permitido por este flujo) agente para un usuario
 * identificado por su hash estable, e imprime la API key en stdout.
 *
 * Uso:
 *   node cli/create-agent.mjs <userHash> [--name Nombre] [--platform plataforma]
 *
 * URL del backend (por defecto http://localhost:3000):
 *   ZEROGATE_URL o NEXT_PUBLIC_SITE_URL
 */

const baseUrl = (process.env.ZEROGATE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

function parseArgs(argv) {
  const positional = [];
  const flags = { name: undefined, platform: undefined };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name' && argv[i + 1]) {
      flags.name = argv[++i];
    } else if (a === '--platform' && argv[i + 1]) {
      flags.platform = argv[++i];
    } else if (a.startsWith('-')) {
      console.error(`Opción desconocida: ${a}`);
      process.exit(1);
    } else {
      positional.push(a);
    }
  }
  return { userHash: positional[0], ...flags };
}

async function main() {
  const { userHash, name, platform } = parseArgs(process.argv);
  if (!userHash) {
    console.error('Uso: node cli/create-agent.mjs <userHash> [--name Nombre] [--platform plataforma]');
    process.exit(1);
  }

  const res = await fetch(`${baseUrl}/api/cli/create-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userHash,
      ...(name ? { name } : {}),
      ...(platform ? { platform } : {}),
    }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error('Respuesta no JSON:', text.slice(0, 500));
    process.exit(1);
  }

  if (!res.ok) {
    console.error(json.error || json.message || `HTTP ${res.status}`);
    process.exit(1);
  }

  if (!json.apiKey) {
    console.error('El servidor no devolvió apiKey (¿tipo de agente inesperado?)');
    process.exit(1);
  }

  console.log(json.apiKey);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
