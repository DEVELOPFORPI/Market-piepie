import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/utils/api';
import { TopBar } from '@/components/common/TopBar';
import { getCurrentUserId } from '@/utils/authStorage';
import { uploadImagesToR2 } from '@/utils/imageUpload';

const CATEGORIES = ['General', 'Bug Report', 'Account', 'Trade', 'Suggestion', 'Other'];
const TEAL = '#00A8A3';
const MAX_IMAGES = 5;

export const InquiryWrite: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('General');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [email, setEmail] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const uid = getCurrentUserId();

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return;
    const picks = Array.from(files).slice(0, room);
    setUploadingImages(true);
    try {
      const urls = await uploadImagesToR2(picks, { folder: 'inquiries' });
      setImages((prev) => [...prev, ...urls]);
    } catch {
      alert('Could not upload image.');
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || sending) return;
    setSending(true);
    const res = await api.post('/api/inquiries', {
      user_id: uid,
      email: email.trim() || null,
      category: category.toLowerCase().replace(/ /g, '_'),
      title: title.trim(),
      content: content.trim(),
      images,
    });
    setSending(false);
    if (!res.ok) {
      alert(res.error || 'Failed to submit. Please try again.');
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <TopBar
          leftContent={
            <button onClick={() => navigate(-1)} className="p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }
          title="Inquiry"
        />
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Submitted!</h2>
          <p className="text-sm text-gray-500 text-center mb-8">Your inquiry has been sent. We'll get back to you shortly.</p>
          <div className="flex gap-2">
            <button onClick={() => navigate('/my/inquiries')}
              className="px-6 py-2.5 text-sm text-white font-medium rounded-lg" style={{ backgroundColor: TEAL }}>
              View My Inquiries
            </button>
            <button onClick={() => navigate(-1)}
              className="px-6 py-2.5 text-sm text-gray-700 font-medium rounded-lg border border-gray-300">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-8 safe-area-bottom">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title="Inquiry"
      />

      <div className="px-4 py-4 space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === c ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={category === c ? { backgroundColor: TEAL } : undefined}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief summary of your inquiry"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3]/30 focus:border-[#00A8A3]" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Content</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your issue or question in detail"
            rows={6}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#00A8A3]/30 focus:border-[#00A8A3]" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Images <span className="text-gray-400 font-normal">({images.length}/{MAX_IMAGES})</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                  aria-label="Remove image">
                  ×
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[#00A8A3] hover:text-[#00A8A3]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-[10px] mt-1">Add</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={(e) => handleFiles(e.target.files)} className="hidden" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Email <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="For reply notification"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8A3]/30 focus:border-[#00A8A3]" />
        </div>

        <button onClick={handleSubmit} disabled={sending || uploadingImages || !title.trim() || !content.trim()}
          className="w-full py-3 text-sm text-white font-medium rounded-lg disabled:opacity-50 transition-colors" style={{ backgroundColor: TEAL }}>
          {uploadingImages ? 'Uploading...' : sending ? 'Submitting...' : 'Submit Inquiry'}
        </button>
      </div>
    </div>
  );
};
