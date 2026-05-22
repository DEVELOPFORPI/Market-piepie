import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ListingCard } from '@/components/common/ListingCard';
import { BottomSheet } from '@/components/common/BottomSheet';
import { TabType, Product, TAB_TYPE_VALUE, ORDER_STATUS_VALUE, PRODUCT_STATUS_VALUE } from '@/types';
import { getAllProducts } from '@/utils/productStorage';
import { getRegion } from '@/utils/regionStorage';
import { getUnreadCount } from '@/utils/notificationStorage';
import { getOrders } from '@/utils/orderStorage';
import { labelTabType, UI_REGION_PLACEHOLDER } from '@/locale/enUI';
import { getHomePopupConfig, shouldShowHomePopup, dismissHomePopupForSession } from '@/utils/homePopupStorage';
import { HomePromoPopup } from '@/components/home/HomePromoPopup';
import { usePiPrice } from '@/utils/piPrice';

const defaultMockProducts: Product[] = [];

const tabs: TabType[] = [TAB_TYPE_VALUE.LATEST, TAB_TYPE_VALUE.FREE];

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>(TAB_TYPE_VALUE.LATEST);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [kycOnly, setKycOnly] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>(defaultMockProducts);
  const [selectedRegion, setSelectedRegion] = useState<string>(UI_REGION_PLACEHOLDER);
  const [piExpanded, setPiExpanded] = useState(false);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const piPrice = usePiPrice();
  const [homePromo, setHomePromo] = useState(() => ({
    show: shouldShowHomePopup(),
    config: getHomePopupConfig(),
  }));
  const [homePromoReady, setHomePromoReady] = useState(false);

  const refreshHomePromo = useCallback(() => {
    const show = shouldShowHomePopup();
    const config = getHomePopupConfig();
    setHomePromo({ show, config });
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') return;
    setHomePromoReady(false);
    refreshHomePromo();
    const raf = window.requestAnimationFrame(() => {
      setHomePromoReady(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [location.pathname, refreshHomePromo]);

  useEffect(() => {
    const fn = () => refreshHomePromo();
    window.addEventListener('homePopupConfigChanged', fn);
    return () => window.removeEventListener('homePopupConfigChanged', fn);
  }, [refreshHomePromo]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'marketpiepie_home_popup_config_v1') return;
      refreshHomePromo();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshHomePromo]);

  const closeHomePromo = () => {
    dismissHomePopupForSession();
    setHomePromo((s) => ({ ...s, show: false }));
  };

  // Refresh when returning to home
  const refreshHomeData = () => {
    const savedRegion = getRegion();
    if (savedRegion) setSelectedRegion(savedRegion);
    setAllProducts(getAllProducts());
    setNotificationUnread(getUnreadCount());
  };

  useEffect(() => {
    if (location.pathname === '/') {
      refreshHomeData();
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleStorageChange = () => {
      const products = getAllProducts();
      setAllProducts(products);
    };

    const handleRegionChange = () => {
      const savedRegion = getRegion();
      if (savedRegion) {
        setSelectedRegion(savedRegion);
      }
    };

    const refreshNotificationCount = () => setNotificationUnread(getUnreadCount());

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('productRegistered', handleStorageChange);
    window.addEventListener('productsChanged', handleStorageChange);
    window.addEventListener('regionChanged', handleRegionChange);
    window.addEventListener('notificationsChanged', refreshNotificationCount);
    refreshNotificationCount();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('productRegistered', handleStorageChange);
      window.removeEventListener('productsChanged', handleStorageChange);
      window.removeEventListener('regionChanged', handleRegionChange);
      window.removeEventListener('notificationsChanged', refreshNotificationCount);
    };
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      console.log('Search:', searchQuery);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts];

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.region.toLowerCase().includes(query) ||
          p.seller.nickname.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query)
      );
    }

    // Price range
    if (minPrice) {
      filtered = filtered.filter((p) => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter((p) => p.price <= Number(maxPrice));
    }

    // KYC-only filter
    if (kycOnly) {
      filtered = filtered.filter((p) => p.seller.kycStatus === 'verified');
    }

    // Tab filter + sort (newest first)
    if (activeTab === TAB_TYPE_VALUE.FREE) {
      filtered = filtered.filter((p) => p.isFreeShare || p.price === 0);
    }
    filtered = [...filtered].sort((a, b) => {
      const aSold = a.status === PRODUCT_STATUS_VALUE.SOLD ? 1 : 0;
      const bSold = b.status === PRODUCT_STATUS_VALUE.SOLD ? 1 : 0;
      if (aSold !== bSold) return aSold - bSold;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [allProducts, searchQuery, minPrice, maxPrice, kycOnly, activeTab]);

  const meetupProductIds = new Set(
    getOrders()
      .filter((o) => o.status === ORDER_STATUS_VALUE.MEETUP_SET)
      .map((o) => o.product?.id)
      .filter(Boolean)
  );

  return (
    <div className="min-h-screen bg-white pb-20">
      {location.pathname === '/' && homePromoReady && homePromo.show && homePromo.config.enabled ? (
        <HomePromoPopup config={homePromo.config} onClose={closeHomePromo} />
      ) : null}
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 h-14">
          <button
            onClick={() => navigate('/region/select')}
            className="flex items-center gap-1 text-sm font-medium text-gray-900"
          >
            {selectedRegion} <span className="text-gray-400">▾</span>
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className={`relative p-2 ${notificationUnread > 0 ? 'text-[#00A8A3]' : 'text-gray-900 hover:text-gray-600'}`}
            aria-label="Notifications"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notificationUnread > 0 && (
              <span
                className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: '#00A8A3' }}
              >
                {notificationUnread > 99 ? '99+' : notificationUnread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search title, region, seller"
              className="w-full px-4 py-3 pl-11 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3] bg-gray-50"
            />
            <svg
              className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 hover:text-gray-600"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(true)}
            className="p-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 bg-white"
            aria-label="Filter"
          >
            <img src="/b_1.svg" alt="Filter" className="w-5 h-5 object-contain" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-full px-2 py-3 border-b border-gray-200 items-center">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex justify-center items-center text-sm font-semibold whitespace-nowrap transition-colors min-w-0 py-2.5 rounded-full outline-none focus:outline-none focus-visible:ring-0 ${
              activeTab === tab
                ? 'rounded-full text-white'
                : 'text-[#CFCFCF] hover:text-gray-500 bg-transparent'
            }`}
            style={{
              ...(activeTab === tab ? { backgroundColor: '#00A8A3' } : {}),
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {labelTabType(tab)}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchQuery ? 'No results.' : 'No listings yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 px-4 py-4">
          {filteredProducts.map((product) => (
            <ListingCard
              key={product.id}
              product={product}
              layout="grid"
              onClick={() => navigate(`/product/${product.id}`)}
              meetupConfirmed={meetupProductIds.has(product.id)}
            />
          ))}
        </div>
      )}

      {/* PI price widget */}
      <div
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex items-center overflow-hidden rounded-l-2xl shadow-lg border border-r-0 border-gray-100 bg-gradient-to-l from-white to-gray-50 transition-all duration-300 ease-out"
        style={{ width: piExpanded ? 200 : 52 }}
        aria-expanded={piExpanded}
      >
        {/* Expanded */}
        <div
          className={`flex items-center gap-2 min-w-0 pl-2 pr-3 py-2.5 overflow-hidden transition-all duration-300 ${
            piExpanded ? 'opacity-100' : 'opacity-0 w-0 min-w-0 pl-0 pr-0'
          }`}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPiExpanded(false); }}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            aria-label="Collapse"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img src="/pi_logo.svg" alt="PI" className="w-5 h-5 object-contain flex-shrink-0" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-gray-900 text-base">
                  {piPrice.loading ? '...' : piPrice.error ? '--' : `$${piPrice.price!.toFixed(4)}`}
                </span>
                {piPrice.change24h != null && !piPrice.loading && !piPrice.error && (
                  <span className={`text-xs font-semibold ${piPrice.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {piPrice.change24h >= 0 ? '+' : ''}{piPrice.change24h.toFixed(2)}%
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-500 font-medium">PI Network</span>
            </div>
          </div>
        </div>

        {/* Collapsed */}
        <button
          type="button"
          onClick={() => setPiExpanded((v) => !v)}
          className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 flex-shrink-0 overflow-hidden transition-all duration-300 hover:bg-gray-50 ${
            piExpanded ? 'opacity-0 w-0 min-w-0 p-0 pointer-events-none' : ''
          }`}
          aria-label="Expand PI price"
        >
          <img src="/pi_logo.svg" alt="PI" className="w-6 h-6 object-contain flex-shrink-0" />
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] font-bold text-gray-700">
              {piPrice.loading ? '...' : piPrice.error ? '--' : `$${piPrice.price!.toFixed(2)}`}
            </span>
            {piPrice.change24h != null && !piPrice.loading && !piPrice.error && (
              <svg className={`w-3 h-3 ${piPrice.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 20 20">
                {piPrice.change24h >= 0
                  ? <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  : <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                }
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* Filter BottomSheet */}
      <BottomSheet
        isOpen={showFilter}
        onClose={() => setShowFilter(false)}
        title="Filter"
      >
        <div className="px-4 py-6 space-y-6">
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
              <span className="text-sm text-gray-700">Verified sellers only</span>
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
