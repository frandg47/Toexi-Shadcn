import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext({
  user: null,
  role: null,
  isActive: false,
  status: "loading",
  error: null,
  profile: null,
  refreshProfile: async () => {},
});

export const AuthContextProvider = ({ children }) => {
  const [user, setUser] = useState(undefined);
  const [role, setRole] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  const loadUser = useCallback(async (sessionUser) => {
    if (status === "loading" || !user || user?.id !== sessionUser?.id) {
      setStatus("loading");
    }

    if (!sessionUser) {
      setUser(null);
      setRole(null);
      setIsActive(false);
      setProfile(null);
      setError(null);
      setStatus("ready");
      return;
    }

    setUser(sessionUser);

    const { data, error: queryError } = await supabase
      .from("users")
      .select("id, name, last_name, role, state")
      .eq("id_auth", sessionUser.id)
      .single();

    if (queryError || !data) {
      setRole(null);
      setIsActive(false);
      setProfile(null);
      setError(queryError?.message ?? "User profile not found");
      setStatus("ready");
      return;
    }

    setRole(data.role);
    setIsActive(Boolean(data.state));
    setProfile(data);
    setError(null);
    setStatus("ready");
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    await loadUser(sessionData?.session?.user ?? null);
  }, [loadUser]);

  useEffect(() => {
    let isSubscribed = true;

    const initialize = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!isSubscribed) return;
      await loadUser(sessionData?.session?.user ?? null);
    };

    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isSubscribed) return;
        loadUser(session?.user ?? null);
      }
    );

    return () => {
      isSubscribed = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, [loadUser]);

  const value = useMemo(
    () => ({
      user,
      role,
      isActive,
      status,
      error,
      profile,
      refreshProfile,
    }),
    [user, role, isActive, status, error, profile, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
