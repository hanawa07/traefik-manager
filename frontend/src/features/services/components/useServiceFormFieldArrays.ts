import { useFieldArray, type Control } from "react-hook-form";

import type { ServiceFormData } from "./serviceFormSchema";

export function useServiceFormFieldArrays(control: Control<ServiceFormData>) {
  const customHeaders = useFieldArray({
    control,
    name: "custom_headers",
  });
  const basicAuthCredentials = useFieldArray({
    control,
    name: "basic_auth_credentials",
  });

  return {
    customHeaderFields: customHeaders.fields,
    appendCustomHeader: customHeaders.append,
    removeCustomHeader: customHeaders.remove,
    basicAuthFields: basicAuthCredentials.fields,
    appendBasicAuthField: basicAuthCredentials.append,
    removeBasicAuthField: basicAuthCredentials.remove,
  };
}
