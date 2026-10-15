"use client";

import { useEffect, useRef, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: InstallPromptEvent;
  }
}

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const syncInstalledState = () => {
      setIsInstalled(
        standalone.matches ||
          ("standalone" in navigator && navigator.standalone === true),
      );
    };
    const handleInstallPrompt = (event: InstallPromptEvent) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    syncInstalledState();
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    standalone.addEventListener("change", syncInstalledState);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      standalone.removeEventListener("change", syncInstalledState);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (helpOpen && !dialog.open) dialog.showModal();
    if (!helpOpen && dialog.open) dialog.close();
  }, [helpOpen]);

  const showInstallInstructions = () => {
    setIsIos(
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    setHelpOpen(true);
  };

  const handleInstall = async () => {
    if (!installPrompt) {
      showInstallInstructions();
      return;
    }

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (outcome === "accepted") setIsInstalled(true);
    } catch (error) {
      console.error("The app install prompt could not be opened.", error);
      setInstallPrompt(null);
      showInstallInstructions();
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <button
        className="zm-chip zm-install-button"
        type="button"
        onClick={handleInstall}
        aria-haspopup={installPrompt ? undefined : "dialog"}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 13v3.5h13V13" />
        </svg>
        Install app
      </button>

      <dialog
        ref={dialogRef}
        className="zm-install-dialog"
        aria-labelledby="zm-install-title"
        onClose={() => setHelpOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setHelpOpen(false);
        }}
      >
        <div className="zm-install-dialog-content">
          <button
            className="zm-install-dialog-close"
            type="button"
            aria-label="Close install instructions"
            onClick={() => setHelpOpen(false)}
          >
            ×
          </button>
          <span className="zm-install-dialog-kicker">Faith of the Pioneers</span>
          <h2 id="zm-install-title">Install this app</h2>
          <p>
            {isIos
              ? "In Safari, tap the Share button, then choose “Add to Home Screen.”"
              : "Open your browser menu and choose “Install app” or “Add to Home screen.” The exact wording depends on your browser."}
          </p>
        </div>
      </dialog>
    </>
  );
}
