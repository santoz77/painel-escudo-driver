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
  link?: string;
  startDate?: string;
  endDate?: string;
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
        <Popup>Arraste o marcador para ajustar o ponto.</Popup>
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
  const [link, setLink] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
    } catch (error) {
      console.error("Erro no login:", error);
      alert("Email ou senha inválidos.");
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
      alert("Erro ao sair.");
    }
  }
  if (!user) {
  return (
    <div style={{ padding: 40, fontSize: 32 }}>
      LOGIN OBRIGATÓRIO 777
    </div>
  );
}

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Erro ao enviar imagem para o Cloudinary.");
    }

    const data = await response.json();
    return data.secure_url as string;
  }

  async function searchLocation() {
    if (!searchText.trim()) {
      alert("Digite um endereço ou local para pesquisar.");
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
        alert("Local não encontrado.");
      }
    } catch (error) {
      console.error("Erro ao buscar localização:", error);
      alert("Erro ao buscar localização.");
    }
  }

  async function loadCampaigns() {
    try {
      const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Campaign, "id">),
      }));

      setCampaigns(list);
    } catch (error) {
      console.error("Erro ao carregar campanhas:", error);
    }
  }

  async function createCampaign() {
    if (!advertiser || !city || !type) {
      alert("Preencha anunciante, cidade e tipo.");
      return;
    }

    if (latitude === null || longitude === null) {
      alert("Selecione um ponto no mapa.");
      return;
    }

    if (!startDate || !endDate) {
      alert("Preencha a data inicial e a data final.");
      return;
    }

    try {
      setLoading(true);

      let imageUrl = "";

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      await addDoc(collection(db, "campaigns"), {
        advertiser,
        city,
        type,
        imageUrl,
        active: true,
        latitude,
        longitude,
        radiusMeters: Number(radiusMeters),
        link,
        startDate,
        endDate,
        createdAt: serverTimestamp(),
      });

      alert("Campanha criada com sucesso.");

      setAdvertiser("");
      setCity("");
      setType("");
      setRadiusMeters("500");
      setImageFile(null);
      setLink("");
      setStartDate("");
      setEndDate("");
      setLatitude(null);
      setLongitude(null);
      setSearchText("");

      await loadCampaigns();
    } catch (error) {
      console.error("Erro ao criar campanha:", error);
      alert("Erro ao criar campanha.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleCampaign(id: string, active: boolean) {
    try {
      await updateDoc(doc(db, "campaigns", id), {
        active: !active,
      });

      await loadCampaigns();
    } catch (error) {
      console.error("Erro ao alterar status da campanha:", error);
      alert("Erro ao alterar status.");
    }
  }

  async function deleteCampaign(id: string) {
    const confirmDelete = window.confirm("Deseja excluir esta campanha?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "campaigns", id));
      await loadCampaigns();
    } catch (error) {
      console.error("Erro ao excluir campanha:", error);
      alert("Erro ao excluir campanha.");
    }
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
          background: "#f5f5f5",
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
          background: "#f5f5f5",
          fontFamily: "Arial, sans-serif",
          padding: 20,
        }}
      >
        <div
          style={{
            width: 360,
            background: "#fff",
            padding: 30,
            borderRadius: 12,
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Login do painel</h2>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              padding: 12,
              background: "#111",
              color: "#fff",
              border: "none",
              borderRadius: 8,
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
        padding: 40,
        fontFamily: "Arial, sans-serif",
        background: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 6 }}>Painel Escudo Driver</h1>
          <p style={{ margin: 0 }}>Cadastro e gerenciamento de campanhas geolocalizadas</p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: "10px 14px",
            background: "#dc2626",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </div>

      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          maxWidth: 900,
          marginBottom: 30,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h2>Nova campanha</h2>

        <input
          placeholder="Nome do anunciante"
          value={advertiser}
          onChange={(e) => setAdvertiser(e.target.value)}
          style={{ padding: 10, width: "100%", marginBottom: 10, boxSizing: "border-box" }}
        />

        <input
          placeholder="Cidade"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={{ padding: 10, width: "100%", marginBottom: 10, boxSizing: "border-box" }}
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ padding: 10, width: "100%", marginBottom: 10, boxSizing: "border-box" }}
        >
          <option value="">Tipo de anúncio</option>
          <option value="master_notification">Master + Notificação</option>
          <option value="notification_only">Somente Notificação</option>
        </select>

        <input
          placeholder="Link do anunciante (opcional)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          style={{ padding: 10, width: "100%", marginBottom: 10, boxSizing: "border-box" }}
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Data inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: 10, width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Data final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: 10, width: "100%", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <input
          type="number"
          placeholder="Raio em metros"
          value={radiusMeters}
          onChange={(e) => setRadiusMeters(e.target.value)}
          style={{ padding: 10, width: "100%", marginBottom: 10, boxSizing: "border-box" }}
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              setImageFile(e.target.files[0]);
            }
          }}
          style={{ marginBottom: 10 }}
        />

        {imagePreview && (
          <div
            style={{
              background: "#f8f8f8",
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <p style={{ marginTop: 0 }}><strong>Preview da imagem:</strong></p>
            <img
              src={imagePreview}
              alt="Preview"
              style={{
                width: 240,
                maxWidth: "100%",
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input
            placeholder="Buscar endereço ou local"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ padding: 10, flex: 1, boxSizing: "border-box" }}
          />

          <button
            onClick={searchLocation}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Buscar
          </button>
        </div>

        <p style={{ marginTop: 16, marginBottom: 8 }}>
          Clique no mapa ou arraste o marcador para ajustar a localização:
        </p>

        <div
          style={{
            height: 380,
            width: "100%",
            marginBottom: 12,
            borderRadius: 12,
            overflow: "hidden",
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

        <div
          style={{
            background: "#f8f8f8",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <strong>Latitude:</strong> {latitude ?? "não selecionada"}
          <br />
          <strong>Longitude:</strong> {longitude ?? "não selecionada"}
          <br />
          <strong>Raio:</strong> {radiusMeters || "0"} m
        </div>

        <button
          onClick={createCampaign}
          disabled={loading}
          style={{
            padding: 12,
            width: "100%",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {loading ? "Salvando..." : "Criar campanha"}
        </button>
      </div>

      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h2>Campanhas cadastradas</h2>

        {campaigns.length === 0 ? (
          <p>Nenhuma campanha encontrada.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {campaigns.map((c) => (
              <div
                key={c.id}
                style={{
                  border: "1px solid #ddd",
                  padding: 15,
                  borderRadius: 10,
                  background: "#fafafa",
                }}
              >
                <p><b>Anunciante:</b> {c.advertiser}</p>
                <p><b>Cidade:</b> {c.city}</p>
                <p>
                  <b>Tipo:</b>{" "}
                  {c.type === "master_notification"
                    ? "Master + Notificação"
                    : "Somente Notificação"}
                </p>
                <p><b>Status:</b> {c.active ? "Ativa" : "Pausada"}</p>
                <p><b>Link:</b> {c.link || "-"}</p>
                <p><b>Início:</b> {c.startDate || "-"}</p>
                <p><b>Fim:</b> {c.endDate || "-"}</p>
                <p><b>Latitude:</b> {c.latitude ?? "-"}</p>
                <p><b>Longitude:</b> {c.longitude ?? "-"}</p>
                <p><b>Raio:</b> {c.radiusMeters ?? 0} m</p>

                {c.imageUrl && (
                  <img
                    src={c.imageUrl}
                    alt={c.advertiser}
                    style={{
                      width: 220,
                      marginTop: 10,
                      borderRadius: 8,
                      border: "1px solid #ccc",
                    }}
                  />
                )}

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => toggleCampaign(c.id, c.active)}
                    style={{
                      background: c.active ? "#f59e0b" : "#16a34a",
                      color: "#fff",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    {c.active ? "Stop" : "Play"}
                  </button>

                  <button
                    onClick={() => deleteCampaign(c.id)}
                    style={{
                      background: "#dc2626",
                      color: "#fff",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: 6,
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
  );
}