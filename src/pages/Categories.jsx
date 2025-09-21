import { SiteHeader } from "@/components/site-header";
import CatalogTable from "../components/CatalogTable";

const Categories = ({ titulo }) => {
  return (
    <>
      <SiteHeader titulo={titulo || "Categorías"} />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <CatalogTable />
        </div>
      </div>
    </>
  );
};

export default Categories;
