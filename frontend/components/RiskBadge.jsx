export default function RiskBadge({ category }) {
    const map = {
        FRAUD:   { bg: 'bg-red-600/20',    text: 'text-red-300',    border: 'border-red-600/30',    label: 'FRAUD' },
        HIGH:    { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', label: 'High Risk' },
        MEDIUM:  { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', label: 'Medium Risk' },
        LOW:     { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20',   label: 'Low Risk' },
        NO_RISK: { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20',  label: 'No Risk' },
    };
    const s = map[category?.toUpperCase()] || map.NO_RISK;
    return (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
            {s.label}
        </span>
    );
}
