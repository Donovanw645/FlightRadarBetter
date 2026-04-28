import { useState } from 'react';
import { X, Plus, Radio, Trash2, ToggleLeft, ToggleRight, MapPin } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';
import type { SpottingAlert } from '../types';

interface Props { onClose: () => void }

export default function SpottingPanel({ onClose }: Props) {
  const { spottingAlerts, addSpottingAlert, removeSpottingAlert, toggleSpottingAlert, userLocation } = useFlightStore();
  const [callsign, setCallsign] = useState('');
  const [radius, setRadius] = useState(50);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [useMyLocation, setUseMyLocation] = useState(true);

  const handleAdd = () => {
    const alertLat = useMyLocation && userLocation ? userLocation[0] : parseFloat(lat);
    const alertLng = useMyLocation && userLocation ? userLocation[1] : parseFloat(lng);
    if (isNaN(alertLat) || isNaN(alertLng)) return;

    const alert: SpottingAlert = {
      id: `${Date.now()}`,
      callsign: callsign.trim() || '*',
      icao24: '',
      radius,
      lat: alertLat,
      lng: alertLng,
      active: true,
    };
    addSpottingAlert(alert);
    setCallsign('');
  };

  return (
    <div className="absolute top-14 right-3 z-[1001] w-80 bg-gray-900 border border-orange-700/50 rounded-2xl shadow-2xl text-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Radio size={15} className="text-orange-400" />
          <span className="font-semibold text-sm">Planespotting Alerts</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
      </div>

      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        <p className="text-xs text-gray-400">
          Get notified when aircraft enter a radius around a location. Use <code className="text-orange-300">*</code> to match any aircraft.
        </p>

        {/* New alert form */}
        <div className="space-y-2.5 p-3 bg-gray-800 rounded-xl border border-gray-700">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Callsign filter (* = any)</label>
            <input
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="e.g. UAL, * , RCH"
              className="w-full px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Radius: {radius} km</label>
            <input
              type="range" min={5} max={500} step={5}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setUseMyLocation((v) => !v)}
              className={`w-9 h-5 rounded-full transition relative cursor-pointer shrink-0 ${useMyLocation ? 'bg-orange-500' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${useMyLocation ? 'left-4' : 'left-0.5'}`} />
            </div>
            <span className="text-xs text-gray-300">Use my location</span>
            {userLocation && useMyLocation && (
              <MapPin size={11} className="text-orange-400" />
            )}
          </label>

          {!useMyLocation && (
            <div className="flex gap-2">
              <input
                value={lat} onChange={(e) => setLat(e.target.value)}
                placeholder="Latitude" className="flex-1 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none"
              />
              <input
                value={lng} onChange={(e) => setLng(e.target.value)}
                placeholder="Longitude" className="flex-1 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-medium transition"
          >
            <Plus size={14} />
            Add Alert
          </button>
        </div>

        {/* Existing alerts */}
        {spottingAlerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Alerts</p>
            {spottingAlerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} onRemove={removeSpottingAlert} onToggle={toggleSpottingAlert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertRow({
  alert, onRemove, onToggle
}: { alert: SpottingAlert; onRemove: (id: string) => void; onToggle: (id: string) => void }) {
  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition ${alert.active ? 'border-orange-700/50 bg-orange-900/20' : 'border-gray-700 bg-gray-800/50'}`}>
      <button onClick={() => onToggle(alert.id)} className="text-gray-400 hover:text-white shrink-0">
        {alert.active ? <ToggleRight size={18} className="text-orange-400" /> : <ToggleLeft size={18} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-medium truncate">{alert.callsign === '*' ? 'Any aircraft' : alert.callsign}</p>
        <p className="text-[10px] text-gray-500">{alert.radius} km · {alert.lat.toFixed(2)}, {alert.lng.toFixed(2)}</p>
      </div>
      <button onClick={() => onRemove(alert.id)} className="text-gray-500 hover:text-red-400 shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}
