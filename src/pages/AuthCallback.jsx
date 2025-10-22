import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
// ❌ ELIMINADO: import Swal from "sweetalert2";
// ✅ AGREGADO: Sonner para notificaciones
import { toast } from "sonner";

import Loader from "@/components/ui/loading";
import { useAuthStore } from "@/store/AuthStore";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { syncUser } = useAuthStore();
  const hasRun = useRef(false);

  useEffect(() => {
    // Evita que el efecto se ejecute dos veces en Strict Mode
    if (hasRun.current) return;
    hasRun.current = true;

    const verifySession = async () => {
      let redirectPath = "/login"; // Ruta por defecto para manejar errores

      try {
        const result = await syncUser();
        
        // Determinar el mensaje de notificación basado en el resultado
        const title =
          result?.title ??
          (result?.ok ? "Sesión verificada" : "No se pudo validar tu sesión");
        const text = result?.text ?? "";
        
        // Determinar la función de toast
        const toastFunction = result?.icon === "error" || !result?.ok 
            ? toast.error 
            : result?.icon === "warning" || result?.icon === "info" 
            ? toast.warning
            : toast.success;

        // Mostrar la notificación con Sonner (no bloqueante)
        toastFunction(title, {
            description: text,
            duration: 3500, // Duración para que el usuario pueda leer
        });

        // Establecer la ruta de redirección
        redirectPath = result?.redirectPath ?? "/"; 
        
      } catch (error) {
        console.error("Error en AuthCallback:", error);
        
        // Mostrar notificación de error inesperado
        toast.error("Error inesperado", {
          description: "Ocurrió un problema al verificar la sesión.",
          duration: 5000,
        });
        
        // Mantener la ruta de redirección por defecto ('/login') en caso de error
        redirectPath = "/login";

      } finally {
        // Navegar inmediatamente, sin esperar el toast
        navigate(redirectPath, { replace: true });
      }
    };

    verifySession();
  }, [syncUser, navigate]);

  return <Loader message="Verificando sesión..." />;
}