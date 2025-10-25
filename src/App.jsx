import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthContextProvider, useAuth } from "./context/AuthContextProvider";

import DashboardLayout from "./components/layout/DashboardLayout";
import SellerLayout from "./components/layout/SellerLayout";

import Dashboard from "./pages/Dashboard";
import FallbackRedirect from "@/components/FallbackRedirect";
import Products from "./pages/Products";
import CatalogPage from "./pages/CatalogPage";
import Clients from "./pages/Clients";
import TeamPage from "./pages/TeamPage";
import LoginPage from "./pages/LoginPage";
import Orders from "./pages/Orders";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import ConcentricLoader from "./components/ui/loading";
import ConfigurationPage from "./pages/ConfigurationPage";
import AuthCallback from "./pages/AuthCallback";

// ⚙️ Configuración
import ComissionConfig from "./pages/config/ComissionConfig";
import FxRatesConfig from "./pages/config/FxRatesConfig";
import PaymentMethodsConfig from "./pages/config/PaymentMethodsConfig";
import InventoryConfig from "./pages/config/InventoryConfig";
import SalesConfig from "./pages/config/SalesConfig";

// 🔒 COMPONENTE DE RUTA PROTEGIDA
function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { user, role, isActive, status } = useAuth();

  // 🔍 Mostrar loader solo mientras se verifica sesión por primera vez
  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <ConcentricLoader />
      </div>
    );
  }

  // 🔐 Si no hay usuario autenticado (una vez que terminó de cargar)
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 🚫 Si el usuario está deshabilitado
  if (!isActive) {
    return <Navigate to="/login?disabled=1" replace />;
  }

  // 🎭 Normalizar rol
  const normalizedRole = role?.toLowerCase();

  // 🚷 Si el rol no tiene permiso
  if (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(normalizedRole)
  ) {
    // Si es vendedor e intenta entrar al dashboard → redirigir a su panel
    if (normalizedRole === "seller") {
      return <Navigate to="/seller/products" replace />;
    }

    // Caso contrario → página de no autorizado
    return <Navigate to="/unauthorized" replace />;
  }

  // ✅ Si todo está bien, renderizar el contenido
  return children;
}

// 🧭 APP PRINCIPAL
export default function App() {
  return (
    <>
      <Toaster position="top-center" />
      <AuthContextProvider>
        <Routes>
          {/* 🔓 PÁGINAS PÚBLICAS */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* 🧭 DASHBOARD (solo superadmin) */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* 🧩 RUTAS INTERNAS DEL DASHBOARD */}
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="catalog/brands" element={<CatalogPage />} />
            <Route path="catalog/categories" element={<CatalogPage />} />
            <Route path="clients" element={<Clients />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="orders" element={<Orders />} />

            {/* ⚙️ CONFIGURACIONES */}
            <Route
              path="settings"
              element={<ConfigurationPage titulo="Configuraciones" />}
            />
            <Route path="settings/comission" element={<ComissionConfig />} />
            <Route path="settings/fx-rates" element={<FxRatesConfig />} />
            <Route
              path="settings/payment-methods"
              element={<PaymentMethodsConfig />}
            />
            <Route path="settings/inventory" element={<InventoryConfig />} />
            <Route path="settings/sales" element={<SalesConfig />} />
          </Route>

          {/* 🛍️ VISTA DE VENDEDORES */}
          <Route
            path="/seller/*"
            element={
              <ProtectedRoute allowedRoles={["seller", "superadmin"]}>
                <SellerLayout />
              </ProtectedRoute>
            }
          >
            <Route path="products" element={<Products />} />
            {/* Agregá más rutas específicas del vendedor aquí */}
          </Route>

          {/* 🚪 RUTA POR DEFECTO */}
          <Route path="*" element={<FallbackRedirect />} />
        </Routes>
      </AuthContextProvider>
    </>
  );
}
