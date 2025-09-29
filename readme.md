# 🚗 UberPool - Ride Sharing POC

Una prueba de concepto (POC) de un sistema de viajes compartidos estilo UberPool que optimiza rutas usando OSRM y Firebase en tiempo real.

## 📋 Descripción

Este proyecto implementa un sistema básico de ride-sharing que permite:

- **Conductores online** que pueden recibir solicitudes de viaje
- **Pasajeros** que solicitan viajes con nombres personalizados
- **Matching inteligente** que optimiza rutas insertando paradas de manera eficiente
- **Visualización en tiempo real** con diferentes colores para pickup/dropoff
- **Sistema de reset** para limpiar y empezar de nuevo

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │  Node.js Backend│    │  OSRM Backend   │
│                 │    │                 │    │                 │
│ • Leaflet Map   │◄──►│ • Express API   │◄──►│ • Route Engine  │
│ • Firebase Web  │    │ • Firebase Admin│    │ • Docker        │
│ • Real-time UI  │    │ • Geohashing    │    │ • Peru OSM Data │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         └───────────────────────┼──────────────────────────────────┐
                                 ▼                                  │
                    ┌───────────────────────────────────────────┐   │
                    │           Firebase Database               │   │
                    │                                           │   │
                    │ • drivers/     • trips/     • rideRequests│   │
                    │ • Real-time    • Geohash    • Status      │   │
                    └───────────────────────────────────────────┘   │
                                 ▲                                  │
                                 └──────────────────────────────────┘
```

## 🚀 Instalación y Configuración

### Prerrequisitos

- **Node.js** (v16+)
- **Docker** y **Docker Compose**
- **Cuenta de Firebase** con Realtime Database
- **Git**

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd UberPool
```

### 2. Configurar Firebase

1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Crear un nuevo proyecto o usar `uberpool`
3. Habilitar **Realtime Database**
4. Descargar el archivo `serviceAccountKey.json` y colocarlo en `matcher-backend/`
5. Obtener la configuración web para el frontend

### 3. Configurar Backend

```bash
cd matcher-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env  # Ajustar las variables
```

**Archivo `.env`:**

```env
FB_DB_URL="https://.firebaseio.com"
FB_SA="./serviceAccountKey-.json"
OSRM_URL="http://localhost:5000"
```

### 4. Configurar OSRM Backend

```bash
cd ../osrm-backend

# Procesar datos de mapa (solo la primera vez)
docker run --rm -v ${PWD}/osrm:/data osrm/osrm-backend:latest osrm-extract -p /opt/car.lua /data/peru-250928.osm.pbf
docker run --rm -v ${PWD}/osrm:/data osrm/osrm-backend:latest osrm-partition /data/peru-250928.osrm
docker run --rm -v ${PWD}/osrm:/data osrm/osrm-backend:latest osrm-customize /data/peru-250928.osrm

# Iniciar servidor OSRM
docker compose up
```

### 5. Configurar Frontend

Actualizar `web-frontend/index.html` con tu configuración de Firebase:

```javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: ".firebaseapp.com",
  databaseURL: "https://uberpool-.firebaseio.com",
  projectId: "uberpool-",
  storageBucket: "uberpool-.firebasestorage.app",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};
```

## 🎮 Uso

### Iniciar los servicios

1. **OSRM Backend** (Puerto 5000):

```bash
cd osrm-backend
docker compose up
```

2. **Node.js Backend** (Puerto 3000):

```bash
cd matcher-backend
npm run dev
```

3. **Frontend** (Puerto 5500):
   - Abrir `web-frontend/index.html` con Live Server o similar

### Flujo de uso

1. **🔄 Reiniciar** → Limpia todos los datos
2. **🚗 Driver: Online** → Pone un conductor disponible
3. **🙋‍♂️ Rider: Solicitar Viaje** → Pide nombre y crea viaje
4. **🗺️ Ver resultado** → Mapa actualizado en tiempo real

## 🎨 Sistema Visual

### Marcadores

- **🚗 Conductor (Amarillo)** → Posición actual con animación
- **🚶‍♂️ Pickup (Verde)** → Puntos de recogida de pasajeros
- **🏁 Dropoff (Rojo)** → Puntos de entrega de pasajeros
- **— Ruta (Azul)** → Camino optimizado que seguirá el conductor

### Información en Popup

```
🚶‍♂️ Recogida de
María
ID: María_1727620800000
```

