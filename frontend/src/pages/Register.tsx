import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { Product, PRODUCT_STATUS_VALUE, TRADE_METHOD_VALUE } from '@/types';
import { UI_REGION_PLACEHOLDER } from '@/locale/enUI';
import { saveProduct, getAllProducts } from '@/utils/productStorage';
import { getRegion } from '@/utils/regionStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { uploadImagesToR2, uploadImageReferencesToR2 } from '@/utils/imageUpload';
import { getMyUser } from '@/utils/profileStorage';
import { hasProductActiveDispute } from '@/utils/disputeStorage';
import { isGuest } from '@/utils/guestGate';

const MAX_IMAGES = 5;
const REGISTER_DRAFT_KEY_PREFIX = 'pipi_register_draft_v1_';
const REGISTER_REGION_PICKER_KEY = 'pipi_register_region_picker_v1';

type RegisterDraft = {
  images: string[];
  title: string;
  price: string;
  isFreeShare: boolean;
  allowOffer: boolean;
  region: string;
  description: string;
};

export const Register: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (isGuest()) navigate('/welcome', { replace: true });
  }, [navigate]);
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;

  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [isFreeShare, setIsFreeShare] = useState(false);
  const [allowOffer, setAllowOffer] = useState(true);
  const [region, setRegion] = useState('');
  const [description, setDescription] = useState('');
  const [originalProduct, setOriginalProduct] = useState<Product | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const draftKey = `${REGISTER_DRAFT_KEY_PREFIX}${editId || 'new'}`;

  const saveRegisterDraft = () => {
    const draft: RegisterDraft = {
      images,
      title,
      price,
      isFreeShare,
      allowOffer,
      region,
      description,
    };
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // ignore
    }
  };

  // Edit: load listing (sold listings cannot be edited)
  useEffect(() => {
    if (editId) {
      const products = getAllProducts();
      const found = products.find((p) => p.id === editId);
      if (found) {
        if (found.status === PRODUCT_STATUS_VALUE.SOLD) {
          alert('Sold listings cannot be edited.');
          navigate(`/product/${editId}`, { replace: true });
          return;
        }
        if (hasProductActiveDispute(found.id)) {
          alert('You cannot edit while a dispute is open.');
          navigate(`/product/${editId}`, { replace: true });
          return;
        }
        setOriginalProduct(found);
        setTitle(found.title);
        setPrice(found.price > 0 ? String(found.price) : '');
        setIsFreeShare(found.isFreeShare || found.price === 0);
        setAllowOffer(found.allowOffer !== false);
        setImages(found.images || []);
        setRegion(found.region);
        setDescription(found.description === '-' ? '' : found.description);
      }
    }
  }, [editId, navigate]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<RegisterDraft>;
      if (Array.isArray(draft.images)) setImages(draft.images);
      if (typeof draft.title === 'string') setTitle(draft.title);
      if (typeof draft.price === 'string') setPrice(draft.price);
      if (typeof draft.isFreeShare === 'boolean') setIsFreeShare(draft.isFreeShare);
      if (typeof draft.allowOffer === 'boolean') setAllowOffer(draft.allowOffer);
      if (typeof draft.region === 'string') setRegion(draft.region);
      if (typeof draft.description === 'string') setDescription(draft.description);
    } catch {
      // ignore invalid draft
    }
  }, [draftKey]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(REGISTER_REGION_PICKER_KEY) !== draftKey) return;
      const savedRegion = getRegion();
      if (savedRegion) setRegion(savedRegion);
      sessionStorage.removeItem(REGISTER_REGION_PICKER_KEY);
    } catch {
      // ignore
    }
  }, [draftKey]);

  // Free share → no offers
  useEffect(() => {
    if (isFreeShare) setAllowOffer(false);
  }, [isFreeShare]);

  useEffect(() => {
    if (!isEdit) {
      const savedRegion = getRegion();
      if (savedRegion) setRegion(savedRegion);
    }
  }, [isEdit]);

  useEffect(() => {
    const onRegionChanged = () => setRegion(getRegion());
    window.addEventListener('regionChanged', onRegionChanged);
    return () => window.removeEventListener('regionChanged', onRegionChanged);
  }, []);

  const handleRegionSelect = () => {
    saveRegisterDraft();
    try {
      sessionStorage.setItem(REGISTER_REGION_PICKER_KEY, draftKey);
    } catch {
      // ignore
    }
    navigate('/region/select');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      alert(`You can upload up to ${MAX_IMAGES} photos.`);
      return;
    }
    setUploadingImages(true);
    try {
      const urls = await uploadImagesToR2(files, { folder: 'products' });
      setImages((prev) => [...prev, ...urls]);
    } catch {
      alert('Could not upload image.');
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || (!isFreeShare && !price) || !region) {
      alert('Fill in all required fields.');
      return;
    }

    let imagesToSave: string[] = [];
    try {
      imagesToSave = await uploadImageReferencesToR2(images, { folder: 'products' });
    } catch {
      alert('Could not upload image.');
      return;
    }

    const product: Product = {
      id: isEdit && originalProduct ? originalProduct.id : `product-${Date.now()}`,
      title,
      category: originalProduct?.category || 'Other',
      price: isFreeShare ? 0 : Number(price),
      images: imagesToSave,
      region,
      status: originalProduct?.status || PRODUCT_STATUS_VALUE.FOR_SALE,
      description: description || '-',
      createdAt: originalProduct?.createdAt || new Date().toISOString(),
      seller: originalProduct?.seller || getMyUser(),
      tradeMethods: originalProduct?.tradeMethods || [TRADE_METHOD_VALUE.IN_PERSON],
      todayTradeAvailable: originalProduct?.todayTradeAvailable || false,
      liked: originalProduct?.liked || false,
      isFreeShare,
      allowOffer: isFreeShare ? false : allowOffer,
    };

    try {
      saveProduct(product);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save.';
      alert(message);
      return;
    }
    try {
      sessionStorage.removeItem(draftKey);
      sessionStorage.removeItem(REGISTER_REGION_PICKER_KEY);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event('productRegistered'));

    if (isEdit) {
      alert('Listing updated.');
      navigate(-1);
    } else {
      navigate('/register/complete', { state: { productId: product.id, ...product }, replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={isEdit ? 'Edit listing' : 'New listing'}
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        <section>
          <label className="block text-base font-semibold text-gray-900 mb-2">Trade area</label>
          <button
            type="button"
            onClick={handleRegionSelect}
            className="w-full flex items-center justify-between px-4 py-3 border-2 rounded-lg text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
            style={{ borderColor: region ? '#00A8A3' : '#e5e7eb' }}
          >
            <span className="text-gray-700">
              {region || UI_REGION_PLACEHOLDER}
            </span>
            <span className="font-medium" style={{ color: '#00A8A3' }}>
              {region ? 'Change' : 'Set'}
            </span>
          </button>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Photos</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, idx) => (
              <div key={idx} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-gray-200">
                <img src={getDisplayImageUrl(img)} alt={`${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {Array.from({ length: Math.max(1, MAX_IMAGES - images.length) }).map((_, i) => (
              <label
                key={`slot-${i}`}
                className="flex-shrink-0 w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#00A8A3] transition-colors"
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <svg className="w-8 h-8 text-gray-400 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs text-gray-500">{images.length}/{MAX_IMAGES}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <label className="block text-base font-semibold text-gray-900 mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Listing title"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
          />
        </section>

        <section>
          <label className="block text-base font-semibold text-gray-900 mb-2">Listing type</label>
          <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <span className="relative w-5 h-5 shrink-0 inline-flex items-center justify-center">
              <input
                type="checkbox"
                checked={isFreeShare}
                onChange={(e) => {
                  setIsFreeShare(e.target.checked);
                  if (e.target.checked) setPrice('');
                }}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded border-2 border-gray-300 peer-checked:border-[#00A8A3] peer-checked:bg-[#00A8A3]" />
              <svg className="relative z-10 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <img src="/p_1.svg" alt="Gift" className="w-6 h-6 object-contain" />
            <span className="text-base font-medium text-gray-900">Free share</span>
          </label>
        </section>

        {!isFreeShare && (
          <section>
            <label className="block text-base font-semibold text-gray-900 mb-2">Price (Pi)</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
            />
          </section>
        )}

        <section>
          <label className="block text-base font-semibold text-gray-900 mb-2">
            Description <span className="text-sm text-gray-500">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your item"
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3] resize-none"
          />
        </section>

        <section>
          <label className="flex items-start gap-3">
            <span className="relative w-5 h-5 shrink-0 inline-flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={allowOffer}
                disabled={isFreeShare}
                onChange={(e) => setAllowOffer(e.target.checked)}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded border-2 border-gray-300 peer-checked:border-[#00A8A3] peer-checked:bg-[#00A8A3] peer-disabled:bg-gray-100 peer-disabled:border-gray-200" />
              <svg
                className="relative z-10 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-base font-semibold text-gray-900">Allow offers</span>
              <span className="text-xs text-gray-500">Buyers can send price offers when enabled</span>
            </div>
          </label>
          {isFreeShare && (
            <p className="mt-2 ml-8 text-xs text-red-500">Free shares cannot receive offers.</p>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title || (!isFreeShare && !price) || !region || uploadingImages}
          className="w-full py-3.5 text-white rounded-lg font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#00A8A3' }}
        >
          {uploadingImages ? 'Uploading...' : isEdit ? 'Save changes' : 'Publish listing'}
        </button>
      </div>
    </div>
  );
};
