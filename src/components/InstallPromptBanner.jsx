import { useEffect, useState } from "react";
import { IconApps } from "@tabler/icons-react";

export default function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Si ya lo cerró antes, no mostrarlo
    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (dismissed) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
      window.deferredPWAInstallPrompt = e;
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("✅ Instalado");
      setShowBanner(false);
    } else {
      console.log("❌ Cancelado");
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-banner-dismissed", "1");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-300 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] p-4 z-[9999] flex items-center justify-center gap-4">
      <div className="flex items-center gap-2  font-medium">
        <IconApps /> ¿Querés instalar esta app?
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleInstall}
          className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-700 cursor-pointer"
        >
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          className="text-gray-500 text-lg font-bold px-2 absolute right-4 hover:text-gray-700 cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
