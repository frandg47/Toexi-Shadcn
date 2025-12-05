import { SiteHeader } from "@/components/site-header";
import SellersTop from "../components/SellersTop";
import { useAuth } from "../context/AuthContextProvider"

const TopSellersPage = () => {
  const { role } = useAuth();

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-6">
      <SellersTop role={role} />
    </div>
  );
};

export default TopSellersPage;
