import { t } from "@/i18n/t";
import { useMediaQuery } from "@/ui/hooks/useMediaQuery";
import { Layout } from "./Layout";

// S-02: desktop browsers at 1280 px or more; narrower viewports show app.desktopOnly and no editor.
export function App() {
  const desktop = useMediaQuery("(min-width: 1280px)");
  if (!desktop) {
    return (
      <div
        data-testid="desktop-only"
        className="flex h-screen items-center justify-center p-8 text-center text-muted-foreground"
      >
        {t("app.desktopOnly")}
      </div>
    );
  }
  return <Layout />;
}
