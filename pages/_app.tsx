import "../styles/global.css"; // Certifique-se de que o caminho está correto
import type { AppProps } from "next/app";
import { Sidebar } from "../components/Sidebar"; // Ajuste o caminho conforme necessário

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-4">
        <Component {...pageProps} />
      </main>
    </div>
  );
}

export default MyApp;
