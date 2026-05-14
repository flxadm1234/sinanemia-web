import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().optional().default(""),
  DB_NAME: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
});

export const env = envSchema.parse(process.env);

