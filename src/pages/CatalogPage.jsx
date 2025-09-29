import { useLocation } from "react-router-dom";
import { SiteHeader } from "@/components/site-header";
import CatalogTable from "../components/CatalogTable";

export default function CatalogPage() {
  const { pathname } = useLocation();

  let tipo = "all";
  if (pathname.endsWith("/catalog/brands")) tipo = "brands";
  else if (pathname.endsWith("/catalog/categories")) tipo = "categories";

  return (
    <>
      <SiteHeader
        titulo={
          tipo === "brands"
            ? "Marcas"
            : tipo === "categories"
            ? "Categorías"
            : "Catálogo"
        }
      />
      <CatalogTable tipo={tipo} />
    </>
  );
}
