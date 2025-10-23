import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";

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

  // 🧠 Flag persistente para no repetir toast
  const hasShownInactiveToast = useRef(false);

  // 🔹 Cargar o crear usuario
  const loadUser = useCallback(async (sessionUser) => {
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
    setStatus("loading");

    const { data, error: queryError } = await supabase
      .from("users")
      .select("id, name, last_name, role, is_active, email")
      .eq("id_auth", sessionUser.id)
      .maybeSingle();

    if (queryError) {
      console.error("Error al consultar usuario:", queryError.message);
      setError(queryError.message);
      setStatus("ready");
      return;
    }

    // 🧱 Si no existe → crear
    if (!data) {
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("id_auth", sessionUser.id)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await supabase.from("users").insert([
          {
            id_auth: sessionUser.id,
            name:
              sessionUser.user_metadata?.full_name ||
              sessionUser.user_metadata?.name ||
              "",
            last_name: sessionUser.user_metadata?.last_name || "",
            email: sessionUser.email,
            role: "seller",
            is_active: false,
          },
        ]);

        if (insertError && insertError.code !== "23505") {
          console.error("Error al insertar usuario:", insertError.message);
          setError(insertError.message);
        } else if (!insertError) {
          toast.info("Cuenta pendiente de activación", {
            description:
              "Tu cuenta fue creada correctamente, pero un administrador deberá activarla antes de ingresar.",
            duration: 5000,
          });
        }
      }

      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      setIsActive(false);
      setProfile(null);
      setStatus("ready");
      return;
    }

    // 🧩 Usuario inactivo
    if (!data.is_active) {
      if (!hasShownInactiveToast.current) {
        hasShownInactiveToast.current = true;
        toast.warning("Cuenta inactiva", {
          description:
            "Tu cuenta aún no ha sido activada por un administrador.",
          duration: 5000,
        });
      }

      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      setIsActive(false);
      setProfile(data);
      setStatus("ready");
      return;
    }

    // ✅ Usuario activo y válido
    if (JSON.stringify(profile) !== JSON.stringify(data)) {
      setProfile(data);
    }

    setRole(data.role);
    setIsActive(Boolean(data.is_active));
    setError(null);
    setStatus("ready");
  }, [profile]);

  // 🔹 Refrescar perfil manualmente
  const refreshProfile = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    await loadUser(sessionData?.session?.user ?? null);
  }, [loadUser]);

  // 🔹 Inicialización + listener de sesión
  useEffect(() => {
    let isSubscribed = true;
    let lastUserId = null;

    const initialize = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user ?? null;
      if (!isSubscribed) return;
      if (currentUser?.id !== lastUserId) {
        lastUserId = currentUser?.id;
        await loadUser(currentUser);
      }
    };

    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isSubscribed) return;
        if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
        const currentUser = session?.user ?? null;
        if (currentUser?.id !== lastUserId) {
          lastUserId = currentUser?.id;
          loadUser(currentUser);
        }
      }
    );

    return () => {
      isSubscribed = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, [loadUser]);

  // 🔹 Valor del contexto
  const value = useMemo(
    () => ({
      user,
      role: profile?.role || role,
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
