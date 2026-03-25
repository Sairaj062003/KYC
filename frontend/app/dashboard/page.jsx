'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { userApi } from '../../lib/api';
import { userAuth } from '../../lib/auth';
import KycStatusBadge from '../../components/KycStatusBadge';

export default function DashboardPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check auth using userAuth
    if (!userAuth.isLoggedIn()) {
      router.push('/login');
      return;
    }
    setUser(userAuth.getUser());
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await userApi.get('/kyc/my');
      setDocuments(res.data.data);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    userAuth.clear(); // ONLY clears user session, admin stays logged in
    router.push('/login');
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="font-semibold text-white">KYC Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">{user?.name}</span>
              <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white transition-colors" id="logout-btn">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-white">My KYC Documents</h1>
            <p className="text-gray-400 mt-1">Track the status of your identity verification submissions</p>
          </div>
          <Link href="/dashboard/upload" className="btn-primary flex items-center gap-2" id="upload-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Document
          </Link>
        </div>

        {/* Documents List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : documents.length === 0 ? (
          <div className="glass-card p-12 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg">No documents yet</h3>
            <p className="text-gray-400 mt-2 mb-6">Upload your first KYC document to get started</p>
            <Link href="/dashboard/upload" className="btn-primary inline-flex items-center gap-2">
              Upload Your First Document
            </Link>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {documents.map((doc, index) => (
              <div
                key={doc.id}
                className="glass-card-hover p-5"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">{doc.original_name || 'KYC Document'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-gray-400 text-xs">{formatDate(doc.uploaded_at)}</span>
                        {doc.document_type && (
                          <span className="text-xs text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full capitalize">
                            {doc.document_type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {doc.is_duplicate && (
                      <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-full font-medium">
                        ⚠ Duplicate
                      </span>
                    )}
                    <KycStatusBadge status={doc.status} />
                  </div>
                </div>
                {doc.extracted_name && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <span className="text-gray-400">Name: <span className="text-white">{doc.extracted_name}</span></span>
                    {doc.pan_number && <span className="text-gray-400">PAN: <span className="text-white">{doc.pan_number}</span></span>}
                    {doc.aadhaar_number && <span className="text-gray-400">Aadhaar: <span className="text-white">{`XXXX XXXX ${doc.aadhaar_number.slice(-4)}`}</span></span>}
                  </div>
                )}
                {doc.admin_reason && (doc.status === 'rejected' || doc.status === 'reupload_requested') && (
                  <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Feedback from Admin</p>
                    <p className="text-sm text-gray-300 italic">"{doc.admin_reason}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
