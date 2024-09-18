import "../styles/global.css"; // Certifique-se de que o caminho está correto
import type { AppProps } from "next/app";
import { Sidebar } from "../components/Sidebar"; // Ajuste o caminho conforme necessário
import Layout from "../components/Layout";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

export default MyApp;
