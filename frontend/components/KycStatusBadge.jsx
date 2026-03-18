/**
 * KycStatusBadge — Color-coded status indicator for KYC documents.
 * Maps each status to a distinct color for quick visual identification.
 */
const statusConfig = {
  pending:             { label: 'Pending',            bg: 'bg-gray-500/20',    text: 'text-gray-300',   dot: 'bg-gray-400' },
  processing:          { label: 'Processing',         bg: 'bg-blue-500/20',    text: 'text-blue-300',   dot: 'bg-blue-400' },
  extracted:           { label: 'Extracted',           bg: 'bg-yellow-500/20',  text: 'text-yellow-300', dot: 'bg-yellow-400' },
  approved:            { label: 'Approved',            bg: 'bg-green-500/20',   text: 'text-green-300',  dot: 'bg-green-400' },
  rejected:            { label: 'Rejected',            bg: 'bg-red-500/20',     text: 'text-red-300',    dot: 'bg-red-400' },
  reupload_requested:  { label: 'Re-upload Requested', bg: 'bg-orange-500/20',  text: 'text-orange-300', dot: 'bg-orange-400' },
  extraction_failed:   { label: 'Extraction Failed',   bg: 'bg-red-500/20',     text: 'text-red-300',    dot: 'bg-red-400' },
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
