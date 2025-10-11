import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import UnauthorizedPage from "./pages/UnauthorizedPage";
import ConcentricLoader from "./components/ui/loading";
import ConfigurationPage from "./pages/ConfigurationPage";

// 🧩 Configuración
import ComissionConfig from "./pages/config/ComissionConfig";
import FxRatesConfig from "./pages/config/FxRatesConfig";
import PaymentMethodsConfig from "./pages/config/PaymentMethodsConfig";
import InventoryConfig from "./pages/config/InventoryConfig";
import SalesConfig from "./pages/config/SalesConfig";

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { user, role, isActive, status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <ConcentricLoader />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isActive) {
    return <Navigate to="/login?disabled=1" replace />;
  }

  if (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(role)
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" />
      <AuthContextProvider>
        <Routes>
          {/* 🔐 Páginas públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* 🧭 Dashboard protegido */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* 📊 Rutas principales */}
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="catalog/brands" element={<CatalogPage />} />
            <Route path="catalog/categories" element={<CatalogPage />} />
            <Route path="clients" element={<Clients />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="orders" element={<Orders />} />

            {/* ⚙️ Configuraciones */}
            <Route path="settings" element={<ConfigurationPage titulo="Configuraciones" />} />
            <Route path="settings/comission" element={<ComissionConfig />} />
            <Route path="settings/fx-rates" element={<FxRatesConfig />} />
            <Route path="settings/payment-methods" element={<PaymentMethodsConfig />} />
            <Route path="settings/inventory" element={<InventoryConfig />} />
            <Route path="settings/sales" element={<SalesConfig />} />
          </Route>

          {/* 🚪 Redirección para rutas no válidas */}
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
