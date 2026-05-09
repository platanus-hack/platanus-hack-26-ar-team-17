import { Fingerprint, Shield, Zap, Link2, Eye, Code2 } from "lucide-react";

const features = [
  {
    icon: Fingerprint,
    title: "Cryptographic Identity",
    description: "Every agent receives a unique cryptographic identity that cannot be forged or impersonated.",
  },
  {
    icon: Shield,
    title: "Verified Actions",
    description: "All agent actions are signed and verifiable, creating an immutable audit trail.",
  },
  {
    icon: Zap,
    title: "Sub-millisecond Auth",
    description: "Identity verification happens in under 1ms, ensuring zero latency for your agents.",
  },
  {
    icon: Link2,
    title: "Human Association",
    description: "Link agent identities to human owners, enabling accountability and trust.",
  },
  {
    icon: Eye,
    title: "Full Observability",
    description: "Monitor all agent activities in real-time with comprehensive logging and analytics.",
  },
  {
    icon: Code2,
    title: "Developer First",
    description: "Simple SDK integration with TypeScript, Python, and Go. Get started in minutes.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 text-xs font-mono text-primary border border-primary/30 rounded-full mb-4">
            FEATURES
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            Built for the Agent Economy
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to secure, verify, and manage AI agent identities at scale.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-lg border border-border bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2 font-mono">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
