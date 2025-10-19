import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";
import Swal from "sweetalert2";

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

  // 🔹 Cargar o crear usuario
  const loadUser = useCallback(async (sessionUser) => {
    if (status === "loading" || !user || user?.id !== sessionUser?.id) {
      setStatus("loading");
    }

    // 🔸 Si no hay sesión → limpiar estados
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

    // 🔹 Buscar en tu tabla "users"
    const { data, error: queryError } = await supabase
      .from("users")
      .select("id, name, last_name, role, is_active, email")
      .eq("id_auth", sessionUser.id)
      .maybeSingle();

    // 🧱 Si no existe el registro en tu tabla "users" → crear
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
            email: sessionUser.email,
            role: "seller",
            is_active: false, // inactivo por defecto
          },
        ]);

        if (insertError && insertError.code !== "23505") {
          console.error("Error al insertar usuario:", insertError.message);
          setError(insertError.message);
        } else if (!insertError) {
          Swal.fire(
            "Cuenta pendiente de activación",
            "Tu cuenta fue creada correctamente, pero un administrador deberá activarla antes de ingresar.",
            "info"
          );
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

    // 🧩 Si sí existe, pero está inactiva
    if (!data.is_active) {
      Swal.fire(
        "Cuenta inactiva",
        "Tu cuenta aún no ha sido activada por un administrador.",
        "warning"
      );

      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      setIsActive(false);
      setProfile(data);
      setStatus("ready");
      return;
    }

    // ✅ Usuario válido y activo
    setRole(data.role);
    setIsActive(Boolean(data.is_active));
    setProfile(data);
    setError(null);
    setStatus("ready");
  }, []);

  // 🔹 Refrescar perfil manualmente
  const refreshProfile = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    await loadUser(sessionData?.session?.user ?? null);
  }, [loadUser]);

  // 🔹 Inicialización + listener de sesión
  useEffect(() => {
    let isSubscribed = true;

    const initialize = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!isSubscribed) return;
      await loadUser(sessionData?.session?.user ?? null);
    };

    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isSubscribed) return;

        // ⚙️ Evitar reload innecesario al refrescar token
        if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;

        // Solo recargar si hay un login/logout real
        loadUser(session?.user ?? null);
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
