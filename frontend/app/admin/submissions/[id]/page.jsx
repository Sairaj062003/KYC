'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminAuth } from '../../../../lib/auth';
import { adminApi } from '../../../../lib/api';
import RiskBadge from '../../../../components/RiskBadge';

export default function SubmissionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null); // 'approved' | 'rejected' | 'reapply'
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [fraudActionLoading, setFraudActionLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (!adminAuth.isLoggedIn()) { router.push('/login'); return; }
    fetchDetail();
  }, [id]);

  useEffect(() => {
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [imageUrl]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get(`/admin/submissions/${id}`);
      const data = res.data.data;
      setDoc(data);
      if (data.file_path) loadSecureImage(data.file_path);
    } catch (err) {
      console.error('Failed to fetch submission detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSecureImage = async (filePath) => {
    const filename = filePath.split('/').pop().split('\\').pop();
    setImageLoading(true);
    try {
      const response = await adminApi.get(`/files/${filename}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      setImageUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Failed to load image:', err);
    } finally {
      setImageLoading(false);
    }
  };

  const handleFraudDbAction = async (action) => {
    setFraudActionLoading(true);
    try {
      const endpoint = action === 'add'
        ? `/admin/submissions/${id}/add-to-fraud-db`
        : `/admin/submissions/${id}/decline-fraud-db`;
      await adminApi.post(endpoint);
      await fetchDetail();
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed');
    } finally {
      setFraudActionLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      await adminApi.post(`/admin/submissions/${id}/action`, {
        action: actionModal,
        reason: reason || null,
      });
      setActionModal(null);
      setReason('');
      await fetchDetail();
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading submission...</div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Submission not found.</div>
      </div>
    );
  }

  const parsedMatchedFields = (() => {
    try { return JSON.parse(doc.matched_fields || '[]'); } catch { return []; }
  })();

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link href="/admin/submissions" className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="font-semibold text-white">Submission Review</span>
            <div className="ml-2">
              <RiskBadge category={doc.risk_category} />
            </div>
            <div className="ml-auto flex gap-4">
              <Link href="/admin" className="text-sm text-gray-400 hover:text-white">Fraud Database</Link>
              <Link href="/admin/submissions" className="text-sm text-gray-400 hover:text-white">New Submissions</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* HIGH RISK ALERT BANNER */}
        {doc.risk_category === 'HIGH' && !doc.fraud_db_added && (
          <div className="p-5 rounded-xl bg-orange-500/10 border border-orange-500/30 animate-fade-in">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-orange-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-orange-300 font-semibold text-base mb-1">
                  High Risk Alert — {doc.similarity_score > 0 ? `${(doc.similarity_score * 100).toFixed(1)}%` : 'Field'} Match with Fraud Data
                </h3>
                <p className="text-orange-200/70 text-sm mb-2">
                  This document matches a record in the fraud database. Should it be permanently added to the fraud database?
                </p>
                {(doc.fraud_match_name || doc.fraud_match_pan) && (
                  <p className="text-xs text-orange-300/60 mb-3">
                    Matched fraud record: <span className="font-semibold">{doc.fraud_match_name}</span>
                    {doc.fraud_match_pan && <> · PAN: <span className="font-mono">{doc.fraud_match_pan}</span></>}
                    {doc.fraud_match_aadhaar && <> · Aadhaar: <span className="font-mono">{doc.fraud_match_aadhaar}</span></>}
                  </p>
                )}
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => handleFraudDbAction('add')}
                    disabled={fraudActionLoading}
                    className="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all disabled:opacity-50"
                    id="add-to-fraud-db-btn"
                  >
                    {fraudActionLoading ? 'Processing...' : 'Yes — Add to Fraud Database'}
                  </button>
                  <button
                    onClick={() => handleFraudDbAction('decline')}
                    disabled={fraudActionLoading}
                    className="px-4 py-2 bg-white/5 text-gray-300 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-all disabled:opacity-50"
                    id="decline-fraud-db-btn"
                  >
                    No — Manual Review Only
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FRAUD AUTO-ADDED BANNER */}
        {doc.risk_category === 'FRAUD' && (
          <div className="p-4 rounded-xl bg-red-600/15 border border-red-600/30 flex items-center gap-3">
            <svg className="w-5 h-5 text-red-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-300 text-sm font-semibold">
              FRAUD DETECTED — All four fields matched a known fraud record. Automatically added to the Fraud Database.
            </p>
          </div>
        )}

        {/* ADDED TO FRAUD DB CONFIRMATION */}
        {doc.fraud_db_added && doc.risk_category === 'HIGH' && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-green-400 text-sm">Admin confirmed — this document has been added to the Fraud Database.</p>
          </div>
        )}

        {/* Document Info Grid */}
        <div className="glass-card p-6">
          <h3 className="text-white font-semibold mb-4">Submission Details</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['User', doc.user_name || '—'],
              ['Email', doc.user_email || '—'],
              ['Phone', doc.phone_number || '—'],
              ['Status', doc.status?.replace(/_/g, ' ') || '—'],
              ['Document Type', doc.document_type?.toUpperCase() || '—'],
              ['Extracted Name', doc.extracted_name || '—'],
              ['PAN Number', doc.pan_number || '—'],
              ['Aadhaar Number', doc.aadhaar_number ? `XXXX XXXX ${doc.aadhaar_number.slice(-4)}` : '—'],
              ['Date of Birth', doc.dob ? new Date(doc.dob).toLocaleDateString('en-IN') : '—'],
              ['Similarity Score', doc.similarity_score ? `${(doc.similarity_score * 100).toFixed(1)}%` : '0.0%'],
              ['Uploaded', doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString('en-IN') : '—'],
            ].map(([label, value]) => (
              <div key={label} className="p-3 rounded-lg bg-white/5">
                <p className="text-gray-400 text-xs mb-1">{label}</p>
                <p className="text-white text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Assessment */}
        {parsedMatchedFields.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-3">Risk Assessment</h3>
            <div className="flex items-center gap-3 mb-3">
              <RiskBadge category={doc.risk_category} />
              <span className="text-gray-400 text-sm">Matched fields: <span className="text-white font-semibold">{parsedMatchedFields.join(', ')}</span></span>
            </div>
            {doc.fraud_match_name && (
              <div className="p-3 rounded-lg bg-white/5 text-sm">
                <p className="text-gray-400 text-xs mb-1">Matching Fraud Record</p>
                <p className="text-white">{doc.fraud_match_name} {doc.fraud_match_pan && <span className="text-gray-400">· {doc.fraud_match_pan}</span>}</p>
              </div>
            )}
          </div>
        )}

        {/* Document Image */}
        {doc.file_path && (() => {
          const filename = doc.file_path.split('/').pop().split('\\').pop();
          const isPdf = filename.split('.').pop().toLowerCase() === 'pdf';
          return (
            <div className="glass-card p-6">
              <h3 className="text-white font-semibold mb-4">Uploaded Document</h3>
              {isPdf ? (
                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm mb-3">PDF: {doc.original_name || filename}</p>
                  <button
                    onClick={async () => {
                      const r = await adminApi.get(`/files/${filename}`, { responseType: 'blob' });
                      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
                      window.open(url, '_blank');
                      setTimeout(() => URL.revokeObjectURL(url), 10000);
                    }}
                    className="btn-primary text-sm"
                  >Open PDF</button>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden bg-white/5 p-2 min-h-[200px] flex items-center justify-center">
                  {imageLoading ? (
                    <div className="text-gray-400 flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Loading securely...
                    </div>
                  ) : imageUrl ? (
                    <img src={imageUrl} alt={doc.original_name || 'Document'} className="w-full max-h-[600px] object-contain rounded-lg" />
                  ) : (
                    <p className="text-gray-500 text-sm">Unable to load preview.</p>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Standard Action Buttons */}
        {!doc.fraud_db_added && doc.status !== 'added_to_fraud_db' && (
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4">Admin Actions</h3>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => setActionModal('approved')} className="px-5 py-2.5 rounded-xl bg-green-500/15 text-green-400 border border-green-500/20 font-semibold text-sm hover:bg-green-500/25 transition-all" id="action-approve-btn">Approve</button>
              <button onClick={() => setActionModal('rejected')} className="px-5 py-2.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/20 font-semibold text-sm hover:bg-red-500/25 transition-all" id="action-reject-btn">Reject</button>
              <button onClick={() => setActionModal('reapply')} className="px-5 py-2.5 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-semibold text-sm hover:bg-yellow-500/20 transition-all" id="action-reapply-btn">Request Re-apply</button>
            </div>
          </div>
        )}

        {/* Review History */}
        {doc.reviews?.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4">Review History</h3>
            <div className="space-y-3">
              {doc.reviews.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-white/5 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400">By <span className="text-white">{r.admin_name}</span> · <span className="capitalize text-primary-400">{r.action?.replace(/_/g, ' ')}</span></span>
                    <span className="text-gray-500 text-xs">{new Date(r.created_at).toLocaleString('en-IN')}</span>
                  </div>
                  {r.reason && <p className="text-gray-300 italic">"{r.reason}"</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 w-full max-w-md">
            <h3 className="text-white font-semibold mb-2 capitalize">{actionModal.replace(/_/g, ' ')} Submission</h3>
            <p className="text-gray-400 text-sm mb-4">Optionally provide a reason for this action.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={handleAction} disabled={actionLoading} className="btn-primary flex-1 disabled:opacity-50" id="confirm-action-btn">
                {actionLoading ? 'Saving...' : 'Confirm'}
              </button>
              <button onClick={() => { setActionModal(null); setReason(''); }} className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
