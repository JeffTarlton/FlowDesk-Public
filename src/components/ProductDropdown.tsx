import { useEffect } from 'react';
import { useProductStore } from '../store/useProductStore';
import { Package } from 'lucide-react';

interface ProductDropdownProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function ProductDropdown({ value, onChange, className = '' }: ProductDropdownProps) {
  const { products, fetchProducts, isLoading } = useProductStore();

  useEffect(() => {
    if (products.length === 0) {
      fetchProducts();
    }
  }, [products.length, fetchProducts]);

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[180px] appearance-none transition-all"
        disabled={isLoading}
      >
        <option value="">All Products</option>
        {products
          .filter(p => p.status === 'active')
          .map(product => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
      </select>
      <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
