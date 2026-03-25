'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api, { adminApi } from '../../../lib/api';
import { adminAuth } from '../../../lib/auth';
import KycStatusBadge from '../../../components/KycStatusBadge';
import SimilarityAlert from '../../../components/SimilarityAlert';
import RiskBadge from '../../../components/RiskBadge';

export default function AdminKycDetailPage() {
  const router = useRouter();
  const params = useParams();
  const kycId = params.id;

  const [kycData, setKycData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null); // 'approved' | 'rejected' | 'reupload_requested'
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showOcrText, setShowOcrText] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    // Check auth using adminAuth
    if (!adminAuth.isLoggedIn()) { router.push('/login'); return; }
    const user = adminAuth.getUser();
    if (!user || user.role !== 'admin') { router.push('/login'); return; }
    fetchKycDetail();
  }, [kycId]);

  const fetchKycDetail = async () => {
    try {
      const res = await adminApi.get(`/admin/kyc/${kycId}`);
      const data = res.data.data;
      setKycData(data);
      if (data.file_path) {
        loadSecureImage(data.file_path);
      }
    } catch (err) {
      console.error('Failed to fetch KYC detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSecureImage = async (filePath) => {
    const filename = filePath.split('/').pop().split('\\').pop();
    const imageUrl = `/files/${filename}`;
    setImageLoading(true);
    try {
      const response = await adminApi.get(imageUrl, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
    } catch (err) {
      console.error('Failed to load secure image:', err);
    } finally {
      setImageLoading(false);
    }
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      await adminApi.post(`/admin/kyc/${kycId}/action`, {
        action: actionModal,
        reason: reason || undefined,
      });
      setActionModal(null);
      setReason('');
      fetchKycDetail(); // Refresh data
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!kycData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-white text-xl mb-2">KYC Document Not Found</h2>
          <Link href="/admin" className="text-primary-400 hover:text-primary-300">Back to Admin</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="font-semibold text-white">KYC Review</span>
            <KycStatusBadge status={kycData.status} />
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
        {/* Duplicate Alert */}
        <SimilarityAlert score={kycData.similarity_score} isDuplicate={kycData.is_duplicate} />

        {/* Submitter Info */}
        <div className="glass-card p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Submitter Information
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-gray-400 text-xs mb-1">Name</p>
              <p className="text-white font-medium">{kycData.user_name}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Email</p>
              <p className="text-white font-medium">{kycData.user_email}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Phone</p>
              <p className="text-white font-medium">{kycData.user_phone}</p>
            </div>
          </div>
        </div>

        {/* Document Image Preview */}
        {kycData.file_path && (() => {
          const filename = kycData.file_path.split('/').pop().split('\\').pop();
          const ext = filename.split('.').pop().toLowerCase();
          const isPdf = ext === 'pdf';
          
          return (
            <div className="glass-card p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Uploaded Document
              </h3>
              {isPdf ? (
                <div className="p-4 rounded-xl bg-white/5 text-center">
                  <p className="text-gray-400 text-sm mb-3">PDF Document: {kycData.original_name || filename}</p>
                  <button
                    onClick={async () => {
                      const filename = kycData.file_path.split('/').pop().split('\\').pop();
                      const response = await adminApi.get(`/files/${filename}`, { responseType: 'blob' });
                      const blob = new Blob([response.data], { type: 'application/pdf' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                      setTimeout(() => URL.revokeObjectURL(url), 10000);
                    }}
                    className="btn-primary inline-flex items-center gap-2 text-sm"
                  >
                    Open PDF
                  </button>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden bg-white/5 p-2 min-h-[200px] flex items-center justify-center">
                  {imageLoading ? (
                    <div className="text-gray-400 flex items-center gap-2">
                       <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                       </svg>
                       Loading image securely...
                    </div>
                  ) : imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={kycData.original_name || 'KYC Document'}
                      className="w-full max-h-[600px] object-contain rounded-lg"
                    />
                  ) : (
                    <p className="text-gray-500 text-sm py-4">
                      Unable to load image preview. Check your connection or permissions.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Extracted Data */}
        <div className="glass-card p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Extracted Fields
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-gray-400 text-xs mb-1">Full Name</p>
              <p className="text-white font-medium">{kycData.extracted_name || '—'}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-gray-400 text-xs mb-1">PAN Number</p>
              <p className="text-white font-medium font-mono">{kycData.pan_number || '—'}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-gray-400 text-xs mb-1">Date of Birth</p>
              <p className="text-white font-medium">{kycData.dob || '—'}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-gray-400 text-xs mb-1">Aadhaar Number</p>
              <p className="text-white font-medium font-mono">{kycData.aadhaar_number ? `XXXX XXXX ${kycData.aadhaar_number.slice(-4)}` : '—'}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-gray-400 text-xs mb-1">Document Type</p>
              <p className="text-white font-medium capitalize">{kycData.document_type || '—'}</p>
            </div>
          </div>

          {/* Similarity Score */}
          <div className="mt-4 p-4 rounded-xl bg-white/5">
            <p className="text-gray-400 text-xs mb-1">Similarity Score</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${kycData.similarity_score >= 0.85 ? 'bg-red-500' :
                    kycData.similarity_score >= 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                  style={{ width: `${(kycData.similarity_score || 0) * 100}%` }}
                />
              </div>
              <span className={`text-sm font-semibold ${kycData.similarity_score >= 0.85 ? 'text-red-400' :
                kycData.similarity_score >= 0.5 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                {kycData.similarity_score != null ? `${(kycData.similarity_score * 100).toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>

          {/* Risk Category */}
          <div className='mt-3 p-4 rounded-xl bg-white/5 flex items-center justify-between'>
            <div>
              <p className='text-gray-400 text-xs mb-1'>Risk Category</p>
              <RiskBadge category={kycData.similarity_category} />
            </div>
            <div className='text-right'>
              <p className='text-gray-400 text-xs mb-1'>Decision Guidance</p>
              <p className='text-xs text-gray-300'>
                {kycData.similarity_category === 'HIGH' && 'Reject or escalate — likely duplicate'}
                {kycData.similarity_category === 'MEDIUM' && 'Review carefully — possible match'}
                {kycData.similarity_category === 'LOW' && 'Safe to approve if documents are valid'}
              </p>
            </div>
          </div>
        </div>

        {/* OCR Raw Text (Collapsible) */}
        {kycData.ocr_raw_text && (
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => setShowOcrText(!showOcrText)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
              id="toggle-ocr-text"
            >
              <span className="text-white font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                OCR Raw Text
              </span>
              <svg className={`w-5 h-5 text-gray-400 transition-transform ${showOcrText ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showOcrText && (
              <div className="p-4 pt-0">
                <pre className="p-4 rounded-xl bg-black/30 text-gray-300 text-sm whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">
                  {kycData.ocr_raw_text}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="glass-card p-6">
          <h3 className="text-white font-semibold mb-4">Take Action</h3>
          <div className="flex gap-3">
            <button onClick={() => setActionModal('approved')} className="btn-success flex-1" id="approve-btn">
              ✓ Approve
            </button>
            <button onClick={() => setActionModal('rejected')} className="btn-danger flex-1" id="reject-btn">
              ✕ Reject
            </button>
            <button onClick={() => setActionModal('reupload_requested')} className="btn-warning flex-1" id="reupload-btn">
              ↻ Request Re-upload
            </button>
          </div>
        </div>

        {/* Review History */}
        {kycData.reviews && kycData.reviews.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Review History
            </h3>
            <div className="space-y-3">
              {kycData.reviews.map((review) => (
                <div key={review.id} className="p-4 rounded-xl bg-white/5 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <KycStatusBadge status={review.action} />
                      <span className="text-gray-400 text-xs">by {review.admin_name || review.admin_email}</span>
                    </div>
                    {review.reason && (
                      <p className="text-gray-300 text-sm mt-2">{review.reason}</p>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs flex-shrink-0">{formatDate(review.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="glass-card p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-1">Document ID</p>
              <p className="text-white font-mono text-xs">{kycData.id}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Original Filename</p>
              <p className="text-white">{kycData.original_name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Uploaded At</p>
              <p className="text-white">{formatDate(kycData.uploaded_at)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Last Updated</p>
              <p className="text-white">{formatDate(kycData.updated_at)}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-md w-full animate-slide-up" id="action-modal">
            <h3 className="text-white font-semibold text-lg mb-2">
              {actionModal === 'approved' && '✓ Approve KYC Document'}
              {actionModal === 'rejected' && '✕ Reject KYC Document'}
              {actionModal === 'reupload_requested' && '↻ Request Document Re-upload'}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {actionModal === 'approved' && 'This will mark the KYC submission as verified and approved.'}
              {actionModal === 'rejected' && 'This will reject the KYC submission. Please provide a reason.'}
              {actionModal === 'reupload_requested' && 'The user will be asked to submit a new document.'}
            </p>

            <div className="mb-4">
              <label className="input-label">Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for this action..."
                className="input-field min-h-[100px] resize-y"
                id="action-reason"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={`flex-1 ${actionModal === 'approved' ? 'btn-success' :
                  actionModal === 'rejected' ? 'btn-danger' : 'btn-warning'
                  } flex items-center justify-center`}
                id="confirm-action-btn"
              >
                {actionLoading ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : 'Confirm'}
              </button>
              <button
                onClick={() => { setActionModal(null); setReason(''); }}
                className="flex-1 px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-all"
                id="cancel-action-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
