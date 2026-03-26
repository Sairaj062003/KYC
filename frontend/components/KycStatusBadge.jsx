/**
 * KycStatusBadge — Color-coded status indicator for KYC documents.
 * Maps each status to a distinct color for quick visual identification.
 */
const statusConfig = {
  pending:             { label: 'Pending',            bg: 'bg-gray-500/10',    text: 'text-gray-400',   dot: 'bg-gray-500' },
  processing:          { label: 'Processing',         bg: 'bg-blue-500/10',    text: 'text-blue-400',   dot: 'bg-blue-500' },
  pending_review:      { label: 'Pending Review',      bg: 'bg-blue-500/10',    text: 'text-blue-400',   dot: 'bg-blue-500' },
  extracted:           { label: 'Extracted',           bg: 'bg-yellow-500/10',  text: 'text-yellow-400', dot: 'bg-yellow-500' },
  approved:            { label: 'Approved',            bg: 'bg-green-500/10',   text: 'text-green-400',  dot: 'bg-green-500' },
  reapply:             { label: 'Re-apply Requested',  bg: 'bg-orange-500/10',  text: 'text-orange-400', dot: 'bg-orange-500' },
  rejected:            { label: 'Rejected',            bg: 'bg-red-500/10',     text: 'text-red-400',    dot: 'bg-red-500' },
  reupload_requested:  { label: 'Re-upload Requested', bg: 'bg-orange-500/10',  text: 'text-orange-400', dot: 'bg-orange-500' },
  extraction_failed:   { label: 'Extraction Failed',   bg: 'bg-red-500/10',     text: 'text-red-400',    dot: 'bg-red-500' },
  added_to_fraud_db:   { label: 'Flagged Fraud',       bg: 'bg-red-600/20',     text: 'text-red-300',    dot: 'bg-red-600' },
};

export default function KycStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse-soft`} />
      {config.label}
    </span>
  );
}
