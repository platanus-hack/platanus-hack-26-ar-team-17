import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTA() {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
      
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6 text-balance">
          Ready to Build the Future?
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
          Join thousands of developers building secure, accountable AI agents with Zero.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-mono">
            <Link href="/onboard">
              Start Building Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="font-mono border-border hover:bg-secondary">
            Talk to Sales
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground font-mono">
          Free tier includes 10,000 agent verifications/month
        </p>
      </div>
    </section>
  );
}
