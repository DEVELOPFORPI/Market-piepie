import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';
import { Product, ORDER_STATUS_VALUE } from '@/types';
import { getFavorites, removeFavorite } from '@/utils/favoriteStorage';
import { getOrders } from '@/utils/orderStorage';
import { getProductById } from '@/utils/productStorage';

export const MyFavorites: React.FC = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Product[]>([]);

  const loadFavorites = () => {
    setFavorites(getFavorites());
  };

  useEffect(() => {
    loadFavorites();
    window.addEventListener('favoritesChanged', loadFavorites);
    return () => window.removeEventListener('favoritesChanged', loadFavorites);
  }, []);

  const handleUnfavorite = (product: Product) => {
    if (confirm(`Remove "${product.title}" from saved?`)) {
      removeFavorite(product.id);
      loadFavorites();
    }
  };

  const meetupProductIds = new Set(
    getOrders().filter((o) => o.status === ORDER_STATUS_VALUE.MEETUP_SET).map((o) => o.product?.id).filter(Boolean)
  );

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
          favorites.length > 0 ? (
            <span className="text-sm text-gray-500">{favorites.length}</span>
          ) : undefined
        }
      />

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
              style={{ backgroundColor: '#00A8A3' }}
            >
              Browse listings
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {favorites.map((product) => {
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
                    meetupConfirmed={meetupProductIds.has(product.id)}
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
