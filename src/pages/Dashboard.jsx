import { ChartAreaInteractive } from "@/components/chart-area-interactive";
// import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import SalesByChannelChart from "@/components/SalesByChannelChart";
import SectionCardsProducts from "../components/SectionCardsProducts";
// import data from "../app/dashboard/data.json";

const Dashboard = () => {
  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-4 ">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:p-6">
            <div className="px-6">
              <SectionCardsProducts />
            </div>
            <SectionCards />
            <div className="px-4 lg:px-6">
              <ChartAreaInteractive />
            </div>
            <div className="px-4 lg:px-6">
              <SalesByChannelChart />
            </div>
            {/* <DataTable data={data} /> */}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
