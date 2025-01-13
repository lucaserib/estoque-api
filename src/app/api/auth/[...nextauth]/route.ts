import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Exporta o handler padrão do NextAuth para a API de rotas
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
