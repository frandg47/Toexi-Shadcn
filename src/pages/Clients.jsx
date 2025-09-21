import { SiteHeader } from "@/components/site-header";

const Clients = ({ titulo}) => {
  return (
    <>
    <SiteHeader titulo={titulo || "Clientes"} />
    </>
  )
}

export default Clients