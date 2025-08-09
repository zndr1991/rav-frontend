import React, { useState } from "react";
import { login } from "../api";

export default function Login({ setTokenUser, goToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await login(email, password);
      // res debe tener { token, user }
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.token && res.user) {
        setTokenUser(res.token, res.user);
      } else {
        setError("Login incorrecto.");
      }
    } catch (err) {
      setError("Error de conexión.");
    }
  };

  return (
    <div>
      <h2>Iniciar sesión</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={e => setEmail(e.target.value)}
        /><br />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
        /><br />
        <button type="submit">Entrar</button>
      </form>
      <button onClick={goToRegister}>Registrarse</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}