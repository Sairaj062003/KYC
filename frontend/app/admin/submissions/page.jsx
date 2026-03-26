'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminAuth } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import RiskBadge from '../../../components/RiskBadge';

export default function SubmissionsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!adminAuth.isLoggedIn()) { router.push('/login'); return; }
    fetchDocs();
  }, [riskFilter]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (riskFilter) params.risk = riskFilter;
      const res = await adminApi.get('/admin/submissions', { params });
      setDocs(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const riskFilters = [
    { value: '', label: 'All' },
    { value: 'FRAUD', label: 'Fraud' },
    { value: 'HIGH', label: 'High Risk' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
    { value: 'NO_RISK', label: 'No Risk' },
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <span className="font-bold text-white">KYC Admin</span>
              <Link href="/admin" className="text-sm text-gray-400 hover:text-white transition-colors">
                Fraud Database
              </Link>
              <Link href="/admin/submissions" className="text-sm text-white font-semibold border-b-2 border-primary-400 pb-0.5">
                New Submissions
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">New Submissions</h1>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-gray-400 text-sm">{total} total submissions</p>
              <button
                onClick={fetchDocs}
                className="text-primary-400 hover:text-primary-300 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m0 0H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
          {/* Risk Filter Buttons */}
          <div className="flex gap-2 flex-wrap sm:justify-end">
            {riskFilters.map(f => (
              <button
                key={f.value}
                onClick={() => setRiskFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  riskFilter === f.value
                    ? 'bg-white/10 text-white border-white/20'
                    : 'text-gray-400 border-white/10 hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading submissions...</div>
        ) : docs.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-gray-400">No submissions found{riskFilter ? ` for risk: ${riskFilter}` : ''}.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-4 text-left text-xs text-gray-400 uppercase tracking-wider">User</th>
                    <th className="p-4 text-left text-xs text-gray-400 uppercase tracking-wider">Document</th>
                    <th className="p-4 text-left text-xs text-gray-400 uppercase tracking-wider">Extracted Name</th>
                    <th className="p-4 text-left text-xs text-gray-400 uppercase tracking-wider">Risk</th>
                    <th className="p-4 text-left text-xs text-gray-400 uppercase tracking-wider">Matched Fields</th>
                    <th className="p-4 text-left text-xs text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="p-4 text-left text-xs text-gray-400 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map(doc => (
                    <tr
                      key={doc.id}
                      onClick={() => router.push(`/admin/submissions/${doc.id}`)}
                      className={`border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                        doc.risk_category === 'FRAUD' ? 'bg-red-500/10' :
                        doc.risk_category === 'HIGH'  ? 'bg-orange-500/5' : ''
                      }`}
                    >
                      <td className="p-4">
                        <p className="text-sm text-white">{doc.user_email}</p>
                        <p className="text-xs text-gray-400">{doc.phone_number}</p>
                      </td>
                      <td className="p-4 text-sm text-gray-300">{doc.original_name || '—'}</td>
                      <td className="p-4 text-sm text-white">{doc.extracted_name || '—'}</td>
                      <td className="p-4">
                        <RiskBadge category={doc.risk_category} />
                      </td>
                      <td className="p-4 text-xs text-gray-400">
                        {doc.matched_fields
                          ? (() => { try { return JSON.parse(doc.matched_fields).join(', '); } catch { return doc.matched_fields; } })()
                          : '—'}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          doc.status === 'pending_review' ? 'bg-blue-500/10 text-blue-400' :
                          doc.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                          doc.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                          doc.status === 'added_to_fraud_db' ? 'bg-red-600/20 text-red-300' :
                          'bg-white/5 text-gray-400'
                        }`}>
                          {doc.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-400">
                        {new Date(doc.uploaded_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
