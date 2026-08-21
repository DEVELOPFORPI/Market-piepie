import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';
import { Post, PostCategory, Product, POST_CATEGORY_VALUE } from '@/types';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useLanguage, type AppMessageKey } from '@/hooks/useLanguage';
import { addUserPost, getPostById, ensurePostById, updateUserPost, updateDisputePost, COMMUNITY_QUOTA_EXCEEDED_MESSAGE } from '@/utils/communityStorage';
import { syncPostsFromDB } from '@/utils/dbSync';
import { getMyProducts } from '@/utils/productStorage';
import { getMyUser } from '@/utils/profileStorage';
import { getRegion } from '@/utils/regionStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { createLocalPreviewUrls, revokeLocalPreviewUrl, uploadImageReferencesToR2 } from '@/utils/imageUpload';
import { getCurrentCoordinates } from '@/utils/geoLocation';
import { hasSensitiveContent } from '@/utils/contentFilter';
import { useGuestPageGuard } from '@/hooks/useGuestPageGuard';
import { BottomSheet } from '@/components/common/BottomSheet';
import { showToast } from '@/utils/toast';

const CAT_KEY: Record<PostCategory, AppMessageKey> = {
  [POST_CATEGORY_VALUE.QUESTION]: 'catQuestion',
  [POST_CATEGORY_VALUE.INFO]: 'catInfo',
  [POST_CATEGORY_VALUE.LOOKING_FOR]: 'catLookingFor',
  [POST_CATEGORY_VALUE.DISPUTE]: 'catDispute',
  [POST_CATEGORY_VALUE.SWAP]: 'catSwap',
};

