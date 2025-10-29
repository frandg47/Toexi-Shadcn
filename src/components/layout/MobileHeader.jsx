import { Button } from "@/components/ui/button";
import { IconMenu2 } from "@tabler/icons-react";
import { useSidebar } from "@/components/ui/sidebar";

export default function MobileHeader({ title }) {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b flex items-center justify-between px-4 py-3 md:hidden">
      <h1 className="text-lg font-semibold">{title}</h1>
      <Button variant="outline" size="icon" onClick={toggleSidebar}>
        <IconMenu2 className="h-5 w-5" />
      </Button>
    </header>
  );
}
