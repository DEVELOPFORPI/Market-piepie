import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Product } from '@/types';
import { getAllProducts } from '@/utils/productStorage';
import { isFreeShareListing } from '@/locale/enUI';
import { useLanguage } from '@/hooks/useLanguage';
import type { HomeMessageKey } from '@/i18n/homeMessages';

type FilterListingType = 'all' | 'free' | 'sale';

const FILTER_LISTING_TYPES: { value: FilterListingType; labelKey: HomeMessageKey }[] = [
  { value: 'all', labelKey: 'chipAll' },
  { value: 'free', labelKey: 'chipFree' },
  { value: 'sale', labelKey: 'chipForSale' },
];

export const Search: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [listingType, setListingType] = useState<FilterListingType>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    setProducts(getAllProducts());
    const onUpdate = () => setProducts(getAllProducts());
    window.addEventListener('productRegistered', onUpdate);
    return () => window.removeEventListener('productRegistered', onUpdate);
  }, []);

  const recentSearches = ['iPhone', 'laptop', 'chair'];
  const recommendedSearches = ['furniture', 'clothes', 'electronics', 'books'];

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter((p) => {
      const matchText = p.title.toLowerCase().includes(q)
        || p.description?.toLowerCase().includes(q)
        || p.region?.toLowerCase().includes(q)
        || p.seller?.nickname?.toLowerCase().includes(q);
      if (!matchText) return false;
      if (listingType === 'free' && !isFreeShareListing(p)) return false;
      if (listingType === 'sale' && isFreeShareListing(p)) return false;
      if (listingType !== 'free' && minPrice && p.price < Number(minPrice)) return false;
      if (listingType !== 'free' && maxPrice && p.price > Number(maxPrice)) return false;
      return true;
    });
  }, [searchQuery, products, listingType, minPrice, maxPrice]);

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar title={t('searchTitle')} />

      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchQueryPh')}
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
            {t('filter')}
          </button>
        </div>
      </div>

      {!searchQuery && (
        <div className="px-4 py-6">
          {recentSearches.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t('recent')}</h3>
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

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t('suggested')}</h3>
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

      {searchQuery && (
        <div className="px-4 py-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {t('noResultsFor', { q: searchQuery })}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <ListingCard
                  key={product.id}
                  product={product}
                  layout="list"
                  onClick={() => navigate(`/product/${product.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <BottomSheet
        isOpen={showFilter}
        onClose={() => setShowFilter(false)}
        title={t('filtersTitle')}
      >
        <div className="px-4 py-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t('listingType')}</h3>
            <div className="flex flex-wrap gap-2">
              {FILTER_LISTING_TYPES.map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setListingType(value);
                    if (value === 'free') {
                      setMinPrice('');
                      setMaxPrice('');
                    }
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    listingType === value ? 'text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                  style={listingType === value ? { backgroundColor: '#00A8A3' } : undefined}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className={listingType === 'free' ? 'opacity-50' : undefined}>
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t('priceRange')}</h3>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder={t('min')}
                disabled={listingType === 'free'}
                className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <span className="text-gray-500 shrink-0">~</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder={t('max')}
                disabled={listingType === 'free'}
                className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-gray-500 shrink-0">Pi</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setListingType('all');
                setMinPrice('');
                setMaxPrice('');
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
            >
              {t('reset')}
            </button>
            <button
              onClick={() => setShowFilter(false)}
              className="flex-1 px-4 py-3 text-white rounded-lg font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              {t('apply')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
