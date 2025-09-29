import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthContextProvider, useAuth } from "./context/AuthContextProvider";

import DashboardLayout from "./components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import CatalogPage from "./pages/CatalogPage";
import Clients from "./pages/Clients";
import TeamPage from "./pages/TeamPage";
import LoginPage from "./pages/LoginPage";
import Orders from "./pages/Orders";

// --- Rutas protegidas usando el contexto ---
function ProtectedRoute({ children }) {
  const { user } = useAuth();         // 👈 Tomamos el usuario del contexto
  if (user === undefined) return <div>Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" />
      <AuthContextProvider>
        <Routes>
          {/* Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Dashboard y subrutas protegidas */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="catalog" element={<CatalogPage />} >
              <Route path="brands" element={<CatalogPage titulo="Marcas" />} />
              <Route path="categories" element={<CatalogPage titulo="Categorías" />} />
            </Route>
            <Route path="clients" element={<Clients />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="orders" element={<Orders />} />
          </Route>

          {/* Redirección por defecto */}
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthContextProvider>
    </>
  );
}
