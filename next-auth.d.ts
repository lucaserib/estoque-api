// types/next-auth.d.ts
import "next-auth";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: UserRole;
  }

  interface Session {
    user: User & { role: UserRole };
  }
}
