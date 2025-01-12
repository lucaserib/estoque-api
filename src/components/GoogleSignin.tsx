import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";
import React from "react";

const GoogleSignin = () => {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <Button
        className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg"
        type="submit"
      >
        Sign in with Google
      </Button>
    </form>
  );
};

export default GoogleSignin;
