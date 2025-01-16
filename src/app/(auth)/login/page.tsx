"use client";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import GoogleSignin from "@/app/components/GoogleSignin";
import "../../../../styles/global.css";
import { signIn } from "next-auth/react";

const LoginForm = () => {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Login com credenciais
    await signIn("credentials", { email, password, callbackUrl: "/" });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        name="email"
        placeholder="Email"
        type="email"
        required
        autoComplete="email"
        className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      />
      <Input
        name="password"
        placeholder="Password"
        type="password"
        required
        autoComplete="current-password"
        className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      />
      <Button
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg"
        type="submit"
      >
        Sign In
      </Button>
    </form>
  );
};

const Page = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-center text-gray-800 dark:text-gray-200 mb-4">
          Login
        </h1>

        <GoogleSignin />

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300 dark:border-gray-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">
              Ou continue via email
            </span>
          </div>
        </div>

        <LoginForm />

        <div className="text-center mt-4">
          <Button asChild variant="link">
            <a href="/register" className="text-indigo-600 hover:underline">
              Don&apos;t have an account? Sign up
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Page;
