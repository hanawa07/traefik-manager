import type { UseFormRegister } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import type { ServiceFormData } from "./serviceFormSchema";

export interface ServiceCustomHeaderField {
  id: string;
}

interface ServiceCustomHeadersFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  customHeaderFields: ServiceCustomHeaderField[];
  onAddCustomHeader: () => void;
  onRemoveCustomHeader: (index: number) => void;
}

export default function ServiceCustomHeadersFields({
  register,
  customHeaderFields,
  onAddCustomHeader,
  onRemoveCustomHeader,
}: ServiceCustomHeadersFieldsProps) {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-200">커스텀 응답 헤더</p>
        <button
          type="button"
          className="btn-secondary gap-1 px-2 py-1 text-xs"
          onClick={onAddCustomHeader}
        >
          <Plus className="h-3 w-3" /> 추가
        </button>
      </div>
      <div className="space-y-2">
        {customHeaderFields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              className="input text-sm"
              placeholder="Key"
              {...register(`custom_headers.${index}.key`)}
            />
            <input
              className="input text-sm"
              placeholder="Value"
              {...register(`custom_headers.${index}.value`)}
            />
            <button
              type="button"
              onClick={() => onRemoveCustomHeader(index)}
              className="p-2 text-gray-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
