import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Inicializa el socket UNA SOLA VEZ fuera del componente
const socketInstance = io(
  process.env.REACT_APP_API_URL.replace('/api', ''),
  {
    transports: ['websocket', 'polling'],
    autoConnect: true
  }
);

function ChatGeneral({ token, usuario }) {
  // Eliminado el código que borra la sesión al refrescar/cerrar la ventana
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
  const [usuariosEnLinea, setUsuariosEnLinea] = useState([]);
  const [adjuntosVisibles, setAdjuntosVisibles] = useState({});
  const [mostrarAdjuntos, setMostrarAdjuntos] = useState({});
  const scrollRef = useRef(null);
  const socketRef = useRef(socketInstance);
  const usuariosEnLineaRef = useRef([]);

  const estadoInicial = localStorage.getItem(`enLinea_${usuario.id}`) === 'true';
  const [enLinea, setEnLinea] = useState(estadoInicial);

  const textareaRef = useRef(null);
  const editTextareaRef = useRef(null);

  const fetchMensajes = async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/chat/group`, {
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

  useEffect(() => {
    socketRef.current.on('nuevo-mensaje', (mensaje) => {
      setMensajes(prev => {
        if (prev.some(m => m.id === mensaje.id)) return prev;
        return [...prev, mensaje];
      });
      setAutoScroll(true);
    });

    socketRef.current.on('mensaje-editado', (msgEditado) => {
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

    socketRef.current.on('chat-general-borrado', () => {
      setMensajes([]);
      toast.info('El chat general ha sido borrado.', {
        position: 'top-right',
        autoClose: 2500
      });
      console.log('Evento chat-general-borrado recibido');
    });

    socketRef.current.on('mensaje-borrado', (mensajeId) => {
      setMensajes(prev => prev.filter(m => String(m.id) !== String(mensajeId)));
    });

    // Actualización en tiempo real de adjuntos eliminados
    socketRef.current.on('adjunto-eliminado', ({ mensajeId, adjuntoIdx }) => {
      setMensajes(prev => prev.map(m => {
        if (m.id === mensajeId) {
          let nuevosAdjuntos = [];
          if (Array.isArray(m.archivo_url)) {
            nuevosAdjuntos = [...m.archivo_url];
            nuevosAdjuntos.splice(adjuntoIdx, 1);
          }
          return { ...m, archivo_url: nuevosAdjuntos };
        }
        return m;
      }));
      // Mantener la visibilidad de los adjuntos si ya estaba activa
      setMostrarAdjuntos(prev => ({ ...prev, [mensajeId]: true }));
    });

    return () => {
      socketRef.current.off('adjunto-eliminado');
    };
  }, [token, usuario.id, usuario.nombre, enLinea]);

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
    if (!texto && archivos.length === 0) return;
    setError('');
    try {
      const formData = new FormData();
      formData.append('usuario_id', usuario.id);
      formData.append('nombre_usuario', usuario.nombre);
      formData.append('texto', texto);
      archivos.forEach((archivo) => {
        formData.append('archivos', archivo);
      });
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/chat/group`, {
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
      await fetchMensajes();
    } catch {
      setError('No se pudo enviar el mensaje.');
    }
  };

  const borrarMensaje = async (id) => {
    if (!window.confirm('¿Seguro que quieres borrar este mensaje?')) return;
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/api/chat/group/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/chat/group/${id}`, {
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
    usuario.rol === 'supervisor' || usuario.id === msg.usuario_id;

  const puedeEditar = (msg) =>
    usuario.id === msg.usuario_id ||
    (usuario.rol === 'supervisor' && usuario.id === msg.usuario_id);

  // Construir la URL absoluta y codificada para el adjunto
  const getArchivoUrl = (archivo_url) => {
    if (!archivo_url) return null;
    // Si la URL ya es absoluta, la retorna
    if (archivo_url.startsWith('http')) return archivo_url;
    const baseUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:3001';
    // Codificar solo la parte del nombre de archivo
    const parts = archivo_url.split('/');
    const encodedFile = encodeURIComponent(parts.pop());
    return `${baseUrl}${parts.join('/')}/${encodedFile}`;
  };

  // Iconos unicode y emoji para tipos de archivo
const iconosArchivos = {
  pdf: <img src="/pdf-icon.png.png" alt="PDF" style={{ width: 22, height: 22, objectFit: 'contain', verticalAlign: 'middle' }} />, // PDF
  xml: '🟪', // XML
  doc: '📄', docx: '📄', // Word
  xls: '📊', xlsx: '📊', // Excel
  ppt: '📈', pptx: '📈', // PowerPoint
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', // Imagen
  zip: '🗜️', rar: '🗜️', '7z': '🗜️', // Comprimido
  txt: '📃', // Texto
  csv: '📑', // CSV
  default: '📁' // Otro
};

  // Función para alternar visibilidad de adjuntos por mensaje
const toggleAdjuntos = (id) => {
  setAdjuntosVisibles(prev => ({ ...prev, [id]: !prev[id] }));
};

  // Eliminar adjunto de mensaje antes de enviar
const eliminarAdjunto = (idx) => {
  setArchivos(prev => prev.filter((_, i) => i !== idx));
};

// Eliminar adjunto de mensaje ya enviado
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const eliminarAdjuntoMensaje = async (msgId, idx) => {
  const mensaje = mensajes.find(m => m.id === msgId);
  const nombre = mensaje && Array.isArray(mensaje.archivo_url) ? nombreArchivo(mensaje.archivo_url[idx]) : '';
  if (!window.confirm(`¿Seguro que quieres eliminar el archivo "${nombre}"?`)) return;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/chat/group/eliminar-adjunto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ mensajeId: msgId, adjuntoIdx: idx })
    });
    if (!res.ok) {
      alert('Error al eliminar adjunto');
      fetchMensajes();
      return;
    }
    // Espera a que el socket actualice los adjuntos
    setTimeout(() => {
      // Mantener la visibilidad de los adjuntos si ya estaba activa
      setMostrarAdjuntos(prev => ({ ...prev, [msgId]: true }));
      // Si solo quedaba un adjunto y se eliminó, ahora el array está vacío
      const m = mensajes.find(m => m.id === msgId);
      if (m && (!m.texto || m.texto.trim() === '') && (!m.archivo_url || m.archivo_url.length === 1)) {
        borrarMensaje(msgId);
      }
    }, 400);
  } catch (err) {
    alert('Error al eliminar adjunto');
    fetchMensajes();
  }
};

// Devuelve el nombre del archivo desde la url
function nombreArchivo(url) {
  if (!url) return '';
  const partes = url.split('/');
  return partes[partes.length - 1];
}

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
          height: 500, // más larga la ventana del chat
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
              background: msg.usuario_id === usuario.id ? '#e6f7ff' : '#fff',
              borderRadius: 6,
              padding: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              position: 'relative'
            }}
            onMouseEnter={() => setHoveredMsgId(msg.editado ? msg.id : null)}
            onMouseLeave={() => setHoveredMsgId(null)}
          >
            <div style={{ fontWeight: 'bold', color: '#007bff' }}>
              {msg.nombre_usuario || msg.nombre || msg.autor || 'Desconocido'}
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
                  {/* Botón para mostrar/ocultar adjuntos por mensaje */}
                  {msg.archivo_url && msg.archivo_url.length > 0 && (
                    <span
                      onClick={() => setMostrarAdjuntos(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                      style={{ textDecoration: 'underline', color: '#007bff', cursor: 'pointer', fontSize: 13, marginBottom: 4, display: 'inline-block' }}
                    >
                      {mostrarAdjuntos[msg.id] ? 'Ocultar adjuntos' : 'Mostrar adjuntos'}
                    </span>
                  )}
                  {msg.archivo_url && msg.archivo_url.length > 0 && mostrarAdjuntos[msg.id] && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                      {msg.archivo_url.map((archivo, idx) => {
                        const ext = archivo.split('.').pop().toLowerCase();
                        let icon;
                        if (ext === 'pdf') {
                          icon = <img src="/pdf-icon.png.png" alt="PDF" style={{ width: 22, height: 22, objectFit: 'contain', verticalAlign: 'middle', cursor: 'pointer' }} title={nombreArchivo(archivo)} onClick={() => window.open(getArchivoUrl(archivo), '_blank', 'noopener,noreferrer,width=800,height=600')} />;
                        } else if (["jpg","jpeg","png","gif","bmp","webp"].includes(ext)) {
                          icon = <img src="/simbolo-de-interfaz-de-imagenes.png" alt="Imagen" style={{ width: 22, height: 22, objectFit: 'contain', verticalAlign: 'middle', cursor: 'pointer' }} title={nombreArchivo(archivo)} onClick={() => window.open(getArchivoUrl(archivo), '_blank', 'noopener,noreferrer,width=800,height=600')} />;
                        } else {
                          icon = <span style={{ fontSize: 22, cursor: 'pointer' }} title={nombreArchivo(archivo)} onClick={() => window.open(getArchivoUrl(archivo), '_blank', 'noopener,noreferrer,width=800,height=600')}>{iconosArchivos[ext] || iconosArchivos.default}</span>;
                        }
                        return (
                          <div key={archivo + idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', minHeight: 28 }}>
                            {icon}
                            <span style={{ fontSize: 12, color: '#444', marginLeft: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180, display: 'inline-block', verticalAlign: 'middle' }}>
                              {nombreArchivo(archivo)}
                            </span>
                            {(usuario.rol === 'supervisor' || usuario.id === msg.usuario_id) && (
                              <button
                                type="button"
                                onClick={() => eliminarAdjuntoMensaje(msg.id, idx)}
                                style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 12, marginLeft: 4 }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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
      <form onSubmit={enviarMensaje} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', width: '50%' }}>
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
        {/* Mostrar archivos seleccionados antes de enviar */}
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

export default ChatGeneral;