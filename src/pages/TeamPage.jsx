import { useState } from "react";

import { SiteHeader } from "@/components/site-header";
import UsersTable from "@/components/UsersTable";
import FormRegisterNewUser from "../components/FormRegisterNewUser";

const TeamPage = ({ titulo }) => {
  const [refreshToken, setRefreshToken] = useState(0);

  const handleUserCreated = () => {
    setRefreshToken((current) => current + 1);
  };

  return (
    <>
      <SiteHeader
        titulo={titulo || "Equipo"}
        actions={<FormRegisterNewUser onSuccess={handleUserCreated} />}
      />
      <div className="mt-6">
        <UsersTable refreshToken={refreshToken} />
      </div>
    </>
  );
};

export default TeamPage;
