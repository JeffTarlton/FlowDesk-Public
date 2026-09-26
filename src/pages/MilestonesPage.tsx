import { useState, useEffect, useRef } from 'react';
import { useMilestoneStore, Milestone } from '../store/useMilestoneStore';
import { useTicketStore } from '../store/useTicketStore';
import { useProductStore } from '../store/useProductStore';
import { Ticket } from '../types';
import TicketDetailPanel from '../components/TicketDetailPanel';
import { Loader2, Plus, Trash2, Edit3, X, Target, CalendarDays, CheckCircle2, Calendar } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export default function MilestonesPage() {
  const { milestones, isLoading, fetchMilestones, createMilestone, updateMilestone, deleteMilestone } = useMilestoneStore();
  const { tickets } = useTicketStore();
  const { products, fetchProducts } = useProductStore();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', target_date: '', product_id: '' });
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [dateDisplay, setDateDisplay] = useState('');
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMilestones();
    fetchProducts();
  }, []);

  // Sync dateDisplay when form.target_date changes (e.g. on edit)
  useEffect(() => {
    if (form.target_date) {
      const d = new Date(form.target_date + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setDateDisplay(`${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`);
      }
    } else {
      setDateDisplay('');
    }
  }, [form.target_date]);

  const handleDateDisplayChange = (val: string) => {
    setDateDisplay(val);
    // Try to parse MM/DD/YYYY → YYYY-MM-DD for the form value
    const match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, mm, dd, yyyy] = match;
      const isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      const test = new Date(isoDate + 'T00:00:00');
      if (!isNaN(test.getTime())) {
        setForm(f => ({ ...f, target_date: isoDate }));
      }
    } else if (val === '') {
      setForm(f => ({ ...f, target_date: '' }));
    }
  };

  const handleNativeDatePick = (val: string) => {
    setForm(f => ({ ...f, target_date: val }));
    // dateDisplay will update via the useEffect above
  };

  const openCalendar = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker?.();
      dateInputRef.current.focus();
    }
  };

  const resetForm = () => {
    setForm({ name: '', description: '', target_date: '', product_id: '' });
    setDateDisplay('');
    setShowCreate(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await updateMilestone(editingId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        target_date: form.target_date || null,
        product_id: form.product_id || null,
      });
    } else {
      await createMilestone({
        name: form.name.trim(),
        description: form.description.trim() || null,
        target_date: form.target_date || null,
        product_id: form.product_id || null,
      });
    }
    resetForm();
  };

  const startEdit = (m: Milestone) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      description: m.description || '',
      target_date: m.target_date || '',
      product_id: m.product_id || '',
    });
    setShowCreate(true);
  };

  const selectedMilestoneTickets = selectedMilestone
    ? tickets.filter(t => (t as any).milestone_id === selectedMilestone)
    : [];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Target size={24} className="text-primary-500" />
            Milestones
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track project milestones and their progress across tickets.</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); if (editingId) resetForm(); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors shadow-sm"
        >
          <Plus size={16} /> {showCreate ? 'Cancel' : 'New Milestone'}
        </button>
      </div>

      {/* Create/Edit Form */}
      {showCreate && (
        <div className="mb-6 p-5 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm animate-pulse-fade-in">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">{editingId ? 'Edit Milestone' : 'New Milestone'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. v2.0 Launch"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Target Date</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={dateDisplay}
                  onChange={e => handleDateDisplayChange(e.target.value)}
                  placeholder="MM/DD/YYYY"
                  className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={openCalendar}
                  className="absolute right-2 p-1 text-gray-400 hover:text-primary-500 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Open calendar"
                >
                  <Calendar size={16} />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={form.target_date}
                  onChange={e => handleNativeDatePick(e.target.value)}
                  className="absolute inset-0 opacity-0 pointer-events-none"
                  tabIndex={-1}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Product</label>
              <select
                value={form.product_id}
                onChange={e => setForm({ ...form, product_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Products</option>
                {products.filter(p => p.status === 'active').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-primary-500 text-white text-sm font-semibold rounded-lg hover:bg-primary-600 transition-colors">
                {editingId ? 'Save' : 'Create'}
              </button>
              <button onClick={resetForm} className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>
          {/* Description (full width) */}
          <div className="mt-3">
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this milestone..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary-500" size={32} />
        </div>
      ) : milestones.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800">
          <Target size={48} className="text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Milestones Yet</h3>
          <p className="text-sm text-gray-400">Create your first milestone to start tracking project progress.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Milestone Cards */}
          <div className="lg:col-span-2 space-y-4">
            {milestones.map(m => {
              const progress = m.ticket_count ? Math.round((m.completed_count! / m.ticket_count) * 100) : 0;
              const isSelected = selectedMilestone === m.id;
              const product = products.find(p => p.id === m.product_id);
              const isOverdue = m.target_date && new Date(m.target_date) < new Date() && m.status !== 'completed';

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMilestone(isSelected ? null : m.id)}
                  className={`p-5 bg-white dark:bg-surface-dark rounded-2xl border cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-primary-300 dark:border-primary-600 shadow-md ring-2 ring-primary-100 dark:ring-primary-900/30' : 'border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">{m.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[m.status]}`}>
                          {m.status.replace('_', ' ')}
                        </span>
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Overdue
                          </span>
                        )}
                      </div>
                      {m.description && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{m.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      {/* Status cycle */}
                      <select
                        value={m.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); updateMilestone(m.id, { status: e.target.value as Milestone['status'] }); }}
                        className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button onClick={(e) => { e.stopPropagation(); startEdit(m); }} className="p-1.5 text-gray-400 hover:text-primary-500 transition-colors" title="Edit">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteMilestone(m.id); }} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                    {m.target_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} /> {new Date(m.target_date).toLocaleDateString()}
                      </span>
                    )}
                    {product && (
                      <span className="px-1.5 py-0.5 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded text-[10px] font-semibold">
                        {product.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} /> {m.completed_count || 0} / {m.ticket_count || 0} tickets
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress === 100 ? 'bg-green-500' : progress > 50 ? 'bg-primary-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-right text-[10px] font-bold text-gray-400 mt-1">{progress}%</div>
                </div>
              );
            })}
          </div>

          {/* Right Panel — Tickets in selected milestone */}
          <div className="lg:col-span-1">
            <div className="sticky top-0 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                {selectedMilestone ? `Tickets (${selectedMilestoneTickets.length})` : 'Select a Milestone'}
              </h3>

              {!selectedMilestone ? (
                <p className="text-xs text-gray-400 text-center py-8">Click on a milestone card to see its tickets.</p>
              ) : selectedMilestoneTickets.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No tickets assigned to this milestone yet. Assign tickets from the Ticket Detail panel.</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {selectedMilestoneTickets.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setActiveTicket(t)}
                      className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400 group-hover:underline">{t.readable_id}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          t.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          t.status === 'dev_in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {t.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{t.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {activeTicket && (
        <TicketDetailPanel
          ticket={tickets.find(t => t.id === activeTicket.id) || activeTicket}
          onClose={() => setActiveTicket(null)}
        />
      )}
    </div>
  );
}
