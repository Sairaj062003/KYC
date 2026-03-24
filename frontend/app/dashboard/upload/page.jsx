'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../../lib/api';
import FileUploader from '../../../components/FileUploader';
import KycStatusBadge from '../../../components/KycStatusBadge';

export default function UploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [kycData, setKycData] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }
    if (!phoneNumber || !/^[6-9]\d{9}$/.test(phoneNumber)) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('phone_number', phoneNumber);

      const res = await api.post('/kyc/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { kycId } = res.data;
      setUploading(false);
      setProcessing(true);

      // Poll for processing status every 3 seconds
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/kyc/status/${kycId}`);
          const data = statusRes.data.data;
          setKycData(data);

          // Stop polling when status is no longer 'processing'
          if (data.status !== 'processing') {
            clearInterval(pollInterval);
            setProcessing(false);
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
          clearInterval(pollInterval);
          setProcessing(false);
        }
      }, 3000);

    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="font-semibold text-white">Upload KYC Document</span>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-white mb-2">Upload Document</h1>
          <p className="text-gray-400 mb-8">Submit your identity document for AI-powered verification</p>

          {/* Upload Section */}
          {!kycData ? (
            <div className="glass-card p-8 space-y-6">
              <FileUploader
                onFileSelect={setSelectedFile}
                disabled={uploading || processing}
              />

              <div className="space-y-2">
                <label className="text-white text-sm font-medium">Linked Phone Number</label>
                <input
                  type="tel"
                  placeholder="Enter 10-digit phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={uploading || processing}
                  maxLength={10}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  id="phone-number-input"
                />
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!selectedFile || uploading || processing}
                className="btn-primary w-full flex items-center justify-center gap-2"
                id="submit-upload-btn"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Submit for Verification
                  </>
                )}
              </button>

              {/* Processing indicator */}
              {processing && (
                <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-slide-up">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <svg className="animate-spin h-10 w-10 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-blue-300 font-semibold">Processing Document</h4>
                      <p className="text-blue-400/70 text-sm mt-1">
                        Running OCR extraction and AI analysis. This may take a moment...
                      </p>
                    </div>
                  </div>
                  {/* Processing steps */}
                  <div className="mt-4 space-y-2">
                    {['Extracting text (OCR)', 'Analyzing with AI (LLM)', 'Generating embeddings', 'Checking duplicates'].map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-blue-400/60">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-soft" style={{ animationDelay: `${i * 300}ms` }} />
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Result section */
            <div className="glass-card p-8 space-y-6 animate-slide-up">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-lg">Verification Result</h3>
                <KycStatusBadge status={kycData.status} />
              </div>

              {kycData.extracted_name && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-gray-400 text-xs mb-1">Extracted Name</p>
                    <p className="text-white font-medium">{kycData.extracted_name || '—'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-gray-400 text-xs mb-1">PAN Number</p>
                    <p className="text-white font-medium">{kycData.pan_number || '—'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-gray-400 text-xs mb-1">Date of Birth</p>
                    <p className="text-white font-medium">{kycData.dob || '—'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-gray-400 text-xs mb-1">Document Type</p>
                    <p className="text-white font-medium capitalize">{kycData.document_type || '—'}</p>
                  </div>
                </div>
              )}

              {kycData.is_duplicate && (
                <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
                  ⚠ This document has been flagged as a potential duplicate (Similarity: {(kycData.similarity_score * 100).toFixed(1)}%).
                </div>
              )}

              <div className="flex gap-3">
                <Link href="/dashboard" className="btn-primary flex-1 text-center">
                  Back to Dashboard
                </Link>
                <button
                  onClick={() => { setKycData(null); setSelectedFile(null); }}
                  className="px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-all"
                  id="upload-another-btn"
                >
                  Upload Another
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
