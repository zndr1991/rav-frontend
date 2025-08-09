import React, { useState } from "react";
import { register } from "../api";

export default function Register({ goToLogin }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("operador");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const data = await register(nombre, email, password, rol);
    if (data.message) {
      setSuccess("Registro exitoso, ahora puedes iniciar sesión.");
    } else {
      setError(data.error || "Error al registrarse.");
    }
  };

  return (
    <div>
      <h2>Registro</h2>
      <form onSubmit={handleRegister}>
        <input
          type="text"
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        /><br/>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        /><br/>
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        /><br/>
        <select value={rol} onChange={e=>setRol(e.target.value)}>
          <option value="operador">Operador</option>
          <option value="supervisor">Supervisor</option>
        </select><br/>
        <button type="submit">Registrarse</button>
      </form>
      {error && <p style={{color:'red'}}>{error}</p>}
      {success && <p style={{color:'green'}}>{success}</p>}
      <button onClick={goToLogin}>¿Ya tienes cuenta? Inicia sesión</button>
    </div>
  );
}