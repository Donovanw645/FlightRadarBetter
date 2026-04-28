import type { AircraftCategory } from '../types';
import { getCategoryColor, getCategoryLabel } from '../utils/aircraftUtils';

const SHOWN: AircraftCategory[] = ['commercial', 'military', 'private', 'helicopter', 'drone', 'ground'];

export default function Legend() {
  return (
    <div className="absolute bottom-3 left-3 z-[999] bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-3 py-2.5 hidden sm:block">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Legend</p>
      <div className="flex flex-col gap-1.5">
        {SHOWN.map((cat) => (
          <div key={cat} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(cat) }} />
            <span className="text-[11px] text-gray-300">{getCategoryLabel(cat)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
