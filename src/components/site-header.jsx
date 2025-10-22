import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Componente de cabecera reutilizable
 *
 * @param {string} titulo - Título a mostrar en la barra
 * @param {ReactNode} actions - Botones, search bar u otros elementos a la derecha
 */
export function SiteHeader({ titulo, actions }) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 mb-1">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{titulo}</h1>

        {/* Contenido dinámico a la derecha */}
        <div className="ml-auto flex items-center gap-2">
          {actions}
        </div>
      </div>
    </header>
  );
}
