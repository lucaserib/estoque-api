import React from "react";
import { auth } from "@/lib/auth";
import "../../styles/global.css";

const Page = () => {
  const session = auth();
  return (
    <div>
      <p color="">Bem vindo: </p>
    </div>
  );
};

export default Page;
