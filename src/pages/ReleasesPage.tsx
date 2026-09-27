import { useState, useEffect } from 'react';
import { useReleaseStore, Release } from '../store/useReleaseStore';
import { useTicketStore } from '../store/useTicketStore';
import { useProductStore } from '../store/useProductStore';
import { useMilestoneStore } from '../store/useMilestoneStore';
import { Loader2, Plus, Trash2, Edit3, X, Rocket, CalendarDays, CheckCircle2, Package, Search } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  staged: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  released: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rolled_back: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function ReleasesPage() {
  const { releases, isLoading, fetchReleases, createRelease, updateRelease, deleteRelease, addTicketToRelease, removeTicketFromRelease, fetchReleaseTickets } = useReleaseStore();
  const { tickets } = useTicketStore();
  const { products, fetchProducts } = useProductStore();
  const { milestones, fetchMilestones } = useMilestoneStore();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ version: '', name: '', description: '', release_date: '', product_id: '', milestone_id: '' });
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const [releaseTickets, setReleaseTickets] = useState<{ id: string; readable_id: string; title: string; status: string }[]>([]);
  const [addTicketSearch, setAddTicketSearch] = useState('');
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    fetchReleases();
    fetchProducts();
    fetchMilestones();
  }, []);

  useEffect(() => {
    if (selectedRelease) {
      loadReleaseTickets(selectedRelease);
    }
  }, [selectedRelease]);

  const loadReleaseTickets = async (releaseId: string) => {
    setLoadingTickets(true);
    const data = await fetchReleaseTickets(releaseId);
    setReleaseTickets(data);
    setLoadingTickets(false);
  };

  const resetForm = () => {
    setForm({ version: '', name: '', description: '', release_date: '', product_id: '', milestone_id: '' });
    setShowCreate(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.version.trim()) return;
    const payload = {
      version: form.version.trim(),
      name: form.name.trim() || null,
      description: form.description.trim() || null,
      release_date: form.release_date || null,
      product_id: form.product_id || null,
      milestone_id: form.milestone_id || null,
    };
    if (editingId) {
      await updateRelease(editingId, payload);
    } else {
      await createRelease(payload);
    }
    resetForm();
  };

  const startEdit = (r: Release) => {
    setEditingId(r.id);
    setForm({
      version: r.version,
      name: r.name || '',
      description: r.description || '',
      release_date: r.release_date || '',
      product_id: r.product_id || '',
      milestone_id: r.milestone_id || '',
    });
    setShowCreate(true);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Rocket size={24} className="text-primary-500" />
            Releases
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Plan, stage, and track deployments across products.</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); if (editingId) resetForm(); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors shadow-sm"
        >
          <Plus size={16} /> {showCreate ? 'Cancel' : 'New Release'}
        </button>
      </div>

      {/* Create/Edit Form */}
      {showCreate && (
        <div className="mb-6 p-5 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm animate-pulse-fade-in">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">{editingId ? 'Edit Release' : 'New Release'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Version *</label>
              <input
                type="text"
                value={form.version}
                onChange={e => setForm({ ...form, version: e.target.value })}
                placeholder="e.g. v2.1.0"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Spring Update"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Release Date</label>
              <input
                type="date"
                value={form.release_date}
                onChange={e => setForm({ ...form, release_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 items-end">
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
            <div>
              <label className="block text-xs text-gray-400 mb-1">Milestone</label>
              <select
                value={form.milestone_id}
                onChange={e => setForm({ ...form, milestone_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="">None</option>
                {milestones.filter(m => m.status !== 'completed').map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
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
          <div className="mt-3">
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Release notes or deployment instructions..."
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
      ) : releases.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800">
          <Rocket size={48} className="text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Releases Yet</h3>
          <p className="text-sm text-gray-400">Create your first release to start tracking deployments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Release Cards */}
          <div className="lg:col-span-2 space-y-4">
            {releases.map(r => {
              const product = products.find(p => p.id === r.product_id);
              const milestone = milestones.find(m => m.id === r.milestone_id);
              const isSelected = selectedRelease === r.id;

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRelease(isSelected ? null : r.id)}
                  className={`p-5 bg-white dark:bg-surface-dark rounded-2xl border cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-primary-300 dark:border-primary-600 shadow-md ring-2 ring-primary-100 dark:ring-primary-900/30' : 'border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{r.version}</span>
                        {r.name && <span className="text-sm text-gray-600 dark:text-gray-300">&mdash; {r.name}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[r.status]}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </div>
                      {r.description && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{r.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      <select
                        value={r.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); updateRelease(r.id, { status: e.target.value as Release['status'] }); }}
                        className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      >
                        <option value="planned">Planned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="staged">Staged</option>
                        <option value="released">Released</option>
                        <option value="rolled_back">Rolled Back</option>
                      </select>
                      <button onClick={e => { e.stopPropagation(); startEdit(r); }} className="p-1.5 text-gray-400 hover:text-primary-500 transition-colors" title="Edit">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteRelease(r.id); }} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {r.release_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} /> {new Date(r.release_date + 'T00:00:00').toLocaleDateString()}
                      </span>
                    )}
                    {product && (
                      <span className="flex items-center gap-1">
                        <Package size={12} /> {product.name}
                      </span>
                    )}
                    {milestone && (
                      <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded text-[10px] font-semibold">
                        {milestone.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} /> {r.ticket_count || 0} tickets
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Panel — Tickets in selected release */}
          <div className="lg:col-span-1">
            <div className="sticky top-0 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                {selectedRelease ? `Release Tickets (${releaseTickets.length})` : 'Select a Release'}
              </h3>

              {!selectedRelease ? (
                <p className="text-xs text-gray-400 text-center py-8">Click on a release to view and manage its tickets.</p>
              ) : (
                <>
                  {/* Add Ticket Search */}
                  <div className="mb-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search ticket to add..."
                        value={addTicketSearch}
                        onChange={e => setAddTicketSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    {addTicketSearch.length >= 2 && (
                      <div className="mt-1 max-h-32 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                        {tickets
                          .filter(t =>
                            !releaseTickets.some(rt => rt.id === t.id) && (
                              t.readable_id.toLowerCase().includes(addTicketSearch.toLowerCase()) ||
                              t.title.toLowerCase().includes(addTicketSearch.toLowerCase())
                            )
                          )
                          .slice(0, 6)
                          .map(t => (
                            <button
                              key={t.id}
                              onClick={async () => {
                                await addTicketToRelease(selectedRelease, t.id);
                                await loadReleaseTickets(selectedRelease);
                                setAddTicketSearch('');
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-center gap-2"
                            >
                              <span className="font-bold text-primary-600 dark:text-primary-400 shrink-0">{t.readable_id}</span>
                              <span className="truncate text-gray-600 dark:text-gray-300">{t.title}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Ticket List */}
                  {loadingTickets ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={16} className="animate-spin text-primary-500" />
                    </div>
                  ) : releaseTickets.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No tickets in this release. Search above to add.</p>
                  ) : (
                    <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                      {releaseTickets.map(t => (
                        <div key={t.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800 flex items-center justify-between group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{t.readable_id}</span>
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
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await removeTicketFromRelease(selectedRelease, t.id);
                              await loadReleaseTickets(selectedRelease);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all ml-2 shrink-0"
                            title="Remove from release"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
