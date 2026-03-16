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
      map.setView([latitude, longitude], 16);
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
        <Popup>Arraste para ajustar o ponto do anúncio</Popup>
      </Marker>

      <Circle center={[latitude, longitude]} radius={radiusMeters} />
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #eef2ff 0%, #f8fafc 35%, #f8fafc 100%)",
    fontFamily: "Arial, sans-serif",
    padding: 24,
  } as const,

  container: {
    maxWidth: 1320,
    margin: "0 auto",
  } as const,

  card: {
    background: "#ffffff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
    border: "1px solid rgba(226,232,240,0.9)",
  } as const,

  title: {
    margin: 0,
    fontSize: 42,
    fontWeight: 800,
    color: "#0f172a",
  } as const,

  subtitle: {
    margin: "8px 0 0",
    color: "#475569",
    fontSize: 16,
  } as const,

  sectionTitle: {
    marginTop: 0,
    marginBottom: 20,
    fontSize: 30,
    color: "#0f172a",
  } as const,

  input: {
    width: "100%",
    padding: 14,
    marginBottom: 12,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box" as const,
    fontSize: 16,
    outline: "none",
    background: "#fff",
  },

  buttonPrimary: {
    width: "100%",
    padding: 14,
    border: "none",
    borderRadius: 14,
    background: "#0f172a",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  } as const,

  buttonBlue: {
    padding: "14px 18px",
    border: "none",
    borderRadius: 14,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  } as const,

  buttonDanger: {
    padding: "12px 16px",
    border: "none",
    borderRadius: 12,
    background: "#dc2626",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  } as const,

  infoBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    color: "#334155",
    lineHeight: 1.7,
  } as const,
};

