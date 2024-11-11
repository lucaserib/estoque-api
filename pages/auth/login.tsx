// pages/auth/login.tsx
import { useState } from "react";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/router";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc"; // Importa o ícone do Google

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/"); // Redireciona para a página inicial
    } catch (error: any) {
      setError(error.message);
      console.error("Erro ao fazer login:", error);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/"); // Redireciona para a página inicial
    } catch (error: any) {
      setError(error.message);
      console.error("Erro ao fazer login com Google:", error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-semibold text-center mb-6 text-gray-700">
          Login
        </h2>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition duration-200"
          >
            Entrar
          </button>
        </form>
        <div className="my-4 flex items-center justify-center">
          <span className="text-gray-400">ou</span>
        </div>
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-2 rounded-lg shadow-sm hover:bg-gray-100 transition duration-200"
        >
          <FcGoogle className="mr-2 text-2xl" /> Entrar com Google
        </button>
        <p className="text-center mt-6 text-gray-600">
          Não tem uma conta?{" "}
          <Link href="/auth/register" legacyBehavior>
            <a className="text-blue-600 font-medium hover:underline">
              Registre-se
            </a>
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
