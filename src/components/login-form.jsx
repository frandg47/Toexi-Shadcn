import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";

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

  const showResultAlert = async (result, overrides = {}) => {
    if (!result) return;

    const icon = result.icon ?? (result.ok ? "success" : "info");
    const title = result.title ?? "";
    const text = result.text ?? "";

    if (title || text) {
      await Swal.fire({
        icon,
        title,
        text,
        ...overrides,
      });
    }

    if (result.redirectPath) {
      navigate(result.redirectPath, { replace: true });
    }
  };

  const onSubmit = async (values) => {
    const result = await loginWithPassword(values.email, values.password);
    await showResultAlert(result);
  };

  const handleGoogleLogin = async () => {
    const result = await loginWithGoogle();
    if (!result) return;

    const override =
      result.ok && !result.redirectPath
        ? { timer: 1600, showConfirmButton: false }
        : undefined;

    await showResultAlert(result, override);
  };

  return (
    <Card className={cn("w-full max-w-md", className)} {...props}>
      <CardContent className="space-y-6 pt-6">
        <form
          className="space-y-4"
          onSubmit={handleSubmit(onSubmit)}
          disabled={isSubmitting || loading}
        >
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="correo@empresa.com"
              {...register("email", {
                required: "El email es obligatorio",
              })}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password", {
                required: "La contraseña es obligatoria",
              })}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || loading}
          >
            {loading || isSubmitting ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              O continúa con
            </span>
          </div>
        </div>

        {/* Google Login */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={loading || isSubmitting}
        >
          Ingresar con Google
        </Button>
      </CardContent>
    </Card>
  );
}
