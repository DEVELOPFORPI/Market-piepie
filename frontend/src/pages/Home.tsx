import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ListingCard } from '@/components/common/ListingCard';
import { BottomSheet } from '@/components/common/BottomSheet';
import { NotificationBellButton } from '@/components/common/NotificationBellButton';
import { HomeFeedChip, Product, HOME_FEED_CHIP_VALUE, PRODUCT_STATUS_VALUE } from '@/types';
import { getAllProducts } from '@/utils/productStorage';
import { getLikeCount } from '@/utils/favoriteStorage';
import { getRegion } from '@/utils/regionStorage';
import { isFreeShareListing, labelFreeShareMenu, labelHomeFeedChip, UI_REGION_PLACEHOLDER } from '@/locale/enUI';
import { fetchActiveHomePopup, type HomePopupView } from '@/utils/homePopupStorage';
import { HomePromoPopup } from '@/components/home/HomePromoPopup';
import { usePiPrice } from '@/utils/piPrice';
import { syncProductsFromDB } from '@/utils/dbSync';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/common/PullToRefreshIndicator';

const defaultMockProducts: Product[] = [];
const HOME_PROMO_SHOWN_SESSION_KEY = 'marketpiepie_home_popup_shown_this_session';
const PRODUCT_CATEGORIES = ['Electronics', 'Furniture', 'Clothes', 'Hobby', 'Books', 'Other'] as const;

const feedChips: HomeFeedChip[] = [
  HOME_FEED_CHIP_VALUE.ALL,
  HOME_FEED_CHIP_VALUE.LATEST,
  HOME_FEED_CHIP_VALUE.FREE,
  HOME_FEED_CHIP_VALUE.FOR_SALE,
  HOME_FEED_CHIP_VALUE.POPULAR,
  HOME_FEED_CHIP_VALUE.PRICE_LOW,
  HOME_FEED_CHIP_VALUE.PRICE_HIGH,
  HOME_FEED_CHIP_VALUE.OLDEST,
];

function productListPrice(p: Product): number {
  return p.isFreeShare || p.price === 0 ? 0 : p.price;
}

