'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { adminApi } from '../../lib/api';
import { adminAuth } from '../../lib/auth';
import KycStatusBadge from '../../components/KycStatusBadge';
import RiskBadge from '../../components/RiskBadge';

export default function AdminListPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const limit = 20;

  useEffect(() => {
    // Check auth using adminAuth
    if (!adminAuth.isLoggedIn()) { router.push('/login'); return; }
    const user = adminAuth.getUser();
    if (!user || user.role !== 'admin') { router.push('/login'); return; }
    fetchDocuments();
  }, [page, statusFilter, riskFilter]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (riskFilter) params.risk = riskFilter;
      const res = await adminApi.get('/admin/kyc', { params });
      setDocuments(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to fetch KYC documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const handleLogout = () => {
    adminAuth.clear(); // ONLY clears admin session, user stays logged in
    router.push('/login');
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const statuses = ['', 'pending', 'processing', 'extracted', 'approved', 'rejected', 'reupload_requested', 'extraction_failed'];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
       <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="font-semibold text-white">Admin</span>
              </div>
              <Link href="/admin" className="text-sm text-white font-semibold border-b-2 border-primary-400 pb-0.5">Fraud Database</Link>
              <Link href="/admin/submissions" className="text-sm text-gray-400 hover:text-white transition-colors">New Submissions</Link>
            </div>
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white transition-colors" id="admin-logout-btn">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-white">KYC Submissions</h1>
            <p className="text-gray-400 mt-1">{total} total submissions</p>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field w-48"
            id="status-filter"
          >
            {statuses.map((s) => (
              <option key={s} value={s} className="bg-gray-900">
                {s ? s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : 'All Statuses'}
              </option>
            ))}
          </select>

          {/* Risk Filter */}
          <div className='flex gap-2'>
            {['', 'HIGH', 'MEDIUM', 'LOW'].map(r => (
              <button key={r}
                onClick={() => { setRiskFilter(r); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${riskFilter === r ? 'bg-white/10 text-white border-white/20' :
                    'text-gray-400 border-white/10 hover:bg-white/5'}`}>
                {r || 'All Risk'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full" id="kyc-table">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">User Email</th>
                  <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Document</th>
                  <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Upload Date</th>
                  <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Similarity</th>
                  <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Risk</th>
                  <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Duplicate</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <svg className="animate-spin h-8 w-8 text-primary-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-gray-400">No submissions found</td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => router.push(`/admin/${doc.id}`)}
                      className={`border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5
                        ${doc.is_duplicate ? 'bg-red-500/5' : ''}`}
                    >
                      <td className="p-4 text-sm text-white">{doc.user_email}</td>
                      <td className="p-4 text-sm text-gray-300">{doc.original_name || '—'}</td>
                      <td className="p-4 text-sm text-gray-400">{formatDate(doc.uploaded_at)}</td>
                      <td className="p-4"><KycStatusBadge status={doc.status} /></td>
                      <td className="p-4 text-sm">
                        {doc.similarity_score != null ? (
                          <span className={doc.similarity_score >= 0.85 ? 'text-red-400 font-medium' : 'text-gray-400'}>
                            {(doc.similarity_score * 100).toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-4">
                        <RiskBadge category={doc.similarity_category} />
                      </td>
                      <td className="p-4">
                        {doc.is_duplicate ? (
                          <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-full font-medium">Yes</span>
                        ) : (
                          <span className="text-xs text-gray-500">No</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <p className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-white disabled:opacity-30 hover:bg-white/5 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-white disabled:opacity-30 hover:bg-white/5 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
