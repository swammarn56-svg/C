import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

export const AUTH_TIMEOUT_MS = 12000;

export function withAuthTimeout<T>(promise: Promise<T>, message: string, timeoutMs = AUTH_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(value => { globalThis.clearTimeout(timer); resolve(value); }, error => { globalThis.clearTimeout(timer); reject(error); });
  });
}

export function useAuth() {
  const utils = trpc.useUtils();
  const [sessionReady, setSessionReady] = useState(!supabase);
  const [hasSession, setHasSession] = useState(false);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [userQueryTimedOut, setUserQueryTimedOut] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      return;
    }
    let active = true;
    void withAuthTimeout(supabase.auth.getSession(), "Supabase session loading timed out. Please try again.").then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setAuthError(null);
      setSessionReady(true);
    }).catch(error => {
      if (!active) return;
      setAuthError(error instanceof Error ? error : new Error("Unable to load the Supabase session."));
      setHasSession(false);
      setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setHasSession(Boolean(nextSession));
      setAuthError(null);
      setUserQueryTimedOut(false);
      setSessionReady(true);
      if (!nextSession) utils.auth.me.setData(undefined, null);
      void utils.auth.me.invalidate();
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [utils]);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: sessionReady && hasSession,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!hasSession || !meQuery.isLoading) return;
    const timer = globalThis.setTimeout(() => setUserQueryTimedOut(true), AUTH_TIMEOUT_MS);
    return () => globalThis.clearTimeout(timer);
  }, [hasSession, meQuery.isLoading]);

  const logout = useCallback(async () => {
    await supabase?.auth.signOut();
    setHasSession(false);
    setAuthError(null);
    setUserQueryTimedOut(false);
    utils.auth.me.setData(undefined, null);
  }, [utils]);

  const refresh = useCallback(() => {
    setAuthError(null);
    setUserQueryTimedOut(false);
    return meQuery.refetch();
  }, [meQuery.refetch]);

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: !sessionReady || (hasSession && meQuery.isLoading && !userQueryTimedOut),
    error: authError ?? meQuery.error ?? (userQueryTimedOut ? new Error("ERP profile loading timed out. Please retry sign-in.") : null),
    isAuthenticated: Boolean(meQuery.data),
  }), [authError, hasSession, meQuery.data, meQuery.error, meQuery.isLoading, sessionReady, userQueryTimedOut]);

  return { ...state, refresh, logout };
}
