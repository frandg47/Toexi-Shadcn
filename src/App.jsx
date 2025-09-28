import {
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import DashboardLayout from "./components/layout/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";

import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import CatalogPage from "./pages/CatalogPage";
import Clients from "./pages/Clients";
import TeamPage from "./pages/TeamPage";
import LoginPage from "./pages/LoginPage";
import Orders from "./pages/Orders";
import { supabase } from "./lib/supabaseClient";

// --- Componente para rutas protegidas ---
function ProtectedRoute({ user, children }) {
  if (user === undefined) return <div>Loading...</div>; // espera al user
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

const App = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);

  // --- Captura token de Supabase del hash ---
  useEffect(() => {
    const handleSessionFromHash = async () => {
      if (window.location.hash) {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token"); // también necesitamos esto

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          const {
            data: { user },
          } = await supabase.auth.getUser();

          console.log("user", user); // ahora sí lo vas a ver
          setUser(user);
          navigate("/dashboard", { replace: true });

          // limpiar hash solo después de todo
          window.history.replaceState(null, "", "/");
          return;
        }
      }

      // Si ya hay sesión activa
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) setUser(user);
      else setUser(null); // marca como no logueado
    };

    handleSessionFromHash();
  }, [navigate]);

  return (
    <>
      <Toaster position="top-center" />
      <Routes>
        {/* Login */}
        <Route path="/login" element={<LoginPage setUser={setUser} />} />

        {/* Dashboard y subrutas protegidas */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute user={user}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="clients" element={<Clients />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="orders" element={<Orders />} />
        </Route>

        {/* Redirección por defecto */}
        <Route
          path="*"
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </>
  );
};

export default App;
