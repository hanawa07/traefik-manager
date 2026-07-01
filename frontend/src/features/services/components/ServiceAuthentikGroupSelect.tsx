import type { UseFormRegister } from "react-hook-form";

import type { AuthentikGroup } from "../api/serviceApi";
import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceAuthentikGroupSelectProps {
  register: UseFormRegister<ServiceFormData>;
  authMode: ServiceFormData["auth_mode"];
  authentikGroups: AuthentikGroup[];
}

export default function ServiceAuthentikGroupSelect({
  register,
  authMode,
  authentikGroups,
}: ServiceAuthentikGroupSelectProps) {
  if (authMode !== "authentik") return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-2">
      <label className="label">Authentik 접근 그룹</label>
      <select className="input" {...register("authentik_group_id")}>
        <option value="">그룹 선택 안 함 (모든 사용자)</option>
        {authentikGroups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </div>
  );
}
