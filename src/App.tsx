import { useEffect, useState } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Usuário atual:", currentUser);
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function handleLogin() {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(error);
      alert("Email ou senha inválidos.");
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  if (authLoading) {
    return <div style={{ padding: 40 }}>Carregando...</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Login do painel</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: "block", marginBottom: 10, padding: 10, width: 300 }}
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: "block", marginBottom: 10, padding: 10, width: 300 }}
        />

        <button onClick={handleLogin} style={{ padding: 10 }}>
          Entrar
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Painel protegido</h1>
      <p>Usuário logado: {user.email}</p>

      <button onClick={handleLogout} style={{ padding: 10 }}>
        Sair
      </button>
    </div>
  );
}