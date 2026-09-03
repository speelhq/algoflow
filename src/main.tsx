import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { t } from "@/i18n/t";
import { App } from "@/ui/app/App";
import "@/ui/theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

// U-71: index.html carries the same text statically for the pre-render tab title.
document.title = t("app.name");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
