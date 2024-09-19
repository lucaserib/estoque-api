import Link from "next/link";
import {
  FaHome,
  FaClipboardList,
  FaBox,
  FaTruck,
  FaWarehouse,
  FaSignOutAlt,
} from "react-icons/fa";

export const Sidebar = () => {
  return (
    <div className="w-64 h-screen bg-gray-900 text-white p-4">
      <h2 className="text-2xl font-bold mb-6">Gestão de Estoque</h2>
      <ul>
        <li className="mb-4">
          <Link href="/" legacyBehavior>
            <a className="flex items-center py-2 px-4 rounded hover:bg-gray-700">
              <FaHome className="mr-3" />
              Home
            </a>
          </Link>
        </li>
        <li className="mb-4">
          <Link href="/pedidos" legacyBehavior>
            <a className="flex items-center py-2 px-4 rounded hover:bg-gray-700">
              <FaClipboardList className="mr-3" />
              Pedidos
            </a>
          </Link>
        </li>
        <li className="mb-4">
          <Link href="/produtos" legacyBehavior>
            <a className="flex items-center py-2 px-4 rounded hover:bg-gray-700">
              <FaBox className="mr-3" />
              Produtos
            </a>
          </Link>
        </li>
        <li className="mb-4">
          <Link href="/fornecedores" legacyBehavior>
            <a className="flex items-center py-2 px-4 rounded hover:bg-gray-700">
              <FaTruck className="mr-3" />
              Fornecedores
            </a>
          </Link>
        </li>
        <li className="mb-4">
          <Link href="/estoque" legacyBehavior>
            <a className="flex items-center py-2 px-4 rounded hover:bg-gray-700">
              <FaWarehouse className="mr-3" />
              Estoque
            </a>
          </Link>
        </li>
        <li className="mb-4">
          <Link href="/saida" legacyBehavior>
            <a className="flex items-center py-2 px-4 rounded hover:bg-gray-700">
              <FaSignOutAlt className="mr-3" />
              Saida
            </a>
          </Link>
        </li>
      </ul>
    </div>
  );
};