export default function App() {
  const CLOUD_NAME = "dzvtrzzxx";
  const UPLOAD_PRESET = "escudo_driver";

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

  const [googleMapsLink, setGoogleMapsLink] = useState("");

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

    if (!res.ok) {
      throw new Error("Erro ao enviar imagem");
    }

    const data = await res.json();
    return data.secure_url as string;
  }

  function extractCoordinatesFromGoogleMapsUrl(url: string) {
    if (!url.trim()) return null;

    try {
      const decoded = decodeURIComponent(url);

      const atMatch = decoded.match(/@(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/);
      if (atMatch) {
        return {
          lat: parseFloat(atMatch[1]),
          lng: parseFloat(atMatch[3]),
        };
      }

      const altMatch = decoded.match(/!3d(-?\d+(\.\d+)?)!4d(-?\d+(\.\d+)?)/);
      if (altMatch) {
        return {
          lat: parseFloat(altMatch[1]),
          lng: parseFloat(altMatch[3]),
        };
      }

      return null;
    } catch (error) {
      console.error("Erro ao interpretar link do Google Maps:", error);
      return null;
    }
  }

  function handleGoogleMapsLink() {
    const coords = extractCoordinatesFromGoogleMapsUrl(googleMapsLink);

    if (!coords) {
      alert("Não foi possível extrair as coordenadas do link.");
      return;
    }

    setLatitude(coords.lat);
    setLongitude(coords.lng);
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
      alert("Defina o local da campanha.");
      return;
    }

    try {
      setLoading(true);

      let imageUrl = "";

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const docRef = await addDoc(collection(db, "campaigns"), {
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

      console.log("CAMPANHA SALVA ID:", docRef.id);

      alert("Campanha criada com sucesso.");

      setAdvertiser("");
      setCity("");
      setType("");
      setRadiusMeters("500");
      setImageFile(null);
      setLatitude(null);
      setLongitude(null);
      setGoogleMapsLink("");

      await loadCampaigns();
    } catch (error: any) {
      console.error("ERRO FIRESTORE:", error);
      alert(
        "Erro ao salvar no Firestore: " +
          (error?.message || JSON.stringify(error))
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleCampaign(id: string, active: boolean) {
    await updateDoc(doc(db, "campaigns", id), {
      active: !active,
    });

    await loadCampaigns();
  }

  async function deleteCampaign(id: string) {
    const ok = window.confirm("Excluir campanha?");
    if (!ok) return;

    await deleteDoc(doc(db, "campaigns", id));
    await loadCampaigns();
  }

  useEffect(() => {
    if (user) {
      loadCampaigns();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div style={styles.page}>
        <div
          style={{
            minHeight: "80vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#334155",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          Carregando painel...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.page}>
        <div
          style={{
            minHeight: "85vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 400,
              background: "#fff",
              padding: 32,
              borderRadius: 24,
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
              border: "1px solid rgba(226,232,240,0.9)",
            }}
          >
            <h1 style={{ marginTop: 0, marginBottom: 10, color: "#0f172a" }}>
              Painel Escudo Driver
            </h1>
            <p style={{ color: "#475569", marginBottom: 20 }}>
              Faça login para acessar o painel administrativo.
            </p>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />

            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />

            <button onClick={handleLogin} style={styles.buttonPrimary}>
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div
          style={{
            ...styles.card,
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={styles.title}>Painel Escudo Driver</h1>
            <p style={styles.subtitle}>
              Cadastro e controle de campanhas geolocalizadas
            </p>
          </div>

          <button onClick={handleLogout} style={styles.buttonDanger}>
            Sair
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.08fr 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Nova campanha</h2>

            <input
              placeholder="Nome do anunciante"
              value={advertiser}
              onChange={(e) => setAdvertiser(e.target.value)}
              style={styles.input}
            />

            <input
              placeholder="Cidade"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={styles.input}
            />

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={styles.input}
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
              style={styles.input}
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
                <p
                  style={{
                    fontWeight: "bold",
                    marginBottom: 8,
                    color: "#0f172a",
                  }}
                >
                  Preview da imagem
                </p>
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

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: "bold",
                  color: "#0f172a",
                }}
              >
                Cole o link do Google Maps
              </label>

              <div style={{ display: "flex", gap: 10 }}>
                <input
                  placeholder="Cole aqui o link do Google Maps do local"
                  value={googleMapsLink}
                  onChange={(e) => setGoogleMapsLink(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    boxSizing: "border-box",
                    fontSize: 16,
                  }}
                />

                <button onClick={handleGoogleMapsLink} style={styles.buttonBlue}>
                  Usar link
                </button>
              </div>

              <p style={{ marginTop: 8, color: "#64748b", fontSize: 14 }}>
                Pesquise o local no Google Maps, copie o link e cole aqui.
              </p>
            </div>

            <div style={styles.infoBox}>
              <strong>Latitude:</strong> {latitude ?? "não selecionada"}
              <br />
              <strong>Longitude:</strong> {longitude ?? "não selecionada"}
              <br />
              <strong>Raio:</strong> {radiusMeters} m
            </div>

            <button
              onClick={createCampaign}
              disabled={loading}
              style={styles.buttonPrimary}
            >
              {loading ? "Salvando..." : "Criar campanha"}
            </button>
          </div>

          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Mapa da campanha</h2>

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
            ...styles.card,
            marginTop: 24,
          }}
        >
          <h2 style={styles.sectionTitle}>Campanhas cadastradas</h2>

          {campaigns.length === 0 ? (
            <p style={{ color: "#475569" }}>Nenhuma campanha encontrada.</p>
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
                  <h3 style={{ marginTop: 0, marginBottom: 8, color: "#0f172a" }}>
                    {c.advertiser}
                  </h3>

                  <p style={{ margin: "4px 0", color: "#334155" }}>
                    <strong>Cidade:</strong> {c.city}
                  </p>

                  <p style={{ margin: "4px 0", color: "#334155" }}>
                    <strong>Status:</strong> {c.active ? "Ativa" : "Pausada"}
                  </p>

                  <p style={{ margin: "4px 0", color: "#334155" }}>
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

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginTop: 16,
                      flexWrap: "wrap",
                    }}
                  >
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