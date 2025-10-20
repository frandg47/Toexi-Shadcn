import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { IconCirclePlusFilled, IconChevronDown, IconInfoCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function NavMain({ items }) {
  const navigate = useNavigate();

  const showDevelopmentToast = (feature) => {
    toast("Funcionalidad en desarrollo", {
      description: `El módulo de ${feature} estará disponible próximamente.`,
      icon: <IconInfoCircle className="h-5 w-5 text-blue-500" />,
      duration: 3000,
    });
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {/* Botón Nueva venta */}
        <SidebarMenu>
          <SidebarMenuItem>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                showDevelopmentToast("Nueva venta");
                navigate("/dashboard");
              }}
            >
              <IconCirclePlusFilled className="mr-2 h-5 w-5" />
              Nueva venta
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Links de navegación */}
        <SidebarMenu>
          {items.map((item) =>
            item.items ? (
              <DropMenu key={item.title} item={item} />
            ) : (
              <SidebarMenuItem key={item.title}>
                <NavLink
                  to={item.url}
                  end={true}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors
                     ${
                       isActive && !item.onClick
                         ? "bg-primary text-primary-foreground shadow-sm"
                         : "hover:bg-muted hover:text-foreground"
                     }`
                  }
                >
                  {item.icon && <item.icon className="h-5 w-5" />}
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/* --- Subcomponente para dropdown --- */
function DropMenu({ item }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Verificar si alguna subruta coincide con la ruta actual
  const isAnyChildActive = item.items.some(
    (sub) => location.pathname === sub.url
  );

  return (
    <SidebarMenuItem className="flex flex-col">
      {/* Botón padre con el mismo estilo que un NavLink */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors
          ${
            open || isAnyChildActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "hover:bg-muted hover:text-foreground"
          }`}
      >
        <span className="flex items-center gap-2">
          {item.icon && <item.icon className="h-5 w-5" />}
          {item.title}
        </span>
        <IconChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Submenú desplegable */}
      {open && (
        <SidebarMenu className="pl-3 mt-1 flex flex-col gap-1 overflow-x-hidden w-[calc(100%-0.75rem)]">
          {item.items.map((sub) => (
            <SidebarMenuItem key={sub.title}>
              <NavLink
                to={sub.url}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors
                   ${
                     isActive
                       ? "bg-primary text-primary-foreground"
                       : "hover:bg-muted hover:text-foreground"
                   }`
                }
              >
                {sub.icon && <sub.icon className="h-4 w-4" />}
                {sub.title}
              </NavLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  );
}
