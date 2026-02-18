// src/pages/AuthCallback.jsx

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Loader from "@/components/ui/loading";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/AuthStore";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { syncUser } = useAuthStore();
  const hasRun = useRef(false);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [backendMessage, setBackendMessage] = useState("");

  const isNetworkError = (error) => {
    const message = `${error?.message || ""}`.toLowerCase();
    return (
      error?.name === "TypeError" ||
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("err_name_not_resolved")
    );
  };

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const verifySession = async () => {
      let shouldNavigate = true;
      let redirectPath = "/login";

      try {
        let sessionUser = null;
        let retries = 0;

        // 🕒 Esperar hasta 10 veces (4 segundos total)
        while (retries < 10 && !sessionUser) {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError && isNetworkError(sessionError)) {
            setBackendUnavailable(true);
            setBackendMessage(
              "Estamos con problemas temporales en el servidor. Por favor, intenta nuevamente en unos minutos."
            );
            shouldNavigate = false;
            return;
          }
          sessionUser = sessionData?.session?.user;

          if (!sessionUser) {
            await new Promise((r) => setTimeout(r, 400));
            retries++;
          }
        }

        // 🚨 Última oportunidad: refresh manual
        if (!sessionUser) {
          console.warn("⚠️ Sesión aún no disponible, intentando refresh manual...");
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError && isNetworkError(refreshError)) {
            setBackendUnavailable(true);
            setBackendMessage(
              "Estamos con problemas temporales en el servidor. Por favor, intenta nuevamente en unos minutos."
            );
            shouldNavigate = false;
            return;
          }
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
        if (isNetworkError(error)) {
          setBackendUnavailable(true);
          setBackendMessage(
            "Estamos con problemas temporales en el servidor. Por favor, intenta nuevamente en unos minutos."
          );
          shouldNavigate = false;
          return;
        }
        console.error("💥 Error en AuthCallback:", error);
        toast.error("Error inesperado", {
          description: "Ocurrió un problema al verificar la sesión.",
          duration: 5000,
        });
        redirectPath = "/login";
      } finally {
        if (shouldNavigate) {
          navigate(redirectPath, { replace: true });
        }
      }
    };

    verifySession();
  }, [syncUser, navigate]);

  if (backendUnavailable) {
    return (
      <Loader
        message={
          backendMessage ||
          "Servidor temporalmente inestable. IntentÇ¡ nuevamente en unos minutos."
        }
      />
    );
  }

  return <Loader message="Verificando sesión..." />;
}
