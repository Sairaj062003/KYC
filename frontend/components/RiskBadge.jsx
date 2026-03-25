export default function RiskBadge({ category }) {
    const map = {
        HIGH: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: 'High Risk' },
        MEDIUM: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', label: 'Medium Risk' },
        LOW: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', label: 'Low Risk' },
    };
    const s = map[category?.toUpperCase()] || map.LOW;
    return (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
            {s.label}
        </span>
    );
}
