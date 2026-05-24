import * as bindings from "./bindings";

type GeneratedCommands = typeof bindings & {
  commands?: Record<string, (...args: unknown[]) => Promise<unknown>>;
};

const gen = bindings as GeneratedCommands;

function pick<TName extends string>(
  name: TName,
): (...args: unknown[]) => Promise<unknown> {
  // `??` keeps the direct-export fallback lazy: when the `commands` namespace
  // has the function we never touch the named export (which a mocked module
  // may not define).
  const fn = gen.commands?.[name] ?? (gen as Record<string, unknown>)[name];
  if (typeof fn !== "function") {
    throw new Error(
      `Generated bindings.ts is missing command '${name}'. Run \`pnpm bindings\` to regenerate.`,
    );
  }
  return fn as (...args: unknown[]) => Promise<unknown>;
}

// One typed re-export per command. Plan 20 expands this list as the surface
// grows. Field names mirror the generated bindings (serde wire format).
export const getAppVersion = pick("getAppVersion") as () => Promise<{
  app: string;
  git_short_sha: string | null;
}>;
