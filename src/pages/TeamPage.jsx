import { SiteHeader } from "@/components/site-header";
import {DialogTeam } from "../components/DialogTeam";
import ConcentricLoader from "../components/ui/loading";

const TeamPage = ({ titulo }) => {
  return (
    <>
      <SiteHeader titulo={titulo || "Equipo"} />
      <DialogTeam />
      <ConcentricLoader />
    </>
  );
};

export default TeamPage;
