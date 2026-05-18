import { SiteHeader } from "@/components/site-header";
import SellersTop from "../components/SellersTop";
import { useAuth } from "../context/AuthContextProvider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TopSellersPage = () => {
  const { role: currentUserRole } = useAuth();

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-6">
      <Tabs defaultValue="free" className="space-y-4">
        <TabsList>
          <TabsTrigger value="free">Vendedores Free</TabsTrigger>
          {currentUserRole === "superadmin" || currentUserRole === "owner" ? (
            <TabsTrigger value="presencial">Vendedores Presenciales</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="free">
          <SellersTop viewRole="seller" currentUserRole={currentUserRole} />
        </TabsContent>

        {(currentUserRole === "superadmin" || currentUserRole === "owner") && (
          <TabsContent value="presencial">
            <SellersTop viewRole="superadmin" currentUserRole={currentUserRole} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default TopSellersPage;