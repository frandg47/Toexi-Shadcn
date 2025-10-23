import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
// ❌ ELIMINADO: import Swal from "sweetalert2";
// ✅ AGREGADO: Sonner para notificaciones
import { toast } from "sonner";

import Loader from "@/components/ui/loading";
import { useAuthStore } from "@/store/AuthStore";
import { supabase } from "@/lib/supabaseClient";

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
        // 🕒 Esperar hasta que Supabase tenga la sesión activa
        let retries = 0;
        let sessionUser = null;
        while (retries < 3 && !sessionUser) {
          const { data: sessionData } = await supabase.auth.getSession();
          sessionUser = sessionData?.session?.user;
          if (!sessionUser) {
            await new Promise((r) => setTimeout(r, 300));
            retries++;
          }
        }

        // Ahora sí, ejecutar syncUser
        const result = await syncUser();
        const toastFunction =
          result?.icon === "error" || !result?.ok
            ? toast.error
            : result?.icon === "warning" || result?.icon === "info"
            ? toast.warning
            : toast.success;

        toastFunction(result?.title ?? "Sesión verificada", {
          description: result?.text ?? "",
          duration: 3500,
        });

        redirectPath = result?.redirectPath ?? "/";
      } catch (error) {
        console.error("Error en AuthCallback:", error);
        toast.error("Error inesperado", {
          description:
            error.message || "Ocurrió un problema al verificar la sesión.",
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
