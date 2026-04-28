import { useFlightStore } from '../store/useFlightStore';
import type { MapStyle } from '../types';

const STYLES: { id: MapStyle; label: string; preview: string }[] = [
  { id: 'dark', label: 'Dark', preview: '🌑' },
  { id: 'light', label: 'Light', preview: '☀️' },
  { id: 'satellite', label: 'Satellite', preview: '🛰️' },
  { id: 'terrain', label: 'Terrain', preview: '🏔️' },
];

export default function MapStyleToggle({ onClose }: { onClose: () => void }) {
  const { mapStyle, setMapStyle } = useFlightStore();

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-2 flex flex-col gap-1 w-36">
      {STYLES.map((s) => (
        <button
          key={s.id}
          onClick={() => { setMapStyle(s.id); onClose(); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
            mapStyle === s.id
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          <span>{s.preview}</span>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}
