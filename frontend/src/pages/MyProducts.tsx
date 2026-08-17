import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';
import { Product, ProductStatus, PRODUCT_STATUS_VALUE } from '@/types';
import { isFreeShareListing } from '@/locale/enUI';
import { getMyProducts, deleteProduct } from '@/utils/productStorage';
import { hasProductActiveDispute } from '@/utils/disputeStorage';
import { useLanguage } from '@/hooks/useLanguage';
import type { AppMessageKey } from '@/hooks/useLanguage';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';

type FilterStatus = 'all' | 'free' | ProductStatus;

export const MyProducts: React.FC = () => {
  useGuestPageGuard('sell');
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [products, setProducts] = useState<Product[]>([]);

  const loadProducts = () => {
    setProducts(getMyProducts());
  };

  useEffect(() => {
    loadProducts();
    window.addEventListener('productsChanged', loadProducts);
    window.addEventListener('productRegistered', loadProducts);
    return () => {
      window.removeEventListener('productsChanged', loadProducts);
      window.removeEventListener('productRegistered', loadProducts);
    };
  }, []);

  const handleDelete = (productId: string, productTitle: string) => {
    if (confirm(t('deleteConfirm', { title: productTitle }))) {
      deleteProduct(productId);
      loadProducts();
      window.dispatchEvent(new Event('productRegistered'));
    }
  };

  const filteredProducts = (() => {
    if (filterStatus === 'all') return products;
    if (filterStatus === 'free') return products.filter((p) => isFreeShareListing(p));
    return products.filter((p) => p.status === filterStatus);
  })();

  const filterTabs: { value: FilterStatus; labelKey: AppMessageKey }[] = [
    { value: 'all', labelKey: 'chipAll' },
    { value: 'free', labelKey: 'free' },
    { value: PRODUCT_STATUS_VALUE.FOR_SALE, labelKey: 'forSale' },
    { value: PRODUCT_STATUS_VALUE.RESERVED, labelKey: 'trading' },
    { value: PRODUCT_STATUS_VALUE.SOLD, labelKey: 'sold' },
  ];

  return (
    <div className="min-h-screen bg-white pb-20">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2" aria-label={t('goBack')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={t('myListings')}
      />

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-200 overflow-x-auto">
        {filterTabs.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setFilterStatus(value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filterStatus === value
                ? 'text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={filterStatus === value ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Product List */}
      <div className="px-4 py-4">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">{t('noListings')}</p>
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-2 text-white rounded-lg font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              {t('createListing')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => (
              <div key={product.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div
                  onClick={() => {
                    if (!product.adminHidden) navigate(`/product/${product.id}`);
                  }}
                >
                  <ListingCard
                    product={product}
                    layout="list"
                    hideLikeCount
                    hideLikeButton
                    hideSeller
                  />
                </div>
                {product.adminHidden ? (
                  <div className="border-t border-gray-200 bg-gray-100 px-4 py-2 text-xs text-gray-600">
                    {t('adminHidden')}
                    {product.adminHiddenReason ? ` ${product.adminHiddenReason}` : ''}
                  </div>
                ) : null}
                <div className="flex border-t border-gray-200">
                  {hasProductActiveDispute(product.id) ? (
                    <p className="flex-1 py-2.5 text-center text-sm text-gray-500">
                      {t('cannotEditDeleteDispute')}
                    </p>
                  ) : (
                    <>
                      {!product.adminHidden && product.status !== PRODUCT_STATUS_VALUE.SOLD && (
                        <>
                          <button
                            onClick={() => navigate(`/register/edit/${product.id}`)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {t('edit')}
                          </button>
                          <div className="w-px bg-gray-200" />
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(product.id, product.title)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {t('delete')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/register')}
        className="fixed bottom-24 right-4 w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity z-40"
        style={{ backgroundColor: '#00A8A3' }}
        aria-label={t('createListing')}
      >
        <span className="relative flex h-full w-full items-center justify-center">
          <img src="/main.svg" alt="" className="h-7 w-7 object-contain" />
          <span
            className="absolute -left-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full p-0.5"
            style={{ backgroundColor: '#00A8A3', border: '2px solid #E2E2E2' }}
          >
            <img src="/plus.svg" alt="" className="w-full h-full object-contain" />
          </span>
        </span>
      </button>
    </div>
  );
};
