import { X, Bug, Sparkles, Calendar, User, ChevronDown, Loader2, CheckCircle2, ShieldAlert, Paperclip, Download, FileText, Tag, Clock, Plus, Trash2, Package, Link2, Zap, Briefcase, Eye, GitBranch, Edit, Check, Target } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import PresenceAvatars from './PresenceAvatars';
import DatePicker from './DatePicker';
import { Ticket, Profile, COLUMNS, TicketAttachment, TimeEntry, RelationshipType } from '../types';
import { format } from 'date-fns';
import { useState, useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { supabase } from '../lib/supabase';
import { useTicketStore } from '../store/useTicketStore';
import { useAdminStore } from '../store/useAdminStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePresenceStore } from '../store/usePresenceStore';
import { useProductStore } from '../store/useProductStore';
import { useApprovalStore } from '../store/useApprovalStore';
import { useRelationshipStore } from '../store/useRelationshipStore';
import { useMilestoneStore } from '../store/useMilestoneStore';
import { useTimerStore } from '../store/useTimerStore';
import ConfirmModal from './ConfirmModal';
import { parseTimeToHours, formatHoursToTime } from '../utils/timeTracker';
import TicketProgressBar from './TicketProgressBar';
import toast from 'react-hot-toast';
import BranchInfoPanel from './BranchInfoPanel';
import NewTicketModal from './NewTicketModal';
import SlaBadge from './SlaBadge';

function TimerButton({ ticketId }: { ticketId: string }) {
  const { activeTimer, startTimer, stopTimer, discardTimer, fetchActiveTimer } = useTimerStore();
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    fetchActiveTimer();
  }, []);

  useEffect(() => {
    if (!activeTimer?.started_at || activeTimer.ticket_id !== ticketId) { setElapsed(''); return; }
    const tick = () => {
      const ms = Date.now() - new Date(activeTimer.started_at!).getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setElapsed(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTimer, ticketId]);

  const isThisTicket = activeTimer?.ticket_id === ticketId;
  const isOtherTicket = activeTimer && !isThisTicket;

  if (isThisTicket) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-mono font-bold text-green-700 dark:text-green-300">{elapsed}</span>
        </div>
        <button onClick={stopTimer} className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
          Stop
        </button>
        <button onClick={discardTimer} className="px-2 py-2 text-gray-400 hover:text-red-500 text-xs transition-colors" title="Discard">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => startTimer(ticketId)}
      disabled={!!isOtherTicket}
      className={`w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
        isOtherTicket
          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
          : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800'
      }`}
      title={isOtherTicket ? 'Stop your other timer first' : 'Start timer'}
    >
      <Clock size={14} /> {isOtherTicket ? 'Timer running on another ticket' : 'Start Timer'}
    </button>
  );
}

interface Props {
  ticket: Ticket;
  onClose: () => void;
}

