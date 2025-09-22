import { NavLink } from "react-router-dom";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { IconCirclePlusFilled } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export function NavMain({ items }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {/* Botón Nueva venta (opcional) */}
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              variant="outline"
              className="w-full justify-start"
            >
              <IconCirclePlusFilled className="mr-2 h-5 w-5" />
              Nueva venta
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Links de navegación */}
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <NavLink
                to={item.url}
                end={item.url === "/dashboard"}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors
         ${
           isActive
             ? "bg-primary text-primary-foreground shadow-sm"
             : "hover:bg-muted hover:text-foreground"
         }`
                }
              >
                {item.icon && <item.icon className="h-5 w-5" />}
                <span>{item.title}</span>
              </NavLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
