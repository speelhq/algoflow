import { t } from "@/i18n/t";
import { useMediaQuery } from "@/ui/hooks/useMediaQuery";

// S-02: desktop browsers at 1280 px or more; narrower viewports show app.desktopOnly and no editor.
// The shell is empty until M-03 adds the pages (U-01..U-03).
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
  return <div data-testid="shell" className="h-screen w-screen bg-background text-foreground" />;
}
