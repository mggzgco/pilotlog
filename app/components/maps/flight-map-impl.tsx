"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";

function decodePolyline(encoded: string): [number, number][] {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];

  while (index < len) {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

interface FlightMapProps {
  polyline?: string | null;
  track?: Array<{ latitude: number; longitude: number }> | null;
}

export function FlightMapImpl({ polyline, track }: FlightMapProps) {
  const didFixIcons = useRef(false);

  useEffect(() => {
    if (didFixIcons.current) return;
    didFixIcons.current = true;

    const defaultIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });
    (L.Marker.prototype.options as { icon?: unknown }).icon = defaultIcon;
  }, []);

  const coordinates =
    track && track.length > 0
      ? track.map((point) => [point.latitude, point.longitude] as [number, number])
      : polyline
        ? decodePolyline(polyline)
        : [];

  const center = coordinates[0] ?? [47.4502, -122.3088];

  return (
    <MapContainer center={center} zoom={9} className="h-72 w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {coordinates.length > 1 && (
        <>
          <Polyline positions={coordinates} color="#3b82f6" />
          <Marker position={coordinates[0]}>
            <Popup>Departure</Popup>
          </Marker>
          <Marker position={coordinates[coordinates.length - 1]}>
            <Popup>Arrival</Popup>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}

