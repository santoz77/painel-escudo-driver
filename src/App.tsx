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

  const [imageFile, setImageFile] = useState<File | null>(null);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [radiusMeters, setRadiusMeters] = useState("500");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const imagePreview = useMemo(() => {
    if (!imageFile) return "";
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function handleLogin() {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      alert("Login inválido");
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
      alert("Preencha os campos");
      return;
    }

    if (latitude === null || longitude === null) {
      alert("Selecione no mapa");
      return;
    }

    let imageUrl = "";

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

    alert("Campanha criada");

    setAdvertiser("");
    setCity("");
    setType("");
    setImageFile(null);

    loadCampaigns();
  }

  async function toggleCampaign(id: string, active: boolean) {
    await updateDoc(doc(db, "campaigns", id), {
      active: !active,
    });

    loadCampaigns();
  }

  async function deleteCampaign(id: string) {
    await deleteDoc(doc(db, "campaigns", id));
    loadCampaigns();
  }

  useEffect(() => {
    if (user) loadCampaigns();
  }, [user]);

  function MapClick() {
    useMapEvents({
      click(e) {
        setLatitude(e.latlng.lat);
        setLongitude(e.latlng.lng);
      },
    });
    return null;
  }

  if (authLoading) {
    return <div style={{ padding: 40 }}>Carregando...</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Login do painel</h2>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <br />
        <br />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <br />
        <br />

        <button onClick={handleLogin}>Entrar</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Painel Escudo Driver</h1>

      <button onClick={handleLogout}>Sair</button>

      <h2>Nova campanha</h2>

      <input
        placeholder="Anunciante"
        value={advertiser}
        onChange={(e) => setAdvertiser(e.target.value)}
      />

      <br />

      <input
        placeholder="Cidade"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />

      <br />

      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">Tipo</option>
        <option value="master_notification">Master + Notificação</option>
        <option value="notification_only">Somente Notificação</option>
      </select>

      <br />
      <br />

      <input
        type="number"
        value={radiusMeters}
        onChange={(e) => setRadiusMeters(e.target.value)}
      />

      <br />
      <br />

      <input
        type="file"
        onChange={(e) => {
          if (e.target.files) setImageFile(e.target.files[0]);
        }}
      />

      {imagePreview && <img src={imagePreview} width={200} />}

      <div style={{ height: 400, marginTop: 20 }}>
        <MapContainer
          center={[-5.0892, -42.8016]}
          zoom={13}
          style={{ height: "100%" }}
        >
          <TileLayer
            attribution="OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClick />

          {latitude && longitude && (
            <>
              <Marker position={[latitude, longitude]} icon={markerIcon}>
                <Popup>Ponto do anúncio</Popup>
              </Marker>

              <Circle
                center={[latitude, longitude]}
                radius={Number(radiusMeters)}
              />
            </>
          )}
        </MapContainer>
      </div>

      <br />

      <button onClick={createCampaign}>Criar campanha</button>

      <h2>Campanhas</h2>

      {campaigns.map((c) => (
        <div key={c.id} style={{ border: "1px solid #ccc", padding: 10 }}>
          <b>{c.advertiser}</b>
          <p>{c.city}</p>

          <p>Status: {c.active ? "Ativa" : "Pausada"}</p>

          {c.imageUrl && <img src={c.imageUrl} width={200} />}

          <br />

          <button onClick={() => toggleCampaign(c.id, c.active)}>
            {c.active ? "Stop" : "Play"}
          </button>

          <button onClick={() => deleteCampaign(c.id)}>Excluir</button>
        </div>
      ))}
    </div>
  );
}