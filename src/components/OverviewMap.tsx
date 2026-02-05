"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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

  const html = `
  <div style="
    position:relative;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    width:78px;height:52px;border-radius:16px;
    background: rgba(14,33,66,0.74);
    border: 1px solid rgba(46,134,255,0.55);
    box-shadow: 0 10px 26px rgba(0,0,0,0.30);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: rgba(255,255,255,0.92);
    font-family: ui-sans-serif, system-ui, -apple-system;
    overflow:hidden;
  ">
    <div style="
      font-weight:900;
      font-size:12px;
      line-height:12px;
      letter-spacing:0.2px;
      white-space:nowrap;
    ">
      ${count} ATM
    </div>

    <div style="
      margin-top:6px;
      font-size:9px;
      line-height:9px;
      letter-spacing:0px;
      color: rgba(167,184,216,0.95);
      display:flex;
      gap:6px;
      align-items:center;
      white-space:nowrap;
    ">
      <span style="display:flex;align-items:center;gap:3px;">
        <i style="width:6px;height:6px;border-radius:999px;background:#E63946;display:inline-block;"></i>H:${h}
      </span>
      <span style="display:flex;align-items:center;gap:3px;">
        <i style="width:6px;height:6px;border-radius:999px;background:#F2B705;display:inline-block;"></i>M:${m}
      </span>
      <span style="display:flex;align-items:center;gap:3px;">
        <i style="width:6px;height:6px;border-radius:999px;background:#2E86FF;display:inline-block;"></i>L:${l}
      </span>
    </div>

    <div style="
      position:absolute; inset:0;
      border-radius:16px;
      border:2px solid ${accent};
      opacity:0.32;
      pointer-events:none;
    "></div>
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
}: OverviewMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={5.6}
      scrollWheelZoom={false}
      preferCanvas={true}
      style={{ height: "100%", width: "100%" }}
    >
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
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
