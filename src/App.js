import React, { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import ChatSelector from "./components/ChatSelector"; // Cambiar esto - importar ChatSelector en lugar de Chat
import Files from "./components/Files";

function App() {
  // Estado del token y usuario logueado
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(
    localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null
  );
  const [view, setView] = useState(token ? "chat" : "login");

  // Cerrar sesión
  const cerrarSesion = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setView("login");
  };

  // Renderizar login o registro si no hay token
  if (!token) {
    if (view === "register") {
      return (
        <Register
          goToLogin={() => setView("login")}
        />
      );
    }
    return (
      <Login
        setTokenUser={(t, u) => {
          setToken(t);
          setUser(u);
          localStorage.setItem("token", t);
          localStorage.setItem("user", JSON.stringify(u));
          setView("chat");
        }}
        goToRegister={() => setView("register")}
      />
    );
  }

  // Renderizar app principal cuando el usuario está autenticado
  return (
    <div style={{ maxWidth: 800, margin: "30px auto" }}> {/* Amplié un poco el ancho máximo para acomodar el panel lateral */}
      <h1>Sistema de Chat y Archivos</h1>
      <button 
        onClick={cerrarSesion} 
        style={{ 
          float: "right",
          padding: "8px 15px",
          backgroundColor: "#f44336",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }}
      >
        Cerrar sesión
      </button>
      <div style={{ display: "flex", gap: 20, margin: "20px 0" }}>
        <button
          onClick={() => setView("chat")}
          style={{ 
            fontWeight: view === "chat" ? "bold" : "normal",
            padding: "8px 15px",
            backgroundColor: view === "chat" ? "#3498db" : "#e0e0e0",
            color: view === "chat" ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Chat
        </button>
        <button
          onClick={() => setView("files")}
          style={{ 
            fontWeight: view === "files" ? "bold" : "normal",
            padding: "8px 15px",
            backgroundColor: view === "files" ? "#3498db" : "#e0e0e0", 
            color: view === "files" ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Archivos
        </button>
      </div>
      {view === "chat" && <ChatSelector token={token} user={user} />} {/* Usar ChatSelector aquí en lugar de Chat */}
      {view === "files" && <Files token={token} />}
    </div>
  );
}

export default App;