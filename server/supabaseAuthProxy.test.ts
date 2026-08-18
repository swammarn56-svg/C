import { describe, expect, it, vi } from "vitest";
import { buildSupabasePasswordSignInRequest } from "./_core/supabaseAuthProxy";

describe("same-origin Supabase sign-in proxy", () => {
  it("builds the password-token request from managed server configuration", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    const request = buildSupabasePasswordSignInRequest(" user@example.com ", "password");
    expect(request.url).toBe("https://example.supabase.co/auth/v1/token?grant_type=password");
    expect(request.headers.apikey).toBe("test-publishable-key");
    expect(JSON.parse(request.body)).toEqual({ email: " user@example.com ", password: "password" });
    vi.unstubAllEnvs();
  });

  it("falls back to the VITE publishable key when the server alias is absent", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "vite-publishable-key");
    expect(buildSupabasePasswordSignInRequest("user@example.com", "password").headers.apikey).toBe("vite-publishable-key");
    vi.unstubAllEnvs();
  });
});
