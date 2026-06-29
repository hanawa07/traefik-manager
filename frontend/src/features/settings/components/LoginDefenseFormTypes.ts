import type { LoginDefenseForm } from "@/features/settings/lib/settingsDefaults";

export type LoginDefenseUpdateForm = (patch: Partial<LoginDefenseForm>) => void;
