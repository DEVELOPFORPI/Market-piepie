import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';
import { Product, ProductStatus, PRODUCT_STATUS_VALUE, ORDER_STATUS_VALUE } from '@/types';
import { labelProductStatus } from '@/locale/enUI';
import { getMyProducts, deleteProduct } from '@/utils/productStorage';
import { getOrders } from '@/utils/orderStorage';
import { hasProductActiveDispute } from '@/utils/disputeStorage';

type FilterStatus = 'all' | ProductStatus;

export const MyProducts: React.FC = () => {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [products, setProducts] = useState<Product[]>([]);

  const loadProducts = () => {
    setProducts(getMyProducts());
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleDelete = (productId: string, productTitle: string) => {
    if (confirm(`Delete "${productTitle}"?`)) {
      deleteProduct(productId);
      loadProducts();
      window.dispatchEvent(new Event('productRegistered'));
    }
  };

  const filteredProducts = filterStatus === 'all'
    ? products
    : products.filter((p) => p.status === filterStatus);

  const meetupProductIds = new Set(
    getOrders().filter((o) => o.status === ORDER_STATUS_VALUE.MEETUP_SET).map((o) => o.product?.id).filter(Boolean)
  );

  const filterTabs: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: PRODUCT_STATUS_VALUE.FOR_SALE, label: labelProductStatus(PRODUCT_STATUS_VALUE.FOR_SALE) },
    { value: PRODUCT_STATUS_VALUE.RESERVED, label: labelProductStatus(PRODUCT_STATUS_VALUE.RESERVED) },
    { value: PRODUCT_STATUS_VALUE.SOLD, label: labelProductStatus(PRODUCT_STATUS_VALUE.SOLD) },
  ];

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
        title="My listings"
        rightContent={
          <button
            onClick={() => navigate('/register')}
            className="px-3 py-1.5 text-sm font-medium"
            style={{ color: '#00A8A3' }}
          >
            Add
          </button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-200 overflow-x-auto">
        {filterTabs.map(({ value, label }) => (
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
            {label}
          </button>
        ))}
      </div>

      {/* Product List */}
      <div className="px-4 py-4">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No listings yet.</p>
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-2 text-white rounded-lg font-medium"
              style={{ backgroundColor: '#00A8A3' }}
            >
              Create listing
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => (
              <div key={product.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div onClick={() => navigate(`/product/${product.id}`)}>
                  <ListingCard
                    product={product}
                    layout="list"
                    meetupConfirmed={meetupProductIds.has(product.id)}
                  />
                </div>
                <div className="flex border-t border-gray-200">
                  {hasProductActiveDispute(product.id) ? (
                    <p className="flex-1 py-2.5 text-center text-sm text-gray-500">You cannot edit or delete during a dispute.</p>
                  ) : (
                    <>
                      {product.status !== PRODUCT_STATUS_VALUE.SOLD && (
                        <>
                          <button
                            onClick={() => navigate(`/register/edit/${product.id}`)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
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
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
