import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const [sessionReady, setSessionReady] = useState(!supabase);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setHasSession(Boolean(nextSession));
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

  const logout = useCallback(async () => {
    await supabase?.auth.signOut();
    setHasSession(false);
    utils.auth.me.setData(undefined, null);
  }, [utils]);

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: !sessionReady || (hasSession && meQuery.isLoading),
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
  }), [hasSession, meQuery.data, meQuery.error, meQuery.isLoading, sessionReady]);

  return { ...state, refresh: () => meQuery.refetch(), logout };
}
