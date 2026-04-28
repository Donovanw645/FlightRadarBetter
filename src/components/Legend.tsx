export default function Legend() {
  return (
    <div className="absolute bottom-3 left-3 z-[999] bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-3 py-2.5 hidden sm:block">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Legend</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#facc15]" />
          <span className="text-[11px] text-gray-300">Aircraft</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#ef4444]" />
          <span className="text-[11px] text-gray-300">Military</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#6b7280]" />
          <span className="text-[11px] text-gray-300">On Ground</span>
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-gray-700">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Path altitude</p>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-24 rounded-full" style={{
              background: 'linear-gradient(to right, #22c55e, #3b82f6, #eab308, #f97316, #ef4444, #a855f7)'
            }} />
          </div>
          <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
