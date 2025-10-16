import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import Swal from "sweetalert2";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role, state, name")
        .eq("id_auth", user.id)
        .single();

      if (!profile) {
        Swal.fire("Error", "Tu cuenta no está registrada", "error");
        await supabase.auth.signOut();
        navigate("/login");
        return;
      }

      if (!profile.state) {
        Swal.fire("Cuenta inactiva", "Contacta al administrador", "warning");
        await supabase.auth.signOut();
        navigate("/login");
        return;
      }

      Swal.fire({
        icon: "success",
        title: `Bienvenido ${profile.name}`,
        timer: 1500,
        showConfirmButton: false,
      });

      const target =
        profile.role === "superadmin"
          ? "/dashboard"
          : profile.role === "seller"
          ? "/products"
          : "/unauthorized";

      navigate(target, { replace: true });
    };

    handleAuth();
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center text-lg">
      Verificando cuenta...
    </div>
  );
}
