import { Bell, X } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';

export default function AlertToast() {
  const { triggeredAlerts, dismissTriggeredAlert } = useFlightStore();
  if (triggeredAlerts.length === 0) return null;

  return (
    <div className="absolute bottom-20 right-3 z-[1002] flex flex-col gap-2 max-w-xs">
      {triggeredAlerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-2.5 p-3 bg-orange-900/95 border border-orange-600 rounded-xl shadow-2xl backdrop-blur animate-bounce-in"
        >
          <div className="p-1 bg-orange-600 rounded-full shrink-0">
            <Bell size={12} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-200">Aircraft In Range!</p>
            <p className="text-xs text-orange-100 font-mono">{alert.callsign}</p>
            <p className="text-[10px] text-orange-400">{alert.radius} km radius alert triggered</p>
          </div>
          <button onClick={() => dismissTriggeredAlert(alert.id)} className="text-orange-400 hover:text-white shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
