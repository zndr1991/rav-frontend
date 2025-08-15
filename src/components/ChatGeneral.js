import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

function ChatGeneral({ token, usuario }) {
  const [mensajes, setMensajes] = useState([]);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensajeParpadeoId, setMensajeParpadeoId] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef(null);

  // Cargar mensajes iniciales
  const fetchMensajes = async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/group`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMensajes(data || []);
    } catch (err) {
      setMensajes([]);
      setError('No se pudieron cargar los mensajes.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchMensajes();
  }, [token]);

  // Socket.IO para tiempo real
  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_URL.replace('/api', ''), {
      transports: ['websocket'],
      autoConnect: true
    });

    socket.on('nuevo-mensaje', (mensaje) => {
      setMensajes(prev => [...prev, mensaje]);
      setAutoScroll(true);
    });

    return () => socket.disconnect();
  }, []);

  // Solo hacer scroll si autoScroll es true
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, autoScroll]);

  // Detecta si el usuario se aleja del final
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  };

  // Escuchar evento para ir al mensaje y parpadear
  useEffect(() => {
    const handler = (e) => {
      setMensajeParpadeoId(e.detail);
      setTimeout(() => setMensajeParpadeoId(null), 2000);
      const el = document.getElementById(`mensaje-${e.detail}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('ir-a-mensaje', handler);
    return () => window.removeEventListener('ir-a-mensaje', handler);
  }, []);

  // Al abrir el chat, revisa si hay mensaje pendiente en localStorage
  useEffect(() => {
    const mensajePendiente = localStorage.getItem('mensajePendiente');
    if (mensajePendiente) {
      setMensajeParpadeoId(Number(mensajePendiente));
      setTimeout(() => setMensajeParpadeoId(null), 2000);
      setTimeout(() => {
        const el = document.getElementById(`mensaje-${mensajePendiente}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300); // Espera a que se rendericen los mensajes
      localStorage.removeItem('mensajePendiente');
    }
  }, []);

  // Enviar mensaje (Enter o botón)
  const enviarMensaje = async (e) => {
    if (e) e.preventDefault();
    const texto = mensajeTexto.trim();
    if (!texto) return;
    setError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          usuario_id: usuario.id,
          nombre_usuario: usuario.nombre,
          texto
        })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'No se pudo enviar el mensaje.');
        return;
      }
      setMensajeTexto('');
      setAutoScroll(true); // Fuerza el scroll al enviar
      // No hace falta fetchMensajes, el socket lo actualizará
    } catch {
      setError('No se pudo enviar el mensaje.');
    }
  };

  return (
    <div>
      {/* Efecto parpadeo CSS */}
      <style>
        {`
          @keyframes parpadeo {
            0% { background: #ffe066; }
            50% { background: #fff; }
            100% { background: #ffe066; }
          }
          .mensaje-parpadeo {
            animation: parpadeo 1s ease-in-out 2;
          }
        `}
      </style>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          height: 350,
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: 12,
          background: '#f9f9f9',
          marginBottom: 16
        }}
      >
        {cargando && <div>Cargando mensajes...</div>}
        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
        {mensajes.length === 0 && !cargando && !error && <div>No hay mensajes.</div>}
        {mensajes.map((msg, idx) => (
          <div
            key={idx}
            id={`mensaje-${msg.id}`}
            className={msg.id === mensajeParpadeoId ? 'mensaje-parpadeo' : ''}
            style={{
              marginBottom: 12,
              background: msg.usuario_id === usuario.id ? '#e6f7ff' : '#fff',
              borderRadius: 6,
              padding: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#007bff' }}>
              {msg.nombre_usuario || msg.nombre || msg.autor || 'Desconocido'}
            </div>
            <div>{msg.texto}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {msg.fecha ? new Date(msg.fecha).toLocaleString() : ''}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={enviarMensaje} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={mensajeTexto}
          onChange={e => setMensajeTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              enviarMensaje(e);
            }
          }}
          placeholder="Escribe tu mensaje..."
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: 16
          }}
        />
        <button
          type="submit"
          style={{
            padding: '10px 22px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            fontSize: 16,
            cursor: 'pointer'
          }}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

export default ChatGeneral;