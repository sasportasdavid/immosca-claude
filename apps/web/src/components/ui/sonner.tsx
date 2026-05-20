// Sonner toaster — wrap minimal aligné sur les tokens ImmoScan.
// Monter UNE FOIS dans le composant racine (routes/__root.tsx).
// Usage : import { toast } from "sonner"; puis toast.success("Sauvegardé").

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-ink group-[.toaster]:border group-[.toaster]:border-line group-[.toaster]:shadow-lvl-2 group-[.toaster]:rounded-r-md",
          description: "group-[.toast]:text-muted-ink",
          actionButton:
            "group-[.toast]:bg-violet group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-bg-2 group-[.toast]:text-ink",
          success: "group-[.toaster]:!text-success-soft-foreground",
          warning: "group-[.toaster]:!text-warning-soft-foreground",
          error: "group-[.toaster]:!text-destructive-soft-foreground",
          info: "group-[.toaster]:!text-info-soft-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
