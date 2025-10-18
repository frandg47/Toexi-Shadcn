import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";

const determineRedirect = (role) => {
  switch (role) {
    case "superadmin":
      return "/dashboard";
    case "seller":
      return "/seller/products";
    default:
      return "/unauthorized";
  }
};

const normalizeProfile = (profile) => {
  if (!profile) return null;
  // Ya no necesitamos buscar "state"
  return {
    ...profile,
    is_active: Boolean(profile.is_active),
  };
};

const buildResponse = (overrides = {}) => ({
  ok: false,
  icon: "info",
  title: "",
  text: "",
  redirectPath: null,
  role: null,
  ...overrides,
});

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: false,

  loginWithPassword: async (email, password) => {
    set({ loading: true });
    let response;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        response = buildResponse({
          icon: "error",
          title: "Error de autenticación",
          text:
            error.message ||
            "No pudimos iniciar sesión con las credenciales ingresadas.",
          redirectPath: "/login",
        });
      } else {
        response = await get().syncUser();
      }
    } catch (error) {
      response = buildResponse({
        icon: "error",
        title: "Error inesperado",
        text:
          error?.message ||
          "Ocurrió un problema al iniciar sesión. Por favor, intentá nuevamente.",
        redirectPath: "/login",
      });
    } finally {
      set({ loading: false });
    }

    return response;
  },

  loginWithGoogle: async () => {
    set({ loading: true });
    let response;
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          ...(redirectTo ? { redirectTo } : {}),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        response = buildResponse({
          icon: "error",
          title: "Error de redirección",
          text:
            error.message ||
            "No pudimos iniciar el proceso de autenticación con Google.",
          redirectPath: "/login",
        });
      } else {
        response = buildResponse({
          ok: true,
          icon: "info",
          title: "Redirigiendo",
          text: "Te estamos llevando a Google para completar el inicio de sesión.",
        });
      }
    } catch (error) {
      response = buildResponse({
        icon: "error",
        title: "Error inesperado",
        text:
          error?.message ||
          "Ocurrió un problema con la autenticación de Google.",
        redirectPath: "/login",
      });
    } finally {
      set({ loading: false });
    }

    return response;
  },

  syncUser: async () => {
    set({ loading: true });
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        set({ user: null, profile: null, loading: false });
        return buildResponse({
          icon: "error",
          title: "Sesión inválida",
          text: sessionError.message || "No se pudo recuperar la sesión actual.",
          redirectPath: "/login",
        });
      }

      const sessionUser = sessionData?.session?.user;

      if (!sessionUser) {
        set({ user: null, profile: null, loading: false });
        return buildResponse({
          icon: "error",
          title: "Sesión no encontrada",
          text: "Iniciá sesión nuevamente para continuar.",
          redirectPath: "/login",
        });
      }

      // 🧩 Selección sin 'state'
      let { data: profile, error: profileError } = await supabase
        .from("users")
        .select(
          "id, id_auth, name, last_name, email, role, is_active"
        )
        .eq("id_auth", sessionUser.id)
        .maybeSingle();

      if (profileError) {
        set({ user: null, profile: null, loading: false });
        return buildResponse({
          icon: "error",
          title: "Error al cargar el perfil",
          text:
            profileError.message ||
            "No se pudo obtener la información de tu cuenta.",
          redirectPath: "/login",
        });
      }

      let createdProfile = false;

      if (!profile) {
        const insertPayload = {
          id_auth: sessionUser.id,
          email: sessionUser.email,
          name:
            sessionUser.user_metadata?.full_name ||
            sessionUser.user_metadata?.name ||
            "",
          last_name: sessionUser.user_metadata?.last_name || "",
          role: "seller",
          is_active: false,
        };

        const { data: inserted, error: insertError } = await supabase
          .from("users")
          .insert(insertPayload)
          .select("id, id_auth, name, last_name, email, role, is_active")
          .maybeSingle();

        if (insertError) {
          set({ user: null, profile: null, loading: false });
          return buildResponse({
            icon: "error",
            title: "No se pudo registrar tu cuenta",
            text:
              insertError.message ||
              "Ocurrió un problema al crear tu perfil interno.",
            redirectPath: "/login",
          });
        }

        profile = inserted;
        createdProfile = true;
      }

      const normalizedProfile = normalizeProfile(profile);
      const fullName = [normalizedProfile.name, normalizedProfile.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!normalizedProfile.is_active) {
        await supabase.auth.signOut();
        set({ user: null, profile: normalizedProfile, loading: false });

        return buildResponse({
          icon: "info",
          title: createdProfile ? "Cuenta creada" : "Cuenta inactiva",
          text: createdProfile
            ? "Tu cuenta fue creada y un administrador deberá activarla antes de ingresar."
            : "Tu cuenta aún no ha sido activada por un administrador.",
          redirectPath: "/login?disabled=1",
          role: normalizedProfile.role,
        });
      }

      const redirectPath = determineRedirect(normalizedProfile.role);
      const ok = redirectPath !== "/unauthorized";

      set({
        user: sessionUser,
        profile: normalizedProfile,
        loading: false,
      });

      return buildResponse({
        ok,
        icon: ok ? "success" : "error",
        title: ok ? "Ingreso exitoso" : "Acceso no permitido",
        text: ok
          ? fullName
            ? `Bienvenido, ${fullName}.`
            : "Ingreso correcto."
          : "No tenés permisos para acceder a esta sección.",
        redirectPath,
        role: normalizedProfile.role,
      });
    } catch (error) {
      set({ loading: false });
      return buildResponse({
        icon: "error",
        title: "Error inesperado",
        text:
          error?.message ||
          "No se pudo validar tu sesión. Por favor, intentá nuevamente.",
        redirectPath: "/login",
      });
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await supabase.auth.signOut();
    } finally {
      set({ user: null, profile: null, loading: false });
    }

    return buildResponse({
      ok: true,
      icon: "info",
      title: "Sesión cerrada",
      text: "Cerraste sesión correctamente.",
      redirectPath: "/login",
    });
  },
}));
