import type { UseFormRegister } from "react-hook-form";

import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceAccessRulesFieldsProps {
  register: UseFormRegister<ServiceFormData>;
}

export default function ServiceAccessRulesFields({
  register,
}: ServiceAccessRulesFieldsProps) {
  return (
    <>
      <div>
        <label className="label">허용 IP 목록</label>
        <textarea
          className="input min-h-24"
          placeholder={"한 줄에 하나씩 입력\n192.168.0.0/24"}
          {...register("allowed_ips_input")}
        />
      </div>

      <div>
        <label className="label">차단 경로</label>
        <textarea
          className="input min-h-24"
          placeholder="예: /admin"
          {...register("blocked_paths_input")}
        />
      </div>
    </>
  );
}
