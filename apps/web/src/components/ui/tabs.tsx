// Tabs basé sur Radix UI — wrapper stylé pour les onglets de navigation
// interne (page rapport : Tableau / Top / Synthèse).
//
// Style aligné sur le handoff : tabs sobres avec ligne de séparation
// border-line bottom, item actif marqué par un underline violet 2px et
// le texte ink. Pas de pill background — c'est un trigger "rail".

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 border-b border-line",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap px-3 py-2.5 text-[13px] font-medium",
      "transition-colors focus-visible:outline-none focus-visible:shadow-ring-violet",
      "disabled:pointer-events-none disabled:opacity-50",
      "text-mute-2 hover:text-ink",
      "data-[state=active]:text-ink",
      // underline violet 2px sur l'onglet actif
      "after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:bg-transparent after:rounded-full",
      "data-[state=active]:after:bg-violet",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-6 focus-visible:outline-none focus-visible:shadow-ring-violet",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
