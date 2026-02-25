"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";

type ATM = {
  atm_id: string;
  atm_name?: string;
  city: string;
  district: string;
  zone?: string | number;
  latitude: number;
  longitude: number;
  active?: boolean;
  location_type?: string;
  brand?: string;
};

type OverviewMapProps = {
  filteredAtms: ATM[];
  center: [number, number];
  top10Band: Map<string, "High" | "Medium" | "Low">;
  top10Data: Map<string, { risk_band: "High" | "Medium" | "Low"; availability: number | undefined }>;
};

function getBandColor(band?: string) {
  if (band === "High") return "#E63946";
  if (band === "Medium") return "#F2B705";
  return "#2E86FF"; // Low
}

function makeAtmDotIcon(color: string, isOffsite: boolean = false) {
  const borderRadius = isOffsite ? "2px" : "999px";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:10px;height:10px;border-radius:${borderRadius};
      background:${color};
      border:2px solid rgba(255,255,255,0.78);
      box-shadow:0 0 0 2px rgba(43,65,107,0.65);
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

function MapResizer() {
  const map = useMap();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  
  return null;
}

function getClusterIcon(cluster: any) {
  const markers: any[] = cluster.getAllChildMarkers();
  let h = 0,
    m = 0,
    l = 0;

  for (const mk of markers) {
    const b = (mk.options as any).riskBand as "High" | "Medium" | "Low" | undefined;
    if (b === "High") h++;
    else if (b === "Medium") m++;
    else l++;
  }

  const count = cluster.getChildCount();

  let dominant: "High" | "Medium" | "Low" = "Low";
  if (h >= m && h >= l) dominant = "High";
  else if (m >= h && m >= l) dominant = "Medium";

  const accent = dominant === "High" ? "#E63946" : dominant === "Medium" ? "#F2B705" : "#2E86FF";
  const bgColor = dominant === "High" ? "rgba(230,57,70,0.15)" : dominant === "Medium" ? "rgba(242,183,5,0.15)" : "rgba(46,134,255,0.15)";

  const html = `
  <div style="
    position:relative;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding: 8px 12px;
    border-radius:12px;
    background: linear-gradient(135deg, rgba(17,37,68,0.95) 0%, rgba(14,33,66,0.90) 100%);
    border: 2px solid ${accent};
    box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset;
    color: white;
    font-family: ui-sans-serif, system-ui, -apple-system;
    min-width: 60px;
  ">
    <div style="
      font-weight: 800;
      font-size: 16px;
      line-height: 1;
      color: ${accent};
      margin-bottom: 4px;
    ">
      ${count}
    </div>
    
    <div style="
      font-size: 9px;
      font-weight: 600;
      color: rgba(255,255,255,0.7);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    ">
      ATM
    </div>
    
    ${h > 0 || m > 0 ? `
    <div style="
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 8px;
      display: flex;
      gap: 6px;
      color: rgba(167,184,216,0.9);
    ">
      ${h > 0 ? `<span style="display:flex;align-items:center;gap:2px;"><i style="width:5px;height:5px;border-radius:999px;background:#E63946;"></i>${h}</span>` : ''}
      ${m > 0 ? `<span style="display:flex;align-items:center;gap:2px;"><i style="width:5px;height:5px;border-radius:999px;background:#F2B705;"></i>${m}</span>` : ''}
    </div>
    ` : ''}
  </div>`;

  return L.divIcon({
    html,
    className: "",
    iconSize: [78, 52],
    iconAnchor: [39, 26],
  });
}

export default function OverviewMap({
  filteredAtms,
  center,
  top10Band,
  top10Data,
}: OverviewMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={5.6}
      scrollWheelZoom={true}
      preferCanvas={true}
      style={{ height: "100%", width: "100%" }}
    >
      <MapResizer />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        iconCreateFunction={getClusterIcon as any}
      >
        {filteredAtms.map((a) => {
          const band = top10Band.get(String(a.atm_id)) ?? "Low";
          const color = getBandColor(band);
          const isOffsite = a.location_type === "Offsite";
          const icon = makeAtmDotIcon(color, isOffsite);

          return (
            <Marker
              key={a.atm_id}
              position={[a.latitude, a.longitude]}
              icon={icon}
              // @ts-ignore
              riskBand={band}
            >
              <Popup>
                <div style={{ fontWeight: 800 }}>ATM {a.atm_id}</div>
                <div style={{ opacity: 0.85 }}>{a.atm_name ? a.atm_name : ""}</div>
                <div>
                  {a.city} / {a.district}
                </div>
                <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "4px" }}>
                  {a.location_type === "Offsite" ? "📍 OFFSITE" : "🏢 ONSITE (Şube)"}
                </div>
                <div>Zone: {a.zone ?? "-"}</div>
                <div>Risk: {band}</div>
                {(() => {
                  const data = top10Data.get(a.atm_id);
                  if (data && data.availability !== undefined) {
                    const avail = data.availability;
                    const color = avail < 70 ? "#E63946" : avail < 90 ? "#F2B705" : "#10B981";
                    return (
                      <div style={{ marginTop: "4px", fontWeight: 700, color }}>
                        ⚡ Avail: {avail.toFixed(1)}%
                      </div>
                    );
                  }
                  return null;
                })()}
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
