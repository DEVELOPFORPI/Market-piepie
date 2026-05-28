import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { ListingCard } from '@/components/common/ListingCard';
import { Post, PostCategory, Product, POST_CATEGORY_VALUE } from '@/types';
import { labelPostCategory } from '@/locale/enUI';
import { addUserPost, getPostById, updateUserPost, updateDisputePost, COMMUNITY_QUOTA_EXCEEDED_MESSAGE } from '@/utils/communityStorage';
import { getMyProducts } from '@/utils/productStorage';
import { getMyUser } from '@/utils/profileStorage';
import { getRegion } from '@/utils/regionStorage';
import { getDisplayImageUrl } from '@/utils/imageUrl';
import { uploadImagesToR2, uploadImageReferencesToR2 } from '@/utils/imageUpload';
import { getCurrentCoordinates } from '@/utils/geoLocation';
import { hasSensitiveContent } from '@/utils/contentFilter';
import { isGuest } from '@/utils/guestGate';

export const PostWrite: React.FC = () => {
  const _nav = useNavigate();
  useEffect(() => {
    if (isGuest()) _nav('/welcome', { replace: true });
  }, [_nav]);
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
    POST_CATEGORY_VALUE.DISPUTE,
    POST_CATEGORY_VALUE.SWAP,
  ];

  // Load my listings for attach flow
  useEffect(() => {
    setMyProducts(getMyProducts());
  }, []);

  // Edit: load post; auto dispute posts cannot be edited
  useEffect(() => {
    if (postId) {
      const existing = getPostById(postId);
      if (existing) {
        if (existing.category === POST_CATEGORY_VALUE.DISPUTE && existing.orderId) {
          alert('Posts created from a trade dispute cannot be edited.');
          navigate('/community', { replace: true });
          return;
        }
        setCategory(existing.category);
        setTitle(existing.title);
        setContent(existing.content);
        setImages(existing.images || []);
        setAttachedProduct(existing.attachedProduct || null);
      } else {
        alert('Post not found.');
        navigate('/community', { replace: true });
      }
    }
  }, [postId, navigate]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (images.length + files.length > 5) {
      alert('You can upload up to 5 images.');
      return;
    }
    setUploadingImages(true);
    try {
      const urls = await uploadImagesToR2(files, { folder: 'posts' });
      setImages((prev) => [...prev, ...urls]);
    } catch {
      alert('Could not upload image.');
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Enter a title and body.');
      return;
    }

    try {
      if (hasSensitiveContent(content)) {
        const proceed = confirm('Your text includes external links or contact info. Continue?');
        if (!proceed) return;
      }
    } catch { /* ignore */ }

    setIsSubmitting(true);
    try {
      const existingForEdit = isEdit ? getPostById(postId!) : null;
      const region = isEdit && existingForEdit?.region ? existingForEdit.region : (getRegion() || '');
      // Save coordinates; keep existing on edit
      const coords = await getCurrentCoordinates();
      const imagesToSave = images.length > 0
        ? await uploadImageReferencesToR2(images, { folder: 'posts' })
        : [];

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
        } else {
          updateUserPost(post);
        }
        alert('Post updated.');
      } else {
        addUserPost(post);
        alert('Post published.');
      }
      navigate('/community', { replace: true });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        alert(COMMUNITY_QUOTA_EXCEEDED_MESSAGE);
      } else {
        alert('Could not save the post. Try again.');
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
        title={isEdit ? 'Edit post' : 'New post'}
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        {/* Category Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category <span className="text-red-500">*</span>
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
                {labelPostCategory(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3]"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Body <span className="text-red-500">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post"
            rows={8}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A8A3] resize-none"
          />
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Images (optional)</label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-200">
                <img src={getDisplayImageUrl(img)} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages(images.filter((_, i) => i !== idx))}
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
          <p className="text-xs text-gray-500">Up to 5 images.</p>
        </div>

        {category === POST_CATEGORY_VALUE.LOOKING_FOR && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attach listing <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">You may attach a reference listing, or skip.</p>
            {attachedProduct ? (
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600">Attached listing</span>
                  <button
                    onClick={() => setAttachedProduct(null)}
                    className="text-sm text-red-500"
                  >
                    Remove
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
                  + Attach listing
                </button>
                <button
                  type="button"
                  onClick={() => setAttachedProduct(null)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-500 text-sm bg-gray-50 hover:bg-gray-100"
                >
                  Skip attach
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
            <p className="text-sm font-medium text-gray-700">{isEdit ? 'Saving...' : 'Publishing...'}</p>
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
          {uploadingImages ? 'Uploading...' : isSubmitting ? (isEdit ? 'Saving...' : 'Publishing...') : isEdit ? 'Save changes' : 'Publish'}
        </button>
      </div>

      {/* Product Select Modal */}
      {showProductSelect && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Choose your listing</h3>
              <button
                onClick={() => setShowProductSelect(false)}
                className="p-2 text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              {myProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <p>No listings yet.</p>
                  <button
                    onClick={() => {
                      setShowProductSelect(false);
                      navigate('/register');
                    }}
                    className="mt-3 px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: '#00A8A3' }}
                  >
                    Create listing
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
          </div>
        </div>
      )}
    </div>
  );
};
