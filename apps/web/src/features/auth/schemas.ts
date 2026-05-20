// Schemas Zod côté form pour login / signup / magic link.
//
// Ces schémas appartiennent à la couche UI (pas à packages/shared) parce
// qu'ils valident l'input du formulaire avant l'appel Supabase, avec
// des messages d'erreur localisés FR. Le contrat de données persistées
// (profile, user_params) reste dans @immoscan/shared.

import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email requis").email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    email: z.string().min(1, "Email requis").email("Email invalide"),
    password: z
      .string()
      .min(8, "Au moins 8 caractères")
      .max(72, "72 caractères maximum"),
    confirmPassword: z.string().min(1, "Confirme ton mot de passe"),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Tu dois accepter les CGU pour continuer." }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas",
  });
export type SignupInput = z.infer<typeof signupSchema>;

export const magicLinkSchema = z.object({
  email: z.string().min(1, "Email requis").email("Email invalide"),
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
