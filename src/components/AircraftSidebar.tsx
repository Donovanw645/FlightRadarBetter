import { useEffect, useState } from 'react';
import {
  X, Crosshair, Navigation, Gauge, ArrowUp, Globe,
  Tag, Calendar, Wrench, Info, ExternalLink, Camera,
  ChevronDown, ChevronUp, Navigation2, AlertTriangle, RadioTower, PhoneOff
} from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';
import { fetchAircraftInfo, fetchJetPhoto } from '../hooks/useFlightData';
import {
  formatAltitude, formatSpeed, formatVerticalRate,
  getAircraftCategory, getCategoryColor, getCategoryLabel, isMilitary
} from '../utils/aircraftUtils';

const SQUAWK_CODES: Record<string, { label: string; icon: React.ReactNode }> = {
  '7500': { label: 'Hijacking', icon: <AlertTriangle size={13} /> },
  '7600': { label: 'Radio Failure', icon: <PhoneOff size={13} /> },
  '7700': { label: 'Emergency', icon: <RadioTower size={13} /> },
};

export default function AircraftSidebar() {
  const {
    selectedAircraft: ac, sidebarOpen,
    setSelectedAircraft, aircraftInfo, setAircraftInfo,
    jetPhoto, setJetPhoto, followAircraft, setFollowAircraft
  } = useFlightStore();

  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!ac) { setAircraftInfo(null); setJetPhoto(null); setPhotoError(false); return; }

    setLoadingInfo(true);
    setLoadingPhoto(true);
    setPhotoError(false);

    // Both info and photo come from planespotters.net — fire in parallel
    Promise.all([
      fetchAircraftInfo(ac.icao24),
      fetchJetPhoto(ac.icao24),
    ]).then(([info, photo]) => {
      setAircraftInfo(info);
      setJetPhoto(photo);
      setLoadingInfo(false);
      setLoadingPhoto(false);
      if (!photo) setPhotoError(true);
    });
  }, [ac?.icao24]);

  if (!ac || !sidebarOpen) return null;

  const cat = getAircraftCategory(ac);
  const catColor = getCategoryColor(cat);
  const military = isMilitary(ac);
  const squawkWarning = ac.squawk ? (SQUAWK_CODES[ac.squawk] ?? null) : null;

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex absolute top-14 right-0 bottom-0 z-[999] w-[340px] flex-col bg-gray-950 border-l border-gray-700 shadow-2xl overflow-hidden">
        <SidebarContent
          ac={ac} cat={cat} catColor={catColor} military={military}
          squawkWarning={squawkWarning} loadingInfo={loadingInfo} loadingPhoto={loadingPhoto}
          photoError={photoError} aircraftInfo={aircraftInfo} jetPhoto={jetPhoto}
          followAircraft={followAircraft} setFollowAircraft={setFollowAircraft}
          onClose={() => setSelectedAircraft(null)}
          expanded={expanded} setExpanded={setExpanded}
        />
      </div>

      {/* Mobile bottom sheet */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 z-[999] bg-gray-950 border-t border-gray-700 rounded-t-2xl shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>
        <SidebarContent
          ac={ac} cat={cat} catColor={catColor} military={military}
          squawkWarning={squawkWarning} loadingInfo={loadingInfo} loadingPhoto={loadingPhoto}
          photoError={photoError} aircraftInfo={aircraftInfo} jetPhoto={jetPhoto}
          followAircraft={followAircraft} setFollowAircraft={setFollowAircraft}
          onClose={() => setSelectedAircraft(null)}
          expanded={expanded} setExpanded={setExpanded}
        />
      </div>
    </>
  );
}

