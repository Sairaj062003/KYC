/**
 * SimilarityAlert — Prominent warning banner displayed when a KYC document
 * is flagged as a potential duplicate based on vector similarity score.
 */
export default function SimilarityAlert({ score, isDuplicate }) {
  if (!isDuplicate) return null;

  const percentage = (score * 100).toFixed(1);

  return (
    <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur-sm animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div>
          <h4 className="text-red-300 font-semibold text-sm">Potential Duplicate Detected</h4>
          <p className="text-red-400/80 text-sm mt-1">
            This document has a <strong>{percentage}%</strong> similarity match with an existing submission.
            Please review carefully before taking action.
          </p>
        </div>
        {/* Visual similarity gauge */}
        <div className="flex-shrink-0 ml-auto">
          <div className="relative w-14 h-14">
            <svg className="transform -rotate-90 w-14 h-14" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(239,68,68,0.2)" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="24" fill="none"
                stroke="#ef4444" strokeWidth="4"
                strokeDasharray={`${score * 150.8} 150.8`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-red-300">
              {percentage}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
