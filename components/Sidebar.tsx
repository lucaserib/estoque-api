import Link from "next/link";
import {
  FaHome,
  FaClipboardList,
  FaBox,
  FaTruck,
  FaWarehouse,
  FaInfoCircle,
  FaSignOutAlt,
} from "react-icons/fa";
import DarkModeToggle from "./DarkModeToggle";

export const Sidebar = () => {
  return (
    <div className="w-64 h-screen bg-blue-900 dark:bg-gray-900 text-white p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-3xl font-bold mb-8">Gestão de Estoque</h2>
        <ul className="space-y-4">
          <li>
            <Link href="/" legacyBehavior>
              <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                <FaHome className="mr-3" />
                Home
              </a>
            </Link>
          </li>
          <li>
            <Link href="/pedidos" legacyBehavior>
              <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                <FaClipboardList className="mr-3" />
                Pedidos
              </a>
            </Link>
          </li>
          <li>
            <Link href="/produtos" legacyBehavior>
              <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                <FaBox className="mr-3" />
                Produtos
              </a>
            </Link>
          </li>
          <li>
            <Link href="/fornecedores" legacyBehavior>
              <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                <FaTruck className="mr-3" />
                Fornecedores
              </a>
            </Link>
          </li>
          <li>
            <Link href="/estoque" legacyBehavior>
              <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                <FaWarehouse className="mr-3" />
                Estoque
              </a>
            </Link>
          </li>
          <li>
            <Link href="/saida" legacyBehavior>
              <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                <FaSignOutAlt className="mr-3" />
                Saída
              </a>
            </Link>
          </li>
        </ul>
      </div>

      {/* Dark Mode Toggle */}
      <DarkModeToggle />
    </div>
  );
};
