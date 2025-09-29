import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import geohash from "ngeohash";
import dotenv from "dotenv";
import cors from "cors";

// Cargar variables de entorno desde .env
dotenv.config();

const OSRM = process.env.OSRM_URL || "http://localhost:5000";
const SA = process.env.FB_SA || "./serviceAccountKey.json";
const DB_URL = process.env.FB_DB_URL; // p.ej. https://<tu-db>.firebaseio.com

admin.initializeApp({
  credential: admin.credential.cert(SA),
  databaseURL: DB_URL,
});
const db = admin.database();
const app = express();

// Configurar CORS para permitir peticiones desde cualquier origen
app.use(cors());
app.use(express.json());

/** Utilidades */
const toCoordStr = ({ lat, lng }) => `${lng},${lat}`;
async function osrmTable(coords) {
  const qs = coords.map(toCoordStr).join(";");
  const url = `${OSRM}/table/v1/driving/${qs}?annotations=duration,distance`;
  const r = await fetch(url);
  return r.json();
}
async function osrmRoute(coords) {
  const qs = coords.map(toCoordStr).join(";");
  const url = `${OSRM}/route/v1/driving/${qs}?overview=full&geometries=polyline6`;
  const r = await fetch(url);
  return r.json();
}

/** Heurística: inserta (pickup,drop) probando posiciones y minimiza Δtiempo */
function estimateDelta(table, nStops, i, j) {
  // Muy simplificado: comparamos longitud de “camino” (durations) antes vs después.
  // table.durations es matriz NxN (en seg). Último-2=pickup, último-1=drop
  // Para POC: aproximamos con sumas de arcos consecutivos (no exacto, suficiente para demo).
  return Math.random() * 300; // placeholder simple para POC (<= 5 min)
}

