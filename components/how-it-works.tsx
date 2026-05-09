export function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Initialize SDK",
      code: `import { Zero } from '@zero/sdk'

const zero = new Zero({
  apiKey: process.env.ZERO_API_KEY
})`,
    },
    {
      number: "02",
      title: "Create Agent Identity",
      code: `const agent = await zero.createAgent({
  name: 'trading-bot',
  owner: 'user_0x7f3...',
  permissions: ['read', 'execute']
})`,
    },
    {
      number: "03",
      title: "Sign Agent Actions",
      code: `const signedAction = await agent.sign({
  action: 'transfer',
  params: { to: '0x...', amount: 100 },
  timestamp: Date.now()
})`,
    },
    {
      number: "04",
      title: "Verify & Execute",
      code: `const verified = await zero.verify(signedAction)

if (verified.valid) {
  await executeTransaction(verified.payload)
}`,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-4 bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 text-xs font-mono text-primary border border-primary/30 rounded-full mb-4">
            INTEGRATION
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            Four Lines to Identity
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Integrate Zero in minutes, not days. Our SDK handles the complexity.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/50">
                <span className="text-primary font-mono font-bold">{step.number}</span>
                <span className="font-mono text-sm text-foreground">{step.title}</span>
              </div>
              <pre className="p-4 text-sm font-mono overflow-x-auto">
                <code className="text-muted-foreground">
                  {step.code.split('\n').map((line, i) => (
                    <span key={i} className="block">
                      {line.split(/('.*?'|`.*?`|".*?")/).map((part, j) => {
                        if (part.startsWith("'") || part.startsWith('"') || part.startsWith('`')) {
                          return <span key={j} className="text-primary">{part}</span>;
                        }
                        if (part.includes('const') || part.includes('import') || part.includes('from') || part.includes('await') || part.includes('if')) {
                          return part.split(/\b(const|import|from|await|if|async)\b/).map((word, k) => {
                            if (['const', 'import', 'from', 'await', 'if', 'async'].includes(word)) {
                              return <span key={k} className="text-foreground">{word}</span>;
                            }
                            return <span key={k}>{word}</span>;
                          });
                        }
                        return <span key={j}>{part}</span>;
                      })}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
