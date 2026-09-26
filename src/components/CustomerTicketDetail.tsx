import { X, Send, Clock, CheckCircle, Download, User } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import Skeleton from './Skeleton';
import PresenceAvatars from './PresenceAvatars';
import RichTextEditor from './RichTextEditor';
import { usePresenceStore } from '../store/usePresenceStore';

import { Ticket, TicketAttachment } from '../types';
import toast from 'react-hot-toast';
import { Paperclip, FileText } from 'lucide-react';

interface Props {
  ticket: Ticket;
  onClose: () => void;
}

interface CommentWithAuthor {
  id: string;
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

const customerSteps = [
  { id: '1', title: 'Received & Reviewing', statuses: ['pending', 'planning'] },
  { id: '2', title: 'Work In Progress', statuses: ['ready_for_dev', 'dev_in_progress'] },
  { id: '3', title: 'Testing & QA', statuses: ['in_review', 'beta_testing'] },
  { id: '4', title: 'Delivered', statuses: ['done'] },
];

export default function CustomerTicketDetail({ ticket, onClose }: Props) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const { joinRoom, leaveRoom } = usePresenceStore();

  // Determine current active step index
  const activeStepIndex = customerSteps.findIndex(step => step.statuses.includes(ticket.status));

  useEffect(() => {
    fetchComments();
    fetchAttachments();
    // Subscribe to new comments strictly for this ticket
    const channel = supabase.channel(`public:ticket_comments:${ticket.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticket.id}` }, () => {
        fetchComments();
      })
      .subscribe();

    if (user) {
      joinRoom(ticket.id, { id: user.id, full_name: user.user_metadata?.full_name || '', email: user.email || '' });
    }

    return () => {
      supabase.removeChannel(channel);
      leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('ticket_comments')
      .select('id, comment_text, created_at, is_internal_only, author:profiles(full_name, email, role)')
      .eq('ticket_id', ticket.id)
      .eq('is_internal_only', false)
      .order('created_at', { ascending: true });
    
    if (data) setComments(data as unknown as CommentWithAuthor[]);
    setLoadingComments(false);
  };

  const fetchAttachments = async () => {
    const { data } = await supabase
      .from('ticket_attachments')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false });
    if (data) setAttachments(data as TicketAttachment[]);
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !user) return;
    try {
      setIsSending(true);
      await supabase.from('ticket_comments').insert({
        ticket_id: ticket.id,
        author_id: user.id,
        comment_text: newComment.trim(),
        is_internal_only: false
      });
      setNewComment('');
      fetchComments();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
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
      
      htmlContent += `
        <div>
          <h3 style="margin-bottom: 15px; font-size: 18px; color: #111; border-bottom: 1px solid #eaeaea; padding-bottom: 5px;">Chat Logs</h3>
          <div style="display: flex; flex-direction: column; gap: 15px;">
      `;

      comments.forEach(item => {
        const authorName = item.author?.full_name || item.author?.email || 'Deleted user';
        const dateStr = format(new Date(item.created_at), 'MMM d, yyyy h:mm a');
        
        htmlContent += `
          <div style="font-size: 14px; background: #f8fafc; padding: 14px 18px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <div style="margin-bottom: 8px; font-size: 12px; color: #555;">
              <strong>${authorName}</strong> <span style="color: #888;">&bull; ${dateStr}</span>
            </div>
            <div style="line-height: 1.6; color: #1f2937;">${item.comment_text}</div>
          </div>
        `;
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6 pointer-events-none">
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto transition-opacity" 
        onClick={onClose}
      />
      <div className="w-full max-w-2xl bg-white dark:bg-surface-dark rounded-3xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh] transition-transform z-10 border border-gray-100 dark:border-gray-800">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl z-20">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">
                {ticket.readable_id}
              </span>
              <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {ticket.type}
              </span>
              {ticket.product && (
                <span 
                  className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm"
                  style={{ backgroundColor: ticket.product.color }}
                >
                  {ticket.product.name}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-1 mb-1">
              {ticket.title}
            </h2>
            <PresenceAvatars ticketId={ticket.id} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              title="Export as PDF"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 hover:text-primary-700 dark:bg-primary-900/20 dark:hover:bg-primary-900/40 transition-colors"
            >
              <Download size={20} />
            </button>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto w-full">
          
          {/* Tracker Section */}
          <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/10">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6 uppercase tracking-wider">Delivery Tracker</h3>
            <div className="relative">
              <div className="absolute top-5 left-0 w-full h-[2px] bg-gray-200 dark:bg-gray-800 -z-10" />
              {activeStepIndex > 0 && (
                <div 
                  className="absolute top-5 left-0 h-[2px] bg-primary-500 -z-10 transition-all duration-500" 
                  style={{ width: `${(activeStepIndex / (customerSteps.length - 1)) * 100}%` }}
                />
              )}
              
              <div className="flex justify-between relative z-0">
                {customerSteps.map((step, idx) => {
                  const isCompleted = idx < activeStepIndex;
                  const isCurrent = idx === activeStepIndex;
                  
                  return (
                    <div key={step.id} className="flex flex-col items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white dark:border-surface-dark transition-colors ${
                        isCompleted ? 'bg-primary-500 text-white' :
                        isCurrent ? 'bg-white dark:bg-gray-800 border-primary-500 text-primary-600' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-400'
                      }`}>
                        {isCompleted ? <CheckCircle size={18} /> : <Clock size={18} />}
                      </div>
                      <div className={`text-xs font-semibold max-w-[80px] text-center ${
                        isCurrent ? 'text-primary-600 dark:text-primary-400' :
                        isCompleted ? 'text-gray-900 dark:text-white' :
                        'text-gray-400'
                      }`}>
                        {step.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="mt-8 flex items-center gap-3 text-xs text-gray-500 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <Clock size={16} /> Last updated: {format(new Date(ticket.updated_at), 'MMMM d, h:mm a')}
            </div>
          </div>

          {/* Description */}
          {ticket.description && (
             <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Original Request</h3>
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.description || '') }}
                />
             </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Paperclip size={16} className="text-primary-500" />
                Attached Files ({attachments.length})
              </h3>
              <div className="space-y-3">
                {attachments.map((att) => (
                  <button 
                    key={att.id}
                    onClick={() => handleDownloadAttachment(att)}
                    className="flex items-center gap-3 p-3 w-full bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition-all group text-left"
                  >
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform">
                      <FileText size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {att.file_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB • ` : ''}
                        Click to safely download
                      </p>
                    </div>
                    <Download size={16} className="text-gray-400 group-hover:text-primary-500 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Roadmap (Only visible if devs populated scoping fields) */}
          {(ticket.target_start_date || ticket.target_test_date || ticket.target_completion_date || ticket.estimated_hours || ticket.billed_hours) && (
             <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800 bg-primary-50/30 dark:bg-primary-900/10">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={18} className="text-primary-500" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Delivery Roadmap</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-y-6 gap-x-6">
                  {ticket.target_start_date && (
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-1">Target Start</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(new Date(ticket.target_start_date), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  {ticket.target_test_date && (
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-1">Target Test</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(new Date(ticket.target_test_date), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  {ticket.target_completion_date && (
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase font-semibold text-primary-500 dark:text-primary-400 tracking-wider mb-1">Estimated Completion</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">
                        {format(new Date(ticket.target_completion_date), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  {(ticket.estimated_hours || ticket.billed_hours) && (
                    <div className="col-span-2 pt-2 border-t border-gray-200 dark:border-gray-700/50 mt-2">
                      <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-1">Allocated Scope</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-300">
                        {ticket.estimated_hours ? `${ticket.estimated_hours} Hours Estimated` : ''}
                        {ticket.estimated_hours && ticket.billed_hours ? ' / ' : ''}
                        {ticket.billed_hours ? `${ticket.billed_hours} Hours Billed` : ''}
                      </p>
                    </div>
                  )}
                </div>
             </div>
          )}

          {/* Chat / Comments */}
          <div className="p-6 sm:p-8 bg-gray-50 dark:bg-black/20">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6 uppercase tracking-wider">Communication Log</h3>
            
            <div className="space-y-6 mb-6">
              {loadingComments ? (
                <div className="space-y-4">
                  <Skeleton className="w-3/4 h-20 rounded-2xl rounded-tl-none" />
                  <Skeleton className="w-3/4 h-20 rounded-2xl rounded-tr-none ml-auto" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-gray-500 text-sm italic py-4">
                  No messages yet. Send a message to the team to get started.
                </div>
              ) : (
                comments.map((comment) => {
                  const author = comment.author;
                  const isMe = !!author && author.email === user?.email;
                  const isStaff = !!author && ['admin', 'developer', 'support_desk'].includes(author.role);
                  return (
                    <div key={comment.id} className={`flex gap-4 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isStaff ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {isStaff ? 'F' : author ? (author.full_name || author.email || '?').charAt(0).toUpperCase() : <User size={14} />}
                      </div>
                      <div className={`flex flex-col gap-1 max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span className="font-medium text-gray-600 dark:text-gray-400">{!author ? 'Deleted user' : isStaff ? 'FlowDesk Support' : 'You'}</span>
                          <span>•</span>
                          <time>{format(new Date(comment.created_at), 'MMM d, h:mm a')}</time>
                        </div>
                        <div className={`p-4 rounded-2xl text-sm ${
                          isMe 
                            ? 'bg-primary-600 text-white rounded-tr-sm' 
                            : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm'
                        }`}>
                          <div 
                            className={`prose prose-sm ${isMe ? 'prose-invert text-white' : 'dark:prose-invert text-gray-800 dark:text-gray-200'} max-w-none leading-relaxed`}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.comment_text || '') }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="relative mt-2">
              <RichTextEditor 
                content={newComment}
                onChange={setNewComment}
                placeholder="Ask a question or add details..."
                className="min-h-[100px] pb-12 shadow-sm"
              />
              <button 
                onClick={handleSendComment}
                disabled={!newComment.trim() || isSending}
                className="absolute right-3 bottom-9 w-10 h-10 flex items-center justify-center rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white shadow-md transition-transform hover:scale-105 active:scale-95 z-10"
              >
                <Send size={16} className={isSending ? 'animate-pulse' : ''} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
