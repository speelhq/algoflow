// U-01, U-02: the Playground and Modules pages share the header; each is a stub until its
// milestone (Playground M-04, Modules M-07).
import { t } from "@/i18n/t";
import { Header } from "@/ui/app/Header";
import { useTitle } from "@/ui/hooks/useTitle";

export function StubPage({ page }: { page: "playground" | "modules" }) {
  const title = t(`${page}.title`);
  useTitle(title);
  return (
    <div className="flex h-full flex-col">
      <Header current={page} />
      <main className="px-6 py-4" data-testid={page}>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-muted-foreground">{t(`${page}.stub`)}</p>
      </main>
    </div>
  );
}
