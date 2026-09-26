import React, { useState, useEffect } from 'react';
import { X, Loader2, Paperclip } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useTicketStore } from '../store/useTicketStore';
import { useAdminStore } from '../store/useAdminStore';
import { useProductStore } from '../store/useProductStore';

interface Props {
  onClose: () => void;
  initialParentId?: string;
}

export default function NewTicketModal({ onClose, initialParentId }: Props) {
  const { profile } = useAuthStore();
  const { tickets, fetchTickets } = useTicketStore();
  const { products } = useProductStore();
  
  // Extract distinct autocomplete values from existing local tickets (Zero Network Overhead)
  const customerNames = Array.from(new Set(tickets.map(t => t.customer_name).filter(Boolean))) as string[];
  const customerEmails = Array.from(new Set(tickets.map(t => t.customer_email).filter(Boolean))) as string[];
  const productFamilies = Array.from(new Set(tickets.map(t => t.product_family).filter(Boolean))) as string[];
  const productTiers = Array.from(new Set(tickets.map(t => t.product_tier).filter(Boolean))) as string[];

  const { branches } = useAdminStore();
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    acceptance_criteria: '',
    type: initialParentId ? 'task' : 'bug',
    priority: 'medium',
    customer_name: '',
    customer_email: '',
    product_family: '',
    product_tier: '',
    branch_id: '',
    parent_ticket_id: initialParentId || '',
    product_id: '',
    target_version: '',
    is_known_issue: false,
  });

  useEffect(() => {
    // If AdminStore branches are needed, they are already loaded or should be preloaded by the parent
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      // Verify active session before attempting insert
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Your session has expired. Please refresh the page and log in again.');
      }

      let attachmentPath: string | null = null;
      if (attachment) {
        const uniquePrefix = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const safeFileName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${profile.id}/${uniquePrefix}_${safeFileName}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('ticket_attachments')
          .upload(filePath, attachment, { upsert: false });
          
        if (uploadError) throw new Error('Failed to upload attachment: ' + uploadError.message);
        attachmentPath = data.path;
      }

      const { data: newTicket, error } = await supabase.from('tickets').insert([{
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        status: 'pending',
        created_by: profile.id,
        customer_name: formData.customer_name || null,
        customer_email: formData.customer_email || null,
        product_family: formData.product_family || null,
        product_tier: formData.product_tier || null,
        product_id: formData.product_id || null,
        branch_id: formData.branch_id || null,
        parent_ticket_id: formData.type === 'task' && formData.parent_ticket_id ? formData.parent_ticket_id : null,
        acceptance_criteria: formData.acceptance_criteria || null,
        target_version: formData.target_version || null,
        is_known_issue: formData.is_known_issue,
      }]).select('id').single();
      if (error) {
        console.error('[NewTicketModal] Insert error:', error);
        throw new Error(`${error.message} (code: ${error.code})`);
      }

      // Record the upload in ticket_attachments so it shows in the ticket's Attachments list
      if (attachment && attachmentPath) {
        const { error: attachmentError } = await supabase.from('ticket_attachments').insert({
          ticket_id: newTicket.id,
          file_path: attachmentPath,
          file_name: attachment.name,
          file_size: attachment.size,
          uploaded_by: profile.id
        });
        if (attachmentError) {
          console.error('[NewTicketModal] Attachment insert error:', attachmentError);
          alert(`The ticket was created, but the attachment could not be linked: ${attachmentError.message}`);
        }
      }
      await fetchTickets();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Error creating ticket: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Request</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Title <span className="text-red-500">*</span></label>
            <input
              required
              type="text"
              placeholder="Briefly describe the issue or request"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Description</label>
            <RichTextEditor 
              content={formData.description}
              onChange={(html) => setFormData({...formData, description: html})}
              placeholder="Provide any relevant details, steps to reproduce, or links..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Acceptance Criteria</label>
            <RichTextEditor 
              content={formData.acceptance_criteria}
              onChange={(html) => setFormData({...formData, acceptance_criteria: html})}
              placeholder="What needs to be true for this to be considered 'done'?"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Attachment <span className="text-gray-400 font-normal">(Optional)</span></label>
            <div className="flex items-center gap-3">
              <label 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setAttachment(e.dataTransfer.files[0]);
                  }
                }}
                className={`flex-1 cursor-pointer flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-xl transition-all group ${
                  isDragging 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-[1.02] shadow-lg' 
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Paperclip size={24} className={`${isDragging ? 'text-primary-500 scale-110' : 'text-gray-400 group-hover:text-primary-500'} transition-all`} />
                <span className={`text-sm font-medium ${isDragging ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>
                  {attachment ? attachment.name : "Click to select or drag and drop a file"}
                </span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".csv,.pdf,.xlsx,.xls,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAttachment(e.target.files[0]);
                    }
                  }}
                />
              </label>
              {attachment && (
                <button 
                  type="button" 
                  onClick={() => setAttachment(null)} 
                  className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Type</label>
              <select
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
              >
                <option value="feature_request">Feature Request</option>
                <option value="bug">Bug</option>
                <option value="documentation">Documentation</option>
                <option value="improvement">Improvement</option>
                <option value="task">Task</option>
                <option value="professional_service">Professional Service</option>
                <option value="project">Project</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Priority</label>
              <select
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Customer Name</label>
              <input
                list="customer-names"
                type="text"
                placeholder="Optional"
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.customer_name}
                onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
              />
              <datalist id="customer-names">
                {customerNames.map(cn => <option key={cn} value={cn} />)}
              </datalist>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Customer Email</label>
              <input
                list="customer-emails"
                type="email"
                placeholder="Optional"
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.customer_email}
                onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
              />
              <datalist id="customer-emails">
                {customerEmails.map(ce => <option key={ce} value={ce} />)}
              </datalist>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Catalog Product</label>
              <select
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.product_id}
                onChange={(e) => setFormData({...formData, product_id: e.target.value})}
              >
                <option value="">None</option>
                {products.filter(p => p.status === 'active').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Release Version / Tag</label>
              <input
                type="text"
                placeholder="e.g. v2.1.0 or Beta 1"
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.target_version}
                onChange={(e) => setFormData({...formData, target_version: e.target.value})}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Product Family</label>
              <input
                list="product-families"
                type="text"
                placeholder="e.g. Hardware, Software"
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.product_family}
                onChange={(e) => setFormData({...formData, product_family: e.target.value})}
              />
              <datalist id="product-families">
                {productFamilies.map(pf => <option key={pf} value={pf} />)}
              </datalist>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Product Tier</label>
              <input
                list="product-tiers"
                type="text"
                placeholder="e.g. Basic, Pro"
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.product_tier}
                onChange={(e) => setFormData({...formData, product_tier: e.target.value})}
              />
              <datalist id="product-tiers">
                {productTiers.map(pt => <option key={pt} value={pt} />)}
              </datalist>
            </div>
          </div>

          {(profile?.role === 'admin' || profile?.role === 'developer') && (
            <>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Assign to Branch <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <select
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={formData.branch_id}
                    onChange={(e) => setFormData({...formData, branch_id: e.target.value})}
                  >
                    <option value="">None / Global</option>
                    {branches.filter(b => b.is_active).map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
                    ))}
                  </select>
                </div>
                
                {formData.type === 'task' ? (
                  <div className="flex-1">
                    <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Parent Ticket</label>
                    <select
                      className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={formData.parent_ticket_id}
                      onChange={(e) => setFormData({...formData, parent_ticket_id: e.target.value})}
                      required
                    >
                      <option value="">Select a Ticket...</option>
                      {tickets.filter(t => t.parent_ticket_id === null).map(p => (
                        <option key={p.id} value={p.id}>{p.readable_id} - {p.title}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex-1" />
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={formData.is_known_issue}
                    onChange={(e) => setFormData({...formData, is_known_issue: e.target.checked})}
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Flag as Globally Known Bug/Outage
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-8">Will pin this ticket to the top of the Product Catalog for all users.</p>
              </div>
            </>
          )}

          {formData.type === 'task' && profile?.role !== 'admin' && profile?.role !== 'developer' && (
             <div className="flex-1 mt-4">
               <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Parent Ticket</label>
               <select
                 className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                 value={formData.parent_ticket_id}
                 onChange={(e) => setFormData({...formData, parent_ticket_id: e.target.value})}
                 required
               >
                 <option value="">Select a Ticket...</option>
                 {tickets.filter(t => t.parent_ticket_id === null).map(p => (
                   <option key={p.id} value={p.id}>{p.readable_id} - {p.title}</option>
                 ))}
               </select>
             </div>
          )}

          </div>
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 min-w-[130px] px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-colors shadow-md disabled:opacity-70"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