## 🛠️ Tecnologías

| Componente           | Tecnología                           | Propósito                              |
| -------------------- | ------------------------------------ | -------------------------------------- |
| **Frontend**         | HTML5, Leaflet.js, Firebase Web SDK  | Interfaz de usuario y mapa interactivo |
| **Backend**          | Node.js, Express, Firebase Admin SDK | API REST y lógica de matching          |
| **Base de Datos**    | Firebase Realtime Database           | Almacenamiento en tiempo real          |
| **Routing**          | OSRM (Open Source Routing Machine)   | Cálculo de rutas optimizadas           |
| **Geospatial**       | Geohashing (ngeohash)                | Indexación espacial para búsquedas     |
| **Containerización** | Docker, Docker Compose               | Despliegue de OSRM                     |
| **Mapas**            | OpenStreetMap                        | Datos de mapas y visualización         |

## 📁 Estructura del Proyecto

```
UberPool/
├── matcher-backend/              # Backend Node.js
│   ├── src/
│   │   └── matcher.js            # Lógica principal de matching
│   ├── package.json              # Dependencias del backend
│   ├── .env                      # Variables de entorno
│   └── serviceAccountKey.json    # Credenciales de Firebase
├── osrm-backend/                 # Servidor de rutas OSRM
│   ├── docker-compose.yml        # Configuración de Docker
│   └── osrm/
│       └── peru-250928.osm.pbf   # Datos de mapa de Perú
├── web-frontend/                 # Frontend web
│   └── index.html                # Aplicación SPA completa
└── readme.md                     # Este archivo
```

## 🔥 Características Principales

### 🧠 Algoritmo de Matching

1. **Geohashing**: Indexa conductores por ubicación para búsquedas rápidas
2. **OSRM Integration**: Calcula distancias y tiempos reales
3. **Heurística de inserción**: Encuentra la mejor posición para nuevas paradas
4. **Optimización de ruta**: Minimiza tiempo total de viaje

### 🔄 Tiempo Real

- **Firebase Realtime Database**: Sincronización instantánea
- **WebSocket-like**: Actualizaciones automáticas sin polling
- **Estado compartido**: Todos los clientes ven los mismos datos

### 🎯 Experiencia de Usuario

- **Nombres personalizados**: Cada pasajero ingresa su nombre
- **Marcadores diferenciados**: Colores únicos para cada tipo de parada
- **Popups informativos**: Detalles claros de cada punto
- **Reset completo**: Botón para empezar de cero

## 🚧 Limitaciones Actuales (POC)

- **Un solo conductor**: Solo maneja `driver_demo`
- **Área limitada**: Solo Lima, Perú (-12.06, -77.05)
- **Sin autenticación**: Sin sistema de usuarios real
- **Sin pagos**: No incluye procesamiento de pagos
- **Rutas aleatorias**: Origen/destino generados automáticamente
- **Sin tracking GPS**: Ubicaciones estáticas

## 🔮 Posibles Mejoras

### Técnicas

- [ ] Múltiples conductores simultáneos
- [ ] Autenticación de usuarios (Firebase Auth)
- [ ] Tracking GPS en tiempo real
- [ ] Notificaciones push
- [ ] Estimación de tarifas
- [ ] Historial de viajes

### Algoritmo

- [ ] Machine Learning para predicción de demanda
- [ ] Balanceamiento de carga entre conductores
- [ ] Restricciones de capacidad del vehículo
- [ ] Ventanas de tiempo para pickups
- [ ] Penalización por detours largos

### UI/UX

- [ ] App móvil nativa
- [ ] Chat entre conductor y pasajeros
- [ ] Selector de ubicación en mapa
- [ ] Estados de viaje (en camino, llegó, etc.)
- [ ] Calificaciones y reviews

## 🏃‍♂️ Quick Start

```bash
# Terminal 1: OSRM
cd osrm-backend && docker compose up

# Terminal 2: Backend
cd matcher-backend && npm run dev

# Terminal 3: Frontend (con Live Server)
cd web-frontend && live-server index.html
```

Luego:

1. Ir a `http://127.0.0.1:5500`
2. Clic en "🔄 Reiniciar"
3. Clic en "🚗 Driver: Online"
4. Clic en "🙋‍♂️ Rider: Solicitar Viaje" → Ingresar nombre
5. ¡Ver la magia en el mapa! ✨
