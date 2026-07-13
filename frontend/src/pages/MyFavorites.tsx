import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';
import { Product, ProductStatus, PRODUCT_STATUS_VALUE } from '@/types';
import { isFreeShareListing, labelFreeShareMenu, labelProductStatus } from '@/locale/enUI';
import { getFavorites, removeFavorite } from '@/utils/favoriteStorage';
import { getProductById } from '@/utils/productStorage';

const TEAL = '#00A8A3';

type FilterStatus = 'all' | 'free' | ProductStatus;

const FILTER_TABS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'free', label: labelFreeShareMenu() },
  { value: PRODUCT_STATUS_VALUE.FOR_SALE, label: labelProductStatus(PRODUCT_STATUS_VALUE.FOR_SALE) },
  { value: PRODUCT_STATUS_VALUE.RESERVED, label: labelProductStatus(PRODUCT_STATUS_VALUE.RESERVED) },
  { value: PRODUCT_STATUS_VALUE.SOLD, label: labelProductStatus(PRODUCT_STATUS_VALUE.SOLD) },
];

export const MyFavorites: React.FC = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const loadFavorites = () => {
    setFavorites(getFavorites());
  };

  useEffect(() => {
    loadFavorites();
    window.addEventListener('favoritesChanged', loadFavorites);
    return () => window.removeEventListener('favoritesChanged', loadFavorites);
  }, []);

  const filteredFavorites = useMemo(() => {
    if (filterStatus === 'all') return favorites;
    return favorites.filter((product) => {
      const current = getProductById(product.id);
      if (!current) return false;
      if (filterStatus === 'free') return isFreeShareListing(current);
      return current.status === filterStatus;
    });
  }, [favorites, filterStatus]);

  const handleUnfavorite = (product: Product) => {
    if (confirm(`Remove "${product.title}" from saved?`)) {
      removeFavorite(product.id);
      loadFavorites();
    }
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title="Saved"
        rightContent={
          filteredFavorites.length > 0 || favorites.length > 0 ? (
            <span className="text-sm text-gray-500">
              {filterStatus === 'all' ? favorites.length : filteredFavorites.length}
            </span>
          ) : undefined
        }
      />

      {favorites.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b border-gray-200 px-4 py-3">
          {FILTER_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setFilterStatus((current) =>
                  current === value && value !== 'all' ? 'all' : value,
                )
              }
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                filterStatus === value ? 'text-white' : 'bg-gray-100 text-gray-700'
              }`}
              style={filterStatus === value ? { backgroundColor: TEAL } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-4">
        {favorites.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <p className="text-gray-500">No saved listings.</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: TEAL }}
            >
              Browse listings
            </button>
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No saved listings match this filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFavorites.map((product) => {
              const stillExists = getProductById(product.id);
              if (!stillExists) {
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between px-4 py-4 rounded-xl border border-gray-200 bg-gray-50"
                  >
                    <p className="text-gray-500 text-sm">This listing was removed.</p>
                    <button
                      onClick={() => {
                        removeFavorite(product.id);
                        loadFavorites();
                      }}
                      className="text-red-500 text-sm font-medium"
                    >
                      Remove from list
                    </button>
                  </div>
                );
              }
              return (
                <div key={product.id} className="relative">
                  <ListingCard
                    product={stillExists}
                    layout="list"
                    onClick={() => navigate(`/product/${product.id}`)}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnfavorite(product);
                    }}
                    className="absolute top-3 right-3 p-2 bg-white/90 rounded-full shadow-sm hover:bg-red-50 transition-colors"
                    title="Remove from saved"
                  >
                    <svg className="w-5 h-5 text-red-500 fill-current" viewBox="0 0 24 24">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
