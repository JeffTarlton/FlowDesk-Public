import { useState, useEffect, useMemo } from 'react';
import { useKbStore, KbArticle, KbCategory, KB_CATEGORIES } from '../store/useKbStore';
import { useProductStore } from '../store/useProductStore';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, Plus, Search, BookOpen, Edit3, Trash2, Eye, EyeOff, ArrowLeft, Tag } from 'lucide-react';
import DOMPurify from 'dompurify';
import RichTextEditor from '../components/RichTextEditor';
import { format } from 'date-fns';

type View = 'list' | 'detail' | 'editor';

export default function KnowledgeBase() {
  const { articles, isLoading, searchQuery, categoryFilter, setSearchQuery, setCategoryFilter, fetchArticles, createArticle, updateArticle, deleteArticle, incrementViewCount } = useKbStore();
  const { products, fetchProducts } = useProductStore();
  const { profile } = useAuthStore();

  const canEdit = profile && ['admin', 'developer', 'support_desk'].includes(profile.role);

  const [view, setView] = useState<View>('list');
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);
  const [editingArticle, setEditingArticle] = useState<KbArticle | null>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'general' as KbCategory,
    product_id: '' as string,
    tags: '' as string,
    is_published: false,
  });

  useEffect(() => {
    fetchArticles();
    fetchProducts();
  }, []);

  // Client-side search + filter
  const filteredArticles = useMemo(() => {
    let result = articles;

    // Non-staff only see published
    if (!canEdit) {
      result = result.filter(a => a.is_published);
    }

    if (categoryFilter !== 'all') {
      result = result.filter(a => a.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [articles, searchQuery, categoryFilter, canEdit]);

  const openArticle = (article: KbArticle) => {
    setSelectedArticle(article);
    setView('detail');
    incrementViewCount(article.id);
  };

  const openEditor = (article?: KbArticle) => {
    if (article) {
      setEditingArticle(article);
      setForm({
        title: article.title,
        content: article.content,
        category: article.category,
        product_id: article.product_id || '',
        tags: article.tags.join(', '),
        is_published: article.is_published,
      });
    } else {
      setEditingArticle(null);
      setForm({ title: '', content: '', category: 'general', product_id: '', tags: '', is_published: false });
    }
    setView('editor');
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      content: form.content,
      category: form.category,
      product_id: form.product_id || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      is_published: form.is_published,
    };
    if (editingArticle) {
      await updateArticle(editingArticle.id, payload);
    } else {
      await createArticle(payload);
    }
    setView('list');
    setEditingArticle(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this article?')) return;
    await deleteArticle(id);
    setView('list');
    setSelectedArticle(null);
  };

  // ─── DETAIL VIEW ──────────────────────────────────────────────
  if (view === 'detail' && selectedArticle) {
    const cat = KB_CATEGORIES.find(c => c.value === selectedArticle.category);
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => { setView('list'); setSelectedArticle(null); }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Knowledge Base
        </button>

        <article className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Header */}
          <div className="p-8 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                    {cat?.emoji} {cat?.label}
                  </span>
                  {selectedArticle.product && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: selectedArticle.product.color + '20', color: selectedArticle.product.color }}>
                      {selectedArticle.product.name}
                    </span>
                  )}
                  {!selectedArticle.is_published && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Draft
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{selectedArticle.title}</h1>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>By {selectedArticle.author?.full_name || 'Unknown'}</span>
                  <span>Updated {format(new Date(selectedArticle.updated_at), 'MMM d, yyyy')}</span>
                  <span className="flex items-center gap-1"><Eye size={11} /> {selectedArticle.view_count} views</span>
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEditor(selectedArticle)} className="p-2 text-gray-400 hover:text-primary-500 transition-colors" title="Edit">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleDelete(selectedArticle.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Tags */}
            {selectedArticle.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <Tag size={12} className="text-gray-400" />
                {selectedArticle.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div
            className="p-8 prose dark:prose-invert prose-sm max-w-none prose-headings:font-bold prose-a:text-primary-600"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedArticle.content) }}
          />
        </article>
      </div>
    );
  }

  // ─── EDITOR VIEW ──────────────────────────────────────────────
  if (view === 'editor') {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => { setView('list'); setEditingArticle(null); }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Cancel
        </button>

        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
            {editingArticle ? 'Edit Article' : 'New Article'}
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Article title..."
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value as KbCategory })}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  {KB_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Product</label>
                <select
                  value={form.product_id}
                  onChange={e => setForm({ ...form, product_id: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">None (General)</option>
                  {products.filter(p => p.status === 'active').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  placeholder="e.g. setup, billing, config"
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Content</label>
              <RichTextEditor
                content={form.content}
                onChange={(val) => setForm({ ...form, content: val })}
                placeholder="Write your article content here..."
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={e => setForm({ ...form, is_published: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  {form.is_published ? <Eye size={14} className="text-green-500" /> : <EyeOff size={14} className="text-gray-400" />}
                  {form.is_published ? 'Published — visible to everyone' : 'Draft — only visible to staff'}
                </span>
              </label>

              <div className="flex gap-2">
                <button onClick={() => { setView('list'); setEditingArticle(null); }} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.title.trim()}
                  className="px-6 py-2 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-sm disabled:opacity-50"
                >
                  {editingArticle ? 'Save Changes' : 'Create Article'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BookOpen size={24} className="text-primary-500" />
            Knowledge Base
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {canEdit
              ? `${articles.length} articles · ${articles.filter(a => a.is_published).length} published`
              : 'Browse guides, FAQs, and documentation'
            }
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => openEditor()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors shadow-sm"
          >
            <Plus size={16} /> New Article
          </button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search articles, tags..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              categoryFilter === 'all'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {KB_CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategoryFilter(c.value)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                categoryFilter === c.value
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Article Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary-500" size={32} />
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800">
          <BookOpen size={48} className="text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {searchQuery || categoryFilter !== 'all' ? 'No matching articles' : 'No Articles Yet'}
          </h3>
          <p className="text-sm text-gray-400">
            {canEdit ? 'Create your first knowledge base article to get started.' : 'Check back soon for documentation and guides.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArticles.map(article => {
            const cat = KB_CATEGORIES.find(c => c.value === article.category);
            // Strip HTML for preview
            const plainText = article.content.replace(/<[^>]*>/g, '').substring(0, 140);

            return (
              <div
                key={article.id}
                onClick={() => openArticle(article)}
                className="group p-5 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all"
              >
                {/* Top meta */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    {cat?.emoji} {cat?.label}
                  </span>
                  {article.product && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: article.product.color + '15', color: article.product.color }}>
                      {article.product.name}
                    </span>
                  )}
                  {!article.is_published && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                      Draft
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {article.title}
                </h3>

                {/* Preview */}
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 mb-3">
                  {plainText || 'No content yet...'}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-auto pt-3 border-t border-gray-50 dark:border-gray-800">
                  <span>{article.author?.full_name || 'Unknown'}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Eye size={10} /> {article.view_count}</span>
                    <span>{format(new Date(article.updated_at), 'MMM d')}</span>
                  </div>
                </div>

                {/* Tags */}
                {article.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {article.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-gray-50 dark:bg-gray-800 rounded text-[9px] text-gray-500 dark:text-gray-500">
                        {tag}
                      </span>
                    ))}
                    {article.tags.length > 3 && <span className="text-[9px] text-gray-400">+{article.tags.length - 3}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
