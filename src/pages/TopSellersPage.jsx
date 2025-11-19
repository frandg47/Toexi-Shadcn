import { SiteHeader } from "@/components/site-header";
import SellersTop from "../components/SellersTop";

const TopSellersPage = ({ titulo }) => {



  return (
    <>
      <SiteHeader
        titulo={titulo || "Top Vendedores"}
      />
      <div className="mt-6">
        <SellersTop />
      </div>
    </>
  );
};

export default TopSellersPage;
