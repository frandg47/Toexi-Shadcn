import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "../lib/supabaseClient";
import Swal from "sweetalert2";

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const [user, setUser] = useState(undefined); // undefined = cargando
  const [role, setRole] = useState(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      // 1️⃣ Sesión inicial
      const { data: sessionData } = await supabase.auth.getSession();
      const userSession = sessionData?.session?.user ?? null;

      if (!userSession) {
        setUser(null);
        return;
      }

      setUser(userSession);

      // 2️⃣ Traer info adicional desde tabla "users" (usar "state")
      const { data: userData, error } = await supabase
        .from("users")
        .select("role,state")
        .eq("email", userSession.email)
        .single();

      if (
        error ||
        !userData ||
        !userData.state ||
        userData.role !== "superadmin"
      ) {
        Swal.fire({
          icon: "error",
          title: "Acceso denegado",
          text: "No tienes permisos para acceder a esta aplicación",
          confirmButtonText: "Aceptar",
        });

        await supabase.auth.signOut();
        setUser(null);
        return;
      }

      setRole(userData.role);
      setIsActive(userData.state);
    };

    fetchUserData();

    // Escuchar cambios de auth
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session?.user) {
          setUser(null);
          setRole(null);
          setIsActive(false);
          return;
        }

        const { data: userData, error } = await supabase
          .from("users")
          .select("role,state")
          .eq("email", session.user.email)
          .single();

        if (
          error ||
          !userData ||
          !userData.state ||
          userData.role !== "superadmin"
        ) {
          await supabase.auth.signOut();
          setUser(null);
          setRole(null);
          setIsActive(false);
          return;
        }

        setUser(session.user);
        setRole(userData.role);
        setIsActive(userData.state);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, isActive }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
