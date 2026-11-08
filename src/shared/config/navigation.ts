import {
  LayoutDashboard, ClipboardCheck, Layers3, FlaskConical,
  History, FileText, Settings,
} from 'lucide-react';

// Single source of truth for the application navigation and page headings.
export const PAGES = [
  { id: 'Overview', label: 'Overview', description: 'Track evidence, approvals, and requirement changes.', icon: LayoutDashboard },
  { id: 'Reviews', label: 'Reviews', description: 'Track, approve, and revalidate work with evidence.', icon: ClipboardCheck },
  { id: 'Requirements', label: 'Requirements', description: 'Manage versioned requirements and traceability.', icon: Layers3 },
  { id: 'Evidence', label: 'Evidence', description: 'Tests and proof linked to requirement versions.', icon: FlaskConical },
  { id: 'History', label: 'History', description: 'Changes, evidence, and review decisions.', icon: History },
  { id: 'Reports', label: 'Reports', description: 'Verification reports and evidence summaries.', icon: FileText },
  { id: 'Settings', label: 'Settings', description: 'Review policies, permissions, and integrations.', icon: Settings },
] as const;

export type PageId = (typeof PAGES)[number]['id'];
export const pageDefinition = (page: PageId) => PAGES.find((item) => item.id === page)!;
