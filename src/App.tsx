import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";

import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

type Campaign = {
  id: string;
  advertiser: string;
  city: string;
  type: string;
  active: boolean;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
};

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type RecenterMapProps = {
  latitude: number | null;
  longitude: number | null;
};

function RecenterMap({ latitude, longitude }: RecenterMapProps) {
  const map = useMap();

  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      map.setView([latitude, longitude], 15);
    }
  }, [latitude, longitude, map]);

  return null;
}

type LocationPickerProps = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onSelect: (lat: number, lng: number) => void;
};

function LocationPicker({
  latitude,
  longitude,
  radiusMeters,
  onSelect,
}: LocationPickerProps) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  if (latitude === null || longitude === null) return null;

  return (
    <>
      <Marker
        position={[latitude, longitude]}
        icon={markerIcon}
        draggable={true}
        eventHandlers={{
          dragend: (e) => {
            const marker = e.target;
            const pos = marker.getLatLng();
            onSelect(pos.lat, pos.lng);
          },
        }}
      >
        <Popup>Arraste para ajustar o ponto</Popup>
      </Marker>

      <Circle center={[latitude, longitude]} radius={radiusMeters} />
    </>
  );
}

export default function App() {
  const CLOUD_NAME = "dzvtrzzxx";
  const UPLOAD_PRESET = "escudo-driver";

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [advertiser, setAdvertiser] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("500");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [searchText, setSearchText] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);

  const imagePreview = useMemo(() => {
    if (!imageFile) return "";
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function handleLogin() {
    if (!email || !password) {
      alert("Preencha email e senha.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      alert("Email ou senha inválidos.");
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();
    return data.secure_url;
  }

  async function searchLocation() {
    if (!searchText.trim()) {
      alert("Digite um endereço para buscar.");
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchText
        )}`
      );

      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        setLatitude(lat);
        setLongitude(lon);
      } else {
        alert("Endereço não encontrado.");
      }
    } catch {
      alert("Erro ao buscar endereço.");
    }
  }

  async function loadCampaigns() {
    const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const list = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Campaign, "id">),
    }));

    setCampaigns(list);
  }

  async function createCampaign() {
    if (!advertiser || !city || !type) {
      alert("Preencha anunciante, cidade e tipo.");
      return;
    }

    if (latitude === null || longitude === null) {
      alert("Selecione o ponto no mapa.");
      return;
    }

    let imageUrl = "";

    try {
      setLoading(true);

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      await addDoc(collection(db, "campaigns"), {
        advertiser,
        city,
        type,
        imageUrl,
        latitude,
        longitude,
        radiusMeters: Number(radiusMeters),
        active: true,
        createdAt: serverTimestamp(),
      });

      alert("Campanha criada com sucesso.");

      setAdvertiser("");
      setCity("");
      setType("");
      setRadiusMeters("500");
      setImageFile(null);
      setLatitude(null);
      setLongitude(null);
      setSearchText("");

      await loadCampaigns();
    } catch {
      alert("Erro ao criar campanha.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleCampaign(id: string, active: boolean) {
    await updateDoc(doc(db, "campaigns", id), {
      active: !active,
    });

    loadCampaigns();
  }

  async function deleteCampaign(id: string) {
    const ok = window.confirm("Excluir campanha?");
    if (!ok) return;

    await deleteDoc(doc(db, "campaigns", id));
    loadCampaigns();
  }

  useEffect(() => {
    if (user) {
      loadCampaigns();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          background: "#f4f6f8",
        }}
      >
        Carregando...
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f6f8",
          fontFamily: "Arial, sans-serif",
          padding: 20,
        }}
      >
        <div
          style={{
            width: 380,
            background: "#fff",
            padding: 32,
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 10 }}>Painel Escudo Driver</h1>
          <p style={{ color: "#666", marginBottom: 20 }}>
            Faça login para acessar o painel administrativo.
          </p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              borderRadius: 10,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              fontSize: 16,
            }}
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 16,
              borderRadius: 10,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              fontSize: 16,
            }}
          />

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              padding: 14,
              border: "none",
              borderRadius: 10,
              background: "#111827",
              color: "#fff",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6f8",
        fontFamily: "Arial, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 42 }}>Painel Escudo Driver</h1>
            <p style={{ margin: "8px 0 0", color: "#666" }}>
              Cadastro e controle de campanhas geolocalizadas
            </p>
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: "12px 18px",
              border: "none",
              borderRadius: 10,
              background: "#dc2626",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Sair
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 32 }}>Nova campanha</h2>

            <input
              placeholder="Nome do anunciante"
              value={advertiser}
              onChange={(e) => setAdvertiser(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
                boxSizing: "border-box",
                fontSize: 16,
              }}
            />

            <input
              placeholder="Cidade"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
                boxSizing: "border-box",
                fontSize: 16,
              }}
            />

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
                boxSizing: "border-box",
                fontSize: 16,
              }}
            >
              <option value="">Tipo de anúncio</option>
              <option value="master_notification">Master + Notificação</option>
              <option value="notification_only">Somente Notificação</option>
            </select>

            <input
              type="number"
              placeholder="Raio em metros"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
                boxSizing: "border-box",
                fontSize: 16,
              }}
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setImageFile(e.target.files[0]);
                }
              }}
              style={{ marginBottom: 14 }}
            />

            {imagePreview && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontWeight: "bold", marginBottom: 8 }}>Preview da imagem</p>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: 260,
                    maxWidth: "100%",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <input
                placeholder="Buscar endereço ou local"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                  fontSize: 16,
                }}
              />

              <button
                onClick={searchLocation}
                style={{
                  padding: "12px 16px",
                  border: "none",
                  borderRadius: 10,
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Buscar
              </button>
            </div>

            <div
              style={{
                background: "#f9fafb",
                padding: 12,
                borderRadius: 12,
                marginBottom: 16,
                color: "#333",
                lineHeight: 1.6,
              }}
            >
              <strong>Latitude:</strong> {latitude ?? "não selecionada"}
              <br />
              <strong>Longitude:</strong> {longitude ?? "não selecionada"}
              <br />
              <strong>Raio:</strong> {radiusMeters} m
            </div>

            <button
              onClick={createCampaign}
              disabled={loading}
              style={{
                width: "100%",
                padding: 14,
                border: "none",
                borderRadius: 10,
                background: "#111827",
                color: "#fff",
                fontSize: 16,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {loading ? "Salvando..." : "Criar campanha"}
            </button>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 28 }}>Mapa da campanha</h2>

            <div
              style={{
                height: 560,
                width: "100%",
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid #e5e7eb",
              }}
            >
              <MapContainer
                center={
                  latitude !== null && longitude !== null
                    ? [latitude, longitude]
                    : [-5.0892, -42.8016]
                }
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <RecenterMap latitude={latitude} longitude={longitude} />

                <LocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  radiusMeters={Number(radiusMeters) || 0}
                  onSelect={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                />
              </MapContainer>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            marginTop: 24,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 32 }}>Campanhas cadastradas</h2>

          {campaigns.length === 0 ? (
            <p>Nenhuma campanha encontrada.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 16,
                    background: "#fafafa",
                  }}
                >
                  <h3 style={{ marginTop: 0, marginBottom: 8 }}>{c.advertiser}</h3>
                  <p style={{ margin: "4px 0" }}><strong>Cidade:</strong> {c.city}</p>
                  <p style={{ margin: "4px 0" }}>
                    <strong>Status:</strong> {c.active ? "Ativa" : "Pausada"}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    <strong>Tipo:</strong>{" "}
                    {c.type === "master_notification"
                      ? "Master + Notificação"
                      : "Somente Notificação"}
                  </p>

                  {c.imageUrl && (
                    <img
                      src={c.imageUrl}
                      alt={c.advertiser}
                      style={{
                        width: "100%",
                        maxWidth: 260,
                        marginTop: 12,
                        borderRadius: 12,
                        border: "1px solid #ddd",
                      }}
                    />
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                    <button
                      onClick={() => toggleCampaign(c.id, c.active)}
                      style={{
                        padding: "10px 14px",
                        border: "none",
                        borderRadius: 10,
                        background: c.active ? "#f59e0b" : "#16a34a",
                        color: "#fff",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      {c.active ? "Stop" : "Play"}
                    </button>

                    <button
                      onClick={() => deleteCampaign(c.id)}
                      style={{
                        padding: "10px 14px",
                        border: "none",
                        borderRadius: 10,
                        background: "#dc2626",
                        color: "#fff",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}