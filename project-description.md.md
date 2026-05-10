# Zero: identidad responsable para la Internet de Agentes

Zero parte de una pregunta incómoda: cuando un agente de IA ejecuta una acción real, ¿quién responde?

Hoy estamos conectando modelos a WhatsApp, Slack, MCP servers, APIs internas, billeteras, CRMs y sistemas productivos. Les damos herramientas, memoria, permisos y autonomía. Pero la web todavía trata a esos agentes como procesos anónimos: una API key suelta, un webhook, un bot token, un `user_id` prestado. Si algo sale mal, el rastro suele terminar en "el agente lo hizo". Eso no alcanza para un mundo donde los agentes pueden comprar, publicar, mover datos sensibles o coordinar acciones entre servicios.

Zero propone una capa mínima de accountability para ese futuro: una identidad verificable para agentes, vinculada a la persona humana que los creó, con autorización runtime y auditoría por acción.

## Qué construimos

Zero es un protocolo y plataforma developer-first para registrar agentes de IA o servidores MCP con una identidad propia, atada a un creador humano verificado. El flujo es simple:

1. El humano crea una cuenta y verifica su identidad.
2. Registra un agente o MCP server en Zero.
3. Zero emite credenciales por agente: `ZERO_AGENT_ID` + `ZERO_API_SECRET`, o un modo con keypair Ed25519.
4. El dev instala `@zero-gate/sdk` y llama `zero.run()` justo antes de cualquier side effect.
5. Zero valida la firma, la plataforma, el estado del agente, nonces anti-replay y reglas de autorización.
6. Si la acción pasa, devuelve `allowed: true` y un token corto. Si no, bloquea y deja auditoría.

La idea es deliberadamente chica pero potente: antes de que un agente haga algo importante, tiene que poder demostrar "soy este agente, creado por esta cuenta, ejecutando esta acción, en esta plataforma, ahora".

## Por qué importa

La próxima web no va a estar compuesta solamente por usuarios humanos haciendo click. Va a estar llena de agentes actuando entre sistemas. Para que eso escale, necesitamos primitivas nuevas: identidad de agente, delegación, permisos, trazabilidad y revocación.

Zero no intenta resolver toda la gobernanza de IA en un dashboard gigante. Resuelve un punto de control concreto y copiable: poner una patente criptográfica en cada agente antes de que toque el mundo real.

Para devs, eso significa:

- Integración en minutos con un SDK.
- Compatibilidad con agentes normales y servidores MCP.
- Firmas HMAC-SHA256 con nonce y timestamp.
- Modo alternativo con Ed25519 y soporte post-cuántico experimental.
- API de validación centralizada.
- Auditoría de acciones permitidas y bloqueadas.
- Revocación de agentes y claves.
- Identidad humana verificada detrás del runtime.

## Qué lo hace distinto

La mayoría de las soluciones de seguridad para agentes miran el problema desde el prompt, el sandbox o la policy. Zero lo mira desde la responsabilidad operacional: no alcanza con preguntar si una acción "parece segura"; también hay que saber qué agente la pidió, quién lo creó, si sigue habilitado, con qué credencial firmó y qué rastro deja.

Eso abre una capa de infraestructura que puede vivir debajo de cualquier framework de agentes. No compite con LangChain, MCP, OpenAI Agents, workflows propios o bots caseros. Se acopla justo antes del side effect.

```ts
const auth = await zero.run();

if (!auth.allowed) {
  return { ok: false, reason: 'blocked_by_zero' };
}

await performRealAction();
```

Ese patrón es la esencia de Zero: una llamada chica antes de una consecuencia grande.

## Por qué puede ganar

Zero no es otro chatbot ni otra demo de UI sobre un modelo. Es una pieza de infraestructura para un problema que todavía está temprano, pero se está volviendo inevitable. Si los agentes van a operar software, APIs y sistemas financieros o sociales, van a necesitar identidad, permisos y trazabilidad nativas.

El proyecto ya tiene una app funcional, onboarding con verificación, dashboard de agentes, emisión y rotación de claves, audit log, API de validación, SDK publicable, CLI y soporte para MCP. Es demoable hoy, pero apunta a una categoría que va a importar mucho más mañana.

La apuesta es simple: la Internet de Agentes no puede construirse sobre procesos anónimos. Zero le da a cada agente una identidad verificable y a cada acción una cadena de responsabilidad.
