# zero.

> La capa de identidad para la internet de agentes

<img src="./project-logo.png" alt="zero. logo" width="180" />

**Track:** Future | Platanus Hack 26, Buenos Aires &nbsp;|&nbsp; **Live:** [platanus-hack-26-ar-team-17.vercel.app](https://platanus-hack-26-ar-team-17.vercel.app/)

---

## El problema

Los agentes de IA estan actuando sobre sistemas reales: WhatsApp, servidores MCP, billeteras, CRMs, APIs internas. Pero la web todavia los trata como procesos anonimos: una API key suelta, un bot token, un `user_id` prestado. Cuando algo sale mal, el rastro termina en "el agente lo hizo". Eso no alcanza para un mundo donde los agentes compran, publican, mueven datos sensibles y coordinan acciones entre servicios.

## Que hace zero.

Zero pone una patente criptografica en cada agente antes de que toque el mundo real. Una sola llamada antes de cada side effect:

```ts
const auth = await zero.run();

if (!auth.allowed) {
  return { ok: false, reason: 'blocked_by_zero' };
}

await performRealAction();
```

- **HMAC-SHA256** con nonce + timestamp (anti-replay, el secreto nunca viaja por la red)
- **Ed25519 challenge-response**: la clave privada del agente nunca sale de su runtime.
  El servidor emite un challenge de un solo uso; el agente firma `challengeId|nonce|agentId`
  localmente y envia solo la firma. Cada challenge expira en 60 segundos y es de uso unico,
  por lo que los ataques de replay son imposibles.
- **Capa post-cuantica (ML-DSA-65)**: Ed25519 es seguro contra computadoras clasicas, pero
  una computadora cuantica suficientemente potente podria romper las firmas de curva eliptica
  mediante el algoritmo de Shor. zero. soporta una segunda firma opcional usando ML-DSA-65
  (antes conocido como Dilithium 3), un algoritmo basado en reticulados estandarizado por NIST
  que es resistente a ataques cuanticos. Cuando se configura `ZERO_PRIVATE_KEY_PQC`, ambas
  firmas se computan y verifican de forma independiente - si cualquiera de las dos falla, la
  solicitud es bloqueada. Esto hace que zero. este preparado para un futuro post-cuantico sin
  romper las integraciones existentes.
- **Autorizacion por scope** por agente (acciones permitidas definidas en el registro)
- **Audit log a prueba de manipulacion**: cadena de checksums SHA-256 en cada entrada
- **Revocacion instantanea**: deshabilitar un agente bloquea todas las llamadas futuras de inmediato
- **Rate limiting**: 30 req/60s por IP, respaldado por Postgres (sin Redis)

---

## Arquitectura

| Componente | Que hace | Stack |
|---|---|---|
| **Landing + Onboard** (raiz) | Pagina de marketing + wizard de verificacion KYC de 7 pasos | Next.js 16, React 19, shadcn/ui, Tailwind v4 |
| **Platform API** (`next-app/`) | API REST: agentes, claves, validacion, audit log | Next.js 16, Supabase (PostgreSQL), JWT |
| **Agent SDK** (`sdk/`) | `@zero-gate/sdk`, embebido en servidores MCP | Node.js 18+, TypeScript, `crypto` nativo |
| **CLI** (`cli/`) | `@zero-gate/cli`, provision de agentes desde la terminal | Node.js, TypeScript |

---

## Como funciona

1. **El humano se registra** en zero. y completa la verificacion KYC (biometria + documento via Didit)
2. **El humano crea un agente** (nombre, plataforma, scope) y recibe las credenciales una sola vez
3. **Las credenciales se inyectan** en el entorno del agente (`ZERO_AGENT_ID` + `ZERO_API_SECRET`)
4. **El agente razona** y decide llamar a una herramienta MCP
5. **El agente llama al servidor MCP**
6. **El servidor MCP llama a `zero.run()`** antes de ejecutar cualquier side effect
7. **El SDK firma** la solicitud con HMAC-SHA256 y hace POST a `/api/validate`
8. **La plataforma valida:** rate limit -> verificacion de firma -> anti-replay de nonce -> scope -> reglas globales -> audit log
9. **El SDK retorna** `{ allowed: true, token }` o `{ allowed: false }`
10. **El servidor MCP ejecuta la herramienta** solo si esta permitido; de lo contrario rechaza

---

## Inicio rapido

### Probar la plataforma en vivo

Visita [platanus-hack-26-ar-team-17.vercel.app](https://platanus-hack-26-ar-team-17.vercel.app/), registrate y crea tu primer agente desde el dashboard.

### Instalar el CLI

```sh
npm install -g https://github.com/platanus-hack/platanus-hack-26-ar-team-17/raw/main/cli/zero-gate-cli-0.1.0.tgz

zero login                    # pega tu CLI token desde el dashboard
zero agents create mi-bot     # crea un agente e imprime las credenciales
zero agents list
```

### Agregar el SDK a tu servidor MCP

```sh
zero init    # instala @zero-gate/sdk y genera el .env.local
```

O manualmente:

```sh
npm install @zero-gate/sdk
```

```ts
import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();

// Llamar dentro de cada handler de herramienta MCP, antes del side effect:
const { allowed } = await zero.run();
if (!allowed) throw new Error('No autorizado por zero.');
```

Variables de entorno del agente:

```
ZERO_AGENT_ID=<uuid>               # desde el dashboard o CLI
ZERO_API_SECRET=<secret>           # modo HMAC, se muestra una sola vez al crear
# Modo Ed25519 (alternativa):
ZERO_PRIVATE_KEY=<hex-64-chars>        # seed de clave privada Ed25519
ZERO_PRIVATE_KEY_PQC=<hex-64-chars>    # clave ML-DSA-65 (opcional, capa post-cuantica)
```

---

## Self-hosting de la Platform API

```bash
cd next-app
cp .env.example .env    # completar los valores indicados abajo
npm install
npm run dev             # http://localhost:3000
```

Ejecutar `next-app/supabase/schema.sql` en el editor SQL de Supabase para crear el schema.

| Variable | Descripcion |
|---|---|
| `ENCRYPTION_KEY` | Clave AES-256 en hex de 64 chars: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto en Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon key de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo server-side) |
| `JWT_SECRET` | Secreto de minimo 32 chars para firmar todos los JWT |
| `DIDIT_API_KEY` | Clave de integracion KYC con Didit |
| `DIDIT_KYC_WORKFLOW_ID` | UUID del workflow KYC en Didit |
| `SITE_URL` | URL publica del deployment |
| `DIDIT_MOCK` | Setear a cualquier valor para saltear KYC (solo dev) |

---

## Referencia de API

### Validacion de agentes (llamada por el SDK, sin autenticacion de usuario)

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `POST` | `/api/validate` | Modo HMAC: verifica firma y emite JWT |
| `POST` | `/api/agent-auth/challenge` | Modo Ed25519: emite challenge de un solo uso |
| `POST` | `/api/agent-auth/verify` | Modo Ed25519: verifica firma y emite JWT |

Body de `POST /api/validate`: `{ agentId, timestamp, nonce, action, platform, signature }`
Respuesta: `{ allowed: true, token, expiresAt }` o `{ allowed: false }`

### Dashboard (requiere JWT de `user_session`)

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `POST` | `/api/auth/login` | Login con Google OAuth |
| `POST` | `/api/agents` | Crear agente, retorna `{ agent, apiSecret }` una sola vez |
| `GET` | `/api/agents` | Listar agentes |
| `DELETE` | `/api/agents/[id]` | Deshabilitar agente y revocar todas sus claves |
| `POST` | `/api/keys` | Crear clave adicional para un agente |
| `DELETE` | `/api/keys/[id]` | Revocar clave |
| `GET` | `/api/audit-log` | Audit log con filtros |
| `GET` | `/api/alerts` | Ultimos 20 eventos bloqueados por reglas |

---

## Correr los tests

```bash
# Platform API
cd next-app && npm test

# Archivo de test individual
cd next-app && npx jest tests/integration/hmac-mcp-e2e.test.ts --no-coverage

# SDK
cd sdk && npm test
```

---

## Equipo

- Martin Pulitano ([@MartinPuli](https://github.com/MartinPuli))
- Candela Mena Bisignano ([@CandelaMenaBisignano07](https://github.com/CandelaMenaBisignano07))
- Julian Stiefkens ([@juop12](https://github.com/juop12))
- Cielo Dahy ([@ununpentio](https://github.com/ununpentio))