const priorityConfig = {
  low:      { label: 'Low',      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  medium:   { label: 'Medium',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  high:     { label: 'High',     className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export default function TicketDetailPanel({ ticket, onClose }: Props) {
  const { tickets, deleteTicket, updateTicketFields, approveTicket, revokeApproval } = useTicketStore();
  const { branches } = useAdminStore();
  const { products, fetchProducts } = useProductStore();
  const myProfile = useAuthStore((s) => s.profile);
  const { joinRoom, leaveRoom } = usePresenceStore();
  const { gates, fetchGates, canTransition } = useApprovalStore();
  const { relationships, isLoading: loadingRelationships, fetchRelationships, addRelationship, removeRelationship } = useRelationshipStore();
  const { milestones, fetchMilestones } = useMilestoneStore();

  // Relationship linking state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkRelType, setLinkRelType] = useState<RelationshipType>('related_to');

  const [currentStatus, setCurrentStatus] = useState(ticket.status);
  const [savingStatus, setSavingStatus] = useState(false);
  const [assignees, setAssignees] = useState<Profile[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [activityLogs, setActivityLogs] = useState<{id: string, action: string, created_at: string, actor: { full_name: string, email: string } | null}[]>([]);
  interface CommentWithAuthor {
    id: string;
    author_id: string;
    comment_text: string;
    created_at: string;
    is_internal_only: boolean;
    // null when the author's account has been deleted
    author: {
      full_name: string | null;
      email: string;
      role: string;
    } | null;
  }

  const [customerComments, setCustomerComments] = useState<CommentWithAuthor[]>([]);
  const [newCustomerComment, setNewCustomerComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [isEditingAc, setIsEditingAc] = useState(false);
  const [localAc, setLocalAc] = useState(ticket.acceptance_criteria || '');
  const [savingAc, setSavingAc] = useState(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(ticket.title || '');
  const [savingTitle, setSavingTitle] = useState(false);

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [localDescription, setLocalDescription] = useState(ticket.description || '');
  const [savingDescription, setSavingDescription] = useState(false);

  // Blocked / known-issue toggles
  const [blockedToggle, setBlockedToggle] = useState(ticket.is_blocked || false);
  const [blockedReason, setBlockedReason] = useState(ticket.blocked_reason || '');
  const [blockedBy, setBlockedBy] = useState<string | null>(ticket.blocked_by_ticket_id || null);
  const [isKnownIssue, setIsKnownIssue] = useState(ticket.is_known_issue || false);
  const [savingToggles, setSavingToggles] = useState(false);

  const [isLinkingTask, setIsLinkingTask] = useState(false);
  const [selectedTaskToLink, setSelectedTaskToLink] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);

  const linkableTickets = useMemo(() => {
    return tickets.filter(t => t.id !== ticket.id && t.parent_ticket_id === null && t.status !== 'done');
  }, [tickets, ticket.id]);

  const handleLinkTask = async () => {
    if (!selectedTaskToLink) return;
    setIsLinking(true);
    await updateTicketFields(selectedTaskToLink, { parent_ticket_id: ticket.id });
    setIsLinking(false);
    setIsLinkingTask(false);
    setSelectedTaskToLink('');
    toast.success('Task linked successfully');
  };
  const [isEditingScope, setIsEditingScope] = useState(false);
  const [scopeData, setScopeData] = useState({
    estimated_hours: ticket.estimated_hours ? formatHoursToTime(ticket.estimated_hours) : '',
    billed_hours: ticket.billed_hours ? formatHoursToTime(ticket.billed_hours) : '',
    target_start_date: ticket.target_start_date ? new Date(ticket.target_start_date) : null as Date | null,
    target_test_date: ticket.target_test_date ? new Date(ticket.target_test_date) : null as Date | null,
    target_completion_date: ticket.target_completion_date ? new Date(ticket.target_completion_date) : null as Date | null,
  });
  const [savingScope, setSavingScope] = useState(false);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isEditingTimeEntry, setIsEditingTimeEntry] = useState<string | null>(null);
  const [editingHours, setEditingHours] = useState('');

  const [showNewChildTicket, setShowNewChildTicket] = useState(false);

  useEffect(() => {
    fetchAssignees();
    fetchLogs();
    fetchComments();
    fetchAttachments();
    fetchTimeEntries();
    fetchProducts();
    fetchGates();
    fetchRelationships(ticket.id);
    fetchMilestones();

    // Join presence room for this ticket
    if (myProfile) {
      joinRoom(ticket.id, { id: myProfile.id, full_name: myProfile.full_name, email: myProfile.email });
    }
    
    const channel = supabase.channel(`admin:ticket_comments:${ticket.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticket.id}` }, () => {
        fetchComments();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticket.id}` }, () => {
        fetchComments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      leaveRoom(); // Leave presence on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('ticket_comments')
      .select('id, author_id, comment_text, created_at, is_internal_only, author:profiles(full_name, email, role)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    if (data) setCustomerComments(data as unknown as CommentWithAuthor[]);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    
    // Optimistic UI update
    setCustomerComments(prev => prev.filter(c => c.id !== commentId));

    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'delete-comment', comment_id: commentId }
      });
      if (error) throw new Error(error.message || 'Failed to delete');
      if (data?.error) throw new Error(data.error);

      // Force instant fetch on this client, the websocket will take care of others
      fetchComments();
      import('react-hot-toast').then(({ default: toast }) => toast.success('Comment deleted'));
    } catch (err: any) {
      console.error(err);
      fetchComments(); // Revert on failure
      import('react-hot-toast').then(({ default: toast }) => toast.error(err.message || 'Failed to delete comment'));
    }
  };

  const handleSendComment = async () => {
    if (!newCustomerComment.trim()) return;
    setSendingComment(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('ticket_comments').insert({
        ticket_id: ticket.id,
        author_id: user.id,
        comment_text: newCustomerComment.trim(),
        is_internal_only: isInternalComment
      });

      // Extract and dispatch @mentions
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newCustomerComment.trim();
      const mentionNodes = tempDiv.querySelectorAll('[data-type="mention"]');
      const mentionedIds = Array.from(mentionNodes).map((el: any) => el.getAttribute('data-id')).filter(Boolean);
      const uniqueMentions = [...new Set(mentionedIds)];

      if (uniqueMentions.length > 0) {
        const titleText = `Mentioned you in ${ticket.readable_id}`;
        
        // Remove HTML tags for a clean snippet
        let snippet = tempDiv.textContent || tempDiv.innerText || '';
        snippet = snippet.length > 60 ? snippet.substring(0, 60) + '...' : snippet;

        const notificationsList = uniqueMentions.map(mentioned_user_id => ({
          user_id: mentioned_user_id,
          actor_id: user.id,
          ticket_id: ticket.id,
          type: 'mention',
          title: titleText,
          message: snippet
        }));

        await supabase.from('notifications').insert(notificationsList);
      }
      setNewCustomerComment('');
      setIsInternalComment(false);
      fetchComments();
    }
    setSendingComment(false);
  };

  const fetchAssignees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'developer', 'support_desk']);
    if (data) setAssignees(data as Profile[]);
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('id, action, created_at, actor:profiles(full_name, email)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false });
    if (data) setActivityLogs(data as unknown as {id: string, action: string, created_at: string, actor: { full_name: string, email: string } | null}[]);
  };

  const priority = priorityConfig[ticket.priority];

  const fetchAttachments = async () => {
    const { data } = await supabase
      .from('ticket_attachments')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false });
    if (data) setAttachments(data as TicketAttachment[]);
  };

  const fetchTimeEntries = async () => {
    const { data } = await supabase
      .from('time_entries')
      .select('*, technician:profiles(full_name, email)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false });
    if (data) setTimeEntries(data as TimeEntry[]);
  };

  const handleLogTime = async (hoursStr: string) => {
    const hours = parseFloat(hoursStr);
    if (!hours || isNaN(hours)) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('time_entries').insert({
        ticket_id: ticket.id,
        technician_id: user.id,
        hours,
      });

      if (error) throw error;
      
      // Update billed_hours on ticket (rollup)
      const currentBilled = ticket.billed_hours || 0;
      await updateTicketFields(ticket.id, { billed_hours: currentBilled + hours });
      
      // Add activity log
      await supabase.from('activity_logs').insert({
        ticket_id: ticket.id,
        actor_id: user.id,
        action: `Logged <span class="font-semibold">${hours}</span> hours of work`
      });

      toast.success(`Successfully logged ${hours} hours`);
      fetchTimeEntries();
      fetchLogs();
    } catch (err: any) {
      toast.error('Failed to log time: ' + err.message);
    }
  };

  const handleDeleteTimeEntry = async (entry: TimeEntry) => {
    if (!window.confirm("Are you sure you want to delete this time entry?")) return;
    
    try {
      const { error } = await supabase.from('time_entries').delete().eq('id', entry.id);
      if (error) throw error;
      
      // Update billed_hours on ticket (rollup) - subtract
      const currentBilled = ticket.billed_hours || 0;
      await updateTicketFields(ticket.id, { billed_hours: Math.max(0, currentBilled - entry.hours) });
      
      toast.success('Time entry removed');
      fetchTimeEntries();
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const handleEditTimeEntry = async (entry: TimeEntry, newHours: string) => {
    const hours = parseFloat(newHours);
    if (!hours || isNaN(hours)) return;

    try {
      const { error } = await supabase.from('time_entries').update({ hours }).eq('id', entry.id);
      if (error) throw error;
      
      // Re-calculate total billed hours for this ticket
      const { data: allEntries } = await supabase
        .from('time_entries')
        .select('hours')
        .eq('ticket_id', ticket.id);
      
      const totalHours = (allEntries || []).reduce((sum, e) => sum + Number(e.hours), 0);
      await updateTicketFields(ticket.id, { billed_hours: totalHours });
      
      toast.success('Time entry updated');
      setIsEditingTimeEntry(null);
      fetchTimeEntries();
    } catch (err: any) {
      toast.error('Failed to update: ' + err.message);
    }
  };

  const handleSaveToggles = async (updates: Partial<Ticket>) => {
    setSavingToggles(true);
    await updateTicketFields(ticket.id, updates);
    setSavingToggles(false);
    import('react-hot-toast').then(({ default: toast }) => {
      toast.success('Changes saved automatically');
    });
  };

  const handlePriorityChange = async (newPriority: string) => {
    await updateTicketFields(ticket.id, { priority: newPriority as Ticket['priority'] });
    import('react-hot-toast').then(({ default: toast }) => toast.success('Priority updated'));
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'done' && (!ticket.acceptance_criteria || !ticket.acceptance_criteria.trim())) {
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error('Acceptance Criteria required before completing ticket.');
      });
      return;
    }

    // Check approval gates
    const check = canTransition(ticket, newStatus);
    if (!check.allowed) {
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error(check.reason || 'Transition blocked by approval gate.');
      });
      return;
    }

    setSavingStatus(true);
    await updateTicketFields(ticket.id, { status: newStatus as Ticket['status'] });
    setCurrentStatus(newStatus as typeof currentStatus);
    setSavingStatus(false);
  };

  const handleAssigneeChange = async (userId: string) => {
    const assignedId = userId === 'unassigned' ? null : userId;
    await updateTicketFields(ticket.id, { assigned_to: assignedId });
  };

  const handleBranchChange = async (branchId: string) => {
    const assignedId = branchId === 'global' ? null : branchId;
    await updateTicketFields(ticket.id, { branch_id: assignedId });
  };

  const handleProductChange = async (productId: string) => {
    const pId = productId === 'unassigned' ? null : productId;
    await updateTicketFields(ticket.id, { product_id: pId });
  };

  const handleDelete = async () => {
    await deleteTicket(ticket.id);
    onClose();
  };

  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const handleUploadAttachment = async (file: File) => {
    setUploadingAttachment(true);
    try {
      const uniquePrefix = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${myProfile?.id || 'unknown'}/${uniquePrefix}_${safeFileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('ticket_attachments')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

      // Insert into ticket_attachments table
      const { error: dbError } = await supabase.from('ticket_attachments').insert({
        ticket_id: ticket.id,
        file_path: data.path,
        file_name: file.name,
        file_size: file.size,
        uploaded_by: myProfile?.id
      });

      if (dbError) throw dbError;

      toast.success(`Attached: ${file.name}`);
      fetchAttachments();
    } catch (err: any) {
      console.error('Attachment upload error:', err);
      toast.error('Failed to upload: ' + err.message);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = async (attachment: TicketAttachment) => {
    if (!window.confirm("Remove this attachment?")) return;
    try {
      await supabase.storage.from('ticket_attachments').remove([attachment.file_path]);
      await supabase.from('ticket_attachments').delete().eq('id', attachment.id);
      toast.success('Attachment removed');
      fetchAttachments();
    } catch (err: any) {
      toast.error('Failed to remove attachment: ' + err.message);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        await handleUploadAttachment(file);
      }
    }
  };

  const handleDownloadAttachment = async (attachment: TicketAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('ticket_attachments')
        .createSignedUrl(attachment.file_path, 60);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toast.error("Failed to download: " + err.message);
    }
  };

  const handleExportPDF = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      const container = document.createElement('div');
      container.style.padding = '20px';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.color = '#333';
      
      let htmlContent = `
        <div style="border-bottom: 2px solid #eaeaea; padding-bottom: 15px; margin-bottom: 25px;">
          <h1 style="margin: 0 0 10px 0; font-size: 26px; color: #111;">[${ticket.readable_id}] ${ticket.title}</h1>
          <div style="display: flex; gap: 20px; font-size: 14px; color: #555;">
            <span><strong>Type:</strong> ${ticket.type}</span>
            <span><strong>Status:</strong> ${ticket.status}</span>
            <span><strong>Priority:</strong> <span style="text-transform: capitalize;">${ticket.priority}</span></span>
          </div>
        </div>
      `;

      if (ticket.description) {
        htmlContent += `
          <div style="margin-bottom: 25px;">
            <h3 style="margin-bottom: 12px; font-size: 18px; color: #111; border-bottom: 1px solid #eaeaea; padding-bottom: 5px;">Description</h3>
            <div style="font-size: 14px; line-height: 1.6;">${ticket.description}</div>
          </div>
        `;
      }
      
      if (ticket.acceptance_criteria) {
        htmlContent += `
          <div style="margin-bottom: 25px;">
            <h3 style="margin-bottom: 12px; font-size: 18px; color: #111; border-bottom: 1px solid #eaeaea; padding-bottom: 5px;">Acceptance Criteria</h3>
            <div style="font-size: 14px; line-height: 1.6;">${ticket.acceptance_criteria}</div>
          </div>
        `;
      }
      
      htmlContent += `
        <div>
          <h3 style="margin-bottom: 15px; font-size: 18px; color: #111; border-bottom: 1px solid #eaeaea; padding-bottom: 5px;">Activity Feed</h3>
          <div style="display: flex; flex-direction: column; gap: 15px;">
      `;

      unifiedFeed.forEach(item => {
        const authorName = item.author?.full_name || item.author?.email || 'Deleted user';
        const dateStr = format(new Date(item.created_at), 'MMM d, yyyy h:mm a');
        
        if (item.feedType === 'log') {
          htmlContent += `
            <div style="font-size: 12px; color: #666; background: #f9f9f9; padding: 10px 14px; border-radius: 6px; border-left: 3px solid #e5e7eb;">
              <strong>[${dateStr}] ${authorName}</strong>: ${item.action.replace(/<[^>]+>/g, '')}
            </div>
          `;
        } else if (item.feedType === 'comment') {
          const isInternal = item.is_internal_only;
          htmlContent += `
            <div style="font-size: 14px; background: ${isInternal ? '#fff9db' : '#f8fafc'}; padding: 14px 18px; border-radius: 8px; border-left: 4px solid ${isInternal ? '#fcc419' : '#3b82f6'};">
              <div style="margin-bottom: 8px; font-size: 12px; color: #555;">
                <strong>${authorName}</strong> <span style="color: #888;">&bull; ${dateStr}</span>
                ${isInternal ? '<span style="background:#fcc419; color:#fff; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:bold; margin-left:8px;">INTERNAL</span>' : ''}
              </div>
              <div style="line-height: 1.6; color: #1f2937;">${item.comment_text}</div>
            </div>
          `;
        }
      });

      htmlContent += `</div></div>`;
      container.innerHTML = DOMPurify.sanitize(htmlContent);

      const opt = {
        margin:       0.5,
        filename:     `${ticket.readable_id}-export.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      };

      html2pdf().set(opt).from(container).save();
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF export.');
    }
  };

  const handleSaveScope = async () => {
    setSavingScope(true);
    await updateTicketFields(ticket.id, {
      estimated_hours: scopeData.estimated_hours ? parseTimeToHours(scopeData.estimated_hours) : null,
      billed_hours: scopeData.billed_hours ? parseTimeToHours(scopeData.billed_hours) : null,
      target_start_date: scopeData.target_start_date ? format(scopeData.target_start_date, 'yyyy-MM-dd') : null,
      target_test_date: scopeData.target_test_date ? format(scopeData.target_test_date, 'yyyy-MM-dd') : null,
      target_completion_date: scopeData.target_completion_date ? format(scopeData.target_completion_date, 'yyyy-MM-dd') : null,
    });
    setIsEditingScope(false);
    setSavingScope(false);
  };

  const handleSaveAc = async () => {
    setSavingAc(true);
    await updateTicketFields(ticket.id, { acceptance_criteria: localAc.trim() || null });
    setIsEditingAc(false);
    setSavingAc(false);
  };

  const handleSaveTitle = async () => {
    if (!localTitle.trim()) return;
    setSavingTitle(true);
    await updateTicketFields(ticket.id, { title: localTitle.trim() });
    setIsEditingTitle(false);
    setSavingTitle(false);
  };

  const handleSaveDescription = async () => {
    setSavingDescription(true);
    await updateTicketFields(ticket.id, { description: localDescription.trim() || null });
    setIsEditingDescription(false);
    setSavingDescription(false);
  };

  const rollupData = useMemo(() => {
    const subTasks = tickets.filter(t => t.parent_ticket_id === ticket.id);
    if (subTasks.length === 0) return null;

    let estimated = ticket.estimated_hours || 0;
    let billed = ticket.billed_hours || 0;

    subTasks.forEach(child => {
      estimated += (child.estimated_hours || 0);
      billed += (child.billed_hours || 0);
    });

    const completedTasks = subTasks.filter(t => t.status === 'done').length;
    const progress = Math.round((completedTasks / subTasks.length) * 100);

    return { estimated, billed, totalTasks: subTasks.length, completedTasks, progress };
  }, [ticket.id, ticket.estimated_hours, ticket.billed_hours, tickets]);

  const unifiedFeed = useMemo(() => {
    const comments = customerComments.map(c => ({
      ...c,
      feedType: 'comment' as const,
    }));
    const logs = activityLogs.map(l => ({
      ...l,
      feedType: 'log' as const,
      author: l.actor,
    }));
    return [...comments, ...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [customerComments, activityLogs]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-surface-dark shadow-2xl z-50 flex flex-col border-l border-gray-100 dark:border-gray-800 animate-slide-in">
        
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 shrink-0">
              {ticket.readable_id}
            </span>
            <PresenceAvatars ticketId={ticket.id} />
            <div className={`relative px-1 py-0.5 rounded-full ${priority.className}`}>
              <select
                value={ticket.priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="appearance-none bg-transparent cursor-pointer pl-2 pr-6 py-0.5 text-xs font-bold focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5">
                <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
            {(() => {
              const typeStyles: Record<string, string> = {
                bug: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
                feature_request: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
                improvement: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
                task: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
                documentation: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                professional_service: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
                project: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
              };
              const typeIcons: Record<string, React.ReactNode> = {
                bug: <Bug size={12} />,
                feature_request: <Sparkles size={12} />,
                improvement: <Zap size={12} />,
                task: <Tag size={12} />,
                documentation: <FileText size={12} />,
                professional_service: <Briefcase size={12} />,
                project: <Package size={12} />,
              };
              return (
                <div className={`relative flex items-center gap-1 px-1 py-0.5 rounded-full ${typeStyles[ticket.type] || ''}`}>
                  {typeIcons[ticket.type]}
                  <select
                    value={ticket.type}
                    onChange={(e) => updateTicketFields(ticket.id, { type: e.target.value as Ticket['type'] })}
                    className="appearance-none bg-transparent cursor-pointer pl-1 pr-5 py-0.5 text-xs font-bold focus:outline-none"
                  >
                    <option value="bug">Bug</option>
                    <option value="feature_request">Feature</option>
                    <option value="improvement">Improvement</option>
                    <option value="task">Task</option>
                    <option value="documentation">Documentation</option>
                    <option value="professional_service">Service</option>
                    <option value="project">Project</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5">
                    <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              title="Export as PDF"
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              <Download size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          
          {/* Title and Parent Link */}
          <div>
            {ticket.is_blocked && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                  <ShieldAlert size={14} /> BLOCKED
                </span>
                {ticket.blocked_by_ticket_id && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    Waiting on {tickets.find(t => t.id === ticket.blocked_by_ticket_id)?.readable_id || 'Unknown'}
                  </span>
                )}
              </div>
            )}
            {isEditingTitle ? (
              <div className="space-y-2 mb-2">
                <input
                  type="text"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  className="w-full text-2xl font-bold bg-white dark:bg-surface-dark border-2 border-primary-500 rounded-lg px-3 py-1 focus:outline-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setIsEditingTitle(false); setLocalTitle(ticket.title || ''); }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveTitle}
                    disabled={savingTitle || !localTitle.trim()}
                    className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingTitle ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <h1 
                onClick={() => setIsEditingTitle(true)}
                className="text-2xl font-bold text-gray-900 dark:text-white leading-tight cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded -ml-2 px-2 py-1.5 transition-colors group relative"
              >
                {ticket.title}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Edit</span>
                </div>
              </h1>
            )}
            {ticket.parent_ticket_id && (
              <div className="mt-2 flex items-center text-sm">
                <span className="text-gray-500 mr-2">Part of Project:</span>
                <span className="font-semibold text-primary-600 dark:text-primary-400">
                  {tickets.find(t => t.id === ticket.parent_ticket_id)?.readable_id} - {tickets.find(t => t.id === ticket.parent_ticket_id)?.title}
                </span>
              </div>
            )}
          </div>

          {rollupData && (
            <div className="mb-6 px-4 pt-4 pb-5 rounded-xl border border-primary-100 dark:border-primary-900/30 bg-primary-50/50 dark:bg-primary-900/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">Project Progress</span>
                <span className="text-sm font-extrabold text-primary-900 dark:text-primary-100">{rollupData.progress}%</span>
              </div>
              <div className="h-2.5 bg-primary-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-primary-500 rounded-full transition-all duration-1000 ease-in-out" 
                  style={{ width: `${rollupData.progress}%` }}
                />
              </div>
              <div className="mt-2.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {rollupData.completedTasks} of {rollupData.totalTasks} sub-tasks completed
              </div>
            </div>
          )}

          <TicketProgressBar status={ticket.status} />

          {/* SLA Status */}
          {(ticket.sla_response_deadline || ticket.sla_resolution_deadline) && (
            <SlaBadge
              responseDeadline={ticket.sla_response_deadline}
              resolutionDeadline={ticket.sla_resolution_deadline}
              responseBreach={ticket.sla_response_breached}
              resolutionBreach={ticket.sla_resolution_breached}
              firstRespondedAt={ticket.first_responded_at}
              status={ticket.status}
              variant="detail"
            />
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Calendar size={15} className="text-gray-400 shrink-0" />
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Created</div>
                <div className="font-medium text-gray-700 dark:text-gray-200">
                  {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <User size={15} className="text-gray-400 shrink-0" />
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Assigned to</div>
                <select
                  value={ticket.assigned_to || 'unassigned'}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  className="font-medium bg-transparent text-primary-600 dark:text-primary-400 focus:outline-none cursor-pointer"
                >
                  <option value="unassigned">Unassigned</option>
                  {assignees.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Eye size={15} className="text-gray-400 shrink-0" />
              <div className="relative group/watchers">
                <div className="text-xs text-gray-400 mb-0.5">Watchers</div>
                <div className="font-medium text-primary-600 dark:text-primary-400 cursor-pointer flex items-center gap-1">
                  {ticket.watchers?.length || 0} watching
                  <ChevronDown size={12} className="opacity-50" />
                </div>
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-100 dark:border-gray-700 p-2 z-[60] opacity-0 invisible group-hover/watchers:opacity-100 group-hover/watchers:visible transition-all">
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {assignees.map(user => {
                      const isWatching = ticket.watchers?.some(w => w.user_id === user.id);
                      return (
                        <label key={user.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!!isWatching}
                            onChange={(e) => {
                              if (e.target.checked) useTicketStore.getState().addWatcher(ticket.id, user.id);
                              else useTicketStore.getState().removeWatcher(ticket.id, user.id);
                            }}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                            {user.full_name || user.email}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <GitBranch size={15} className="text-gray-400 shrink-0" />
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Branch</div>
                <select
                  value={ticket.branch_id || 'global'}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="font-medium bg-transparent text-primary-600 dark:text-primary-400 focus:outline-none cursor-pointer"
                >
                  <option value="global">Global / Unassigned</option>
                  {branches.filter(b => b.is_active || b.id === ticket.branch_id).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Branch Info Panel — staff only */}
            {myProfile && myProfile.role !== 'branch_manager' && (
              <div className="col-span-2">
                <BranchInfoPanel branchId={ticket.branch_id || null} />
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Package size={15} className="text-gray-400 shrink-0" />
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Catalog Product</div>
                <select
                  value={ticket.product_id || 'unassigned'}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="font-medium bg-transparent text-primary-600 dark:text-primary-400 focus:outline-none cursor-pointer"
                >
                  <option value="unassigned">None</option>
                  {products.filter(p => p.status === 'active' || p.id === ticket.product_id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Tag size={15} className="text-gray-400 shrink-0" />
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Release Version / Tag</div>
                <input
                  type="text"
                  defaultValue={ticket.target_version || ''}
                  onBlur={(e) => updateTicketFields(ticket.id, { target_version: e.target.value.trim() || null })}
                  className="font-medium bg-transparent text-primary-600 dark:text-primary-400 focus:outline-none placeholder-gray-300 dark:placeholder-gray-600 w-32"
                  placeholder="e.g. v1.0.0"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Target size={15} className="text-gray-400 shrink-0" />
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Milestone</div>
                <select
                  value={(ticket as any).milestone_id || 'none'}
                  onChange={(e) => updateTicketFields(ticket.id, { milestone_id: e.target.value === 'none' ? null : e.target.value } as any)}
                  className="font-medium bg-transparent text-primary-600 dark:text-primary-400 focus:outline-none cursor-pointer"
                >
                  <option value="none">None</option>
                  {milestones.filter(m => m.status !== 'completed').map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {ticket.customer_name && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Tag size={15} className="text-gray-400 shrink-0" />
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Customer</div>
                  <div className="font-medium text-gray-700 dark:text-gray-200">{ticket.customer_name}</div>
                </div>
              </div>
            )}
            {ticket.customer_email && (
              <div className="flex items-start gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Customer Email</div>
                  <a href={`mailto:${ticket.customer_email}`} className="font-medium text-primary-600 hover:underline truncate block">
                    {ticket.customer_email}
                  </a>
                </div>
              </div>
            )}
            
            {/* Products */}
            {(ticket.product_family || ticket.product_tier) && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 col-span-2 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 mt-1">
                <Package size={15} className="text-primary-500 shrink-0" />
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{ticket.product_family || 'Any Product'}</span>
                  {ticket.product_tier && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">/</span>
                      <span className="text-gray-600 dark:text-gray-400">{ticket.product_tier}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* QA & Approval Gates */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-4">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">QA & Approvals</div>
              <div className="flex flex-col gap-3">
                {/* Admin Approval */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <CheckCircle2 size={16} className={ticket.admin_approved ? 'text-primary-500' : 'text-gray-400'} />
                    Admin Approval
                  </span>
                  {ticket.admin_approved ? (
                    <button
                      onClick={() => revokeApproval(ticket.id, 'admin')}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                    >
                      Revoke
                    </button>
                  ) : (
                    (myProfile?.role === 'admin') && (
                      <button
                        onClick={() => approveTicket(ticket.id, 'admin')}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40 transition-colors"
                      >
                        Approve
                      </button>
                    )
                  )}
                </div>

                {/* Customer Approval */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <CheckCircle2 size={16} className={ticket.customer_approved ? 'text-emerald-500' : 'text-gray-400'} />
                    Customer Approval
                  </span>
                  {ticket.customer_approved ? (
                    <button
                      onClick={() => revokeApproval(ticket.id, 'customer')}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                    >
                      Revoke
                    </button>
                  ) : (
                    <button
                      onClick={() => approveTicket(ticket.id, 'customer')}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition-colors"
                    >
                      Approve
                    </button>
                  )}
                </div>

                {/* Gate Info — show which transitions are blocked */}
                {gates.filter(g => g.is_active && g.from_status === ticket.status).length > 0 && (
                  <div className="mt-1 p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">Gate Requirements</div>
                    {gates.filter(g => g.is_active && g.from_status === ticket.status).map(g => {
                      const statusLabel = g.to_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      const needs: string[] = [];
                      if (g.requires_admin_approval && !ticket.admin_approved) needs.push('Admin');
                      if (g.requires_customer_approval && !ticket.customer_approved) needs.push('Customer');
                      const met = needs.length === 0;
                      return (
                        <div key={g.id} className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                          {met ? <CheckCircle2 size={12} className="text-green-500" /> : <span className="text-amber-500">🔒</span>}
                          <span>→ {statusLabel}: {met ? 'Ready' : `Needs ${needs.join(' & ')} approval`}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(myProfile?.role === 'admin' || myProfile?.role === 'developer') && (
                  <label className="flex items-center gap-2 cursor-pointer group mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <input
                      type="checkbox"
                      checked={isKnownIssue}
                      onChange={(e) => {
                        setIsKnownIssue(e.target.checked);
                        handleSaveToggles({ is_known_issue: e.target.checked });
                      }}
                      className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 disabled:opacity-50"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white flex items-center gap-1.5">
                      <ShieldAlert size={16} className="text-gray-400 group-hover:text-red-500" /> Flag as Global Known Issue/Outage
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <label className="flex items-center gap-2 cursor-pointer group mb-2">
                <input
                  type="checkbox"
                  checked={blockedToggle}
                  onChange={(e) => {
                    const isBlocked = e.target.checked;
                    setBlockedToggle(isBlocked);
                    if (!isBlocked) {
                      setBlockedReason('');
                      setBlockedBy(null);
                      handleSaveToggles({ is_blocked: false, blocked_reason: null, blocked_by_ticket_id: null });
                    }
                  }}
                  className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 disabled:opacity-50"
                />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-red-600 flex items-center gap-1.5 transition-colors">
                  <ShieldAlert size={16} className={blockedToggle ? 'text-red-500' : 'text-gray-400'} /> Mark as Blocked
                </span>
              </label>

              {blockedToggle && (
                <div className="pl-6 animate-pulse-fade-in relative flex flex-col gap-2">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Why is it blocked?"
                      value={blockedReason}
                      onChange={(e) => setBlockedReason(e.target.value)}
                      onBlur={() => handleSaveToggles({ is_blocked: true, blocked_reason: blockedReason, blocked_by_ticket_id: blockedBy })}
                      className="w-full px-3 py-1.5 text-sm border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 text-red-900 dark:text-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 pr-8"
                    />
                    {savingToggles && <Loader2 size={14} className="animate-spin text-red-500 absolute right-3" />}
                  </div>
                  <select
                    value={blockedBy || ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setBlockedBy(val);
                      handleSaveToggles({ is_blocked: true, blocked_reason: blockedReason, blocked_by_ticket_id: val });
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 text-red-900 dark:text-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">-- No specific ticket blocking this --</option>
                    {tickets.filter(t => t.id !== ticket.id).map(t => (
                      <option key={t.id} value={t.id}>{t.readable_id} - {t.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Linked Tickets */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Link2 size={13} /> Linked Tickets
              </div>
              <button
                onClick={() => setShowLinkForm(!showLinkForm)}
                className="text-xs font-semibold text-primary-500 hover:text-primary-600 transition-colors flex items-center gap-1"
              >
                <Plus size={12} /> {showLinkForm ? 'Cancel' : 'Link'}
              </button>
            </div>

            {/* Add Link Form */}
            {showLinkForm && (
              <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2 animate-pulse-fade-in">
                <div className="flex gap-2">
                  <select
                    value={linkRelType}
                    onChange={(e) => setLinkRelType(e.target.value as RelationshipType)}
                    className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="related_to">Related To</option>
                    <option value="blocks">Blocks</option>
                    <option value="blocked_by">Blocked By</option>
                    <option value="duplicate_of">Duplicate Of</option>
                    <option value="duplicated_by">Duplicated By</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Search by ID or title..."
                    value={linkSearchQuery}
                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {linkSearchQuery.length >= 2 && (
                  <div className="max-h-32 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {tickets
                      .filter(t => t.id !== ticket.id && (
                        t.readable_id.toLowerCase().includes(linkSearchQuery.toLowerCase()) ||
                        t.title.toLowerCase().includes(linkSearchQuery.toLowerCase())
                      ))
                      .slice(0, 8)
                      .map(t => (
                        <button
                          key={t.id}
                          onClick={async () => {
                            await addRelationship(ticket.id, t.id, linkRelType);
                            setLinkSearchQuery('');
                            setShowLinkForm(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-center gap-2"
                        >
                          <span className="font-bold text-primary-600 dark:text-primary-400 shrink-0">{t.readable_id}</span>
                          <span className="truncate text-gray-600 dark:text-gray-300">{t.title}</span>
                          <span className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            t.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            t.status === 'dev_in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {t.status.replace(/_/g, ' ')}
                          </span>
                        </button>
                      ))}
                    {tickets.filter(t => t.id !== ticket.id && (
                      t.readable_id.toLowerCase().includes(linkSearchQuery.toLowerCase()) ||
                      t.title.toLowerCase().includes(linkSearchQuery.toLowerCase())
                    )).length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400 text-center">No matching tickets</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Relationship List */}
            {loadingRelationships ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-primary-500" />
              </div>
            ) : relationships.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-3">No linked tickets</div>
            ) : (
              <div className="space-y-2">
                {(['blocks', 'blocked_by', 'related_to', 'duplicate_of', 'duplicated_by'] as RelationshipType[]).map(relType => {
                  const rels = relationships.filter(r => r.relationship_type === relType);
                  if (rels.length === 0) return null;

                  const typeConfig: Record<string, { label: string; color: string; icon: string }> = {
                    blocks: { label: 'Blocks', color: 'text-red-600 dark:text-red-400', icon: '🚫' },
                    blocked_by: { label: 'Blocked By', color: 'text-orange-600 dark:text-orange-400', icon: '⛔' },
                    related_to: { label: 'Related To', color: 'text-blue-600 dark:text-blue-400', icon: '🔗' },
                    duplicate_of: { label: 'Duplicate Of', color: 'text-purple-600 dark:text-purple-400', icon: '📋' },
                    duplicated_by: { label: 'Duplicated By', color: 'text-purple-600 dark:text-purple-400', icon: '📋' },
                  };

                  const config = typeConfig[relType] || { label: relType, color: 'text-gray-600', icon: '🔗' };

                  return (
                    <div key={relType}>
                      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${config.color}`}>
                        {config.icon} {config.label}
                      </div>
                      {rels.map(rel => (
                        <div key={rel.id} className="flex items-center gap-2 py-1.5 group">
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                            {rel.target_ticket?.readable_id || '???'}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">
                            {rel.target_ticket?.title || 'Unknown'}
                          </span>
                          {rel.target_ticket?.status && (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              rel.target_ticket.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              rel.target_ticket.status === 'dev_in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {rel.target_ticket.status.replace(/_/g, ' ')}
                            </span>
                          )}
                          <button
                            onClick={() => removeRelationship(rel.id, ticket.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all"
                            title="Remove link"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Selector */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Status</div>
            <div className="flex items-center gap-2">
              <select
                value={currentStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="pending">Intake / New Request</option>
                <option value="planning">Planning</option>
                <option value="sow_in_progress">SOW In Progress</option>
                <option value="awaiting_customer_approval">Awaiting Customer Approval</option>
                <option value="ready_for_dev">Ready for Dev</option>
                <option value="dev_in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="on_hold_customer">On-Hold: Customer</option>
                <option value="on_hold_dev">On-Hold: Dev</option>
                <option value="on_hold_support">On-Hold: Support</option>
                <option value="on_hold_sow">On-Hold: SOW</option>
                <option value="beta_testing">Approved / Ready to Release</option>
                <option value="done">Released / Closed</option>
                <option value="rejected">Rejected</option>
              </select>
              {savingStatus && <Loader2 size={16} className="animate-spin text-primary-500 shrink-0" />}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</div>
              {!isEditingDescription && (
                <button 
                  onClick={() => setIsEditingDescription(true)}
                  className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            
            {isEditingDescription ? (
              <div className="space-y-2">
                <RichTextEditor 
                  content={localDescription}
                  onChange={setLocalDescription}
                  placeholder="Describe the issue or request..."
                />
                <div className="flex gap-2 justify-end">
                  <button 
                    onClick={() => { setIsEditingDescription(false); setLocalDescription(ticket.description || ''); }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveDescription}
                    disabled={savingDescription}
                    className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingDescription ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              ticket.description ? (
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-3 -ml-3 rounded-lg transition-colors group relative"
                  onClick={() => setIsEditingDescription(true)}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.description || '') }}
                />
              ) : (
                <div 
                  onClick={() => setIsEditingDescription(true)}
                  className="px-4 py-5 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    No description provided.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click to add a description.
                  </p>
                </div>
              )
            )}
          </div>

          {/* Acceptance Criteria */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Acceptance Criteria</div>
              {!isEditingAc && (
                <button 
                  onClick={() => setIsEditingAc(true)}
                  className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            
            {isEditingAc ? (
              <div className="space-y-2">
                <RichTextEditor 
                  content={localAc}
                  onChange={setLocalAc}
                  placeholder="What needs to be true for this ticket to be considered 'Done'?"
                />
                <div className="flex gap-2 justify-end">
                  <button 
                    onClick={() => { setIsEditingAc(false); setLocalAc(ticket.acceptance_criteria || ''); }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveAc}
                    disabled={savingAc}
                    className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingAc ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              ticket.acceptance_criteria ? (
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50/50 dark:bg-gray-800/20 p-3 rounded-xl border border-gray-100 dark:border-gray-800"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.acceptance_criteria || '') }}
                />
              ) : (
                <div 
                  onClick={() => setIsEditingAc(true)}
                  className="px-4 py-5 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    No criteria defined.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click to add requirement parameters.
                  </p>
                </div>
              )
            )}
          </div>

          {/* Dev Tasks (Child Tickets) */}
          {myProfile && myProfile.role !== 'branch_manager' && (
            <div className="bg-primary-50/50 dark:bg-primary-900/10 p-4 rounded-xl border border-primary-100 dark:border-primary-900/30">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider flex items-center gap-2">
                  <GitBranch size={14} /> Dev Tasks
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsLinkingTask(!isLinkingTask)}
                    className="text-xs font-semibold bg-white border border-primary-200 dark:border-primary-800 text-primary-700 hover:bg-primary-50 dark:bg-surface-dark dark:hover:bg-primary-900/20 dark:text-primary-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                  >
                    Link Existing
                  </button>
                  <button 
                    onClick={() => setShowNewChildTicket(true)}
                    className="text-xs font-semibold bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900/40 dark:text-primary-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Package size={12} /> New Task
                  </button>
                </div>
              </div>
              
              {isLinkingTask && (
                <div className="mb-4 flex gap-2 flex-col sm:flex-row items-stretch sm:items-center bg-white dark:bg-surface-dark p-3 rounded-xl border border-primary-100 dark:border-primary-800 shadow-sm animate-pulse-fade-in relative">
                  <div className="relative flex-1 min-w-0">
                    <button
                      onClick={() => setShowTaskDropdown(!showTaskDropdown)}
                      className="w-full text-left text-sm bg-gray-50 dark:bg-surface-dark-raised border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white cursor-pointer flex justify-between items-center transition-colors min-w-0 shrink flex-nowrap"
                    >
                      <span className="truncate mr-2 flex-1 min-w-0">
                        {selectedTaskToLink 
                          ? `${linkableTickets.find(t => t.id === selectedTaskToLink)?.readable_id} - ${linkableTickets.find(t => t.id === selectedTaskToLink)?.title}`
                          : "Select a task to link..."}
                      </span>
                      <ChevronDown size={14} className={`text-gray-400 transition-transform shrink-0 ${showTaskDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showTaskDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-surface-dark-raised border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1">
                        {linkableTickets.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500 text-center">No tasks available</div>
                        ) : linkableTickets.map(t => (
                          <div
                            key={t.id}
                            onClick={() => { setSelectedTaskToLink(t.id); setShowTaskDropdown(false); }}
                            className="px-3 py-2 hover:bg-primary-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-900 dark:text-white border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors"
                          >
                            <span className="font-bold text-primary-600 dark:text-primary-400 mr-2">{t.readable_id}</span>
                            {t.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleLinkTask}
                    disabled={!selectedTaskToLink || isLinking}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-sm min-w-[80px] flex items-center justify-center shrink-0"
                  >
                    {isLinking ? <Loader2 size={14} className="animate-spin" /> : 'Link'}
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {tickets.filter(t => t.parent_ticket_id === ticket.id).length === 0 ? (
                  <div className="px-4 py-3 bg-white/50 dark:bg-surface-dark/50 border border-primary-100/50 dark:border-primary-900/20 rounded-xl text-sm text-primary-500/70 italic text-center">
                    No Dev Tasks allocated for this request yet.
                  </div>
                ) : (
                  tickets.filter(t => t.parent_ticket_id === ticket.id).map(child => {
                    const statusObj = COLUMNS.find(opt => opt.id === child.status);
                    const childPriority = priorityConfig[child.priority];
                    return (
                      <div key={child.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-surface-dark border-l-4 border-l-primary-500 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                            {child.readable_id}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-[250px]">
                            {child.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${childPriority.className}`}>
                            {childPriority.label}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded">
                            {statusObj ? statusObj.label : child.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Attachments ({attachments.length})</div>
              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                disabled={uploadingAttachment}
                className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors flex items-center gap-1"
              >
                {uploadingAttachment ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                {uploadingAttachment ? 'Uploading…' : 'Add File'}
              </button>
            </div>

            <input
              type="file"
              ref={attachmentInputRef}
              className="hidden"
              multiple
              accept=".csv,.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.doc,.docx,.zip,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  Array.from(e.target.files).forEach(file => handleUploadAttachment(file));
                  e.target.value = '';
                }
              }}
            />

            <div className="space-y-2">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-3 w-full p-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <button
                    onClick={() => handleDownloadAttachment(att)}
                    className="flex items-center gap-3 flex-1 min-w-0 group"
                  >
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400 shrink-0">
                      <FileText size={18} className="group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {att.file_name}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB • ` : ''}
                        {format(new Date(att.created_at), 'MMM d')}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleRemoveAttachment(att)}
                    title="Remove attachment"
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => attachmentInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 text-primary-600' 
                    : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-gray-800/30'
                }`}
              >
                <div className={`p-3 rounded-full ${isDragging ? 'bg-primary-100 text-primary-600' : 'bg-gray-50 dark:bg-gray-800 text-gray-400'}`}>
                  <Paperclip size={24} className={isDragging ? 'animate-bounce' : ''} />
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold block">
                    {isDragging ? 'Drop to upload' : 'Click or drag to attach'}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold opacity-60">
                    PDF, XLS, PNG, ZIP, DOCX up to 50MB
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Scope & Scheduling */}
          <div className="bg-gray-50/50 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <div className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Scope & Timeline</div>
              </div>
              {!isEditingScope && (
                <button 
                  onClick={() => setIsEditingScope(true)}
                  className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                >
                  Edit Timeline
                </button>
              )}
            </div>

            {isEditingScope ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Hours</label>
                    <input 
                      type="text" placeholder="e.g. 1w 2d 4h"
                      value={scopeData.estimated_hours} onChange={(e) => setScopeData({...scopeData, estimated_hours: e.target.value})}
                      className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-surface-dark text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Billed Hours</label>
                    <input 
                      type="text" placeholder="e.g. 3d 4h"
                      value={scopeData.billed_hours} onChange={(e) => setScopeData({...scopeData, billed_hours: e.target.value})}
                      className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-surface-dark text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Target Start</label>
                    <DatePicker 
                      selected={scopeData.target_start_date} 
                      onChange={(date) => setScopeData({...scopeData, target_start_date: date})}
                      isClearable
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Target Test</label>
                    <DatePicker 
                      selected={scopeData.target_test_date} 
                      onChange={(date) => setScopeData({...scopeData, target_test_date: date})}
                      isClearable
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Due Date</label>
                    <DatePicker 
                      selected={scopeData.target_completion_date} 
                      onChange={(date) => setScopeData({...scopeData, target_completion_date: date})}
                      isClearable
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setIsEditingScope(false)} className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Cancel</button>
                  <button onClick={handleSaveScope} disabled={savingScope} className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2">
                    {savingScope ? <Loader2 size={12} className="animate-spin" /> : 'Save Timeline'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-1">
                    {rollupData ? 'Project Total Estimates' : 'Estimates'}
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {rollupData 
                      ? formatHoursToTime(rollupData.estimated) 
                      : formatHoursToTime(ticket.estimated_hours)} 
                    <span className="text-gray-300 dark:text-gray-600">/</span> 
                    <span className="text-gray-500">
                      {rollupData ? formatHoursToTime(rollupData.billed) : formatHoursToTime(ticket.billed_hours)} spent
                    </span>
                  </p>
                  
                  {((rollupData?.estimated ?? ticket.estimated_hours ?? 0) > 0) && ((rollupData?.billed ?? ticket.billed_hours ?? 0) > 0) && (
                    <div className="mt-1.5 flex flex-col gap-1.5 w-full pr-6">
                      {(() => {
                        const est = rollupData?.estimated ?? ticket.estimated_hours ?? 0;
                        const bil = rollupData?.billed ?? ticket.billed_hours ?? 0;
                        const over = bil > est;
                        const pct = Math.min(Math.round((bil / est) * 100), 100);
                        
                        return (
                          <>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-primary-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div>
                              {over ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                  Overrun by {formatHoursToTime(bil - est)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                                  {pct}% budget used
                                </span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Timer</p>
                  </div>
                  <TimerButton ticketId={ticket.id} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Log Time</p>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      id="log-hours-input"
                      placeholder="Hours..."
                      min="0.1"
                      step="0.1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          handleLogTime(input.value);
                          input.value = '';
                        }
                      }}
                      className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-surface-dark text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button 
                      onClick={() => {
                        const input = document.getElementById('log-hours-input') as HTMLInputElement;
                        if (input) {
                          handleLogTime(input.value);
                          input.value = '';
                        }
                      }}
                      className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-semibold rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                    >
                      Log
                    </button>
                  </div>
                </div>

                {/* Time History List */}
                {timeEntries.length > 0 && (
                  <div className="col-span-2 space-y-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Time History</p>
                    <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                      {timeEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800/40 rounded-lg border border-gray-50 dark:border-gray-800 group">
                          <div className="flex items-center gap-2">
                            {isEditingTimeEntry === entry.id ? (
                              <input
                                type="number"
                                step="0.1"
                                value={editingHours}
                                onChange={(e) => setEditingHours(e.target.value)}
                                className="w-16 px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditTimeEntry(entry, editingHours);
                                  if (e.key === 'Escape') setIsEditingTimeEntry(null);
                                }}
                              />
                            ) : (
                              <span className="text-xs font-bold text-gray-900 dark:text-white">{entry.hours}h</span>
                            )}
                            <span className="text-[10px] text-gray-500">
                              by {entry.technician?.full_name || entry.technician?.email || 'Deleted user'} • {format(new Date(entry.created_at), 'MMM d')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isEditingTimeEntry === entry.id ? (
                              <>
                                <button onClick={() => handleEditTimeEntry(entry, editingHours)} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"><Check size={12} /></button>
                                <button onClick={() => setIsEditingTimeEntry(null)} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={12} /></button>
                              </>
                            ) : (
                              (['admin', 'developer', 'support_desk'].includes(myProfile?.role || '') || myProfile?.id === entry.technician_id) && (
                                <>
                                  <button 
                                    onClick={() => {
                                      setIsEditingTimeEntry(entry.id);
                                      setEditingHours(entry.hours.toString());
                                    }} 
                                    className="p-1 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteTimeEntry(entry)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={12} /></button>
                                </>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-1">Due Date</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {ticket.target_completion_date ? format(new Date(ticket.target_completion_date), 'MMM d, yyyy') : 'TBD'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Unified Feed: Communications & Notes & Logs */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Unified Ticket Feed</div>
            <div className="space-y-4 mb-4">
              {unifiedFeed.length > 0 ? unifiedFeed.map((item: any) => {
                if (item.feedType === 'log') {
                  return (
                    <div key={`log-${item.id}`} className="relative flex items-center justify-between group">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 shrink-0 font-bold text-[10px] mx-auto md:mx-0">
                        {(item.author?.full_name?.charAt(0) || item.author?.email?.charAt(0) || '?').toUpperCase()}
                      </div>
                      <div className="w-[calc(100%-2.5rem)] px-3 py-2 flex items-center gap-2">
                         <span className="font-semibold text-gray-900 dark:text-white text-xs whitespace-nowrap">
                           {item.author?.full_name || item.author?.email || 'Deleted user'}
                         </span>
                         <span className="text-gray-500 dark:text-gray-400 text-xs" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.action || '') }} />
                         <span className="font-mono text-[9px] text-gray-400 whitespace-nowrap ml-auto">
                           {format(new Date(item.created_at), 'MMM d, h:mm a')}
                         </span>
                      </div>
                    </div>
                  );
                }

                if (item.feedType === 'comment') {
                  const author = item.author;
                  const isStaff = !!author && ['admin', 'developer', 'support_desk'].includes(author.role);
                  const isInternal = item.is_internal_only;
                  
                  return (
                    <div key={`comment-${item.id}`} className={`flex gap-3 ${!isStaff ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isStaff ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {isStaff ? 'S' : author ? (author.full_name || author.email || '?').charAt(0).toUpperCase() : <User size={14} />}
                      </div>
                      <div className={`flex flex-col gap-1 w-full max-w-[85%] ${!isStaff ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium overflow-hidden">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {author ? (author.full_name || author.email) : 'Deleted user'}
                          </span>
                          {author && (
                            <>
                              <span>•</span>
                              <span className="text-gray-500 dark:text-gray-500">{isStaff ? 'Staff' : 'Customer'}</span>
                            </>
                          )}
                          <span>•</span>
                          <time className="whitespace-nowrap">{format(new Date(item.created_at), 'MMM d, h:mm a')}</time>
                          
                          {(myProfile?.role === 'admin' || myProfile?.id === item.author_id) && (
                            <>
                              <span>•</span>
                              <button 
                                onClick={() => handleDeleteComment(item.id)}
                                className="text-red-500/70 hover:text-red-500 hover:underline transition-colors outline-none shrink-0"
                                title="Delete Comment"
                              >
                                Delete
                              </button>
                            </>
                          )}

                          {isInternal && (
                            <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-bold uppercase text-[9px] tracking-wider ml-1">
                              Internal Note
                            </span>
                          )}
                        </div>
                        <div className={`p-3 rounded-2xl text-sm w-full shadow-sm border ${
                          isInternal 
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-100 border-yellow-200 dark:border-yellow-900/50 rounded-tl-sm'
                            : !isStaff 
                              ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-100 dark:border-gray-700 rounded-tr-sm' 
                              : 'bg-primary-50 text-gray-900 dark:bg-primary-900/20 dark:text-white border-primary-100 dark:border-primary-900/50 rounded-tl-sm'
                        }`}>
                          <div 
                            className={`prose prose-sm max-w-none leading-relaxed ${
                              isInternal ? 'text-yellow-900 dark:text-yellow-100' :
                              !isStaff ? 'dark:prose-invert text-gray-800 dark:text-gray-200' : 'dark:prose-invert text-gray-900 dark:text-white'
                            }`}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.comment_text || '') }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }) : (
                <div className="text-gray-400 italic text-sm text-center py-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/30">
                  No activity or communications yet.
                </div>
              )}
            </div>
            
            <div className="relative mt-2">
              <RichTextEditor 
                content={newCustomerComment}
                onChange={setNewCustomerComment}
                placeholder="Message customer or leave an internal note..."
                className="min-h-[60px] pb-12 shadow-sm"
              />
              <div className="absolute left-4 bottom-10 flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="hidden" checked={isInternalComment} onChange={(e) => setIsInternalComment(e.target.checked)} />
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isInternalComment 
                      ? 'bg-yellow-500 border-yellow-500 text-white' 
                      : 'border-gray-300 dark:border-gray-600 group-hover:border-yellow-500 dark:group-hover:border-yellow-500 bg-white dark:bg-gray-800'
                  }`}>
                    {isInternalComment && <div className="w-2 h-2 border-b-2 border-r-2 border-white transform rotate-45 -translate-y-0.5" />}
                  </div>
                  <span className={`text-[11px] font-bold tracking-wider uppercase transition-colors ${
                    isInternalComment ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-400'
                  }`}>
                    Internal Whisper Note
                  </span>
                </label>
              </div>
              <button 
                onClick={handleSendComment}
                disabled={!newCustomerComment.trim() || sendingComment}
                className="absolute right-3 bottom-9 w-8 h-8 flex items-center justify-center rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white shadow-md transition-transform hover:scale-105 active:scale-95"
              >
                {sendingComment ? <Loader2 size={14} className="animate-spin" /> : <div className="text-sm font-bold">&rarr;</div>}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-1.5 text-red-500 hover:text-red-700 transition-colors bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg font-semibold text-xs"
            >
              <Trash2 size={14} /> Delete
            </button>
            <div className="text-xs text-gray-400 font-medium hidden sm:block">
              Updated: {format(new Date(ticket.updated_at), 'MMM d · h:mm a')}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono bg-gray-200/50 dark:bg-gray-700/50 px-2.5 py-1 rounded-md text-gray-600 dark:text-gray-300 text-xs hidden sm:block">{ticket.readable_id}</span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Delete Ticket"
        message="Are you sure you want to permanently delete this ticket? This action cannot be undone and will remove it from all boards."
        confirmText="Delete Permanently"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />

      {showNewChildTicket && (
        <NewTicketModal onClose={() => setShowNewChildTicket(false)} initialParentId={ticket.id} />
      )}
    </>
  );
}
