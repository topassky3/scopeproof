export interface SelectionScope { key:string; projectId:string; projectKey:string }
type StorageProvider = () => Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function selectionScope(context:unknown): SelectionScope | null;
export function matchesProject(scope:SelectionScope|null,review:unknown): boolean;
export function readSelection(scope:SelectionScope|null,storage:StorageProvider): string|null;
export function rememberSelection(scope:SelectionScope|null,review:unknown,storage:StorageProvider): boolean;
export function forgetSelection(scope:SelectionScope|null,storage:StorageProvider): void;
