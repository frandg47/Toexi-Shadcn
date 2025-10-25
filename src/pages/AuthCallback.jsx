import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Loader from "@/components/ui/loading";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/AuthStore";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { syncUser } = useAuthStore();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const verifySession = async () => {
      let redirectPath = "/login";

      try {
        let sessionUser = null;
        let retries = 0;

        // 🕒 Esperar hasta 10 veces (4 segundos total) a que Supabase guarde la sesión
        while (retries < 10 && !sessionUser) {
          const { data: sessionData } = await supabase.auth.getSession();
          sessionUser = sessionData?.session?.user;
          if (!sessionUser) {
            await new Promise((r) => setTimeout(r, 400));
            retries++;
          }
        }

        // 🚨 Si sigue sin sesión → intentar refresh forzado
        if (!sessionUser) {
          console.warn(
            "⚠️ Sesión aún no disponible, intentando refresh manual..."
          );
          const { data: refreshed } = await supabase.auth.refreshSession();
          sessionUser = refreshed?.session?.user;
        }

        // ❌ Si aún no hay sesión → abortar
        if (!sessionUser) {
          toast.error("Error de autenticación", {
            description:
              "No pudimos recuperar tu sesión. Por favor, intentá iniciar sesión nuevamente.",
            duration: 5000,
          });
          navigate("/login", { replace: true });
          return;
        }

        // ✅ Si hay sesión → sincronizar usuario en BD
        const result = await syncUser();

        const toastFunction =
          result?.icon === "error" || !result?.ok
            ? toast.error
            : result?.icon === "warning" || result?.icon === "info"
            ? toast.warning
            : toast.success;

        toastFunction(result?.title ?? "Sesión verificada", {
          description: result?.text ?? "",
          duration: 4000,
        });

        redirectPath = result?.redirectPath ?? "/";
      } catch (error) {
        console.error("💥 Error en AuthCallback:", error);
        toast.error("Error inesperado", {
          description: "Ocurrió un problema al verificar la sesión.",
          duration: 5000,
        });
        redirectPath = "/login";
      } finally {
        navigate(redirectPath, { replace: true });
      }
    };

    verifySession();
  }, [syncUser, navigate]);

  return <Loader message="Verificando sesión..." />;
}
