const required = ['service_name', 'namespace', 'pod_name', 'error_message'];
const item = $input.first().json;
const payload = item?.body ?? item;
const missing = required.filter((field) => !payload?.[field]);

return [
  {
            json: {
                  ...payload,
                  isValid: missing.length === 0,
                  missing,
                  errorMessage: missing.length
                        ? `Campos obrigatórios faltando: ${missing.join(', ')}`
                        : null,
            },
  },
];