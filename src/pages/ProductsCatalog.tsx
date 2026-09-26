import { useEffect, useState } from 'react';
import { Package, Search, Loader2, Calendar, ShieldAlert, Tag as TagIcon } from 'lucide-react';
import { useProductStore } from '../store/useProductStore';
import { useTicketStore } from '../store/useTicketStore';
import { Product } from '../types';

export default function ProductsCatalog() {
  const { products, isLoading: loadingProducts, fetchProducts } = useProductStore();
  const { tickets, fetchTickets, isLoading: loadingTickets } = useTicketStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchTickets();
  }, [fetchProducts, fetchTickets]);

  const activeProducts = products.filter(p => p.status === 'active');
  const filteredProducts = activeProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const productTickets = selectedProduct 
    ? tickets.filter(t => t.product_id === selectedProduct.id)
    : [];

  const knownIssues = productTickets.filter(t => t.is_known_issue);
  const regularTickets = productTickets.filter(t => !t.is_known_issue);

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Package size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Product Catalog</h1>
        </div>
        <p className="text-gray-500 ml-13">View updates, features, and active tickets for all supported products.</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left Column: Product List */}
        <div className="w-1/3 flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {loadingProducts ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-primary-500" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No products found.</div>
            ) : (
              filteredProducts.map(product => {
                const isSelected = selectedProduct?.id === product.id;
                return (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isSelected 
                        ? 'bg-white dark:bg-surface-dark border-primary-500 shadow-md ring-1 ring-primary-500' 
                        : 'bg-white/50 dark:bg-surface-dark/50 border-gray-100 dark:border-gray-800 hover:bg-white dark:hover:bg-surface-dark hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                       <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: product.color }}></div>
                       <h3 className="font-bold text-gray-900 dark:text-white text-lg">{product.name}</h3>
                    </div>
                    {product.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{product.description}</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Details & specific tickets */}
        <div className="flex-1 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-6 overflow-y-auto shadow-sm">
          {!selectedProduct ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Package size={48} className="mb-4 opacity-20" />
              <p>Select a product to view details and updates</p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center border border-white/20" style={{ backgroundColor: selectedProduct.color }}>
                    <Package size={32} className="text-white" />
                 </div>
                 <div>
                   <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{selectedProduct.name}</h2>
                   <div className="text-sm text-gray-500 mt-1 font-medium">Status: Active &bull; Added {new Date(selectedProduct.created_at).toLocaleDateString()}</div>
                 </div>
              </div>

              {selectedProduct.description && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl text-gray-700 dark:text-gray-300 text-sm mb-8 border border-gray-100 dark:border-gray-800">
                  {selectedProduct.description}
                </div>
              )}

              {/* Known Issues Section */}
              {knownIssues.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
                     <ShieldAlert size={18} />
                     Known Outages & High-Priority Bugs
                  </h3>
                  <div className="space-y-3">
                    {knownIssues.map(ticket => (
                      <div key={ticket.id} className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 hover:border-red-300 dark:hover:border-red-800 transition-colors bg-red-50/80 dark:bg-red-900/10 flex gap-4">
                         <div className="shrink-0 mt-1">
                           <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
                             {ticket.type}
                           </span>
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-xs font-bold text-red-400 dark:text-red-500">{ticket.readable_id}</span>
                              <span className="font-semibold text-sm text-red-900 dark:text-red-100 line-clamp-1">{ticket.title}</span>
                              {ticket.target_version && (
                                <span className="flex items-center gap-1 text-[10px] font-bold bg-white dark:bg-red-900/50 text-red-600 dark:text-red-300 px-2 py-0.5 rounded border border-red-100 dark:border-red-800">
                                  <TagIcon size={10} /> {ticket.target_version}
                                </span>
                              )}
                           </div>
                           <div className="text-xs text-red-600/80 dark:text-red-300/80">
                             Status: <span className="capitalize font-semibold">{ticket.status.replace(/_/g, ' ')}</span> &bull; 
                             Updated {new Date(ticket.updated_at).toLocaleDateString()}
                           </div>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                 <Calendar size={18} className="text-primary-500" />
                 Recent Updates & Tickets
              </h3>

              {loadingTickets ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-primary-500" />
                </div>
              ) : regularTickets.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400">
                   No recent tickets tracked for this product.
                </div>
              ) : (
                <div className="space-y-3">
                  {regularTickets.map(ticket => (
                    <div key={ticket.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors bg-white dark:bg-surface-dark flex gap-4">
                       <div className="shrink-0 mt-1">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${
                           ticket.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                           ticket.type === 'bug' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                         }`}>
                           {ticket.type}
                         </span>
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-xs font-bold text-gray-400">{ticket.readable_id}</span>
                            <span className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">{ticket.title}</span>
                            {ticket.target_version && (
                              <span className="flex items-center gap-1 text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                <TagIcon size={10} /> {ticket.target_version}
                              </span>
                            )}
                         </div>
                         <div className="text-xs text-gray-500">
                           Status: <span className="capitalize font-semibold text-gray-700 dark:text-gray-300">{ticket.status.replace(/_/g, ' ')}</span> &bull; 
                           Updated {new Date(ticket.updated_at).toLocaleDateString()}
                         </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
