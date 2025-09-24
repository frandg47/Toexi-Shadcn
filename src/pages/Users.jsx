import { SiteHeader } from "@/components/site-header";
import {DialogTeam } from "../components/DialogTeam";

const Users = ({ titulo }) => {
  return (
    <>
      <SiteHeader titulo={titulo || "Equipo"} />
      <DialogTeam />
    </>
  );
};

export default Users;
