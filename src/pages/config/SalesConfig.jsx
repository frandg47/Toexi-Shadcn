
import { SiteHeader } from "@/components/site-header";
import { SalesList } from "@/components/SalesList";

const SalesConfig = () => {
  return (
    <>
      <SiteHeader titulo="Configuración de Ventas" />
      <div className="mt-6 h-screen">
        <SalesList />
      </div>
    </>
  );
};

export default SalesConfig;
