import { SiteHeader } from "@/components/site-header";
import OrdersTable from "../components/OrdersTable";

const OrdersPage = ({ titulo }) => {
  return (
    <>
      <SiteHeader titulo={titulo || "Pedidos"} />
      <div className="mt-6">
        <OrdersTable />
      </div>
    </>
  );
};

export default OrdersPage;
