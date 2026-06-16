import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Footer } from "#/components/footer";
import { Header } from "#/components/header";

export const Route = createFileRoute("/_layout")({
  component: Layout,
});

function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Header />
      <main className="min-h-[85dvh] p-5">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
