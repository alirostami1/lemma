export type ReusableZodSchemaOptions = {
  generateReusableSchemas: true;
};

export function reusableZodSchemaOptions(): ReusableZodSchemaOptions {
  return {
    generateReusableSchemas: true,
  };
}
