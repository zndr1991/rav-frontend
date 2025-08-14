import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import ChatSelector from "./components/ChatSelector";
import Files from "./components/Files";
import { getSocket, initSocket, isSocketConnected } from "./api";

// Notificación solo para mensajes grupales
function mostrarNotificacion(titulo, mensaje) {
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(titulo, {
      body: mensaje,
      icon: "/favicon.ico",
    });
  }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(
    localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null
  );
  const [view, setView] = useState(token ? "chat" : "login");

  useEffect(() => {
    if (token && (!isSocketConnected() || !getSocket())) {
      initSocket(token);
    }
  }, [token]);

  // Listener solo para mensajes grupales
  useEffect(() => {
    const socket = getSocket();
    if (!token || !user || !socket) return;

    socket.off("nuevo-mensaje");
    function handleNuevoMensaje(datosNuevoMensaje) {
      console.log("SOCKET GRUPAL:", datosNuevoMensaje);
      mostrarNotificacion(
        `Mensaje grupal de ${datosNuevoMensaje.autor || "alguien"}`,
        datosNuevoMensaje.mensaje
      );
    }
    socket.on("nuevo-mensaje", handleNuevoMensaje);

    return () => {
      socket.off("nuevo-mensaje", handleNuevoMensaje);
    };
  }, [token, user]);

  const cerrarSesion = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setView("login");
  };

  if (!token) {
    if (view === "register") {
      return <Register goToLogin={() => setView("login")} />;
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

  return (
    <div style={{ maxWidth: 800, margin: "30px auto" }}>
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
      {view === "chat" && <ChatSelector token={token} user={user} />}
      {view === "files" && <Files token={token} />}
    </div>
  );
}

export default App;