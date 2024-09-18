import Link from "next/link";

export const Sidebar = () => {
  return (
    <div className="w-64 h-screen bg-gray-800 text-white p-4">
      <h2 className="text-2xl font-bold mb-4">Gestão de Estoque</h2>
      <ul>
        <li className="mb-2">
          <Link href="/" legacyBehavior>
            <a className="block py-2 px-4 rounded hover:bg-gray-700">Home</a>
          </Link>
        </li>
        <li className="mb-2">
          <Link href="/pedidos" legacyBehavior>
            <a className="block py-2 px-4 rounded hover:bg-gray-700">Pedidos</a>
          </Link>
        </li>
        <li className="mb-2">
          <Link href="/produtos" legacyBehavior>
            <a className="block py-2 px-4 rounded hover:bg-gray-700">
              Produtos
            </a>
          </Link>
        </li>
        <li className="mb-2">
          <Link href="/fornecedores" legacyBehavior>
            <a className="block py-2 px-4 rounded hover:bg-gray-700">
              Fornecedores
            </a>
          </Link>
        </li>
        <li className="mb-2">
          <Link href="/estoque" legacyBehavior>
            <a className="block py-2 px-4 rounded hover:bg-gray-700">Estoque</a>
          </Link>
        </li>
        <li className="mb-2">
          <Link href="/about" legacyBehavior>
            <a className="block py-2 px-4 rounded hover:bg-gray-700">About</a>
          </Link>
        </li>
      </ul>
    </div>
  );
};
