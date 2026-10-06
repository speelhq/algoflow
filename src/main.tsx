import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PLANS } from "@/challenges";
import { t } from "@/i18n/t";
import { App } from "@/ui/app/App";
import { firstLaunchTarget, storedKeys } from "@/ui/app/firstLaunch";
import "@/ui/theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

// U-71: index.html carries the same text statically for the pre-render tab title.
document.title = t("app.name");

// U-90: checked once per load, before any store can write.
const first = firstLaunchTarget(window.location.hash, storedKeys(), PLANS);
if (first !== null) window.history.replaceState(null, "", first);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
