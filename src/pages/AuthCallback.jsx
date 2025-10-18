import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import Loader from "@/components/ui/loading";
import { useAuthStore } from "@/store/AuthStore";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { syncUser } = useAuthStore();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const verifySession = async () => {
      try {
        const result = await syncUser();
        const icon = result?.icon ?? (result?.ok ? "success" : "error");
        const title =
          result?.title ??
          (result?.ok ? "Sesión verificada" : "No se pudo validar tu sesión");
        const text = result?.text ?? "";

        await Swal.fire({
          icon,
          title,
          text,
          timer: 1600,
          showConfirmButton: !result?.ok,
        });

        navigate(result?.redirectPath ?? "/login", { replace: true });
      } catch (error) {
        console.error(error);
        await Swal.fire({
          icon: "error",
          title: "Error inesperado",
          text: "Ocurrió un problema al verificar la sesión.",
        });
        navigate("/login", { replace: true });
      }
    };

    verifySession();
  }, [syncUser, navigate]);

  return <Loader message="Verificando sesión..." />;
}
