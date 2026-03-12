import { createSwaggerSpec } from "next-swagger-doc";

export function getOpenApiSpec() {
  return createSwaggerSpec({
    apiFolder: "src/app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Industrial Event Management API",
        version: "1.0.0",
      },
    },
  });
}

