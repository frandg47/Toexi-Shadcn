import { SiteHeader } from "@/components/site-header";
import ProductsTable from "../components/ProductsTable";

const Products = ({ titulo }) => {
  return (
    <>
      <SiteHeader titulo={titulo || "Productos"} />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <ProductsTable />
        </div>
      </div>
    </>
  );
};

export default Products;