function SidebarContent({
  ac, cat, catColor, military, squawkWarning,
  loadingInfo, loadingPhoto, photoError, aircraftInfo, jetPhoto,
  followAircraft, setFollowAircraft, onClose, expanded, setExpanded
}: any) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-3 pb-2 border-b border-gray-800 shrink-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg text-white font-mono">
              {ac.callsign?.trim() || ac.icao24.toUpperCase()}
            </span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ backgroundColor: catColor + '30', color: catColor }}
            >
              {getCategoryLabel(cat)}
            </span>
            {military && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 uppercase tracking-wider border border-red-800">
                Military
              </span>
            )}
          </div>
          {aircraftInfo?.registration && (
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{aircraftInfo.registration}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setFollowAircraft(!followAircraft)}
            className={`p-1.5 rounded-lg transition ${followAircraft ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            title="Follow aircraft"
          >
            <Navigation2 size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Emergency squawk */}
        {squawkWarning && (
          <div className="mx-3 mt-3 p-2.5 bg-red-900/40 border border-red-800/60 rounded-xl">
            <div className="flex items-center gap-2 text-red-300">
              {squawkWarning.icon}
              <span className="text-sm font-bold">{squawkWarning.label}</span>
              <span className="text-xs text-red-500 ml-auto font-mono">Squawk {ac.squawk}</span>
            </div>
          </div>
        )}

        {/* Aircraft photo */}
        <div className="mx-3 mt-3">
          {loadingPhoto && (
            <div className="h-40 bg-gray-800 rounded-xl animate-pulse flex items-center justify-center">
              <Camera size={20} className="text-gray-600" />
            </div>
          )}
          {!loadingPhoto && jetPhoto && (
            <div className="relative rounded-xl overflow-hidden">
              <img
                src={jetPhoto.imageUrl}
                alt="Aircraft"
                className="w-full h-44 object-cover"
                onError={() => {}}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                <p className="text-[10px] text-gray-300 flex items-center gap-1">
                  <Camera size={9} /> {jetPhoto.photographer}
                  <a
                    href={`https://www.jetphotos.com/photo/keyword/${aircraftInfo?.registration ?? ''}`}
                    target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink size={9} />
                  </a>
                </p>
              </div>
            </div>
          )}
          {!loadingPhoto && photoError && (
            <div className="h-32 bg-gray-800/50 rounded-xl flex flex-col items-center justify-center gap-1 border border-dashed border-gray-700">
              <Camera size={16} className="text-gray-600" />
              <p className="text-xs text-gray-500">No photo available</p>
              {aircraftInfo?.registration && (
                <a
                  href={`https://www.jetphotos.com/photo/keyword/${aircraftInfo.registration}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5"
                >
                  Search on JetPhotos <ExternalLink size={9} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Live flight data */}
        <div className="px-3 mt-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Live Data</p>
          <div className="grid grid-cols-2 gap-2">
            <DataCard icon={<ArrowUp size={13} />} label="Altitude" value={formatAltitude(ac.baro_altitude)} />
            <DataCard icon={<Gauge size={13} />} label="Speed" value={formatSpeed(ac.velocity)} />
            <DataCard icon={<Navigation size={13} />} label="Heading" value={ac.true_track ? `${Math.round(ac.true_track)}°` : 'N/A'} />
            <DataCard icon={<ArrowUp size={13} />} label="Vert Rate" value={formatVerticalRate(ac.vertical_rate)} />
            <DataCard icon={<Globe size={13} />} label="Country" value={ac.origin_country} />
            <DataCard icon={<Tag size={13} />} label="Squawk" value={ac.squawk ?? 'N/A'} />
          </div>
        </div>

        {/* Position */}
        <div className="px-3 mt-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Position</p>
          <div className="grid grid-cols-2 gap-2">
            <DataCard icon={<Crosshair size={13} />} label="Latitude" value={ac.latitude?.toFixed(4) ?? 'N/A'} />
            <DataCard icon={<Crosshair size={13} />} label="Longitude" value={ac.longitude?.toFixed(4) ?? 'N/A'} />
            <DataCard icon={<ArrowUp size={13} />} label="Geo Alt" value={formatAltitude(ac.geo_altitude)} />
            <DataCard
              icon={<Info size={13} />}
              label="Status"
              value={ac.on_ground ? 'On Ground' : 'Airborne'}
              highlight={!ac.on_ground}
            />
          </div>
        </div>

        {/* Aircraft info */}
        {loadingInfo && (
          <div className="px-3 mt-3 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {aircraftInfo && (
          <div className="px-3 mt-3">
            <button
              onClick={() => setExpanded((v: boolean) => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-300 transition w-full"
            >
              Aircraft Details
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {expanded && (
              <div className="space-y-1.5">
                {aircraftInfo.manufacturername && (
                  <InfoRow icon={<Wrench size={11} />} label="Manufacturer" value={aircraftInfo.manufacturername} />
                )}
                {aircraftInfo.model && (
                  <InfoRow icon={<Wrench size={11} />} label="Model" value={aircraftInfo.model} />
                )}
                {aircraftInfo.typecode && (
                  <InfoRow icon={<Tag size={11} />} label="Type Code" value={aircraftInfo.typecode} />
                )}
                {aircraftInfo.operator && (
                  <InfoRow icon={<Globe size={11} />} label="Operator" value={aircraftInfo.operator} />
                )}
                {aircraftInfo.built && (
                  <InfoRow icon={<Calendar size={11} />} label="Built" value={aircraftInfo.built} />
                )}
                {aircraftInfo.engines && (
                  <InfoRow icon={<Wrench size={11} />} label="Engines" value={aircraftInfo.engines} />
                )}
                {aircraftInfo.icaoaircrafttype && (
                  <InfoRow icon={<Info size={11} />} label="ICAO Type" value={aircraftInfo.icaoaircrafttype} />
                )}
                {aircraftInfo.serialnumber && (
                  <InfoRow icon={<Tag size={11} />} label="Serial No." value={aircraftInfo.serialnumber} />
                )}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-2">
              <a
                href={`https://www.flightradar24.com/${ac.callsign?.trim() ?? ac.icao24}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                FR24 <ExternalLink size={10} />
              </a>
              <a
                href={`https://globe.adsbexchange.com/?icao=${ac.icao24}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                ADS-B Exchange <ExternalLink size={10} />
              </a>
              <a
                href={`https://www.planespotters.net/hex/${ac.icao24.toUpperCase()}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Planespotters <ExternalLink size={10} />
              </a>
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}

function DataCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-gray-500 mb-0.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-semibold font-mono ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-800">
      <span className="text-gray-600 mt-0.5 shrink-0">{icon}</span>
      <span className="text-xs text-gray-400 shrink-0 w-24">{label}</span>
      <span className="text-xs text-white">{value}</span>
    </div>
  );
}
