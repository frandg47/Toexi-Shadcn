// src/components/layout/SellerLayout.jsx
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { IconLogout, IconDotsVertical } from "@tabler/icons-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContextProvider";
import { Outlet } from "react-router-dom";

export default function SellerLayout() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // 🔹 Unificamos la info del usuario (Auth + Profile)
  const displayUser = user
    ? {
        name:
          profile?.name ||
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          "Usuario",
        email: user.email || profile?.email || "sin-email",
        role: profile?.role || "seller",
        avatar:
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          "/avatars/default.jpg",
      }
    : {
        name: "Cargando…",
        email: "",
        role: "seller",
        avatar: "/avatars/default.jpg",
      };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 🔹 Header sin dependencia del SidebarProvider */}
      <header className="flex items-center justify-between bg-white shadow px-6 py-3 border-b">
        <h1 className="text-xl font-semibold text-gray-800">
          Bienvenido/a {displayUser.name}
          <span className="ml-2 text-gray-500 text-sm">
            ({displayUser.role === "seller" ? "Vendedor" : "Admin"})
          </span>
        </h1>

        {/* 🔹 Menú del usuario */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md border px-3 py-1.5 hover:bg-muted transition text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={displayUser.avatar} alt={displayUser.name} />
                <AvatarFallback className="rounded-lg">
                  {displayUser.name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col text-left">
                <span className="font-medium leading-none">
                  {displayUser.name}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {displayUser.email}
                </span>
              </div>
              <IconDotsVertical className="ml-2 h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleLogout}>
              <IconLogout className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* 🔹 Contenido */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
