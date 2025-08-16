import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Genera un color HEX único a partir de un string (nombre o id)
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).slice(-2);
  }
  return color;
}

function ChatGeneral({ token, usuario }) {
  const [mensajes, setMensajes] = useState([]);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensajeParpadeoId, setMensajeParpadeoId] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [editTexto, setEditTexto] = useState('');
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
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

    socket.on('mensaje-borrado', (id) => {
      setMensajes(prev => prev.filter(msg => msg.id !== id));
    });

    socket.on('mensaje-editado', (msgEditado) => {
      setMensajes(prev =>
        prev.map(msg =>
          msg.id === msgEditado.id
            ? {
                ...msg,
                texto: msgEditado.texto,
                editado: msgEditado.editado,
                fecha_edicion: msgEditado.fecha_edicion,
                texto_original: msgEditado.texto_original
              }
            : msg
        )
      );
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

  // Borrar mensaje
  const borrarMensaje = async (id) => {
    if (!window.confirm('¿Seguro que quieres borrar este mensaje?')) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/group/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMensajes(prev => prev.filter(msg => msg.id !== id));
      } else {
        setError('No se pudo borrar el mensaje.');
      }
    } catch {
      setError('No se pudo borrar el mensaje.');
    }
  };

  // Editar mensaje
  const iniciarEdicion = (msg) => {
    setEditandoId(msg.id);
    setEditTexto(msg.texto);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditTexto('');
  };

  const guardarEdicion = async (id) => {
    const texto = editTexto.trim();
    if (!texto) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/group/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ texto })
      });
      if (res.ok) {
        const data = await res.json();
        setMensajes(prev =>
          prev.map(msg =>
            msg.id === id
              ? {
                  ...msg,
                  texto,
                  editado: true,
                  fecha_edicion: data.fecha_edicion,
                  texto_original: msg.texto
                }
              : msg
          )
        );
        cancelarEdicion();
      } else {
        setError('No se pudo editar el mensaje.');
      }
    } catch {
      setError('No se pudo editar el mensaje.');
    }
  };

  // Permisos para editar/borrar
  const puedeEditar = (msg) => {
    if (usuario.rol === 'supervisor') return msg.usuario_id === usuario.id;
    return msg.usuario_id === usuario.id;
  };
  const puedeBorrar = (msg) => {
    if (usuario.rol === 'supervisor') return true;
    return msg.usuario_id === usuario.id;
  };

  // Tooltip para texto original
  const renderTooltip = (msg) => {
    if (msg.editado && msg.texto_original) {
      return (
        hoveredMsgId === msg.id && (
          <div
            style={{
              position: 'absolute',
              top: '-32px',
              left: 0,
              background: '#333',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 14,
              zIndex: 10,
              whiteSpace: 'pre-wrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            <strong>Texto original:</strong> {msg.texto_original}
          </div>
        )
      );
    }
    return null;
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
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              position: 'relative'
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                color: stringToColor(msg.nombre_usuario || msg.nombre || msg.autor || 'Desconocido')
              }}
            >
              {msg.nombre_usuario || msg.nombre || msg.autor || 'Desconocido'}
            </div>
            {editandoId === msg.id ? (
              <div style={{ margin: '8px 0' }}>
                <input
                  type="text"
                  value={editTexto}
                  onChange={e => setEditTexto(e.target.value)}
                  style={{ width: '80%', fontSize: 16, padding: 4 }}
                />
                <button
                  style={{ marginLeft: 8, fontSize: 15 }}
                  onClick={() => guardarEdicion(msg.id)}
                >
                  Guardar
                </button>
                <button
                  style={{ marginLeft: 4, fontSize: 15 }}
                  onClick={cancelarEdicion}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div
                style={{ position: 'relative', display: 'inline-block' }}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
              >
                {msg.texto}
                {msg.editado && (
                  <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>
                    (editado {msg.fecha_edicion ? new Date(msg.fecha_edicion).toLocaleString() : ''})
                  </span>
                )}
                {renderTooltip(msg)}
              </div>
            )}
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {msg.fecha ? new Date(msg.fecha).toLocaleString() : ''}
            </div>
            <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
              {puedeEditar(msg) && (
                <button
                  style={{ fontSize: 13, padding: '2px 8px' }}
                  onClick={() => iniciarEdicion(msg)}
                >
                  Editar
                </button>
              )}
              {puedeBorrar(msg) && (
                <button
                  style={{ fontSize: 13, padding: '2px 8px', color: '#dc3545' }}
                  onClick={() => borrarMensaje(msg.id)}
                >
                  Borrar
                </button>
              )}
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
      {/* Solo NO supervisores ven el botón */}
      {usuario.rol !== 'supervisor' && (
        <button
          style={{
            width: 400,
            padding: '15px 0',
            background: 'rgb(220, 53, 69)',
            color: 'rgb(255, 255, 255)',
            border: '2px solid rgb(34, 34, 34)',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: 21,
            marginTop: 18
          }}
        >
          Borrar chat general
        </button>
      )}
    </div>
  );
}

export default ChatGeneral;