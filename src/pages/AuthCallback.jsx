// src/pages/AuthCallback.jsx

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

        // 🕒 Esperar hasta 10 veces (4 segundos total)
        while (retries < 10 && !sessionUser) {
          const { data: sessionData } = await supabase.auth.getSession();
          sessionUser = sessionData?.session?.user;

          if (!sessionUser) {
            await new Promise((r) => setTimeout(r, 400));
            retries++;
          }
        }

        // 🚨 Última oportunidad: refresh manual
        if (!sessionUser) {
          console.warn("⚠️ Sesión aún no disponible, intentando refresh manual...");
          const { data: refreshed } = await supabase.auth.refreshSession();
          sessionUser = refreshed?.session?.user;
        }

        // ❌ Si todavía no hay sesión → abortar
        if (!sessionUser) {
          toast.error("Error de autenticación", {
            description:
              "No pudimos recuperar tu sesión. Por favor, intentá iniciar sesión nuevamente.",
            duration: 5000,
          });
          navigate("/login", { replace: true });
          return;
        }

        // ==========================================================
        // 🔥 CLONAR AVATAR CON EDGE FUNCTION "bright-responder"
        // ==========================================================
        try {
          const avatar = sessionUser.user_metadata?.picture;
          const user_id = sessionUser.id;

          if (avatar) {
            // console.log("🔄 Clonando avatar desde Google...", avatar);

            await supabase.functions.invoke("bright-responder", {
              body: {
                user_id,
                avatar_url: avatar,
              },
            });

            // console.log("✅ Avatar clonado correctamente.");
          }
        } catch (err) {
          console.error("⚠️ Error clonando avatar:", err);
          // No hacer toast, no es crítico
        }
        // ==========================================================

        // 🔄 Sincronizar datos del usuario en tu BD
        const result = await syncUser();

        const toastFn =
          result?.icon === "error" || !result?.ok
            ? toast.error
            : result?.icon === "warning" || result?.icon === "info"
            ? toast.warning
            : toast.success;

        toastFn(result?.title ?? "Sesión verificada", {
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
