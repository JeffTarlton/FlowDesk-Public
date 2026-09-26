export type UserRole = 'developer' | 'support_desk' | 'admin' | 'branch_manager';
export type TicketStatus = 'pending' | 'planning' | 'sow_in_progress' | 'awaiting_customer_approval' | 'ready_for_dev' | 'dev_in_progress' | 'in_review' | 'beta_testing' | 'done' | 'rejected' | 'on_hold_customer' | 'on_hold_dev' | 'on_hold_support' | 'on_hold_sow';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketType = 'feature_request' | 'bug' | 'documentation' | 'improvement' | 'task' | 'professional_service' | 'project';

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  ticket_id: string;
  technician_id: string;
  hours: number;
  description: string | null;
  started_at: string | null;
  is_running: boolean;
  created_at: string;
  updated_at: string;
  technician?: Profile;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  branch_id: string | null;
  role: UserRole;
  avatar_url: string;
  is_active?: boolean;
  force_password_reset?: boolean;
  created_at?: string;
  phone?: string | null;
}

export interface Branch {
  id: string; // Short text code chosen by the admin, e.g. "EAST-01"
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  target_id: string | null;
  entity_type: string;
  action: string;
  old_data: any;
  new_data: any;
  created_at: string;
  actor_profile?: Pick<Profile, 'full_name' | 'email'>;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface SlaPolicy {
  id: string;
  priority: TicketPriority;
  response_time_hours: number;
  resolution_time_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalGate {
  id: string;
  from_status: TicketStatus;
  to_status: TicketStatus;
  requires_admin_approval: boolean;
  requires_customer_approval: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RelationshipType = 'related_to' | 'duplicate_of' | 'duplicated_by' | 'blocked_by' | 'blocks';

export interface TicketRelationship {
  id: string;
  source_ticket_id: string;
  target_ticket_id: string;
  relationship_type: RelationshipType;
  created_by: string | null;
  created_at: string;
  /** Joined target ticket data (populated by query) */
  target_ticket?: {
    id: string;
    readable_id: string;
    title: string;
    status: TicketStatus;
    priority: TicketPriority;
  };
}

export interface Ticket {
  id: string;
  readable_id: string;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  created_by: string;
  assigned_to: string | null;
  customer_name: string | null;
  customer_email: string | null;
  product_family: string | null;
  product_tier: string | null;
  product_id: string | null;
  parent_ticket_id: string | null;
  is_known_issue: boolean;
  target_version: string | null;
  attachment_url: string | null;
  archived_by_customer: boolean;
  branch_id: string | null;
  estimated_hours: number | null;
  billed_hours: number | null;
  target_start_date: string | null;
  target_test_date: string | null;
  target_completion_date: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_by_ticket_id: string | null;
  customer_approved: boolean;
  admin_approved: boolean;
  release_date: string | null;
  milestone_id: string | null;
  sla_response_deadline: string | null;
  sla_resolution_deadline: string | null;
  first_responded_at: string | null;
  sla_response_breached: boolean;
  sla_resolution_breached: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  notes: string[] | null;
  assignee?: Profile; // joined property for UI
  product?: Product;  // joined property for UI
  attachments?: TicketAttachment[];
  time_entries?: TimeEntry[];
  watchers?: { user_id: string }[];
}

export const COLUMNS: { id: TicketStatus | 'on_hold'; label: string; mappedStatuses: TicketStatus[] }[] = [
  { id: 'pending', label: 'Intake / New Request', mappedStatuses: ['pending'] },
  { id: 'ready_for_dev', label: 'Ready for Dev', mappedStatuses: ['ready_for_dev'] },
  { id: 'dev_in_progress', label: 'In Progress', mappedStatuses: ['dev_in_progress'] },
  { id: 'on_hold', label: 'On-Hold', mappedStatuses: ['on_hold_customer', 'on_hold_dev', 'on_hold_support', 'on_hold_sow'] },
  { id: 'beta_testing', label: 'Approved / Ready to Release', mappedStatuses: ['beta_testing'] },
  { id: 'done', label: 'Released / Closed', mappedStatuses: ['done'] }
];
