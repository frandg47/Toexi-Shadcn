import { SiteHeader } from "@/components/site-header";
import SellersTop from "../components/SellersTop";

const TopSellersPage = () => {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-6">
      <SellersTop />
    </div>
  );
};

export default TopSellersPage;
