import { IconTool } from "@tabler/icons-react";

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <IconTool className="h-7 w-7" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          Sistema en mantenimiento
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          Estamos finalizando una migracion de inventario y ventas para evitar
          inconsistencias durante el proceso.
        </p>

        <div className="mt-6 rounded-xl border bg-muted/40 p-4 text-left text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Acceso temporalmente bloqueado</p>
          <p className="mt-2">
            No se pueden registrar ventas, compras ni modificaciones hasta que
            termine la actualizacion.
          </p>
          <p className="mt-2">
            Cuando el sistema vuelva a estar disponible, podran retomar la
            operacion normalmente.
          </p>
        </div>
      </div>
    </div>
  );
}
