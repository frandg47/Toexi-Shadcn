import { useEffect } from "react";
import { toast } from "sonner";

export default function InstallPromptListener() {
  useEffect(() => {
    let deferredPrompt;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      window.deferredPWAInstallPrompt = deferredPrompt;

      console.log("✅ PWA lista para instalar");

      toast("Instalá la app", {
        description: "Agregala a tu pantalla de inicio 📱",
        action: {
          label: "Instalar",
          onClick: async () => {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log("Resultado instalación:", outcome);
          },
        },
      });
    });
  }, []);

  return null;
}
