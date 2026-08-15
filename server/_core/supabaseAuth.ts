import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId, upsertUser } from "../db";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function authenticateSupabaseRequest(req: Request): Promise<User | null> {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || !supabaseUrl || !serviceRoleKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: serviceRoleKey,
    },
  });
  if (!response.ok) return null;
  const authUser = await response.json() as { id?: string; email?: string; user_metadata?: { full_name?: string; name?: string } };
  if (!authUser.id) return null;

  const openId = authUser.id;
  const existing = await getUserByOpenId(openId);
  if (!existing) {
    await upsertUser({
      openId,
      email: authUser.email ?? null,
      name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? authUser.email ?? "Bakery user",
      loginMethod: "supabase",
      lastSignedIn: new Date(),
    });
  } else {
    await upsertUser({ openId, lastSignedIn: new Date(), loginMethod: "supabase" });
  }
  return (await getUserByOpenId(openId)) ?? null;
}
