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
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lvl-2 group-[.toaster]:rounded-md",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground",
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
