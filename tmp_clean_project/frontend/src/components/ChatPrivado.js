import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Construir la URL absoluta y codificada para el adjunto
const getArchivoUrl = (archivo_url) => {
  if (!archivo_url) return null;
  if (archivo_url.startsWith('http')) return archivo_url;
  const baseUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:3001';
  const parts = archivo_url.split('/');
  const encodedFile = encodeURIComponent(parts.pop());
  return `${baseUrl}${parts.join('/')}/${encodedFile}`;
};

function ChatPrivado({ token, usuario, socket, destinatario, onVolver }) {
  // Estado para controlar la visibilidad de los adjuntos por mensaje
  const [mostrarAdjuntos, setMostrarAdjuntos] = useState({});
  const [modalArchivo, setModalArchivo] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [archivos, setArchivos] = useState([]);
  const archivoInputRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensajeParpadeoId, setMensajeParpadeoId] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [editandoTexto, setEditandoTexto] = useState('');
  const [mensajeOriginal, setMensajeOriginal] = useState({});
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [noLeidos, setNoLeidos] = useState(0);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const editTextareaRef = useRef(null);

  // Cargar mensajes privados entre usuario y destinatario
  const fetchMensajes = async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/chat/private?usuario_id=${usuario.id}&destinatario_id=${destinatario.id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
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
    if (destinatario?.id) fetchMensajes();
    setNoLeidos(0);
    // Marca como leídos en el backend al abrir el chat
    if (destinatario?.id) {
      fetch(`${process.env.REACT_APP_API_URL}/api/chat/private/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          usuario_id: usuario.id,
          remitente_id: destinatario.id
        })
      });
    }
  }, [token, destinatario?.id]);

  useEffect(() => {
    if (!socket) return;

    // Unirse a la room del usuario para recibir eventos privados
    if (usuario?.id) {
     socket.emit('join', usuario.id.toString());
    }

    const handleNuevoMensajePrivado = (mensaje) => {
      if (
        (mensaje.remitente_id === usuario.id && mensaje.destinatario_id === destinatario.id) ||
        (mensaje.remitente_id === destinatario.id && mensaje.destinatario_id === usuario.id)
      ) {
        setMensajes(prev => {
          if (prev.some(m => m.id === mensaje.id)) return prev;
          return [...prev, mensaje];
        });
        setAutoScroll(true);
        if (mensaje.remitente_id === destinatario.id) {
          setNoLeidos(prev => prev + 1);
        }
      }
    };

    const handleMensajeEditadoPrivado = (msgEditado) => {
      setMensajes(prev =>
        prev.map(m =>
          m.id === msgEditado.id ? { ...m, ...msgEditado } : m
        )
      );
    };

    const handleMensajeBorradoPrivado = (data) => {
      setMensajes(prev => prev.filter(m => m.id !== Number(data.id)));
    };

    // Listener para adjunto eliminado en tiempo real
    const handleAdjuntoEliminadoPrivado = ({ mensajeId, adjuntoIdx }) => {
      setMensajes(prev =>
        prev.map(m =>
          m.id === mensajeId
            ? { ...m, archivo_url: Array.isArray(m.archivo_url) ? m.archivo_url.filter((_, i) => i !== adjuntoIdx) : m.archivo_url }
            : m
        )
      );
      setMostrarAdjuntos(prev => ({ ...prev, [mensajeId]: true }));
    };

    socket.on('nuevo-mensaje-privado', handleNuevoMensajePrivado);
    socket.on('mensaje-editado-privado', handleMensajeEditadoPrivado);
    socket.on('mensaje-borrado-privado', handleMensajeBorradoPrivado);
    socket.on('adjunto-eliminado-privado', handleAdjuntoEliminadoPrivado);

    socket.emit('usuario-en-linea', {
      usuario_id: usuario.id,
      nombre: usuario.nombre,
      enLinea: true
    });

    return () => {
      socket.off('nuevo-mensaje-privado', handleNuevoMensajePrivado);
      socket.off('mensaje-editado-privado', handleMensajeEditadoPrivado);
      socket.off('mensaje-borrado-privado', handleMensajeBorradoPrivado);
      socket.off('adjunto-eliminado-privado', handleAdjuntoEliminadoPrivado);
    };
  }, [socket, usuario.id, destinatario?.id]);

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

  const enviarMensaje = async (e) => {
    if (e) e.preventDefault();
    const texto = mensajeTexto.trim();
    if (!texto && archivos.length === 0) return;
    setError('');
    try {
      const formData = new FormData();
      formData.append('remitente_id', usuario.id);
      formData.append('destinatario_id', destinatario.id);
      formData.append('texto', texto);
      archivos.forEach((archivo) => {
        formData.append('archivos', archivo);
      });

      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/chat/private`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'No se pudo enviar el mensaje.');
        return;
      }
      setMensajeTexto('');
      setArchivos([]);
      if (archivoInputRef.current) archivoInputRef.current.value = '';
      setAutoScroll(true);
      fetchMensajes();
    } catch {
      setError('No se pudo enviar el mensaje.');
    }
  };

  const eliminarAdjunto = (idx) => {
    setArchivos(prev => prev.filter((_, i) => i !== idx));
  };

  // Eliminar adjunto de mensaje ya enviado
  const puedeBorrar = (msg) => usuario.id === msg.remitente_id;

  const borrarAdjuntoDeMensaje = async (msgId, adjuntoIdx) => {
    const mensaje = mensajes.find(m => m.id === msgId);
    if (!mensaje) return;
    if (!puedeBorrar(mensaje)) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/chat/privado/eliminar-adjunto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mensajeId: msgId, adjuntoIdx })
      });
      if (res.ok) {
        fetchMensajes();
        setMostrarAdjuntos(prev => ({ ...prev, [msgId]: true }));
      } else {
        toast.error('No se pudo borrar el adjunto.');
      }
    } catch {
      toast.error('No se pudo borrar el adjunto.');
    }
  };

  const borrarMensaje = async (id) => {
    if (!window.confirm('¿Seguro que quieres borrar este mensaje?')) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/chat/private/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        if (socket) {
          socket.emit('mensaje-borrado-privado', { id });
        }
        setMensajes(prev => prev.filter(m => m.id !== id));
      }
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
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/chat/private/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ texto: editandoTexto })
      });
      if (res.ok) {
        cancelarEdicion();
        fetchMensajes();
      }
    } catch {
      setError('No se pudo editar el mensaje.');
    }
  };

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
      <button
        onClick={onVolver}
        style={{
          marginBottom: 12,
          padding: '8px 18px',
          background: '#eee',
          color: '#333',
          border: '1px solid #bbb',
          borderRadius: 6,
          fontWeight: 'bold',
          fontSize: 16,
          cursor: 'pointer'
        }}
      >
        Volver
      </button>
      <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>
        {destinatario?.nombre}
        {noLeidos > 0 && (
          <span style={{
            marginLeft: 8,
            background: '#dc3545',
            color: '#fff',
            borderRadius: '50%',
            padding: '2px 8px',
            fontSize: 14,
            fontWeight: 'bold'
          }}>
            {noLeidos}
          </span>
        )}
      </div>
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
                  {/* Mostrar adjuntos del mensaje */}
                  {Array.isArray(msg.archivo_url) && msg.archivo_url.length > 0 && (
                    <>
                      <span
                        style={{
                          color: '#007bff',
                          textDecoration: 'underline',
                          fontSize: '1em',
                          cursor: 'pointer',
                          fontWeight: 'normal',
                          marginBottom: 4,
                          display: 'inline-block'
                        }}
                        onClick={() => setMostrarAdjuntos(prev => ({
                          ...prev,
                          [msg.id]: !prev[msg.id]
                        }))}
                      >
                        {mostrarAdjuntos[msg.id] ? 'Contraer adjuntos ▲' : `Ver adjuntos (${msg.archivo_url.length}) ▼`}
                      </span>
                      {mostrarAdjuntos[msg.id] && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                          {msg.archivo_url.map((archivo, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                title={archivo.nombre || archivo}
                                style={{ cursor: 'pointer' }}
                                onClick={() => window.open(getArchivoUrl(archivo.url || archivo), '_blank', 'noopener,noreferrer,width=800,height=600')}
                              >
                                {(() => {
                                  const ext = (archivo.nombre || archivo).split('.').pop().toLowerCase();
                                  if (ext === 'pdf') return <img src="/pdf-icon.png.png" alt="PDF" style={{ width: 24, height: 24 }} />;
                                  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return <img src="/simbolo-de-interfaz-de-imagenes.png" alt="IMG" style={{ width: 24, height: 24 }} />;
                                  return <span style={{ fontSize: 24 }}>📄</span>;
                                })()}
                              </span>
                              <span
                                style={{
                                  color: '#007bff',
                                  textDecoration: 'underline',
                                  fontSize: '1em',
                                  cursor: 'pointer',
                                  fontWeight: 'normal'
                                }}
                                onClick={() => window.open(getArchivoUrl(archivo.url || archivo), '_blank', 'noopener,noreferrer,width=800,height=600')}
                              >
                                {archivo.nombre || archivo}
                              </span>
                              {/* Botón para borrar adjunto si el usuario es el remitente */}
                              {puedeBorrar(msg) && (
                                <button
                                  type="button"
                                  title="Borrar adjunto"
                                  style={{
                                    background: 'transparent',
                                    color: '#dc3545',
                                    border: 'none',
                                    borderRadius: '50%',
                                    padding: '0 8px',
                                    cursor: 'pointer',
                                    fontSize: 18,
                                    lineHeight: 1,
                                    fontWeight: 'bold'
                                  }}
                                  onClick={() => borrarAdjuntoDeMensaje(msg.id, idx)}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {msg.fecha ? new Date(msg.fecha).toLocaleString() : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {puedeBorrar(msg) && (
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
      <form onSubmit={enviarMensaje} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', width: '100%' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            ref={textareaRef}
            value={mensajeTexto}
            onChange={e => setMensajeTexto(e.target.value)}
            onKeyDown={e => {
              if ((e.key === 'Enter' && !e.shiftKey) && (mensajeTexto.trim() || archivos.length > 0)) {
                enviarMensaje(e);
              }
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                setMensajeTexto(prev => prev + '\n');
              }
            }}
            placeholder="Escribe tu mensaje..."
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 6,
              border: '1px solid #ccc',
              fontSize: 17,
              resize: 'vertical',
              minHeight: 80,
              maxHeight: 220,
              flex: 1,
              height: 120
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
              cursor: 'pointer',
              alignSelf: 'flex-end',
              height: 120
            }}
          >
            Enviar
          </button>
        </div>
        <input
          type="file"
          accept="*"
          ref={archivoInputRef}
          multiple
          onChange={e => setArchivos(Array.from(e.target.files))}
          style={{ margin: '8px 0', alignSelf: 'flex-start' }}
        />
        {archivos.length > 0 && (
          <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {archivos.map((archivo, idx) => (
              <div key={archivo.name + idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>{archivo.name}</span>
                <button
                  type="button"
                  onClick={() => eliminarAdjunto(idx)}
                  style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 13 }}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}

export default ChatPrivado;