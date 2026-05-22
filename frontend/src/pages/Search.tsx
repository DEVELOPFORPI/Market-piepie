import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Product, ORDER_STATUS_VALUE } from '@/types';
import { getOrders } from '@/utils/orderStorage';
import { getAllProducts } from '@/utils/productStorage';

export const Search: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [kycOnly, setKycOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    setProducts(getAllProducts());
    const onUpdate = () => setProducts(getAllProducts());
    window.addEventListener('productRegistered', onUpdate);
    return () => window.removeEventListener('productRegistered', onUpdate);
  }, []);

  const recentSearches = ['iPhone', 'laptop', 'chair'];
  const recommendedSearches = ['furniture', 'clothes', 'electronics', 'books'];
  const meetupProductIds = new Set(
    getOrders().filter((o) => o.status === ORDER_STATUS_VALUE.MEETUP_SET).map((o) => o.product?.id).filter(Boolean)
  );

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter((p) => {
      const matchText = p.title.toLowerCase().includes(q)
        || p.description?.toLowerCase().includes(q)
        || p.region?.toLowerCase().includes(q)
        || p.seller?.nickname?.toLowerCase().includes(q);
      if (!matchText) return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (minPrice && p.price < Number(minPrice)) return false;
      if (maxPrice && p.price > Number(maxPrice)) return false;
      return true;
    });
  }, [searchQuery, products, selectedCategory, minPrice, maxPrice]);

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar title="Search" />

      {/* Search Bar */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Listing, area, or seller"
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={() => setShowFilter(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filter
          </button>
        </div>
      </div>

      {!searchQuery && (
        <div className="px-4 py-6">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Recent</h3>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => setSearchQuery(term)}
                    className="px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-700 hover:bg-gray-200"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recommended */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Suggested</h3>
            <div className="flex flex-wrap gap-2">
              {recommendedSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setSearchQuery(term)}
                  className="px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-700 hover:bg-gray-200"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {searchQuery && (
        <div className="px-4 py-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No results for "{searchQuery}"
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <ListingCard
                  key={product.id}
                  product={product}
                  layout="list"
                  onClick={() => navigate(`/product/${product.id}`)}
                  meetupConfirmed={meetupProductIds.has(product.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter BottomSheet */}
      <BottomSheet
        isOpen={showFilter}
        onClose={() => setShowFilter(false)}
        title="Filters"
      >
        <div className="px-4 py-6 space-y-6">
          {/* Category */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Category</h3>
            <div className="flex flex-wrap gap-2">
              {['Electronics', 'Furniture', 'Clothes', 'Hobby', 'Books', 'Other'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCategory === cat ? 'bg-[#00A8A3] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Price range</h3>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min"
                className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg"
              />
              <span className="text-gray-500 shrink-0">~</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max"
                className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg"
              />
              <span className="text-sm text-gray-500 shrink-0">Pi</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">KYC sellers only</span>
              <span className="relative w-5 h-5 shrink-0 inline-flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={kycOnly}
                  onChange={(e) => setKycOnly(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  className="absolute inset-0 rounded border-2 border-gray-300 peer-checked:border-[#00A8A3] peer-checked:bg-[#00A8A3]"
                  aria-hidden
                />
                <svg
                  className="relative z-10 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setMinPrice('');
                setMaxPrice('');
                setKycOnly(false);
                setSelectedCategory('');
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
            >
              Reset
            </button>
            <button
              onClick={() => setShowFilter(false)}
              className="flex-1 px-4 py-3 text-white rounded-lg font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Apply
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};



