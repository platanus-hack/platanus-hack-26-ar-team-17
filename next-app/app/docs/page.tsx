import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShaderBg } from '@/components/ui/page-shader-bg';

export const metadata: Metadata = {
  title: 'Docs para desarrolladores',
  description: 'Integra Zero en un agente de IA o servidor MCP.',
};

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

const AI_PROMPT = `You are integrating @zero-gate/sdk@1.0.3 into an existing AI agent or MCP server.
ZeroGate adds identity and auditability: it signs each action with HMAC-SHA256,
validates it against the Platform API, and returns { allowed, token? } before the action runs.

Integration contract:

1. Install: npm install @zero-gate/sdk@1.0.3
   If the package is not available from npm, install from:
   https://github.com/platanus-hack/platanus-hack-26-ar-team-17/raw/main/sdk/zero-gate-sdk-1.0.3.tgz

2. Ask the developer for only two dashboard values:
   - ZERO_AGENT_ID: the agent UUID
   - ZERO_API_SECRET: the agent HMAC secret

3. Initialize once:
   import { ZeroGateSDK } from '@zero-gate/sdk';
   const zero = new ZeroGateSDK();

4. Wrap every real action with zero.run(). Do not invent fields:
   action and platform are detected automatically.

5. If result.allowed is false, do not run the side effect.

Report back: files changed, protected actions, and env vars added.`;

