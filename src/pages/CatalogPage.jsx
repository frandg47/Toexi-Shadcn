import { SiteHeader } from "@/components/site-header";
import CatalogTable from "../components/CatalogTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconFilter, IconPlus } from "@tabler/icons-react";
import ContributorsTable from "../components/ruixen-contributors-table";


const CatalogPage = ({ titulo }) => {

  return (
    <>
      <SiteHeader titulo={titulo || "Catálogo"} />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <CatalogTable />
        </div>
      </div>
    </>
  );
};

export default CatalogPage;
