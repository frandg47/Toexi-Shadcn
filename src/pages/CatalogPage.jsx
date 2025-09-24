import { SiteHeader } from "@/components/site-header";
import CatalogTable from "../components/CatalogTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconFilter, IconPlus } from "@tabler/icons-react";


const CatalogPage = ({ titulo }) => {


  const handleAdd = () => {
    return null;
  }

  const actions = (
  <>
    <Input
      type="text"
      placeholder="Buscar..."
      className="h-8 px-3 rounded-2xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
    <Button variant="default" size="sm" className="bg-gray-300 hover:bg-gray-400">
      <IconFilter className="text-white" />
    </Button>
    <Button variant="default" size="sm" className="bg-gray-300 hover:bg-gray-400" onClick={handleAdd}>
      <IconPlus className="h-4 w-4 text-white" />
    </Button>
  </>
);

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
