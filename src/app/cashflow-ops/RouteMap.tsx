"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

type RouteMapProps = {
  route: any;
};

function createATMIcon(order: number, operation: string, isSlaExceeded?: boolean) {
  // If SLA exceeded, make it purple
  const bgColor = isSlaExceeded ? "#8B5CF6" : (operation === "ikmal" ? "#10B981" : "#F2B705");
  
  return L.divIcon({
    html: `
      <div style="
        background-color: ${bgColor}; 
        width: 28px; 
        height: 28px; 
        border-radius: 50%; 
        border: 3px solid white; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
        color: white;
      ">${order}</div>
    `,
    className: "custom-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function RouteMap({ route }: RouteMapProps) {
  if (!route || !route.atms || route.atms.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0E2142] text-[#A7B8D8]">
        <div className="text-center">
          <div className="text-4xl mb-2">🗺️</div>
          <div>Rota verisi yükleniyor...</div>
        </div>
      </div>
    );
  }

  // Parse coordinates
  const atmCoordinates = route.atms.map((atm: any) => ({
    ...atm,
    lat: typeof atm.latitude === 'string' ? parseFloat(atm.latitude.replace(',', '.')) : atm.latitude,
    lng: typeof atm.longitude === 'string' ? parseFloat(atm.longitude.replace(',', '.')) : atm.longitude,
  })).filter((atm: any) => !isNaN(atm.lat) && !isNaN(atm.lng));

  if (atmCoordinates.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0E2142] text-[#A7B8D8]">
        <div className="text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <div>Geçerli koordinat bulunamadı</div>
        </div>
      </div>
    );
  }

  // Calculate center
  const centerLat = atmCoordinates.reduce((sum: number, atm: any) => sum + atm.lat, 0) / atmCoordinates.length;
  const centerLng = atmCoordinates.reduce((sum: number, atm: any) => sum + atm.lng, 0) / atmCoordinates.length;
  const center: [number, number] = [centerLat, centerLng];

  // Create route line coordinates
  const routeCoordinates: [number, number][] = atmCoordinates.map((atm: any) => [atm.lat, atm.lng]);

  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ height: "100%", width: "100%" }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route line */}
      <Polyline
        positions={routeCoordinates}
        color="#2E86FF"
        weight={3}
        opacity={0.7}
        dashArray="10, 5"
      />

      {/* ATM Markers */}
      {atmCoordinates.map((atm: any, idx: number) => {
        // Check if ATM has SLA issue (mock: cash level < 20%)
        const isSlaExceeded = atm.cash_level && atm.cash_level < 20;
        
        return (
          <Marker
            key={atm.atm_id}
            position={[atm.lat, atm.lng]}
            icon={createATMIcon(idx + 1, atm.operation, isSlaExceeded)}
          >
            <Popup>
              <div style={{ minWidth: "200px" }}>
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                  #{idx + 1} - ATM {atm.atm_id}
                </div>
                <div style={{ fontSize: "12px", opacity: 0.85, marginBottom: "2px" }}>
                  {atm.atm_name}
                </div>
                <div style={{ fontSize: "12px", marginBottom: "4px" }}>
                  {atm.city} / {atm.district}
                </div>
                {isSlaExceeded && (
                  <div style={{ 
                    fontSize: "12px", 
                    fontWeight: "bold",
                    color: "white",
                    marginBottom: "4px",
                    padding: "4px 6px",
                    backgroundColor: "rgba(139, 92, 246, 0.8)",
                    borderRadius: "4px"
                  }}>
                    ⚠️ SLA Süresi Aşıldı
                  </div>
                )}
                <div style={{ 
                  fontSize: "13px", 
                  fontWeight: "bold",
                  color: atm.operation === "ikmal" ? "#10B981" : "#F2B705",
                  marginTop: "6px"
                }}>
                  {atm.operation === "ikmal" ? "💰 İkmal" : "💵 Para Toplama"}: {atm.amount}
                </div>
                <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "4px" }}>
                  🏦 {route.cash_center} NM
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
