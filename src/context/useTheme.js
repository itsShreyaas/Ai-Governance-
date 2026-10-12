import { useContext } from "react";
import { ThemeContext } from "./themeContextObject";

export const useTheme = () => useContext(ThemeContext);
