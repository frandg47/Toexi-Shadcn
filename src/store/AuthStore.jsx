import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import Swal from "sweetalert2";

export const useAuthStore = create((set) => ({
  user: null, // Datos de auth
  profile: null, // Datos de tu tabla users
  loading: false,

  // 🔹 Login con Google
  loginGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  },

  // 🔹 Sincronizar perfil después del login
  syncUser: async () => {
    set({ loading: true });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      set({ user: null, profile: null, loading: false });
      return;
    }

    // Buscar en tu tabla "users" por id_auth
    const { data: existing, error: selectError } = await supabase
      .from("users")
      .select("id, name, last_name, email, role, is_active")
      .eq("id_auth", user.id)
      .maybeSingle();

    // Si no existe → crear nuevo registro base
    if (!existing) {
      const { error: insertError } = await supabase.from("users").insert([
        {
          id_auth: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || "",
          email: user.email,
          role: "seller",
          is_active: false, // por defecto inactivo
        },
      ]);

      if (insertError) {
        console.error(insertError);
      }

      Swal.fire(
        "Cuenta pendiente",
        "Tu cuenta fue registrada y deberá ser activada por un administrador.",
        "info"
      );

      await supabase.auth.signOut();
      set({ user: null, profile: null, loading: false });
      return;
    }

    // Si existe pero no está activo → bloquear acceso
    if (!existing.is_active) {
      Swal.fire(
        "Cuenta inactiva",
        "Tu cuenta aún no ha sido activada por un administrador.",
        "warning"
      );

      await supabase.auth.signOut();
      set({ user: null, profile: null, loading: false });
      return;
    }

    // Si está activo, guardar usuario + perfil
    set({ user, profile: existing, loading: false });
    return existing;
  },

  // 🔹 Logout
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },
}));