function TerminalDots() {
  const dot = { width: 11, height: 11, borderRadius: '50%', display: 'inline-block' } as const;
  return (
    <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
      <span style={{ ...dot, background: '#ff5f57', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)' }} />
      <span style={{ ...dot, background: '#febc2e', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)' }} />
      <span style={{ ...dot, background: '#28c840', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)' }} />
    </span>
  );
}

function TerminalChrome({
  label,
  accent = false,
  children,
  scrollable = false,
}: {
  label?: string;
  accent?: boolean;
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  const borderColor = accent ? 'rgba(200,245,66,0.22)' : 'rgba(255,255,255,0.08)';
  const headerBg = accent ? 'rgba(7,9,7,0.85)' : 'rgba(10,10,10,0.85)';
  const bodyBg = accent ? 'rgba(7,9,7,0.78)' : 'rgba(8,8,8,0.78)';
  const labelColor = accent ? 'var(--accent)' : 'var(--text-faint)';
  return (
    <div
      style={{
        marginBottom: 28,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 14px',
          background: headerBg,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <TerminalDots />
        {label && (
          <span
            style={{
              ...mono,
              fontSize: 12,
              color: labelColor,
              letterSpacing: '0.02em',
              flex: 1,
              textAlign: 'center',
              paddingRight: 50,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </span>
        )}
      </div>
      <div
        style={{
          background: bodyBg,
          maxHeight: scrollable ? 460 : undefined,
          overflowY: scrollable ? 'auto' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <TerminalChrome label={label}>
      <pre style={{
        ...mono,
        fontSize: 14,
        lineHeight: 1.75,
        padding: '20px 22px',
        color: '#e8e8e8',
        overflowX: 'auto',
        margin: 0,
        whiteSpace: 'pre',
        background: 'transparent',
      }}>
        {code}
      </pre>
    </TerminalChrome>
  );
}

function CopyableBlock({ code, label }: { code: string; label?: string }) {
  return (
    <TerminalChrome label={label} accent scrollable>
      <pre style={{
        ...mono,
        fontSize: 13.5,
        lineHeight: 1.75,
        padding: '20px 22px',
        color: '#e8e8e8',
        overflowX: 'auto',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        background: 'transparent',
      }}>
        {code}
      </pre>
    </TerminalChrome>
  );
}

function Section({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 64, paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        {tag && (
          <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(200,245,66,0.07)', border: '1px solid rgba(200,245,66,0.2)', padding: '4px 10px', borderRadius: 999 }}>
            {tag}
          </span>
        )}
        <h2 style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontSize: 22, fontWeight: 600, letterSpacing: 0, margin: 0, textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(200,245,66,0.05)', border: '1px solid rgba(200,245,66,0.18)', borderRadius: 10, padding: '16px 20px', marginBottom: 22, fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.7, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ fontSize: 15.5, color: 'var(--text-dim)', lineHeight: 1.9, paddingLeft: 20, margin: '0 0 20px' }}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default function DocsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', position: 'relative' }}>
      <PageShaderBg veilOpacity={0.68} />

      <nav style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px clamp(20px, 6vw, 48px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(5,5,5,0.55)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <span style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontWeight: 600, fontSize: 18, letterSpacing: 0, color: 'var(--text)' }}>
            zero
          </span>
          <span style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 600 }}>.</span>
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/login" style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', padding: '7px 14px', borderRadius: 6 }}>
            Iniciar sesión
          </Link>
          <Link href="/login" style={{ ...mono, fontSize: 12, color: '#050505', textDecoration: 'none', padding: '7px 14px', borderRadius: 6, background: 'var(--accent)', fontWeight: 600 }}>
            Empezar -&gt;
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '64px clamp(20px, 6vw, 48px) 120px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 64 }}>
          <span style={{ ...mono, fontSize: 12.5, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18, display: 'block' }}>
            Docs para desarrolladores / SDK v1.0.3 / HMAC
          </span>
          <h1 style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontSize: 46, fontWeight: 700, letterSpacing: 0, lineHeight: 1.1, margin: '0 0 22px', textShadow: '0 4px 32px rgba(0,0,0,0.55)' }}>
            Agrega identidad responsable<br />a tu agente.
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-dim)', lineHeight: 1.7, margin: 0, maxWidth: 640 }}>
            Zero vincula un agente de IA o servidor MCP con la cuenta humana que lo creó. Llama al SDK antes de una acción real: Zero valida el runtime, firma la solicitud, devuelve un token corto y registra la acción para auditoría.
          </p>
        </div>

        <Section tag="00" title="El contrato">
          <InfoBox>
            Tu app sigue ejecutando el trabajo. Zero responde antes: ¿este agente, creado por esta persona, puede realizar esta acción ahora?
          </InfoBox>
          <BulletList
            items={[
              <>Un humano crea un agente desde el dashboard de Zero.</>,
              <>El runtime recibe <code style={mono}>ZERO_AGENT_ID</code> y un secreto o clave privada.</>,
              <>Tu código llama <code style={mono}>zero.run()</code> antes de side effects como mensajes, writes, compras, tool calls o mutaciones de API.</>,
              <>Zero valida la prueba del runtime, la plataforma y el estado del agente.</>,
              <>Si las credenciales no coinciden o el agente fue deshabilitado, <code style={mono}>allowed</code> será <code style={mono}>false</code>.</>,
            ]}
          />
        </Section>

        <Section tag="01" title="Instala">
          <CodeBlock label="npm" code="npm install @zero-gate/sdk@1.0.3" />
          <p style={{ ...mono, fontSize: 12.5, color: 'var(--text-muted)', marginTop: -4, lineHeight: 1.85 }}>
            Instalación local: <code style={{ color: 'var(--text-dim)' }}>npm install ../sdk/zero-gate-sdk-1.0.3.tgz</code><br />
            Si no está en npm: <code style={{ color: 'var(--text-dim)' }}>npm install https://github.com/platanus-hack/platanus-hack-26-ar-team-17/raw/main/sdk/zero-gate-sdk-1.0.3.tgz</code>
          </p>
        </Section>

        <Section tag="02" title="Crea un agente">
          <p style={{ fontSize: 15.5, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.75 }}>
            Crea un agente por cada runtime que quieras identificar. En el dashboard, abre <Link href="/agents" style={{ color: 'var(--accent)' }}>/agents</Link>, entra en credenciales y copia el ID del agente junto con su API secret.
          </p>
          <CodeBlock
            label="dashboard / agents / credenciales"
            code={`ZERO_AGENT_ID=f47ac10b-58cc-4372-a567-0e02b2c3d479
ZERO_API_SECRET=hQv7...(long base64url string)...2k

# Headers for an MCP wrapper:
#   X-Zero-Agent-Id:    f47ac10b-58cc-4372-a567-0e02b2c3d479
#   X-Zero-Api-Secret:  hQv7...2k`}
          />
          <InfoBox>
            Para integraciones nuevas usa <code style={mono}>ZERO_AGENT_ID</code> + <code style={mono}>ZERO_API_SECRET</code>. El flujo viejo con <code style={mono}>ZERO_API_KEY</code> + <code style={mono}>ZERO_USER_HASH</code> queda solo por compatibilidad.
          </InfoBox>
        </Section>

        <Section tag="03" title="Configura el runtime">
          <CodeBlock
            label=".env"
            code={`ZERO_AGENT_ID=0f6f7f64-8c7f-4a8f-bcf1-8d33d624f2a1
ZERO_API_SECRET=zgs_...

# Optional
ZERO_PLATFORM=mcp
ZERO_PLATFORM_API_URL=http://localhost:3000`}
          />
          <p style={{ fontSize: 15.5, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.75 }}>
            Si <code style={mono}>ZERO_PLATFORM</code> no está definido, el SDK detecta MCP cuando <code style={mono}>@modelcontextprotocol/sdk</code> está instalado. Si no, reporta <code style={mono}>custom</code>.
          </p>
          <CodeBlock
            label="initialize"
            code={`import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();
// reads ZERO_AGENT_ID + ZERO_API_SECRET from process.env`}
          />
        </Section>

        <Section tag="04" title="Protege acciones reales">
          <p style={{ fontSize: 15.5, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.75 }}>
            Crea el SDK una vez y llama <code style={mono}>run()</code> justo antes de un side effect. Usa funciones con nombre para que el audit log sea legible.
          </p>
          <CodeBlock
            label="usage"
            code={`import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();

export async function sendMessage(text: string) {
  const auth = await zero.run();

  if (!auth.allowed) {
    return { ok: false, reason: 'blocked_by_zero' };
  }

  await deliverMessage(text);
  return { ok: true };
}`}
          />
        </Section>

        <Section tag="05" title="Patrón para MCP">
          <InfoBox>
            Cuando <code style={mono}>@modelcontextprotocol/sdk</code> está instalado, el SDK reporta <code style={mono}>mcp</code> automáticamente.
          </InfoBox>
          <CodeBlock
            label="mcp-server.ts"
            code={`import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const auth = await zero.run();

  if (!auth.allowed) {
    return {
      content: [{ type: 'text', text: 'Zero blocked this action.' }],
      isError: true,
    };
  }

  return executeTool(request.params);
});`}
          />
        </Section>

        <Section tag="06" title="Modo con keypair">
          <p style={{ fontSize: 15.5, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.75 }}>
            Si no quieres un secreto HMAC compartido dentro del runtime, registra una clave pública Ed25519 y ejecuta el SDK con la clave privada. La clave privada nunca sale del proceso del agente.
          </p>
          <CodeBlock
            label="env"
            code={`ZERO_AGENT_ID=0f6f7f64-8c7f-4a8f-bcf1-8d33d624f2a1
ZERO_PRIVATE_KEY=64_hex_chars

# Optional
ZERO_PRIVATE_KEY_PQC=...`}
          />
        </Section>

        <Section tag="07" title="Prompt para un asistente de IA">
          <p style={{ fontSize: 15.5, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.75 }}>
            Pega esto en Claude, Cursor, Copilot Chat o cualquier asistente que pueda editar tu repo. Incluye el contrato para que no invente campos.
          </p>
          <CopyableBlock label="copiar / pegar en tu asistente" code={AI_PROMPT} />
        </Section>

        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--z-border)', borderRadius: 12, padding: '22px 26px', marginBottom: 48, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
          <p style={{ ...mono, fontSize: 11.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Notas de seguridad</p>
          <ul style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
            <li>El secreto HMAC no viaja en claro. El SDK firma <code style={mono}>agentId|timestamp|nonce|action|platform</code> y el backend lo verifica.</li>
            <li>El transporte exige HTTPS para producción.</li>
            <li>Los nonces son de un solo uso y reducen riesgo de replay.</li>
            <li>Los tokens del SDK expiran en minutos, no en días.</li>
            <li>Cada llamada a <code style={mono}>run()</code>, permitida o bloqueada, queda en el audit log.</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 17, color: 'var(--text-muted)', marginBottom: 22 }}>Construye agentes que puedan responder por lo que hacen.</p>
          <Link href="/login" style={{ ...mono, fontSize: 14, fontWeight: 600, padding: '14px 30px', borderRadius: 8, background: 'var(--accent)', color: '#050505', textDecoration: 'none' }}>
            Crear primer agente -&gt;
          </Link>
        </div>
      </main>
    </div>
  );
}
