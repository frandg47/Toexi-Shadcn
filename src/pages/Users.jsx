import { SiteHeader } from "@/components/site-header";

const Users = ({ titulo }) => {
  return (
    <>
      <SiteHeader titulo={titulo || "Equipo"} />
    </>
  );
};

export default Users;
