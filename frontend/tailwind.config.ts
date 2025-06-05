// tailwind.config.ts
import type { Config } from "tailwindcss";

module.exports = {
  darkMode: 'media', // <-- respect the user's OS setting!
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",   // “look at everything under src/”
    "./pages/**/*.{js,jsx,ts,tsx}",  // (Next.js only) “look at pages/”
    "./components/**/*.{js,jsx,ts,tsx}",
    // add other folders where you reference Tailwind classes
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
