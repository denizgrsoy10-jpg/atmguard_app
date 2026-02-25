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
            <Popup maxWidth={320}>
              <div style={{ minWidth: "280px", fontFamily: "sans-serif" }}>
                {/* Header */}
                <div style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "2px" }}>
                  #{idx + 1} — {atm.atm_name || `ATM ${atm.atm_id}`}
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "2px" }}>
                  ATM {atm.atm_id} • {atm.city} / {atm.district}
                </div>
                {atm.zone && (
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "4px" }}>
                    📍 Zone {atm.zone}{atm.sla_hours ? ` • SLA: ${atm.sla_hours} saat` : ""}
                    {atm.planned !== undefined ? ` • ${atm.planned ? "Planlı" : "Plansız"}` : ""}
                  </div>
                )}
                {isSlaExceeded && (
                  <div style={{
                    fontSize: "11px", fontWeight: "bold", color: "white",
                    marginBottom: "6px", padding: "3px 6px",
                    backgroundColor: "rgba(139,92,246,0.85)", borderRadius: "4px"
                  }}>⚠️ SLA Süresi Aşıldı</div>
                )}

                {/* Operation badge */}
                <div style={{
                  display: "inline-block", fontSize: "12px", fontWeight: "bold",
                  color: atm.operation === "ikmal" ? "#10B981" : "#F2B705",
                  background: atm.operation === "ikmal" ? "rgba(16,185,129,0.1)" : "rgba(242,183,5,0.1)",
                  borderRadius: "4px", padding: "2px 8px", marginBottom: "8px"
                }}>
                  {atm.operation === "ikmal" ? "💰 İkmal" : "🚛 Para Toplama"}: {atm.amount}
                </div>

                {/* Cassette table — only for ikmal with cassette data */}
                {atm.operation === "ikmal" && atm.cassettes && atm.cassettes.length > 0 && (() => {
                  const cassettes: any[] = atm.cassettes;
                  const atmTRY = cassettes.filter((c: any) => c.currency === "TRY").reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                  const atmUSD = cassettes.filter((c: any) => c.currency === "USD").reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                  const atmEUR = cassettes.filter((c: any) => c.currency === "EUR").reduce((s: number, c: any) => s + c.denomination * c.quantity, 0);
                  const USD_RATE = 38, EUR_RATE = 41;
                  const atmTRYEquiv = atmTRY + atmUSD * USD_RATE + atmEUR * EUR_RATE;
                  const currSymbol: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };
                  const currColor: Record<string, string> = { TRY: "#10B981", USD: "#2E86FF", EUR: "#9ca3af" };
                  return (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: "bold", color: "#374151", marginBottom: "4px", borderTop: "1px solid #e5e7eb", paddingTop: "6px" }}>
                        📦 Kaset Detayı {atm.hasFx && <span style={{ background: "rgba(242,183,5,0.2)", color: "#d97706", borderRadius: "3px", padding: "1px 4px", fontSize: "10px" }}>FX</span>}
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                        <thead>
                          <tr style={{ color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                            <th style={{ textAlign: "left", padding: "2px 4px", fontWeight: "600" }}>Kaset</th>
                            <th style={{ textAlign: "center", padding: "2px 4px", fontWeight: "600" }}>Dv.</th>
                            <th style={{ textAlign: "center", padding: "2px 4px", fontWeight: "600" }}>Nominal</th>
                            <th style={{ textAlign: "center", padding: "2px 4px", fontWeight: "600" }}>Adet</th>
                            <th style={{ textAlign: "right", padding: "2px 4px", fontWeight: "600" }}>Toplam</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cassettes.map((c: any) => (
                            <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                              <td style={{ padding: "3px 4px", color: "#374151" }}>#{c.id}</td>
                              <td style={{ padding: "3px 4px", textAlign: "center" }}>
                                <span style={{ background: `${currColor[c.currency]}22`, color: currColor[c.currency], borderRadius: "3px", padding: "1px 5px", fontWeight: "bold", fontSize: "10px" }}>{c.currency}</span>
                              </td>
                              <td style={{ padding: "3px 4px", textAlign: "center", fontWeight: "600" }}>{currSymbol[c.currency]}{c.denomination}</td>
                              <td style={{ padding: "3px 4px", textAlign: "center" }}>{c.quantity.toLocaleString("tr-TR")}</td>
                              <td style={{ padding: "3px 4px", textAlign: "right", fontWeight: "700", color: currColor[c.currency] }}>{currSymbol[c.currency]}{(c.denomination * c.quantity).toLocaleString("tr-TR")}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f9fafb" }}>
                            <td colSpan={3} style={{ padding: "3px 4px", fontWeight: "700", color: "#374151", fontSize: "11px" }}>Toplam</td>
                            <td style={{ padding: "3px 4px", textAlign: "center", fontWeight: "700" }}>{cassettes.reduce((s: number, c: any) => s + c.quantity, 0)}</td>
                            <td style={{ padding: "3px 4px", textAlign: "right" }}>
                              {atmTRY > 0 && <div style={{ fontWeight: "700", color: "#10B981" }}>₺{atmTRY.toLocaleString("tr-TR")}</div>}
                              {atmUSD > 0 && <div style={{ fontWeight: "700", color: "#2E86FF" }}>${atmUSD.toLocaleString("tr-TR")}</div>}
                              {atmEUR > 0 && <div style={{ fontWeight: "700", color: "#9ca3af" }}>€{atmEUR.toLocaleString("tr-TR")}</div>}
                              {(atmUSD > 0 || atmEUR > 0) && (
                                <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>≈ ₺{atmTRYEquiv.toLocaleString("tr-TR")}</div>
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}

                <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "6px" }}>🏦 {route.cash_center} NM</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