export const PostWrite: React.FC = () => {
  const { t } = useLanguage();
  const { askConfirm, confirmDialog } = useConfirmDialog();
  useGuestPageGuard('post');
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const isEdit = !!postId;

  const [category, setCategory] = useState<PostCategory>(POST_CATEGORY_VALUE.INFO);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [showProductSelect, setShowProductSelect] = useState(false);
  const [attachedProduct, setAttachedProduct] = useState<Product | null>(null);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const categories: PostCategory[] = [
    POST_CATEGORY_VALUE.QUESTION,
    POST_CATEGORY_VALUE.INFO,
    POST_CATEGORY_VALUE.LOOKING_FOR,
    POST_CATEGORY_VALUE.SWAP,
  ];

  // Load my listings for attach flow
  useEffect(() => {
    setMyProducts(getMyProducts());
  }, []);

  // Edit: load post; auto dispute posts cannot be edited
  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    void (async () => {
      const existing = await ensurePostById(postId);
      if (cancelled) return;
      if (existing) {
        if (existing.category === POST_CATEGORY_VALUE.DISPUTE && existing.orderId) {
          showToast(t('cannotEditDispute'));
          navigate('/community', { replace: true });
          return;
        }
        setCategory(existing.category);
        setTitle(existing.title);
        setContent(existing.content);
        setImages(existing.images || []);
        setAttachedProduct(existing.attachedProduct || null);
      } else {
        showToast(t('postNotFound'));
        navigate('/community', { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [postId, navigate, t]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    if (images.length + files.length > 5) {
      showToast(t('upTo5ImagesAlert'));
      return;
    }
    const previews = createLocalPreviewUrls(files);
    if (previews.length === 0) {
      showToast(t('couldNotUpload'));
      return;
    }
    setImages((prev) => [...prev, ...previews]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      revokeLocalPreviewUrl(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      showToast(t('enterTitleBody'));
      return;
    }

    try {
      if (hasSensitiveContent(content)) {
        const proceed = await askConfirm({
          message: t('sensitiveConfirm'),
          confirmLabel: t('ok'),
          cancelLabel: t('cancel'),
        });
        if (!proceed) return;
      }
    } catch { /* ignore */ }

    setIsSubmitting(true);
    try {
      const existingForEdit = isEdit ? getPostById(postId!) : null;
      const region = isEdit && existingForEdit?.region ? existingForEdit.region : (getRegion() || '');
      // Save coordinates; keep existing on edit
      const coords = await getCurrentCoordinates();
      let imagesToSave: string[] = [];
      if (images.length > 0) {
        setUploadingImages(true);
        try {
          imagesToSave = await uploadImageReferencesToR2(images, { folder: 'posts' });
        } finally {
          setUploadingImages(false);
        }
      }

      const post: Post = {
        id: isEdit ? postId! : `post_${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        category,
        author: getMyUser(),
        commentCount: isEdit && existingForEdit ? existingForEdit.commentCount : 0,
        createdAt: isEdit && existingForEdit ? existingForEdit.createdAt : new Date().toISOString(),
        region,
        ...(imagesToSave.length > 0 && { images: imagesToSave }),
        ...(attachedProduct && { attachedProduct }),
        ...(coords && { latitude: coords.latitude, longitude: coords.longitude }),
        ...(existingForEdit?.orderId && { orderId: existingForEdit.orderId }),
      };

      if (isEdit) {
        if (existingForEdit?.category === POST_CATEGORY_VALUE.DISPUTE && existingForEdit?.orderId) {
          updateDisputePost(post);
          showToast(t('postUpdated'));
        } else {
          const ok = await updateUserPost(post);
          if (!ok) {
            showToast(t('couldNotSave'));
            return;
          }
          await syncPostsFromDB();
          showToast(t('postUpdated'));
        }
      } else {
        const ok = await addUserPost(post);
        if (!ok) {
          showToast(t('couldNotSave'));
          return;
        }
        await syncPostsFromDB();
        showToast(t('postPublished'));
      }
      images.forEach(revokeLocalPreviewUrl);
      navigate('/community', { replace: true });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        showToast(COMMUNITY_QUOTA_EXCEEDED_MESSAGE);
      } else {
        showToast(t('couldNotSave'));
      }
    } finally {
      setIsSubmitting(false);
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
        title={isEdit ? t('editPost') : t('newPost')}
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {/* Category Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('categoryLabel')} <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`w-[calc(33.333%-6px)] h-11 flex items-center justify-center border rounded-lg font-medium text-sm leading-tight text-center ${
                  category === cat
                    ? 'text-white'
                    : 'border-gray-300 text-gray-700'
                }`}
                style={category === cat ? { borderColor: '#00A8A3', backgroundColor: '#00A8A3' } : undefined}
              >
                {t(CAT_KEY[cat])}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('titleLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('bodyLabel')} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('bodyPlaceholder')}
            rows={8}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3] resize-none"
          />
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('imagesOptional')}</label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-200">
                <img src={getDisplayImageUrl(img)} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#00A8A3]">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </label>
            )}
          </div>
          <p className="text-xs text-gray-500">{t('upTo5Images')}</p>
        </div>

        {category === POST_CATEGORY_VALUE.LOOKING_FOR && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('attachListingOptional')}
            </label>
            <p className="text-xs text-gray-500 mb-2">{t('attachListingHint')}</p>
            {attachedProduct ? (
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600">{t('attachedListing')}</span>
                  <button
                    onClick={() => setAttachedProduct(null)}
                    className="text-sm text-red-500"
                  >
                    {t('remove')}
                  </button>
                </div>
                <ListingCard product={attachedProduct} layout="list" />
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowProductSelect(true)}
                  className="flex-1 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#00A8A3] hover:text-[#00A8A3]"
                >
                  {t('attachListing')}
                </button>
                <button
                  type="button"
                  onClick={() => setAttachedProduct(null)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-500 text-sm bg-gray-50 hover:bg-gray-100"
                >
                  {t('skipAttach')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saving overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-black/40 flex flex-col items-center justify-center" aria-busy="true">
          <div className="bg-white rounded-xl px-6 py-5 flex flex-col items-center gap-3 shadow-lg">
            <div className="w-10 h-10 border-4 border-[#00A8A3] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-700">{isEdit ? t('saving') : t('publishing')}</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim() || isSubmitting || uploadingImages}
          className="w-full px-4 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          style={title.trim() && content.trim() && !isSubmitting && !uploadingImages ? { backgroundColor: '#00A8A3' } : undefined}
        >
          {uploadingImages ? t('uploading') : isSubmitting ? (isEdit ? t('saving') : t('publishing')) : isEdit ? t('saveChanges') : t('publish')}
        </button>
      </div>

      <BottomSheet
        isOpen={showProductSelect}
        onClose={() => setShowProductSelect(false)}
        title={t('chooseYourListing')}
        height="80vh"
      >
        <div className="p-4 space-y-3">
          {myProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              <p>{t('noListings')}</p>
              <button
                onClick={() => {
                  setShowProductSelect(false);
                  navigate('/register');
                }}
                className="mt-3 px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#00A8A3' }}
              >
                {t('createListing')}
              </button>
            </div>
          ) : (
            myProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => {
                  setAttachedProduct(product);
                  setShowProductSelect(false);
                }}
                className="cursor-pointer"
              >
                <ListingCard product={product} layout="list" />
              </div>
            ))
          )}
        </div>
      </BottomSheet>
      {confirmDialog}
    </div>
  );
};
