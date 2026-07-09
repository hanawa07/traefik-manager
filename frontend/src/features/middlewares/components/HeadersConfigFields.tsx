import { Plus, Trash2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { MiddlewareFormData } from "./middlewareFormModel";

interface HeadersConfigFieldsProps {
  register: UseFormRegister<MiddlewareFormData>;
  errors: FieldErrors<MiddlewareFormData>;
  fields: { id: string }[];
  append: (value: { key: string; value: string }) => void;
  remove: (index: number) => void;
}

export function HeadersConfigFields({
  register,
  errors,
  fields,
  append,
  remove,
}: HeadersConfigFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">customResponseHeaders</p>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-1.5 py-1.5 text-sm"
          onClick={() => append({ key: "", value: "" })}
        >
          <Plus className="h-3.5 w-3.5" />
          헤더 추가
        </button>
      </div>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input className="input" placeholder="헤더 키" {...register(`custom_headers.${index}.key`)} />
            <input className="input" placeholder="헤더 값" {...register(`custom_headers.${index}.value`)} />
            <button
              type="button"
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/30 dark:hover:text-red-300"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
              title="헤더 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {errors.custom_headers ? (
        <p className="mt-1 text-xs text-red-500">{errors.custom_headers.message as string}</p>
      ) : null}
    </div>
  );
}
