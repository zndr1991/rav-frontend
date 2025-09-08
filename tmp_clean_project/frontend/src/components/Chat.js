import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchChat, sendMessage, deleteMessage, editMessage, getFileUrl, deleteFile, initSocket, getSocket } from '../api';

function Chat({ token, user }) {
  const inputMensajeRef = useRef(null);
    useEffect(() => {
      if (inputMensajeRef.current) {
        console.log('Input montado, valor actual:', inputMensajeRef.current.value);
      }
    }, []);
    // Escuchar foco de ventana / visibilitychange para reenfocar el input — imita minimizar/restaurar
    useEffect(() => {
      const tryFocus = () => {
        try {
          if (window && typeof window.__forceChatFocus === 'function') {
            window.__forceChatFocus();
            return;
          }
        } catch (e) {}
        if (inputMensajeRef.current) {
          try { inputMensajeRef.current.focus(); } catch (e) {}
        }
      };

      const onFocus = () => tryFocus();
      const onVisibility = () => { if (!document.hidden) tryFocus(); };

      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibility);

      return () => {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }, []);
  const [mensajes, setMensajes] = useState([]);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [archivos, setArchivos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null);
  const [editTexto, setEditTexto] = useState('');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [conectado, setConectado] = useState(false);
  const [archivosExpandidos, setArchivosExpandidos] = useState({});
  const [modoDiagnostico, setModoDiagnostico] = useState(false);
  const [mensajesRaw, setMensajesRaw] = useState([]);
  const [scrollAutomatico, setScrollAutomatico] = useState(true);
  const [historialEdiciones, setHistorialEdiciones] = useState({});
  const [ultimoMensajeId, setUltimoMensajeId] = useState(null);

  const scrollRef = useRef(null);
  const cargandoRef = useRef(false);
  const socketRef = useRef(null);
  const actualizacionProgramadaRef = useRef(null);
  const usuarioScrolleando = useRef(false);
  const ultimaAlturaScroll = useRef(0);
  const tooltipRef = useRef(null);
  const mensajesRef = useRef(mensajes);
  const ultimoNotificadoRef = useRef(null); // NUEVO: evita notificaciones duplicadas

  useEffect(() => {
    mensajesRef.current = mensajes;
  }, [mensajes]);

  // ========== SISTEMA DE NOTIFICACIONES ==========
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          console.log("✅ Permisos de notificación concedidos");
        }
      });
    }
  }, []);

  const mostrarNotificacion = (mensaje) => {
    // Evita notificar si el mensaje es tuyo
    if (Number(mensaje.de_usuario) === Number(user?.id)) return;
    // Evita notificar dos veces el mismo mensaje
    if (ultimoNotificadoRef.current === mensaje.id) return;
    ultimoNotificadoRef.current = mensaje.id;

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const titulo = `💬 ${mensaje.autor || 'Nuevo mensaje'}`;
        const notificacion = new Notification(titulo, {
          body: mensaje.mensaje || "📎 Archivo adjunto",
          icon: "/favicon.ico",
          requireInteraction: true
        });
        notificacion.onclick = () => {
          window.focus();
          notificacion.close();
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        };
      } catch (error) {
        console.error("❌ Error creando notificación:", error);
      }
    }
  };
  // ========== FIN SISTEMA DE NOTIFICACIONES ==========

  const esAdministrador = () => {
    return user && (user.rol === 'admin' || user.rol === 'supervisor' || user.rol === 'administrador');
  };

  const cargarMensajes = useCallback(async (silencioso = false) => {
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    if (!silencioso) setCargando(true);

    try {
      const data = await fetchChat(token);
      if (Array.isArray(data)) {
        setMensajesRaw(data);
        const mensajesOrdenados = [...data].sort((a, b) =>
          new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        );
        setMensajes(mensajesOrdenados);
        setUltimaActualizacion(new Date().toLocaleTimeString());
      }
    } catch (err) {
      if (!silencioso) {
        setError(`Error al cargar mensajes: ${err.message}`);
      }
    } finally {
      if (!silencioso) setCargando(false);
      cargandoRef.current = false;
      // Enfocar el input de mensaje después de recargar mensajes
      setTimeout(() => {
        if (inputMensajeRef.current) inputMensajeRef.current.focus();
      }, 100);
    }
  }, [token]);

  // ========== CONFIGURACIÓN DEL SOCKET Y CONEXIÓN INICIAL ==========
  useEffect(() => {
    cargarMensajes();
    const intervalId = setInterval(() => {
      if (!cargandoRef.current) {
        cargarMensajes(true);
      }
    }, 2500);

    let socket = getSocket();
    if (!socket) {
      socket = initSocket(token);
      console.log("📡 Creando nueva conexión Socket.IO...");
    }
if (socket) {
  socketRef.current = socket;
  setConectado(socket.connected);
  if (!socket.connected) {
    socket.connect();
    console.log("🔄 Intentando conectar socket...");
  }

  // ⚡️ Siempre limpia antes de agregar
  socket.off('connect');
  socket.off('disconnect');
        setTimeout(() => {
          if (inputMensajeRef.current) {
            inputMensajeRef.current.focus();
            console.log('Foco tras recarga. Valor actual:', inputMensajeRef.current.value);
          } else {
            console.log('Input no disponible tras recarga');
          }
        }, 100);
  socket.off('connect_error');

  socket.on('connect', () => {
    setConectado(true);
  });
  socket.on('disconnect', () => {
    setConectado(false);
  });
  socket.on('nuevo-mensaje', (datosNuevoMensaje) => {
    mostrarNotificacion(datosNuevoMensaje);
    cargarMensajes(true);
  });
  socket.on('mensaje-eliminado', () => {
    cargarMensajes(true);
  });
  socket.on('mensaje-editado', () => {
    cargarMensajes(true);
  });
  socket.on('connect_error', (error) => {
    console.error("❌ Error de conexión:", error.message);
  });
} else {
  console.error("❌ No se pudo crear el socket");
  setConectado(false);
}

    const checkConnectionId = setInterval(() => {
      const currentSocket = getSocket();
      if (currentSocket) {
        const isConnected = currentSocket.connected;
        setConectado(isConnected);

        if (!isConnected && !currentSocket.connecting) {
          currentSocket.connect();
        }
      }
    }, 3000);

    const historialGuardado = localStorage.getItem('historial_ediciones');
    if (historialGuardado) {
      try {
        setHistorialEdiciones(JSON.parse(historialGuardado));
      } catch (err) {
        localStorage.removeItem('historial_ediciones');
      }
    }

    return () => {
      clearInterval(intervalId);
      clearInterval(checkConnectionId);
      if (actualizacionProgramadaRef.current) {
        clearTimeout(actualizacionProgramadaRef.current);
      }
      if (socketRef.current) {
        socketRef.current.off('nuevo-mensaje');
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('mensaje-eliminado');
        socketRef.current.off('mensaje-editado');
        socketRef.current.off('connect_error');
      }
    };
  }, [token]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const chatContainer = scrollRef.current;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const estaEnElFondo = Math.abs(scrollHeight - clientHeight - scrollTop) < 20;
      if (estaEnElFondo !== scrollAutomatico) {
        setScrollAutomatico(estaEnElFondo);
      }
      ultimaAlturaScroll.current = scrollTop;
      usuarioScrolleando.current = true;
      setTimeout(() => { usuarioScrolleando.current = false; }, 100);
    };
    chatContainer.addEventListener('scroll', handleScroll);
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [scrollAutomatico]);

  useEffect(() => {
    if (!scrollRef.current || mensajes.length === 0) return;
    if (!usuarioScrolleando.current && scrollAutomatico) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, scrollAutomatico]);

  const agruparMensajes = () => {
    if (!mensajes.length) return [];
    if (modoDiagnostico) {
      return mensajes.map(msg => [msg]);
    }
    const grupos = [];
    let grupoActual = [mensajes[0]];
    const VENTANA_TIEMPO_MS = 1000;
    for (let i = 1; i < mensajes.length; i++) {
      const mensajeActual = mensajes[i];
      const mensajeAnterior = mensajes[i-1];
      const mismoAutor = mensajeActual.de_usuario === mensajeAnterior.de_usuario;
      const tiempoCercano = Math.abs(
        new Date(mensajeActual.fecha).getTime() - 
        new Date(mensajeAnterior.fecha).getTime()
      ) < VENTANA_TIEMPO_MS;
      const esArchivoSinTexto = 
        (mensajeActual.archivo_nombre && (!mensajeActual.mensaje || mensajeActual.mensaje.trim() === '')) ||
        (mensajeAnterior.archivo_nombre && (!mensajeAnterior.mensaje || mensajeAnterior.mensaje.trim() === ''));
      if (mismoAutor && tiempoCercano && esArchivoSinTexto) {
        grupoActual.push(mensajeActual);
      } else {
        grupos.push([...grupoActual]);
        grupoActual = [mensajeActual];
      }
    }
    grupos.push(grupoActual);
    return grupos;
  };

  const enviarMensaje = async (e) => {
    e.preventDefault();
    const texto = mensajeTexto.trim();
    if (!texto && archivos.length === 0) return;
    setEnviando(true);
    try {
      const resultado = await sendMessage(texto, token, archivos);
      if (resultado && resultado.error) {
        setError(`Error al enviar: ${resultado.error}`);
      } else {
        setMensajeTexto('');
        setArchivos([]);
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.value = '';
        setScrollAutomatico(true);
        setTimeout(() => cargarMensajes(), 500);
      }
    } catch (err) {
      setError(`Error al enviar: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const eliminarMensaje = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este mensaje?')) return;
    // No tocar el estado 'enviando' aquí, solo manejar el borrado
    try {
      const resultado = await deleteMessage(id, token);
      if (resultado && resultado.error) {
        setError(`Error al eliminar: ${resultado.error}`);
      } else {
        setMensajes(prev => prev.filter(m => m.id !== id));
        setTimeout(() => cargarMensajes(true), 500);
        // Enfocar el input de mensaje después de borrar
          setTimeout(() => {
            if (inputMensajeRef.current) {
              inputMensajeRef.current.focus();
              console.log('Foco tras borrar. Valor actual:', inputMensajeRef.current.value);
            } else {
              console.log('Input no disponible tras borrar');
            }
          }, 700); // Espera a que termine la recarga
          // Intento adicional agresivo para Electron: llamar al helper inyectado o forzar blur/focus/click
          setTimeout(() => {
            try {
              if (window && typeof window.__forceChatFocus === 'function') {
                window.__forceChatFocus();
                console.log('Llamada a window.__forceChatFocus() tras borrar.');
              } else {
                // Forzar foco a la ventana y al input
                if (window && typeof window.focus === 'function') window.focus();
                const ta = inputMensajeRef.current;
                if (ta) {
                  try { ta.blur && ta.blur(); } catch(e){}
                  setTimeout(() => {
                    try { ta.focus && ta.focus(); } catch(e){}
                    try { ta.click && ta.click(); } catch(e){}
                    console.log('Intento agresivo de focus ejecutado.');
                  }, 120);
                }
              }
            } catch (e) {
              console.error('Error en intento agresivo de focus:', e);
            }
          }, 900);
      }
    } catch (err) {
      setError(`Error al eliminar: ${err.message}`);
    }
  };

  const eliminarArchivo = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este archivo?')) return;
    try {
      const resultado = await deleteFile(id, token);
      if (resultado && resultado.error) {
        setError(`Error al eliminar archivo: ${resultado.error}`);
      } else {
        setTimeout(() => cargarMensajes(), 500);
      }
    } catch (err) {
      setError(`Error al eliminar archivo: ${err.message}`);
    }
  };

  const eliminarTodosArchivos = async (archivos) => {
    if (!window.confirm(`¿Seguro que deseas eliminar todos los archivos (${archivos.length})?`)) return;
    setCargando(true);
    let errores = 0;
    try {
      for (const archivo of archivos) {
        try {
          await deleteFile(archivo.mensaje_id, token);
        } catch (err) {
          errores++;
        }
      }
      if (errores > 0) setError(`Hubo problemas al eliminar ${errores} archivos.`);
      setTimeout(() => cargarMensajes(), 500);
    } catch (err) {
      setError(`Error general: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const iniciarEdicion = (mensaje) => {
    setEditando(mensaje.id);
    setEditTexto(mensaje.mensaje || '');
  };

  const guardarEdicion = async () => {
    if (!editTexto.trim()) return;
    try {
      const mensajeOriginal = mensajes.find(m => m.id === editando);
      if (!mensajeOriginal) return;
      const resultado = await editMessage(editando, editTexto, token);
      if (resultado && resultado.error) {
        setError(`Error al editar: ${resultado.error}`);
      } else {
        const nuevaEdicion = {
          textoOriginal: mensajeOriginal.mensaje || '',
          textoEditado: editTexto,
          fechaEdicion: new Date().toISOString(),
          editadoPor: user.id
        };
        const nuevoHistorial = {
          ...historialEdiciones,
          [editando]: nuevaEdicion
        };
        setHistorialEdiciones(nuevoHistorial);
        localStorage.setItem('historial_ediciones', JSON.stringify(nuevoHistorial));
        setMensajes(prev => 
          prev.map(m => 
            m.id === editando ? {...m, mensaje: editTexto} : m
          )
        );
        setTimeout(() => cargarMensajes(true), 500);
        cancelarEdicion();
      }
    } catch (err) {
      setError(`Error al editar: ${err.message}`);
    }
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setEditTexto('');
  };

  const mostrarTooltip = (e, mensajeId) => {
    const edicion = historialEdiciones[mensajeId];
    if (!edicion) return;
    const tooltip = document.createElement('div');
    tooltip.className = 'mensaje-tooltip';
    tooltip.innerHTML = `
      <div style="
        position: absolute;
        background-color: #34495e;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        max-width: 300px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      ">
        <div><strong>Mensaje original:</strong></div>
        <div style="margin-top: 5px;">${edicion.textoOriginal || '<sin texto>'}</div>
      </div>
    `;
    const rect = e.target.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;
    if (tooltipRef.current) {
      document.body.removeChild(tooltipRef.current);
    }
    document.body.appendChild(tooltip);
    tooltipRef.current = tooltip;
  };
  
  const ocultarTooltip = () => {
    if (tooltipRef.current) {
      document.body.removeChild(tooltipRef.current);
      tooltipRef.current = null;
    }
  };

  const forzarReconexion = async () => {
    try {
      const socket = getSocket();
      if (socket) socket.disconnect();
      const nuevoSocket = initSocket(token);
      if (nuevoSocket) {
        setConectado(nuevoSocket.connected);
        nuevoSocket.on('connect', () => setConectado(true));
        nuevoSocket.on('disconnect', () => setConectado(false));
        nuevoSocket.on('nuevo-mensaje', () => {
          cargarMensajes(true);
        });
      }
      await cargarMensajes();
    } catch (err) {
      setError(`Error al reconectar: ${err.message}`);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setArchivos(Array.from(e.target.files));
    } else {
      setArchivos([]);
    }
  };

  const eliminarArchivoSeleccionado = (index) => {
    const nuevoArchivos = [...archivos];
    nuevoArchivos.splice(index, 1);
    setArchivos(nuevoArchivos);
  };
  
  const toggleArchivosExpandidos = (id) => {
    setArchivosExpandidos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleModoDiagnostico = () => {
    setModoDiagnostico(!modoDiagnostico);
  };

  const forzarScrollAbajo = () => {
    if (scrollRef.current) {
      setScrollAutomatico(true);
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const puedeBorrar = (msg) => user && (user.id === msg.de_usuario || user.rol === 'supervisor' || user.rol === 'admin' || user.rol === 'administrador');
  const puedeEditar = (msg) => user && user.id === msg.de_usuario;
  const fueEditado = (mensajeId) => historialEdiciones[mensajeId] !== undefined;
  const obtenerHoraEdicion = (mensajeId) => {
    const edicion = historialEdiciones[mensajeId];
    if (!edicion) return '';
    try {
      const fecha = new Date(edicion.fechaEdicion);
      return fecha.toLocaleTimeString();
    } catch (err) {
      return '';
    }
  };
  const esImagen = (nombre) => {
    if (!nombre) return false;
    const ext = nombre.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  };
  const esPDF = (nombre) => {
    if (!nombre) return false;
    return nombre.split('.').pop().toLowerCase() === 'pdf';
  };

  const renderizarMensajeIndividual = (msg) => (
    <div 
      key={msg.id}
      style={{
        padding: '10px',
        margin: '8px 0',
        borderRadius: '5px',
        border: '1px solid #ddd',
        backgroundColor: '#fff8e6',
      }}
    >
      <div style={{fontWeight: 'bold'}}>
        ID: {msg.id} | {msg.autor}:
      </div>
      <div style={{marginTop: '5px'}}>
        Mensaje: {msg.mensaje || '<sin texto>'}
      </div>
      {msg.archivo_nombre && (
        <div style={{marginTop: '5px'}}>
          Archivo: {msg.archivo_nombre}
        </div>
      )}
      <div style={{
        marginTop: '5px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8em',
        color: '#666'
      }}>
        <div>Fecha: {new Date(msg.fecha).toLocaleString()}</div>
        <div>Usuario ID: {msg.de_usuario}</div>
      </div>
    </div>
  );

  const renderizarGrupo = (grupo) => {
    if (!grupo || grupo.length === 0) return null;
    if (modoDiagnostico) {
      return renderizarMensajeIndividual(grupo[0]);
    }
    const mensajePrincipal = grupo.find(m => m.mensaje && m.mensaje.trim() !== '') || grupo[0];
    const archivosGrupo = grupo.filter(m => m.archivo_nombre).map(m => ({
      id: m.id,
      nombre: m.archivo_nombre,
      de_usuario: m.de_usuario,
      mensaje_id: m.id
    }));
    const mostrarExpandidos = archivosExpandidos[mensajePrincipal.id] || false;
    const mensajeEditado = fueEditado(mensajePrincipal.id);
    const horaEdicion = obtenerHoraEdicion(mensajePrincipal.id);

    return (
      <div 
        key={mensajePrincipal.id}
        style={{
          padding: '12px',
          margin: '8px 0',
          borderRadius: '5px',
          border: '1px solid #ddd',
          backgroundColor: mensajePrincipal.de_usuario === user?.id ? '#e6f7ff' : '#fff',
        }}
      >
        <div style={{fontWeight: 'bold'}}>
          {mensajePrincipal.autor}:
        </div>
        {editando === mensajePrincipal.id ? (
          <div style={{marginTop: '8px'}}>
            <textarea
              value={editTexto}
              onChange={e => setEditTexto(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                minHeight: '60px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{marginTop: '8px'}}>
              <button
                onClick={guardarEdicion}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  marginRight: '8px'
                }}
              >
                Guardar
              </button>
              <button
                onClick={cancelarEdicion}
                style={{
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          mensajePrincipal.mensaje && (
            <div style={{marginTop: '8px', position: 'relative'}}>
              <span 
                className="mensaje-texto"
                onMouseEnter={mensajeEditado ? (e) => mostrarTooltip(e, mensajePrincipal.id) : null}
                onMouseLeave={mensajeEditado ? ocultarTooltip : null}
                style={{
                  display: 'inline-block',
                  cursor: mensajeEditado ? 'help' : 'default',
                  borderBottom: mensajeEditado ? '1px dashed #999' : 'none',
                }}
              >
                {mensajePrincipal.mensaje}
              </span>
              {mensajeEditado && (
                <span style={{
                  marginLeft: '6px',
                  color: '#777',
                  fontSize: '0.85em',
                  fontStyle: 'italic'
                }}>
                  (editado a las {horaEdicion})
                </span>
              )}
            </div>
          )
        )}
        {archivosGrupo.length > 0 && (
          <div style={{marginTop: '10px'}}>
            {!mostrarExpandidos ? (
              <button
                onClick={() => toggleArchivosExpandidos(mensajePrincipal.id)}
                style={{
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span style={{fontSize: '16px'}}>📎</span>
                {archivosGrupo.length === 1 
                  ? 'Ver archivo adjunto'
                  : `Ver archivos adjuntos (${archivosGrupo.length})`}
              </button>
            ) : (
              <div style={{
                backgroundColor: '#f5f5f5',
                padding: '10px',
                borderRadius: '5px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  alignItems: 'center'
                }}>
                  <h4 style={{margin: 0}}>
                    {archivosGrupo.length === 1 
                      ? 'Archivo adjunto' 
                      : `Archivos adjuntos (${archivosGrupo.length})`}
                  </h4>
                  <div style={{display: 'flex', gap: '8px'}}>
                    {archivosGrupo.length > 1 && puedeBorrar({de_usuario: mensajePrincipal.de_usuario}) && (
                      <button
                        onClick={() => eliminarTodosArchivos(archivosGrupo)}
                        style={{
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Eliminar todos
                      </button>
                    )}
                    <button
                      onClick={() => toggleArchivosExpandidos(mensajePrincipal.id)}
                      style={{
                        backgroundColor: '#95a5a6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Ocultar archivos
                    </button>
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '15px'
                }}>
                  {archivosGrupo.map((archivo, index) => (
                    <div key={`${archivo.id}-${index}`} style={{position: 'relative'}}>
                      {puedeBorrar({de_usuario: archivo.de_usuario}) && (
                        <button
                          onClick={() => eliminarArchivo(archivo.mensaje_id)}
                          style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            zIndex: 10,
                            backgroundColor: 'rgba(231, 76, 60, 0.8)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '25px',
                            height: '25px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          ✕
                        </button>
                      )}
                      {esImagen(archivo.nombre) ? (
                        <a 
                          href={getFileUrl(archivo.nombre)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <img 
                            src={getFileUrl(archivo.nombre)} 
                            alt="Imagen adjunta" 
                            style={{
                              maxWidth: '180px',
                              maxHeight: '140px',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          />
                        </a>
                      ) : esPDF(archivo.nombre) ? (
                        <a 
                          href={getFileUrl(archivo.nombre)} 
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100px',
                            height: '100px',
                            backgroundColor: '#f8f9fa',
                            border: '1px solid #ddd',
                            borderRadius: '5px',
                            textDecoration: 'none',
                            color: '#e74c3c'
                          }}
                        >
                          <span style={{fontSize: '32px'}}>📄</span>
                          <span style={{marginTop: '5px', fontSize: '12px'}}>PDF</span>
                        </a>
                      ) : (
                        <a 
                          href={getFileUrl(archivo.nombre)} 
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100px',
                            height: '100px',
                            backgroundColor: '#f8f9fa',
                            border: '1px solid #ddd',
                            borderRadius: '5px',
                            textDecoration: 'none',
                            color: '#2c3e50'
                          }}
                        >
                          <span style={{fontSize: '32px'}}>📎</span>
                          <span style={{marginTop: '5px', fontSize: '12px'}}>Archivo</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{
          marginTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #eee',
          paddingTop: '8px'
        }}>
          <div style={{color: '#777', fontSize: '0.9em'}}>
            {new Date(mensajePrincipal.fecha).toLocaleString()}
          </div>
          <div>
            {puedeEditar(mensajePrincipal) && editando !== mensajePrincipal.id && (
              <button
                onClick={() => iniciarEdicion(mensajePrincipal)}
                style={{
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  marginRight: '8px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✏️ Editar
              </button>
            )}
            {puedeBorrar(mensajePrincipal) && (
              <button
                onClick={() => eliminarMensaje(mensajePrincipal.id)}
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🗑️ Borrar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const mensajesAgrupados = agruparMensajes();

  return (
    <div>
      <h2 style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
      }}>
        <span>Chat General {modoDiagnostico ? '(Modo Diagnóstico)' : ''}</span>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: '14px',
          gap: '10px',
          color: conectado ? '#4CAF50' : '#e74c3c'
        }}>
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: conectado ? '#4CAF50' : '#e74c3c',
            display: 'inline-block'
          }}></span>
          {conectado ? 'Conectado' : 'Desconectado'}
          {!conectado && esAdministrador() && (
            <button 
              onClick={forzarReconexion}
              style={{
                fontSize: '12px',
                padding: '3px 8px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reconectar
            </button>
          )}
        </div>
      </h2>
      
      {/* Indicador de notificaciones */}
      {"Notification" in window && (
        <div style={{
          padding: '5px 10px',
          backgroundColor: Notification.permission === "granted" ? '#d4edda' : 
                         Notification.permission === "denied" ? '#f8d7da' : '#fff3cd',
          color: Notification.permission === "granted" ? '#155724' : 
                Notification.permission === "denied" ? '#721c24' : '#856404',
          borderRadius: '4px',
          marginBottom: '10px',
          fontSize: '12px',
          border: `1px solid ${
            Notification.permission === "granted" ? '#c3e6cb' : 
            Notification.permission === "denied" ? '#f5c6cb' : '#ffeeba'
          }`
        }}>
          🔔 Notificaciones: {
            Notification.permission === "granted" ? "Activadas ✓" :
            Notification.permission === "denied" ? "Bloqueadas ✗ (Actívalas en configuración del navegador)" :
            "No configuradas (Se solicitará permiso)"
          }
        </div>
      )}

      {esAdministrador() && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f0f8ff',
          borderRadius: '4px',
          marginBottom: '15px',
          fontSize: '14px',
          border: '1px solid #b8daff'
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <strong>Diagnóstico:</strong> {mensajes.length} mensajes cargados | 
              {modoDiagnostico ? (
                <span style={{color: '#e74c3c', fontWeight: 'bold'}}> Modo diagnóstico activado</span>
              ) : (
                <span> {mensajesAgrupados.length} grupos visualizados</span>
              )}
            </div>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
              {ultimaActualizacion && (
                <span>Última actualización: {ultimaActualizacion}</span>
              )}
              <button
                onClick={toggleModoDiagnostico}
                style={{
                  backgroundColor: modoDiagnostico ? '#e74c3c' : '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {modoDiagnostico ? 'Desactivar diagnóstico' : 'Activar diagnóstico'}
              </button>
            </div>
          </div>
          <div style={{marginTop: '8px', fontSize: '13px'}}>
            <span>
              {mensajesRaw.filter(m => m.mensaje && m.mensaje.trim() !== '').length} con texto |
              {mensajesRaw.filter(m => m.archivo_nombre).length} con archivos |
              IDs: {mensajesRaw.map(m => m.id).join(', ')}
            </span>
          </div>
        </div>
      )}
      <div style={{position: 'relative'}}>
        <div 
          ref={scrollRef} 
          id="chat-container"
          style={{
            height: '400px',
            overflowY: 'auto',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '10px',
            marginBottom: '20px',
            backgroundColor: '#f9f9f9'
          }}
        >
          {cargando && (
            <div style={{
              textAlign: 'center',
              padding: '10px',
              color: '#3498db'
            }}>
              Actualizando mensajes...
            </div>
          )}
          <div>
            {mensajesAgrupados.length > 0 ? (
              mensajesAgrupados.map((grupo, index) => (
                <div key={index}>{renderizarGrupo(grupo)}</div>
              ))
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '40px 0',
                color: '#777'
              }}>
                No hay mensajes disponibles
              </div>
            )}
          </div>
        </div>
        {!scrollAutomatico && mensajesAgrupados.length > 10 && (
          <button
            onClick={forzarScrollAbajo}
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '20px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              zIndex: 10,
              fontSize: '20px'
            }}
            title="Ir al final"
          >
            ↓
          </button>
        )}
      </div>
      <form onSubmit={enviarMensaje} style={{marginTop: '20px'}}>
        <div style={{marginBottom: '10px'}}>
          <input
            ref={inputMensajeRef}
            type="text"
            value={mensajeTexto}
            onChange={e => setMensajeTexto(e.target.value)}
            placeholder="Escribe tu mensaje..."
            style={{
              width: '70%',
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #ddd',
              marginRight: '10px'
            }}
            disabled={enviando}
          />
          <button
            type="submit"
            disabled={enviando || (!mensajeTexto.trim() && archivos.length === 0)}
            style={{
              padding: '10px 20px',
              backgroundColor: enviando ? '#cccccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: (enviando || (!mensajeTexto.trim() && archivos.length === 0)) ? 'not-allowed' : 'pointer'
            }}
          >
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
        <div>
          <input
            id="fileInput"
            type="file"
            onChange={handleFileChange}
            multiple
            style={{marginBottom: '10px'}}
            disabled={enviando}
          />
          {archivos.length > 0 && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '5px'
            }}>
              <strong>Archivos seleccionados ({archivos.length}):</strong>
              <ul style={{margin: '5px 0', paddingLeft: '20px'}}>
                {archivos.map((file, index) => (
                  <li key={index} style={{margin: '5px 0'}}>
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    <button
                      type="button"
                      onClick={() => eliminarArchivoSeleccionado(index)}
                      style={{
                        marginLeft: '10px',
                        color: 'red',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </form>
      {/* Workaround: Botón para forzar el enfoque del input en Electron */}
      <button
        type="button"
        onClick={() => {
          if (inputMensajeRef.current) {
            inputMensajeRef.current.focus();
          }
        }}
        style={{
          marginTop: '10px',
          padding: '8px 16px',
          backgroundColor: '#ff9800',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Forzar enfoque en el input
      </button>
      {error && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '5px',
          color: '#721c24'
        }}>
          {error}
          <button 
            onClick={() => setError(null)} 
            style={{
              float: 'right',
              background: 'none',
              border: 'none',
              color: '#721c24',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}
      {esAdministrador() && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '10px',
          marginTop: '20px'
        }}>
          <button
            onClick={() => cargarMensajes()}
            disabled={cargando}
            style={{
              padding: '8px 16px',
              backgroundColor: cargando ? '#cccccc' : '#7f8c8d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: cargando ? 'not-allowed' : 'pointer'
            }}
          >
            {cargando ? 'Actualizando...' : 'Recargar mensajes'}
          </button>
          <button
            onClick={forzarReconexion}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Forzar reconexión
          </button>
        </div>
      )}
      {modoDiagnostico && esAdministrador() && (
        <div style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#ffe8d6',
          borderRadius: '5px',
          border: '1px solid #ffb38a'
        }}>
          <h3>Datos crudos recibidos de la API</h3>
          <pre style={{
            backgroundColor: '#fff',
            padding: '10px',
            borderRadius: '4px',
            overflowX: 'auto',
            fontSize: '12px'
          }}>
            {JSON.stringify(mensajesRaw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default Chat;