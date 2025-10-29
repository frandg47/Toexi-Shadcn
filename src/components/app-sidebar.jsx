import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContextProvider";

export default function AppSidebar({
  navMain = [],
  navSecondary = [],
  title = "Toexi Tech",
  actionButtonLabel,
  onActionClick,
}) {
  const { user, profile } = useAuth();

  console.log("object AppSidebar -> user, profile", user, profile);

  const displayUser =
    user || profile
      ? {
          id: profile?.id || "",
          name:
            profile?.name ||
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            "Usuario",
          email: profile?.email || user?.email || "",
          avatar:
            user?.user_metadata?.avatar_url ||
            user?.user_metadata?.picture ||
            "/avatars/default.jpg",
          role: profile?.role || "",
        }
      : {
          name: "Cargando…",
          email: "",
          avatar: "/avatars/default.jpg",
        };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <span className="text-xl font-bold">{title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={navMain}
          actionButtonLabel={actionButtonLabel}
          onActionClick={onActionClick}
        />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={displayUser} />
      </SidebarFooter>
    </Sidebar>
  );
}
