import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";

import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import CatalogPage from "./pages/CatalogPage";
import Clients from "./pages/Clients";
import Users from "./pages/Users";
import LoginPage from "./pages/LoginPage";
import Orders from "./pages/Orders";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          {/* 👇 Ruta index: cuando entres a /dashboard muestra Dashboard */}
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="clients" element={<Clients />} />
          <Route path="users" element={<Users />} />
          <Route path="orders" element={<Orders />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
