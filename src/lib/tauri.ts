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

// Commands that return `Result<T, CoreError>` resolve to the tauri-specta
// `{ status, data | error }` wrapper. Callers narrow on `status` and cast
// `data` to the matching generated type from `@/lib/bindings`. Returns are
// intentionally loose here so this surface stays stable across tauri-specta
// versions; field names mirror the serde wire format (snake_case).

/* --- KB --- */
export const kbCreate = pick("kbCreate") as (args: unknown) => Promise<unknown>;
export const kbGet = pick("kbGet") as (kbId: string) => Promise<unknown>;
export const kbList = pick("kbList") as () => Promise<unknown>;
export const kbListSummaries = pick("kbListSummaries") as () => Promise<unknown>;
export const kbUpdateMeta = pick("kbUpdateMeta") as (
  kbId: string,
  patch: unknown,
) => Promise<unknown>;
export const kbDelete = pick("kbDelete") as (kbId: string) => Promise<unknown>;
export const kbMigrateSchema = pick("kbMigrateSchema") as (
  kbId: string,
  newSchema: unknown,
) => Promise<unknown>;

/* --- Entries --- */
export const entryCreate = pick("entryCreate") as (
  args: unknown,
) => Promise<unknown>;
export const entryGet = pick("entryGet") as (
  entryId: string,
) => Promise<unknown>;
export const entryList = pick("entryList") as (
  args: unknown,
) => Promise<unknown>;
export const entryUpdate = pick("entryUpdate") as (
  entryId: string,
  patch: unknown,
) => Promise<unknown>;
export const entryDelete = pick("entryDelete") as (
  entryId: string,
) => Promise<unknown>;
export const entryBulkDelete = pick("entryBulkDelete") as (
  entryIds: string[],
) => Promise<unknown>;

/* --- Ingest + source docs --- */
export const ingestFiles = pick("ingestFiles") as (
  args: unknown,
) => Promise<unknown>;
export const sourceDocGet = pick("sourceDocGet") as (
  id: string,
) => Promise<unknown>;
export const sourceDocListRecent = pick("sourceDocListRecent") as (
  limit: number,
) => Promise<unknown>;
export const sourceDocDelete = pick("sourceDocDelete") as (
  id: string,
) => Promise<unknown>;
export const sourceDocResolvePath = pick("sourceDocResolvePath") as (
  id: string,
) => Promise<unknown>;

/* --- Scanner --- */
export const scanDocument = pick("scanDocument") as (
  id: string,
  scope: unknown,
) => Promise<unknown>;
export const scannerInvalidate = pick(
  "scannerInvalidate",
) as () => Promise<unknown>;

/* --- Search --- */
export const searchEntries = pick("searchEntries") as (
  q: string,
  limit: number,
) => Promise<unknown>;
export const searchSourceDocs = pick("searchSourceDocs") as (
  q: string,
  limit: number,
) => Promise<unknown>;

/* --- Identity + Settings --- */
export const identityGet = pick("identityGet") as () => Promise<unknown>;
export const identitySet = pick("identitySet") as (
  displayName: string,
) => Promise<unknown>;
export const getAppSettings = pick("getAppSettings") as () => Promise<{
  data_dir: string;
  log_dir: string;
  pdfium_version: string;
  ocrs_version: string;
  tantivy_version: string;
}>;
export const revealInFileManager = pick("revealInFileManager") as (
  path: string,
) => Promise<unknown>;
