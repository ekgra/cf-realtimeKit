const requiredWorkerEnvKeys = [
  "CLOUDFLARE_ACCOUNT_ID",
  "REALTIMEKIT_APP_ID",
  "REALTIMEKIT_PRESET_NAME",
  "CLOUDFLARE_API_TOKEN",
] as const;

export type WorkerEnvKey = (typeof requiredWorkerEnvKeys)[number];

export type WorkerEnv = Record<WorkerEnvKey, string>;

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join("; "));
    this.name = "EnvValidationError";
  }
}

export function validateWorkerEnv(input: Record<string, unknown>): WorkerEnv {
  const values = {} as WorkerEnv;
  const issues: string[] = [];

  for (const key of requiredWorkerEnvKeys) {
    const value = input[key];

    if (typeof value !== "string" || value.trim().length === 0) {
      issues.push(`${key} is required`);
      continue;
    }

    values[key] = value.trim();
  }

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  return values;
}
