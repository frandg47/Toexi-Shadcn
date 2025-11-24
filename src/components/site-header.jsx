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
    <header
      className="
        sticky top-0 z-40 
        flex h-16
        shrink-0 items-center gap-2 border-b 
        bg-green-700/90 md:bg-white/90 backdrop-blur-sm
        transition-[width,height] ease-linear
      "
    >
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 mb-1">
        <SidebarTrigger className="-ml-1 text-white md:text-black/90" />

        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />

        <h1 className="text-base text-white md:text-black/90 font-medium">{titulo}</h1>

        <div className="ml-auto flex items-center gap-2">
          {actions}
        </div>
      </div>
    </header>
  );
}

