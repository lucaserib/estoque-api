/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // Ativando modo escuro
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          900: "#1e3a8a", // Azul mais forte
          700: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};
