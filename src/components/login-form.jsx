import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "../store/AuthStore";
import { supabase } from "../lib/supabaseClient";

export function LoginForm({ className, ...props }) {
  const navigate = useNavigate();
  const { loginGoogle } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (formData) => {
    try {
      const { data: authResponse, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError || !authResponse?.user) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Email o contrasena incorrectos",
        });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("name, role, state")
        .eq("id_auth", authResponse.user.id)
        .single();

      if (profileError || !profile) {
        Swal.fire({
          icon: "error",
          title: "Acceso denegado",
          text: "Tu cuenta no esta registrada en el sistema",
        });
        await supabase.auth.signOut();
        return;
      }

      if (!profile.state) {
        Swal.fire({
          icon: "warning",
          title: "Cuenta inactiva",
          text: "Tu cuenta esta deshabilitada, contacta al administrador",
        });
        await supabase.auth.signOut();
        return;
      }

      Swal.fire({
        icon: "success",
        title: profile.name ? `Bienvenido ${profile.name}` : "Bienvenido",
        text: "Accediste correctamente",
        timer: 2000,
        showConfirmButton: false,
      });

      const target = profile.role === "superadmin" ? "/dashboard" : "/unauthorized";
      navigate(target, { replace: true });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error inesperado",
        text: "Intenta de nuevo mas tarde",
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginGoogle();
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "No se pudo iniciar con Google",
        text: "Intenta de nuevo",
      });
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Bienvenido</h1>
                <p className="text-balance text-muted-foreground">
                  Inicia sesion en tu cuenta de Toexi-Tech.
                </p>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  autoComplete="email"
                  {...register("email", {
                    required: "El email es obligatorio",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Ingresa un email valido",
                    },
                  })}
                />
                {errors.email && (
                  <span className="text-sm text-red-500">{errors.email.message}</span>
                )}
              </div>

              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    Olvidaste tu contrasena?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register("password", {
                    required: "La contrasena es obligatoria",
                    minLength: {
                      value: 6,
                      message: "Debe tener al menos 6 caracteres",
                    },
                  })}
                />
                {errors.password && (
                  <span className="text-sm text-red-500">{errors.password.message}</span>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Ingresando..." : "Ingresar"}
              </Button>

              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-card px-2 text-muted-foreground">
                  O continua con
                </span>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleGoogleLogin}
                  variant="outline"
                  type="button"
                  className="w-full hover:bg-accent hover:text-accent-foreground"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="mr-2 h-5 w-5"
                  >
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  Ingresar con Google
                  <span className="sr-only">Login with Google</span>
                </Button>
              </div>
            </div>
          </form>

          <div className="relative hidden bg-muted md:block">
            <img
              src="/toexi.jpg"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>

      <div className="text-balance text-center text-xs text-muted-foreground *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary">
        Al hacer clic en continuar, aceptas nuestros <a href="#">Terminos de servicio</a> y <a href="#">Politica de privacidad</a>.
      </div>
    </div>
  );
}


