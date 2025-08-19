import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function ChatPrivado({ token, usuario, destinatario }) {
  const [mensajes, setMensajes] = useState([]);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensajeParpadeoId, setMensajeParpadeoId] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [editandoTexto, setEditandoTexto] = useState('');
  const [mensajeOriginal, setMensajeOriginal] = useState({});
  const [hoveredMsgId, setHoveredMsgId] = useState(null);

  const [usuariosEnLinea, setUsuariosEnLinea] = useState([]);
  const scrollRef = useRef(null);
  const socketRef = useRef(null);
  const usuariosEnLineaRef = useRef([]);

  // Estado en línea persistente por usuario
  const estadoInicial = localStorage.getItem(`enLinea_${usuario.id}`) === 'true';
  const [enLinea, setEnLinea] = useState(estadoInicial);

  const textareaRef = useRef(null);
  const editTextareaRef = useRef(null);

  // Cargar mensajes privados entre usuario y destinatario con mejor manejo de errores
  const fetchMensajes = async () => {
    console.log('fetchMensajes llamado:', {
      usuario_id: usuario.id,
      destinatario_id: destinatario?.id,
      destinatario
    });
    setCargando(true);
    setError('');
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/chat/private?usuario_id=${usuario.id}&destinatario_id=${destinatario.id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) {
        const text = await res.text();
        setMensajes([]);
        setError(`Error al cargar mensajes: ${res.status} - ${text}`);
        return;
      }
  const data = await res.json();
  setMensajes(Array.isArray(data) ? data : []);
    } catch (err) {
      setMensajes([]);
      setError('No se pudieron cargar los mensajes. ' + (err?.message || 'Error desconocido.'));
    } finally {
      setCargando(false);
    }
  };

  // Solo cargar mensajes al cambiar destinatario
  useEffect(() => {
    console.log('useEffect de destinatario/token ejecutado', { destinatario, token });
    if (destinatario?.id) {
      fetchMensajes();
    }
    // No hay polling ni intervalos
  }, [token, destinatario]);

  // Socket.IO para tiempo real (adaptado de ChatGeneral)
  useEffect(() => {
    socketRef.current = io(process.env.REACT_APP_API_URL.replace('/api', ''), {
      transports: ['websocket'],
      autoConnect: true,
      auth: { token }
    });

    socketRef.current.on('nuevo-mensaje-privado', (mensaje) => {
      // Solo agrega si es entre los dos usuarios
      if (
        (mensaje.remitente_id === usuario.id && mensaje.destinatario_id === destinatario.id) ||
        (mensaje.remitente_id === destinatario.id && mensaje.destinatario_id === usuario.id)
      ) {
        setMensajes(prev => [...prev, mensaje]);
        setAutoScroll(true);
      }
    });

    socketRef.current.on('mensaje-editado-privado', (msgEditado) => {
      setMensajes(prev =>
        prev.map(m =>
          m.id === msgEditado.id ? { ...m, ...msgEditado } : m
        )
      );
    });

    socketRef.current.on('usuarios-en-linea', (usuarios) => {
      setUsuariosEnLinea(usuarios);
      usuariosEnLineaRef.current = usuarios;
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('usuario-en-linea', {
        usuario_id: usuario.id,
        nombre: usuario.nombre,
        enLinea
      });
    });

    // Evento de borrado de mensaje privado
    socketRef.current.on('mensaje-borrado-privado', (mensajeId) => {
  console.log('Evento recibido: mensaje-borrado-privado', mensajeId);
  setMensajes(prev => prev.filter(m => String(m.id) !== String(mensajeId)));
    });

    return () => {
      if (enLinea) {
        socketRef.current.emit('usuario-en-linea', { usuario_id: usuario.id, nombre: usuario.nombre, enLinea: false });
      }
      socketRef.current.disconnect();
    };
  }, [token, usuario.id, usuario.nombre, destinatario, enLinea]);

  useEffect(() => {
    localStorage.setItem(`enLinea_${usuario.id}`, enLinea ? 'true' : 'false');
  }, [enLinea, usuario.id]);

  const cambiarEstadoLinea = (nuevoEstado) => {
    setEnLinea(nuevoEstado);
    if (socketRef.current) {
      socketRef.current.emit('usuario-en-linea', { usuario_id: usuario.id, nombre: usuario.nombre, enLinea: nuevoEstado });
    }
    toast[nuevoEstado ? 'success' : 'info'](
      nuevoEstado ? '¡Estás en línea!' : 'Ahora estás fuera de línea',
      { position: 'top-right', autoClose: 2500 }
    );
  };

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  };

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

  useEffect(() => {
    const mensajePendiente = localStorage.getItem('mensajePendiente');
    if (mensajePendiente) {
      setMensajeParpadeoId(Number(mensajePendiente));
      setTimeout(() => setMensajeParpadeoId(null), 2000);
      setTimeout(() => {
        const el = document.getElementById(`mensaje-${mensajePendiente}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      localStorage.removeItem('mensajePendiente');
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [mensajeTexto]);

  useEffect(() => {
    if (editandoId && editTextareaRef.current) {
      editTextareaRef.current.scrollTop = editTextareaRef.current.scrollHeight;
    }
  }, [editandoTexto, editandoId]);

  const enviarMensaje = async (e) => {
    if (e) e.preventDefault();
    const texto = mensajeTexto.trim();
    if (!texto) return;
    setError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/private`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          remitente_id: usuario.id,
          destinatario_id: destinatario.id,
          texto
        })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'No se pudo enviar el mensaje.');
        return;
      }
      setMensajeTexto('');
      setAutoScroll(true);
      // El mensaje llegará por socket en tiempo real
    } catch {
      setError('No se pudo enviar el mensaje.');
    }
  };

  const borrarMensaje = async (id) => {
    // Log para depuración
    const mensaje = mensajes.find(m => m.id === id);
    console.log('Intentando borrar mensaje:', { id, mensaje });
    if (!window.confirm('¿Seguro que quieres borrar este mensaje?')) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/private/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // El mensaje se eliminará por socket en tiempo real (evento emitido solo por el backend)
    } catch {
      setError('No se pudo borrar el mensaje.');
    }
  };

  const iniciarEdicion = (mensaje) => {
    setEditandoId(mensaje.id);
    setEditandoTexto(mensaje.texto);
    setMensajeOriginal(prev => ({ ...prev, [mensaje.id]: mensaje.texto }));
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditandoTexto('');
  };

  const guardarEdicion = async (id) => {
    if (!editandoTexto.trim()) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/private/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ texto: editandoTexto })
      });
      if (res.ok) {
        cancelarEdicion();
      }
    } catch {
      setError('No se pudo editar el mensaje.');
    }
  };

  const puedeBorrar = (msg) =>
    usuario.rol === 'supervisor' || usuario.id === msg.remitente_id;

  const puedeEditar = (msg) =>
    usuario.id === msg.remitente_id ||
    (usuario.rol === 'supervisor' && usuario.id === msg.remitente_id);

  return (
    <div>
      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
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
        {mensajes.map((msg) => (
          <div
            key={msg.id}
            id={`mensaje-${msg.id}`}
            className={msg.id === mensajeParpadeoId ? 'mensaje-parpadeo' : ''}
            style={{
              marginBottom: 12,
              background: msg.remitente_id === usuario.id ? '#e6f7ff' : '#fff',
              borderRadius: 6,
              padding: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              position: 'relative'
            }}
            onMouseEnter={() => setHoveredMsgId(msg.editado ? msg.id : null)}
            onMouseLeave={() => setHoveredMsgId(null)}
          >
            <div style={{ fontWeight: 'bold', color: '#007bff' }}>
              {msg.remitente_id === usuario.id ? usuario.nombre : destinatario.nombre}
            </div>
            <div style={{ position: 'relative' }}>
              {editandoId === msg.id ? (
                <>
                  <textarea
                    ref={editTextareaRef}
                    value={editandoTexto}
                    onChange={e => setEditandoTexto(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        guardarEdicion(msg.id);
                      }
                      if (e.key === 'Enter' && e.shiftKey) {
                        e.preventDefault();
                        setEditandoTexto(prev => prev + '\n');
                      }
                    }}
                    style={{
                      fontSize: 15,
                      padding: 10,
                      width: '80%',
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      resize: 'vertical',
                      minHeight: 80,
                      maxHeight: 220,
                      marginBottom: 8
                    }}
                  />
                  <button onClick={() => guardarEdicion(msg.id)} style={{ marginLeft: 6 }}>Guardar</button>
                  <button onClick={cancelarEdicion} style={{ marginLeft: 4 }}>Cancelar</button>
                </>
              ) : (
                <>
                  <div style={{ whiteSpace: 'pre-line' }}>
                    {msg.texto}
                  </div>
                  {msg.editado && (
                    <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>
                      (editado {msg.fecha_editado ? `- ${new Date(msg.fecha_editado).toLocaleTimeString()}` : ''}
                      {msg.texto_anterior && hoveredMsgId === msg.id && (
                        <> | <span style={{ color: '#d97706' }}>anterior: "{msg.texto_anterior}"</span></>
                      )}
                      )
                    </span>
                  )}
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {msg.fecha ? new Date(msg.fecha).toLocaleString() : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {msg.remitente_id === usuario.id && (
                <button
                  onClick={() => borrarMensaje(msg.id)}
                  style={{
                    fontSize: 13,
                    padding: '2px 6px',
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Borrar
                </button>
              )}
              {puedeEditar(msg) && (
                <button
                  onClick={() => iniciarEdicion(msg)}
                  style={{
                    fontSize: 13,
                    padding: '2px 6px',
                    background: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={enviarMensaje} style={{ display: 'flex', gap: 8 }}>
        <textarea
          ref={textareaRef}
          value={mensajeTexto}
          onChange={e => setMensajeTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              enviarMensaje(e);
            }
            if (e.key === 'Enter' && e.shiftKey) {
              e.preventDefault();
              setMensajeTexto(prev => prev + '\n');
            }
          }}
          placeholder="Escribe tu mensaje..."
          style={{
            flex: 1,
            padding: 14,
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: 17,
            resize: 'vertical',
            minHeight: 80,
            maxHeight: 220
          }}
        />
        <button
          type="submit"
          style={{
            padding: '14px 28px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            fontSize: 17,
            cursor: 'pointer'
          }}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

export default ChatPrivado;