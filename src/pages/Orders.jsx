import { SiteHeader } from "@/components/site-header";

const Orders = ({ titulo}) => {
  return (
    <>
    <SiteHeader titulo={titulo || "Pedidos"} />
    </>
  )
}

export default Orders