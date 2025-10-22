import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
// ❌ ELIMINADO: import Swal from "sweetalert2";

// ✅ AGREGADO: Sonner para notificaciones
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/AuthStore";

export default function LoginForm({ className, ...props }) {
  const navigate = useNavigate();
  const { loginWithPassword, loginWithGoogle, loading } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { email: "", password: "" },
  });

  // 🔄 REEMPLAZO 1: Migrar la lógica de SweetAlert a Sonner (toast)
  const showResultAlert = (result, overrides = {}) => {
    if (!result) return;

    // Determinar el tipo de toast (success, error, info)
    const toastType = result.icon ?? (result.ok ? "success" : "error"); // Asumimos 'error' si no es 'success' y falla
    const title = result.title ?? "";
    const text = result.text ?? "";

    if (title || text) {
      // Configurar las opciones de Sonner
      const toastOptions = {
        duration: overrides.timer || 4000,
        description: text,
      };

      // Mostrar el toast
      if (toastType === "success") {
        toast.success(title, toastOptions);
      } else if (toastType === "error") {
        toast.error(title, toastOptions);
      } else {
        // Usar toast.info o un valor predeterminado para otros íconos (como 'info')
        toast.info(title, toastOptions);
      }
    }

    if (result.redirectPath) {
      // Usamos setTimeout para dar tiempo a que el toast se muestre
      // especialmente si se usó un timer corto (e.g., para un login exitoso).
      const delay = overrides.timer || 0;
      setTimeout(() => {
        navigate(result.redirectPath, { replace: true });
      }, delay + 50);
    }
  };
  // FIN REEMPLAZO 1

  const onSubmit = async (values) => {
    // Nota: El uso de `await` con `showResultAlert` ya no es estrictamente necesario,
    // ya que toast es asíncrono pero no bloqueante como lo era `Swal.fire`.
    const result = await loginWithPassword(values.email, values.password);
    showResultAlert(result);
  };

  const handleGoogleLogin = async () => {
    const result = await loginWithGoogle();
    if (!result) return;

    // Si el login fue exitoso y no hay una redirección inmediata, establecemos un temporizador corto
    // (similar a la lógica de Swal.fire con timer).
    const override =
      result.ok && !result.redirectPath ? { timer: 1600 } : undefined;

    showResultAlert(result, override);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 shadow-md">
        <CardContent className="grid p-0  md:grid-cols-2">
          {/* 🔹 FORMULARIO */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col justify-center md:p-8 md:py-16 space-y-6"
          >
            <div className="flex flex-col items-center text-center">
              <h1 className="text-2xl font-bold">Bienvenido</h1>
              <p className="text-balance text-muted-foreground">
                Inicia sesión con tu cuenta de Google.
              </p>
            </div>
            {/* 
            {/* Email }
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
                    message: "Ingresa un email válido",
                  },
                })}
              />
              {errors.email && (
                <span className="text-sm text-red-500">
                  {errors.email.message}
                </span>
              )}
            </div>

            {/* Password 
            <div className="grid gap-3">
              <div className="flex items-center">
                <Label htmlFor="password">Contraseña</Label>
                <a
                  href="#"
                  className="ml-auto text-sm underline-offset-2 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password", {
                  required: "La contraseña es obligatoria",
                  minLength: {
                    value: 6,
                    message: "Debe tener al menos 6 caracteres",
                  },
                })}
              />
              {errors.password && (
                <span className="text-sm text-red-500">
                  {errors.password.message}
                </span>
              )}
            </div>

            {/* Botón 
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || loading}
            >
              {loading || isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>

            {/* Divider 
            <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
              <span className="relative z-10 bg-card px-2 text-muted-foreground">
                O continúa con
              </span>
            </div> */}

            {/* Google */}
            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              type="button"
              className="w-full hover:bg-accent hover:text-accent-foreground"
              disabled={loading || isSubmitting}
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
               <Separator className="w-full" />

          <p className="text-xs text-muted-foreground text-center">
            Tu información se mantiene segura.  
            Solo utilizamos tu cuenta para autenticarte.
          </p>
          </form>

          {/* 🔹 Imagen lateral */}
          <div className="relative hidden bg-muted md:block">
            <img
              src="/toexi.jpg"
              alt="Toexi Login"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
          
       
        </CardContent>
      </Card>

      {/* 🔹 Footer */}
      <div className="text-balance text-center text-xs text-muted-foreground *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary">
        Al hacer clic en continuar, aceptas nuestros{" "}
        <a href="#">Términos de servicio</a> y{" "}
        <a href="#">Política de privacidad</a>.
      </div>
    </div>
  );
}
