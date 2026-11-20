export function collectActorIds(review: unknown): string[];
export function userBulkPath(ids: string[]): string | null;
export function extractUserNames(result: unknown, requestedIds: string[]): Record<string, string>;
export function actorLabel(actor: string | null | undefined, names?: Record<string,string>): string;
