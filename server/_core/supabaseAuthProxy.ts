import type { Express, Request, Response } from "express";

export function buildSupabasePasswordSignInRequest(email: string, password: string) {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  return {
    url: `${supabaseUrl}/auth/v1/token?grant_type=password`,
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  };
}

export function registerSupabaseAuthProxy(app: Express) {
  app.post("/api/auth/sign-in", async (req: Request, res: Response) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const request = buildSupabasePasswordSignInRequest(email, password);
    if (!email || !password || !request.url.startsWith("https://") || !request.headers.apikey) {
      res.status(400).json({ error: "Email, password, and Supabase configuration are required." });
      return;
    }

    try {
      const upstream = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(10000),
      });
      const payload = await upstream.json().catch(() => ({ error: "Supabase returned an unreadable response." }));
      res.setHeader("Cache-Control", "no-store");
      res.status(upstream.status).json(payload);
    } catch {
      res.status(504).json({ error: "Supabase sign-in service did not respond. Please try again." });
    }
  });
}