function sortHomeProducts(products: Product[], chip: HomeFeedChip): Product[] {
  const sorted = [...products];
  const byNewest = (a: Product, b: Product) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const byOldest = (a: Product, b: Product) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  switch (chip) {
    case HOME_FEED_CHIP_VALUE.OLDEST:
      return sorted.sort(byOldest);
    case HOME_FEED_CHIP_VALUE.PRICE_LOW:
      return sorted.sort((a, b) => {
        const diff = productListPrice(a) - productListPrice(b);
        return diff !== 0 ? diff : byNewest(a, b);
      });
    case HOME_FEED_CHIP_VALUE.PRICE_HIGH:
      return sorted.sort((a, b) => {
        const diff = productListPrice(b) - productListPrice(a);
        return diff !== 0 ? diff : byNewest(a, b);
      });
    case HOME_FEED_CHIP_VALUE.POPULAR:
      return sorted.sort((a, b) => {
        const diff = getLikeCount(b.id) - getLikeCount(a.id);
        return diff !== 0 ? diff : byNewest(a, b);
      });
    case HOME_FEED_CHIP_VALUE.ALL:
    case HOME_FEED_CHIP_VALUE.LATEST:
    case HOME_FEED_CHIP_VALUE.FREE:
    case HOME_FEED_CHIP_VALUE.FOR_SALE:
    default:
      return sorted.sort(byNewest);
  }
}

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeChip, setActiveChip] = useState<HomeFeedChip>(HOME_FEED_CHIP_VALUE.ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>(defaultMockProducts);
  const [selectedRegion, setSelectedRegion] = useState<string>(UI_REGION_PLACEHOLDER);
  const [piExpanded, setPiExpanded] = useState(false);
  const piPrice = usePiPrice();
  const [homePromo, setHomePromo] = useState<{ show: boolean; popup: HomePopupView | null }>({
    show: false,
    popup: null,
  });
  const [homePromoReady, setHomePromoReady] = useState(false);
  const [favoritesVersion, setFavoritesVersion] = useState(0);

  const refreshHomePromo = useCallback(async () => {
    const popup = await fetchActiveHomePopup();
    if (!popup) {
      setHomePromo({ show: false, popup: null });
      return;
    }
    const alreadyShown =
      sessionStorage.getItem(HOME_PROMO_SHOWN_SESSION_KEY) === '1';
    if (alreadyShown) {
      setHomePromo({ show: false, popup });
      return;
    }
    sessionStorage.setItem(HOME_PROMO_SHOWN_SESSION_KEY, '1');
    setHomePromo({ show: popup.enabled, popup });
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') return;
    setHomePromoReady(false);
    void refreshHomePromo();
    const raf = window.requestAnimationFrame(() => {
      setHomePromoReady(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [location.pathname, refreshHomePromo]);

  useEffect(() => {
    const fn = () => {
      void refreshHomePromo();
    };
    window.addEventListener('homePopupConfigChanged', fn);
    return () => window.removeEventListener('homePopupConfigChanged', fn);
  }, [refreshHomePromo]);

  const closeHomePromo = () => {
    setHomePromo((s) => ({ ...s, show: false }));
  };

  // Refresh when returning to home
  const refreshHomeData = () => {
    const savedRegion = getRegion();
    if (savedRegion) setSelectedRegion(savedRegion);
    setAllProducts(getAllProducts());
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

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('productRegistered', handleStorageChange);
    window.addEventListener('productsChanged', handleStorageChange);
    window.addEventListener('regionChanged', handleRegionChange);
    const onFavoritesChanged = () => setFavoritesVersion((v) => v + 1);
    window.addEventListener('favoritesChanged', onFavoritesChanged);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('productRegistered', handleStorageChange);
      window.removeEventListener('productsChanged', handleStorageChange);
      window.removeEventListener('regionChanged', handleRegionChange);
      window.removeEventListener('favoritesChanged', onFavoritesChanged);
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
    const homeVisibleStatuses = new Set([
      PRODUCT_STATUS_VALUE.FOR_SALE,
      PRODUCT_STATUS_VALUE.RESERVED,
      PRODUCT_STATUS_VALUE.SOLD,
    ]);
    let filtered = allProducts.filter((p) => homeVisibleStatuses.has(p.status));

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

    if (freeOnly) {
      filtered = filtered.filter((p) => isFreeShareListing(p));
    }

    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // Price range (paid listings only)
    if (!freeOnly && minPrice) {
      filtered = filtered.filter((p) => p.price >= Number(minPrice));
    }
    if (!freeOnly && maxPrice) {
      filtered = filtered.filter((p) => p.price <= Number(maxPrice));
    }

    // Chip filter + sort
    if (activeChip === HOME_FEED_CHIP_VALUE.FREE) {
      filtered = filtered.filter((p) => p.isFreeShare || p.price === 0);
    }
    if (activeChip === HOME_FEED_CHIP_VALUE.FOR_SALE) {
      filtered = filtered.filter((p) => p.status === PRODUCT_STATUS_VALUE.FOR_SALE);
    }
    filtered = sortHomeProducts(filtered, activeChip);

    return filtered;
  }, [allProducts, searchQuery, freeOnly, selectedCategory, minPrice, maxPrice, activeChip, favoritesVersion]);

  const handlePullRefresh = useCallback(async () => {
    await syncProductsFromDB();
    refreshHomeData();
    void refreshHomePromo();
  }, [refreshHomePromo]);

  const { pull, refreshing } = usePullToRefresh(handlePullRefresh);

  return (
    <div className="min-h-screen bg-white pb-20">
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} />
      {location.pathname === '/' && homePromoReady && homePromo.show && homePromo.popup ? (
        <HomePromoPopup popup={homePromo.popup} onClose={closeHomePromo} />
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
          <NotificationBellButton />
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

      {/* Feed chips */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-200 overflow-x-auto">
        {feedChips.map((chip) => (
          <button
            key={chip}
            onClick={() => {
              setActiveChip((current) => (current === chip ? HOME_FEED_CHIP_VALUE.ALL : chip));
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              activeChip === chip
                ? 'text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={activeChip === chip ? { backgroundColor: '#00A8A3' } : undefined}
          >
            {labelHomeFeedChip(chip)}
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
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Listing type</h3>
            <button
              type="button"
              onClick={() => {
                setFreeOnly((current) => {
                  const next = !current;
                  if (next) {
                    setMinPrice('');
                    setMaxPrice('');
                  }
                  return next;
                });
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                freeOnly ? 'text-white' : 'bg-gray-100 text-gray-700'
              }`}
              style={freeOnly ? { backgroundColor: '#00A8A3' } : undefined}
            >
              {labelFreeShareMenu()} only
            </button>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Category</h3>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory((current) => (current === cat ? '' : cat))}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    selectedCategory === cat ? 'text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                  style={selectedCategory === cat ? { backgroundColor: '#00A8A3' } : undefined}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className={freeOnly ? 'opacity-50' : undefined}>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Price range</h3>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min"
                disabled={freeOnly}
                className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <span className="text-gray-500 shrink-0">~</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max"
                disabled={freeOnly}
                className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-gray-500 shrink-0">Pi</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setFreeOnly(false);
                setSelectedCategory('');
                setMinPrice('');
                setMaxPrice('');
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
