import React from "react";
import { authOptions } from "@/lib/auth";
import "../../styles/global.css";
import { getServerSession } from "next-auth";

const Page = async () => {
  const session = await getServerSession(authOptions);
  return (
    <div>
      <p color="">Bem vindo: </p>
    </div>
  );
};

export default Page;
