"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

type AtmData = {
  atm_id: string;
  atm_name: string;
  city: string;
  district: string;
  cash_level: number;
  latitude: number;
  longitude: number;
};

// Categorize ATMs by cash level
function getCashCategory(cashLevel: number): "Critical" | "Low" | "Moderate" {
  if (cashLevel < 20) return "Critical";
  if (cashLevel < 30) return "Low";
  return "Moderate";
}

// Create custom marker icons based on cash level
function createMarkerIcon(cashLevel: number) {
  let color = "#2E86FF"; // Blue for critical
  if (cashLevel >= 20) color = "#F2B705"; // Yellow for low
  if (cashLevel >= 30) color = "#10B981"; // Green for moderate

  const isCritical = cashLevel < 20;
  const animationStyle = isCritical 
    ? 'animation: pulse 2s ease-in-out infinite;' 
    : '';

  return L.divIcon({
    html: `
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
      </style>
      <div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); ${animationStyle}"></div>
    `,
    className: "custom-marker",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function HeatLayer({ lowCashAtms }: { lowCashAtms: AtmData[] }) {
  const map = useMap();

  useEffect(() => {
    if (lowCashAtms.length === 0) return;

    // Create heatmap data: [lat, lng, intensity]
    // Lower cash_level means higher intensity (more critical)
    const heatData = lowCashAtms.map((atm) => [
      atm.latitude,
      atm.longitude,
      1 - atm.cash_level / 100, // 10% cash = 0.9 intensity, 40% cash = 0.6 intensity
    ]);

    // @ts-ignore - leaflet.heat types
    const heatLayer = L.heatLayer(heatData, {
      radius: 25,
      blur: 35,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: "#10B981",
        0.4: "#F2B705",
        0.7: "#2E86FF",
        1.0: "#2E86FF",
      },
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, lowCashAtms]);

  return null;
}

export default function HeatMap({ lowCashAtms }: { lowCashAtms: AtmData[] }) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Critical", "Low", "Moderate"]);

  // Turkey center coordinates
  const center: [number, number] = [39.0, 35.0];

  // Categorize ATMs
  const criticalAtms = lowCashAtms.filter(a => a.cash_level < 20);
  const lowAtms = lowCashAtms.filter(a => a.cash_level >= 20 && a.cash_level < 30);
  const moderateAtms = lowCashAtms.filter(a => a.cash_level >= 30);

  // Filter ATMs based on selected categories
  const filteredAtms = lowCashAtms.filter(atm => {
    const category = getCashCategory(atm.cash_level);
    return selectedCategories.includes(category);
  });

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <div className="relative h-full w-full">
      {/* Filter buttons overlay */}
      <div className="absolute top-4 right-4 z-[1000] bg-[#0E2142]/95 backdrop-blur-sm rounded-xl p-3 ring-1 ring-[#2B416B] shadow-lg">
        <div className="text-xs text-[#A7B8D8] mb-2 font-semibold">Cash Level Categories</div>
        <div className="space-y-2">
          <button
            onClick={() => toggleCategory("Critical")}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition w-full text-left ${
              selectedCategories.includes("Critical")
                ? "bg-[#2E86FF]/20 ring-1 ring-[#2E86FF]"
                : "bg-[#112544] opacity-50 hover:opacity-75"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#2E86FF" }} />
              <span className="text-xs font-semibold text-white">Kritik</span>
            </div>
            <span className="text-xs text-[#2E86FF] font-bold">{criticalAtms.length}</span>
          </button>

          <button
            onClick={() => toggleCategory("Low")}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition w-full text-left ${
              selectedCategories.includes("Low")
                ? "bg-[#F2B705]/20 ring-1 ring-[#F2B705]"
                : "bg-[#112544] opacity-50 hover:opacity-75"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#F2B705" }} />
              <span className="text-xs font-semibold text-white">Düşük</span>
            </div>
            <span className="text-xs text-[#F2B705] font-bold">{lowAtms.length}</span>
          </button>

          <button
            onClick={() => toggleCategory("Moderate")}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition w-full text-left ${
              selectedCategories.includes("Moderate")
                ? "bg-[#10B981]/20 ring-1 ring-[#10B981]"
                : "bg-[#112544] opacity-50 hover:opacity-75"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#10B981" }} />
              <span className="text-xs font-semibold text-white">Orta</span>
            </div>
            <span className="text-xs text-[#10B981] font-bold">{moderateAtms.length}</span>
          </button>
        </div>
        <div className="mt-3 pt-2 border-t border-[#2B416B]">
          <div className="text-xs text-[#A7B8D8]">
            Gösterilen: <span className="font-bold text-white">{filteredAtms.length}</span> / {lowCashAtms.length}
          </div>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={5.6}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <HeatLayer lowCashAtms={filteredAtms} />
        
        {/* Add markers for filtered ATMs */}
        {filteredAtms.map((atm) => (
          <Marker
            key={atm.atm_id}
            position={[atm.latitude, atm.longitude]}
            icon={createMarkerIcon(atm.cash_level)}
          >
            <Popup>
              <div style={{ minWidth: "180px" }}>
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>ATM {atm.atm_id}</div>
                <div style={{ fontSize: "12px", opacity: 0.85, marginBottom: "2px" }}>{atm.atm_name}</div>
                <div style={{ fontSize: "12px", marginBottom: "4px" }}>
                  {atm.city} / {atm.district}
                </div>
                <div style={{ 
                  fontSize: "13px", 
                  fontWeight: "bold",
                  color: atm.cash_level < 20 ? "#2E86FF" : atm.cash_level < 30 ? "#F2B705" : "#10B981",
                  marginTop: "6px"
                }}>
                  Cash Level: {atm.cash_level}%
                </div>
                <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "2px" }}>
                  {getCashCategory(atm.cash_level)} - Replenishment needed
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