/** Endpoint: crear request y lanzar matching */
app.post("/request", async (req, res) => {
  try {
    const riderId = req.body.riderId || `r_${Date.now()}`;
    const passengerName = req.body.passengerName || "Pasajero Anónimo";
    const origin = req.body.origin; // {lat,lng}
    const dest = req.body.dest; // {lat,lng}
    const reqId = `req_${Date.now()}`;

    console.log(`🙋‍♂️ Nueva solicitud de ${passengerName} (${riderId})`);

    // 1) Guarda solicitud
    await db.ref(`rideRequests/${reqId}`).set({
      riderId,
      passengerName,
      origin,
      dest,
      pax: 1,
      status: "pending",
      constraints: { maxWaitMin: 6, maxDetourMin: 10 },
    });

    // 2) Drivers online
    const snap = await db.ref("drivers").get();
    const drivers = snap.exists()
      ? Object.entries(snap.val()).map(([id, v]) => ({ id, ...v }))
      : [];
    const near = drivers.filter((d) => d.online);

    // 3) Si hay un driver libre, crea trip nuevo; si ya tiene trip, intenta insertar
    let selectedTripId = null,
      selectedDriver = null;

    for (const d of near) {
      if (!d.tripId) {
        selectedDriver = d;
        break;
      }
    }

    if (selectedDriver) {
      // Nuevo trip
      const tripId = `trip_${Date.now()}`;
      await db.ref(`trips/${tripId}`).set({
        driverId: selectedDriver.id,
        status: "searching",
        stops: {
          0: {
            type: "pickup",
            riderId,
            passengerName,
            lat: origin.lat,
            lng: origin.lng,
          },
          1: {
            type: "dropoff",
            riderId,
            passengerName,
            lat: dest.lat,
            lng: dest.lng,
          },
        },
      });
      await db.ref(`drivers/${selectedDriver.id}/tripId`).set(tripId);

      // Calcula polyline para UI
      const route = await osrmRoute([origin, dest]);
      const poly = route?.routes?.[0]?.geometry || "";
      await db.ref(`trips/${tripId}/polyline`).set(poly);

      await db.ref(`rideRequests/${reqId}/status`).set("matched");
      await db.ref(`rideRequests/${reqId}/tripId`).set(tripId);
      selectedTripId = tripId;
    } else {
      // Inserción en el primer trip disponible (POC simple: tomamos cualquiera)
      const tripsSnap = await db.ref("trips").get();
      if (!tripsSnap.exists())
        return res.json({ ok: true, info: "No hay drivers/trips activos." });
      const [tripId, trip] = Object.entries(tripsSnap.val())[0];

      const currentStops = Object.values(trip.stops);
      const coords = [
        ...currentStops.map((s) => ({ lat: s.lat, lng: s.lng })),
        origin,
        dest,
      ];

      const table = await osrmTable(coords);
      let best = null;
      for (let i = 0; i <= currentStops.length; i++) {
        for (let j = i + 1; j <= currentStops.length + 1; j++) {
          const pen = estimateDelta(table, currentStops.length, i, j);
          if (!best || pen < best.penalty) best = { i, j, penalty: pen };
        }
      }
      // Aplica inserción
      const newStops = [...currentStops];
      newStops.splice(best.i, 0, {
        type: "pickup",
        riderId,
        passengerName,
        lat: origin.lat,
        lng: origin.lng,
      });
      newStops.splice(best.j, 0, {
        type: "dropoff",
        riderId,
        passengerName,
        lat: dest.lat,
        lng: dest.lng,
      });
      const stopsObj = Object.fromEntries(
        newStops.map((s, idx) => [idx.toString(), s])
      );
      await db.ref(`trips/${tripId}/stops`).set(stopsObj);

      // Recalcula polyline (ruta en orden de stops)
      const routeCoords = newStops.map((s) => ({ lat: s.lat, lng: s.lng }));
      const route = await osrmRoute(routeCoords);
      const poly = route?.routes?.[0]?.geometry || "";
      await db.ref(`trips/${tripId}/polyline`).set(poly);

      await db.ref(`rideRequests/${reqId}/status`).set("matched");
      await db.ref(`rideRequests/${reqId}/tripId`).set(tripId);
      selectedTripId = tripId;
    }

    return res.json({ ok: true, reqId, tripId: selectedTripId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/** Endpoint: driver online + ubicación */
app.post("/driver/online", async (req, res) => {
  const driverId = req.body.driverId || "driver_demo";
  const loc = req.body.loc || { lat: -12.06, lng: -77.05 };
  const gh = geohash.encode(loc.lat, loc.lng);
  await db
    .ref(`drivers/${driverId}`)
    .update({ online: true, seats: 4, loc: { ...loc, gh } });
  res.json({ ok: true, driverId });
});

/** Endpoint: actualizar ubicación driver (sim) */
app.post("/driver/loc", async (req, res) => {
  const driverId = req.body.driverId || "driver_demo";
  const loc = req.body.loc;
  if (!loc) return res.status(400).json({ ok: false, error: "loc requerido" });
  const gh = geohash.encode(loc.lat, loc.lng);
  await db.ref(`drivers/${driverId}/loc`).set({ ...loc, gh });
  res.json({ ok: true });
});

/** Endpoint: reiniciar sistema completo */
app.post("/reset", async (req, res) => {
  try {
    console.log("🔄 Iniciando reset del sistema...");

    // Limpiar todas las colecciones de Firebase
    await Promise.all([
      db.ref("drivers").remove(),
      db.ref("trips").remove(),
      db.ref("rideRequests").remove(),
    ]);

    console.log("✅ Sistema reiniciado correctamente");
    res.json({
      ok: true,
      message: "Sistema reiniciado correctamente",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error al reiniciar sistema:", error);
    res.status(500).json({
      ok: false,
      error: "Error al reiniciar sistema",
      details: error.message,
    });
  }
});

app.listen(3000, () => console.log("Matcher on :3000"));
