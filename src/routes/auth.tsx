import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Sign in · Sentinel AI" },
      { name: "description", content: "Access your Sentinel AI monitoring console." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle(action: "signin" | "signup") {
    if (!email || password.length < 6) {
      toast.error("Enter a valid email and a password of 6+ characters");
      return;
    }
    setLoading(true);
    try {
      if (action === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Welcome to Sentinel.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-col justify-between p-12 w-1/2 border-r border-border bg-surface/40 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-brand/10 ring-1 ring-brand/30 rounded-lg flex items-center justify-center">
            <Activity className="size-4 text-brand" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold uppercase tracking-wider">Sentinel AI</span>
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight text-balance leading-tight">
            Autonomous safety, watching every frame.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
            Sentinel continuously analyzes live camera feeds for fire, intrusion, accidents,
            congestion, and more — generating incident response plans in real time.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              ["8", "Detection classes"],
              ["<2s", "Response latency"],
              ["24/7", "Always on"],
            ].map(([v, k]) => (
              <div key={k}>
                <div className="text-2xl font-mono-tabular text-brand">{v}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  {k}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[10px] font-mono-tabular text-muted-foreground/60 uppercase tracking-wider">
          v1.0 · Mission Control
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="size-8 bg-brand/10 ring-1 ring-brand/30 rounded-lg flex items-center justify-center">
              <Activity className="size-4 text-brand" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold uppercase tracking-wider">Sentinel AI</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-1">Access your console</h2>
          <p className="text-sm text-muted-foreground mb-8">Sign in or create an operator account.</p>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>
            {(["signin", "signup"] as const).map((mode) => (
              <TabsContent key={mode} value={mode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${mode}-email`}>Email</Label>
                  <Input
                    id={`${mode}-email`}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@yourco.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${mode}-pw`}>Password</Label>
                  <Input
                    id={`${mode}-pw`}
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  onClick={() => handle(mode)}
                  disabled={loading}
                  className="w-full gap-2"
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
