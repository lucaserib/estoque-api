import { useState, useEffect } from "react";

const DarkModeToggle = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <div className="pt-6">
      <label className="flex items-center cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            checked={darkMode}
            onChange={() => setDarkMode(!darkMode)}
            className="sr-only"
          />
          <div className="block bg-gray-600 w-8 h-4 rounded-full"></div>
          <div
            className={`dot absolute left-1 top-0.5 bg-white w-3 h-3 rounded-full transition ${
              darkMode ? "transform translate-x-full bg-blue-500" : ""
            }`}
          ></div>
        </div>
        <div className="ml-3 text-black dark:text-gray-300">
          {darkMode ? "Modo Escuro" : "Modo Claro"}
        </div>
      </label>
    </div>
  );
};

export default DarkModeToggle;
