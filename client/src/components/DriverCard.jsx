export default function DriverCard({ driver, isSelected, onSelect }) {
  const score = driver?.reputation_score;
  const rounded = typeof score === 'number' ? Math.round(score) : Math.round(Number(score));
  const hasScore = Number.isFinite(rounded);

  return (
    <button
      type="button"
      className={`driver-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(driver.id)}
    >
      <div className="driver-card-name">{driver.name}</div>
      {hasScore ? (
        <div className="driver-card-rating">
          <span>{Array.from({ length: 5 }, (_, i) => (i < rounded ? '★' : '☆')).join('')}</span>
          <span className="driver-card-rating-text">{Number(score).toFixed(1)} / 5.0</span>
        </div>
      ) : (
        <span className="driver-new-badge">New Driver</span>
      )}
      <div className="driver-card-meta">
        {driver.successful_deliveries || 0} deliveries · {driver.disputes_against || 0} disputes
      </div>
    </button>
  );
}
