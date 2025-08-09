import React, { useState, useEffect, useRef } from 'react';
import { 
  fetchPrivateChat, 
  sendPrivateMessage, 
  deleteMessage, 
  editMessage, 
  getFileUrl, 
  deleteFile, 
  markMessagesAsRead, 
  initSocket, 
  getSocket,
  deletePrivateAttachments
} from '../api';

function PrivateChat({ token, user, recipient, onBack }) {
  // Estados básicos
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
  const [historialEdiciones, setHistorialEdiciones] = useState({});
  const [scrollAutomatico, setScrollAutomatico] = useState(true);
  const [gruposArchivos, setGruposArchivos] = useState({}); // Mapa para agrupar archivos por timestamp
  
  // Referencias
  const scrollRef = useRef(null);
  const cargandoRef = useRef(false);
  const socketRef = useRef(null);
  const actualizacionProgramadaRef = useRef(null);
  const usuarioScrolleando = useRef(false);
  const ultimaAlturaScroll = useRef(0);
  const tooltipRef = useRef(null);

  // Identificar grupos de archivos cuando cambia la lista de mensajes
  useEffect(() => {
    if (!mensajes.length) return;
    
    // Encuentra grupos de mensajes con archivos enviados en el mismo minuto
    const grupos = {};
    const mensajesConArchivo = mensajes.filter(m => m.archivo_nombre);
    
    mensajesConArchivo.forEach(mensaje => {
      const timestamp = new Date(mensaje.fecha).getTime();
      const minuto = Math.floor(timestamp / 30000); // Agrupar por cada 30 segundos
      const clave = `${mensaje.de_usuario}-${minuto}`;
      
      if (!grupos[clave]) {
        grupos[clave] = [];
      }
      grupos[clave].push(mensaje);
    });
    
    // Solo mantener grupos con más de 1 mensaje
    Object.keys(grupos).forEach(key => {
      if (grupos[key].length <= 1) {
        delete grupos[key];
      }
    });
    
    setGruposArchivos(grupos);
  }, [mensajes]);

  // Cargar mensajes y configurar socket
  useEffect(() => {
    if (!recipient) return;
    
    // Cargar mensajes iniciales
    cargarMensajes();
    
    // Marcar mensajes como leídos cuando se abre la conversación
    markMessagesAsRead(token, recipient.id).catch(err => 
      console.error('Error al marcar mensajes como leídos:', err)
    );
    
    // Configurar actualizaciones periódicas
    const intervalId = setInterval(() => {
      if (!cargandoRef.current) {
        cargarMensajes(true); // silencioso
      }
    }, 3000);
    
    // Configurar socket para actualizaciones en tiempo real
    const socket = getSocket() || initSocket(token);
    if (socket) {
      socketRef.current = socket;
      setConectado(socket.connected);
      
      // Escuchar mensajes privados
      socket.on('mensaje-privado', (data) => {
        // Verificar si el mensaje es de la conversación actual
        if (data.de_usuario === recipient.id || data.para_usuario === recipient.id) {
          console.log("Mensaje privado recibido en la conversación actual");
          cargarMensajes(true);
          
          // Marcar como leído si es un mensaje entrante
          if (data.de_usuario === recipient.id) {
            markMessagesAsRead(token, recipient.id).catch(err => 
              console.error('Error al marcar mensajes como leídos:', err)
            );
          }
        }
      });
      
      // Escuchar eventos de edición de mensajes
      socket.on('mensaje-editado', (data) => {
        if (data.mensaje && (
          data.mensaje.de_usuario === recipient.id || 
          data.mensaje.para_usuario === recipient.id
        )) {
          cargarMensajes(true);
        }
      });
    }
    
    // Cargar el historial de ediciones desde localStorage
    const historialGuardadoKey = `historial_ediciones_private_${recipient.id}`;
    const historialGuardado = localStorage.getItem(historialGuardadoKey);
    if (historialGuardado) {
      try {
        setHistorialEdiciones(JSON.parse(historialGuardado));
      } catch (err) {
        console.error("Error al cargar historial de ediciones:", err);
        localStorage.removeItem(historialGuardadoKey);
      }
    }
    
    // Limpiar
    return () => {
      clearInterval(intervalId);
      if (actualizacionProgramadaRef.current) {
        clearTimeout(actualizacionProgramadaRef.current);
      }
    };
  }, [token, recipient]);

  // Detectar cuando el usuario hace scroll manualmente
  useEffect(() => {
    if (!scrollRef.current) return;
    
    const chatContainer = scrollRef.current;
    
    // Función para detectar scroll manual
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const estaEnElFondo = Math.abs(scrollHeight - clientHeight - scrollTop) < 20;
      
      // Solo cambiar scrollAutomatico si hay un cambio real
      if (estaEnElFondo !== scrollAutomatico) {
        setScrollAutomatico(estaEnElFondo);
      }
      
      ultimaAlturaScroll.current = scrollTop;
      usuarioScrolleando.current = true;
      
      // Resetear la bandera después de un tiempo
      setTimeout(() => {
        usuarioScrolleando.current = false;
      }, 100);
    };
    
    chatContainer.addEventListener('scroll', handleScroll);
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [scrollAutomatico]);

  // Control de scroll mejorado para nuevos mensajes
  useEffect(() => {
    if (!scrollRef.current || mensajes.length === 0) return;
    
    // Solo hacer scroll automático si:
    // 1. El usuario no está haciendo scroll activamente
    // 2. Ya estamos al final del chat O está configurado el scroll automático
    if (!usuarioScrolleando.current && scrollAutomatico) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, scrollAutomatico]);

  // Cargar mensajes desde la API
  const cargarMensajes = async (silencioso = false) => {
    if (!recipient) return;
    
    // Prevenir múltiples solicitudes simultáneas
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    
    if (!silencioso) setCargando(true);
    
    try {
      const data = await fetchPrivateChat(token, recipient.id);
      
      if (Array.isArray(data)) {
        // Ordenar mensajes por fecha
        const mensajesOrdenados = [...data].sort((a, b) => 
          new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        );
        
        // Actualizar estado
        setMensajes(mensajesOrdenados);
        setUltimaActualizacion(new Date().toLocaleTimeString());
        
        // Marcar como leídos si hay nuevos mensajes
        const hayMensajesNoLeidos = mensajesOrdenados.some(m => 
          m.de_usuario === recipient.id && !m.leido
        );
        
        if (hayMensajesNoLeidos) {
          markMessagesAsRead(token, recipient.id).catch(err => 
            console.error('Error al marcar mensajes como leídos:', err)
          );
        }
      } else if (data.error && !silencioso) {
        console.error("Error en respuesta:", data);
        setError(`Error: ${data.error}`);
      }
    } catch (err) {
      if (!silencioso) {
        console.error("Error cargando mensajes privados:", err);
        setError(`Error al cargar mensajes: ${err.message}`);
      }
    } finally {
      if (!silencioso) setCargando(false);
      cargandoRef.current = false;
    }
  };

  // Enviar mensaje
  const enviarMensaje = async (e) => {
    e.preventDefault();
    
    const texto = mensajeTexto.trim();
    if (!texto && archivos.length === 0) return;
    
    setEnviando(true);
    
    try {
      const resultado = await sendPrivateMessage(texto, token, recipient.id, archivos);
      
      if (resultado && resultado.error) {
        console.error("Error al enviar mensaje privado:", resultado.error);
        setError(`Error al enviar: ${resultado.error}`);
      } else {
        // Limpiar formulario
        setMensajeTexto('');
        setArchivos([]);
        
        // Limpiar input de archivos
        const fileInput = document.getElementById('fileInput-private');
        if (fileInput) fileInput.value = '';
        
        // Reactivar scroll automático al enviar un mensaje
        setScrollAutomatico(true);
        
        // Recargar mensajes después de un breve retraso
        setTimeout(() => cargarMensajes(), 500);
      }
    } catch (err) {
      console.error("Error en enviarMensaje:", err);
      setError(`Error al enviar: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  // Eliminar mensaje
  const eliminarMensaje = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este mensaje?')) return;
    
    try {
      const resultado = await deleteMessage(id, token);
      
      if (resultado && resultado.error) {
        setError(`Error al eliminar: ${resultado.error}`);
      } else {
        // Eliminar localmente y recargar para confirmar
        setMensajes(prev => prev.filter(m => m.id !== id));
        setTimeout(() => cargarMensajes(true), 500);
      }
    } catch (err) {
      setError(`Error al eliminar: ${err.message}`);
    }
  };

  // Eliminar archivo
  const eliminarArchivo = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este archivo?')) return;
    
    try {
      const resultado = await deleteFile(id, token);
      
      if (resultado && resultado.error) {
        setError(`Error al eliminar archivo: ${resultado.error}`);
      } else {
        // Recargar mensajes después de eliminar
        setTimeout(() => cargarMensajes(), 500);
      }
    } catch (err) {
      setError(`Error al eliminar archivo: ${err.message}`);
    }
  };

  // Eliminar todos los archivos de un grupo - CORREGIDO
  const eliminarTodosLosArchivos = async (grupo) => {
    if (!grupo || grupo.length === 0) {
      setError("No se encontró ningún grupo de archivos para eliminar");
      return;
    }
    
    if (!window.confirm(`¿Seguro que deseas eliminar todos los archivos (${grupo.length})?`)) {
      return;
    }
    
    try {
      setError(null); // Limpiar errores previos
      
      // Usar el primer mensaje como referencia
      const mensaje = grupo[0];
      const timestamp = mensaje.fecha;
      const usuarioId = mensaje.para_usuario === user.id ? mensaje.de_usuario : mensaje.para_usuario;
      
      console.log(`Eliminando grupo de ${grupo.length} archivos con timestamp: ${timestamp}`);
      
      const requestBody = {
        timestamp: timestamp,
        usuario_id: usuarioId,
        grupo_id: `${mensaje.de_usuario}-${new Date(mensaje.fecha).getTime()}` // Identificador único del grupo
      };
      
      // Realizar la solicitud con un objeto plano (evitar FormData)
      const response = await fetch(`http://localhost:3001/api/chat/privado/archivos`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify(requestBody)
      });
      
      // Primero verificamos el status HTTP
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error HTTP ${response.status}:`, errorText);
        throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      }
      
      // Ahora intentamos parsear la respuesta JSON
      try {
        const resultado = await response.json();
        
        if (resultado.error) {
          setError(`Error al eliminar archivos: ${resultado.error}`);
        } else {
          console.log("Resultado de eliminar grupo de archivos:", resultado);
          
          // Éxito: recargar mensajes para actualizar la UI
          setTimeout(() => cargarMensajes(), 500);
        }
      } catch (jsonError) {
        console.error("Error al procesar la respuesta JSON:", jsonError);
        throw new Error("Error: El servidor respondió con un formato inesperado");
      }
    } catch (err) {
      console.error("Error en eliminarTodosLosArchivos:", err);
      setError(`Error al eliminar archivos: ${err.message}`);
    }
  };

  // Iniciar edición de mensaje
  const iniciarEdicion = (mensaje) => {
    setEditando(mensaje.id);
    setEditTexto(mensaje.mensaje || '');
  };

  // Guardar mensaje editado
  const guardarEdicion = async () => {
    if (!editTexto.trim()) return;
    
    try {
      // Buscar el mensaje original para guardar su texto antes de editar
      const mensajeOriginal = mensajes.find(m => m.id === editando);
      if (!mensajeOriginal) return;
      
      const resultado = await editMessage(editando, editTexto, token);
      
      if (resultado && resultado.error) {
        setError(`Error al editar: ${resultado.error}`);
      } else {
        // Guardar historial de edición
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
        
        // Actualizar el estado y guardar en localStorage
        setHistorialEdiciones(nuevoHistorial);
        const historialGuardadoKey = `historial_ediciones_private_${recipient.id}`;
        localStorage.setItem(historialGuardadoKey, JSON.stringify(nuevoHistorial));
        
        // Actualizar localmente
        setMensajes(prev => 
          prev.map(m => 
            m.id === editando ? {...m, mensaje: editTexto} : m
          )
        );
        
        // Recargar para confirmar
        setTimeout(() => cargarMensajes(true), 500);
        
        // Salir del modo edición
        cancelarEdicion();
      }
    } catch (err) {
      setError(`Error al editar: ${err.message}`);
    }
  };

  // Cancelar edición
  const cancelarEdicion = () => {
    setEditando(null);
    setEditTexto('');
  };

  // Mostrar tooltip personalizado con el texto original
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
    
    // Posicionar tooltip cerca del cursor
    const rect = e.target.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;
    
    // Eliminar tooltip anterior si existe
    if (tooltipRef.current) {
      document.body.removeChild(tooltipRef.current);
    }
    
    // Añadir nuevo tooltip al DOM
    document.body.appendChild(tooltip);
    tooltipRef.current = tooltip;
  };
  
  // Ocultar tooltip
  const ocultarTooltip = () => {
    if (tooltipRef.current) {
      document.body.removeChild(tooltipRef.current);
      tooltipRef.current = null;
    }
  };

  // Manejar selección de archivos
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setArchivos(Array.from(e.target.files));
    } else {
      setArchivos([]);
    }
  };

  // Eliminar archivo de la selección
  const eliminarArchivoSeleccionado = (index) => {
    const nuevoArchivos = [...archivos];
    nuevoArchivos.splice(index, 1);
    setArchivos(nuevoArchivos);
  };

  // Forzar scroll hacia abajo
  const forzarScrollAbajo = () => {
    if (scrollRef.current) {
      setScrollAutomatico(true);
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Verificar permisos
  const puedeBorrar = (msg) => user && (user.id === msg.de_usuario || user.rol === 'admin' || user.rol === 'supervisor' || user.rol === 'administrador');
  const puedeEditar = (msg) => user && user.id === msg.de_usuario;
  
  // Verificar si un mensaje ha sido editado
  const fueEditado = (mensajeId) => {
    return historialEdiciones[mensajeId] !== undefined;
  };
  
  // Obtener hora de edición formateada
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
  
  // Determinar tipo de archivo
  const esImagen = (nombre) => {
    if (!nombre) return false;
    const ext = nombre.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  };
  
  const esPDF = (nombre) => {
    if (!nombre) return false;
    return nombre.split('.').pop().toLowerCase() === 'pdf';
  };
  
  // Comprobar si un mensaje pertenece a un grupo de archivos
  const esParteDe = (mensaje) => {
    if (!mensaje.archivo_nombre) return false;
    
    // Buscar en qué grupo está este mensaje
    for (const key in gruposArchivos) {
      const grupo = gruposArchivos[key];
      if (grupo.some(m => m.id === mensaje.id) && grupo.length > 1) {
        return key; // Devuelve la clave del grupo
      }
    }
    
    return false; // No pertenece a ningún grupo o es un grupo de 1
  };

  // Si no hay destinatario, mostrar mensaje
  if (!recipient) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        Seleccione un usuario para iniciar una conversación privada.
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={onBack}
            style={{
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            ← Volver
          </button>
          <h2 style={{ margin: 0 }}>
            Chat con {recipient.nombre}
            {(recipient.rol === 'admin' || recipient.rol === 'supervisor' || recipient.rol === 'administrador') && 
              <span style={{ 
                fontSize: '14px',
                backgroundColor: '#3498db',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                marginLeft: '8px',
                verticalAlign: 'middle'
              }}>
                Admin
              </span>
            }
          </h2>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: '14px',
          gap: '10px',
          color: conectado ? '#4CAF50' : '#e74c3c'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: conectado ? '#4CAF50' : '#e74c3c',
            display: 'inline-block'
          }}></span>
          {conectado ? 'Conectado' : 'Desconectado'}
        </div>
      </div>

      {/* Área de mensajes con indicador de scroll */}
      <div style={{position: 'relative'}}>
        <div 
          ref={scrollRef} 
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
              Cargando mensajes...
            </div>
          )}
          
          {mensajes.length === 0 && !cargando ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 0',
              color: '#777'
            }}>
              No hay mensajes en esta conversación.
              <br />
              <span style={{ fontSize: '14px' }}>
                Envía un mensaje para comenzar a chatear.
              </span>
            </div>
          ) : (
            // Renderizar mensajes, saltando los que sean parte de un grupo (excepto el primero)
            mensajes.map((mensaje, index) => {
              const grupoKey = esParteDe(mensaje);
              
              // Si el mensaje pertenece a un grupo y no es el primero del grupo, no lo renderizamos aquí
              if (grupoKey) {
                const grupo = gruposArchivos[grupoKey];
                const esPrimero = grupo[0].id === mensaje.id;
                
                if (esPrimero) {
                  // Renderizar el grupo completo
                  return (
                    <div 
                      key={`grupo-${grupoKey}`}
                      style={{
                        padding: '12px',
                        margin: '8px 0',
                        borderRadius: '10px',
                        maxWidth: '75%',
                        marginLeft: mensaje.de_usuario === user.id ? 'auto' : '0',
                        marginRight: mensaje.de_usuario === user.id ? '0' : 'auto',
                        backgroundColor: mensaje.de_usuario === user.id ? '#dcf8c6' : '#f2f2f2',
                        boxShadow: '0px 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      {/* Mostrar mensaje de texto si existe */}
                      {mensaje.mensaje && (
                        <div style={{marginBottom: '10px', wordBreak: 'break-word'}}>
                          {mensaje.mensaje}
                        </div>
                      )}
                      
                      {/* Mostrar todos los archivos del grupo */}
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px',
                        justifyContent: 'flex-start'
                      }}>
                        {grupo.map(m => (
                          <div key={m.id} style={{position: 'relative'}}>
                            {esImagen(m.archivo_nombre) ? (
                              <a 
                                href={getFileUrl(m.archivo_nombre)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <img 
                                  src={getFileUrl(m.archivo_nombre)} 
                                  alt="Imagen adjunta" 
                                  style={{
                                    maxWidth: '120px',
                                    maxHeight: '120px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                  }}
                                />
                              </a>
                            ) : esPDF(m.archivo_nombre) ? (
                              <a 
                                href={getFileUrl(m.archivo_nombre)} 
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '80px',
                                  height: '80px',
                                  backgroundColor: '#f8f9fa',
                                  border: '1px solid #ddd',
                                  borderRadius: '5px',
                                  textDecoration: 'none',
                                  color: '#e74c3c'
                                }}
                              >
                                <span style={{fontSize: '24px'}}>📄</span>
                                <span style={{marginTop: '5px', fontSize: '10px'}}>PDF</span>
                              </a>
                            ) : (
                              <a 
                                href={getFileUrl(m.archivo_nombre)} 
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '80px',
                                  height: '80px',
                                  backgroundColor: '#f8f9fa',
                                  border: '1px solid #ddd',
                                  borderRadius: '5px',
                                  textDecoration: 'none',
                                  color: '#2c3e50'
                                }}
                              >
                                <span style={{fontSize: '24px'}}>📎</span>
                                <span style={{marginTop: '5px', fontSize: '10px', textAlign: 'center', wordBreak: 'break-all'}}>
                                  {m.archivo_nombre.length > 10 
                                    ? m.archivo_nombre.substring(0, 8) + '...' 
                                    : m.archivo_nombre}
                                </span>
                              </a>
                            )}
                            
                            {/* Botón para eliminar archivo individual */}
                            {puedeBorrar(m) && (
                              <button
                                onClick={() => eliminarArchivo(m.id)}
                                style={{
                                  position: 'absolute',
                                  top: '2px',
                                  right: '2px',
                                  backgroundColor: 'rgba(231, 76, 60, 0.8)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '20px',
                                  height: '20px',
                                  fontSize: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {/* Botones para acciones de grupo */}
                      {puedeBorrar(mensaje) && (
                        <div style={{ 
                          marginTop: '10px', 
                          textAlign: 'center',
                          borderTop: '1px solid rgba(0,0,0,0.1)',
                          paddingTop: '8px'
                        }}>
                          <button
                            onClick={() => eliminarTodosLosArchivos(grupo)}
                            style={{
                              backgroundColor: '#c0392b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '5px 10px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Eliminar todos
                          </button>
                        </div>
                      )}
                      
                      {/* Fecha del mensaje */}
                      <div style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        color: '#777',
                        textAlign: 'right'
                      }}>
                        {new Date(mensaje.fecha).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                }
                
                // Si no es el primero, saltamos este mensaje (ya está incluido en el grupo)
                return null;
              }
              
              // Renderizar mensaje individual (no parte de un grupo)
              return (
                <div 
                  key={mensaje.id}
                  style={{
                    padding: '12px',
                    margin: '8px 0',
                    borderRadius: '10px',
                    maxWidth: '75%',
                    alignSelf: mensaje.de_usuario === user.id ? 'flex-end' : 'flex-start',
                    marginLeft: mensaje.de_usuario === user.id ? 'auto' : '0',
                    marginRight: mensaje.de_usuario === user.id ? '0' : 'auto',
                    backgroundColor: mensaje.de_usuario === user.id ? '#dcf8c6' : '#f2f2f2',
                    boxShadow: '0px 1px 3px rgba(0,0,0,0.1)',
                    display: 'block'
                  }}
                >
                  {/* Contenido */}
                  {editando === mensaje.id ? (
                    <div>
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
                      <div style={{marginTop: '8px', display: 'flex', gap: '5px'}}>
                        <button
                          onClick={guardarEdicion}
                          style={{
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            flex: '1'
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
                            cursor: 'pointer',
                            flex: '1'
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {mensaje.mensaje && (
                        <div style={{position: 'relative'}}>
                          {/* Mensaje con tooltip para ver contenido original si fue editado */}
                          <span 
                            onMouseEnter={fueEditado(mensaje.id) ? (e) => mostrarTooltip(e, mensaje.id) : null}
                            onMouseLeave={fueEditado(mensaje.id) ? ocultarTooltip : null}
                            style={{
                              display: 'inline-block',
                              cursor: fueEditado(mensaje.id) ? 'help' : 'default',
                              borderBottom: fueEditado(mensaje.id) ? '1px dashed #999' : 'none',
                              wordBreak: 'break-word'
                            }}
                          >
                            {mensaje.mensaje}
                          </span>
                          
                          {/* Indicador de edición con hora */}
                          {fueEditado(mensaje.id) && (
                            <span style={{
                              marginLeft: '6px',
                              color: '#777',
                              fontSize: '0.85em',
                              fontStyle: 'italic'
                            }}>
                              (editado a las {obtenerHoraEdicion(mensaje.id)})
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Mostrar archivo adjunto si existe */}
                      {mensaje.archivo_nombre && (
                        <div style={{ marginTop: mensaje.mensaje ? '10px' : '0' }}>
                          {esImagen(mensaje.archivo_nombre) ? (
                            <a 
                              href={getFileUrl(mensaje.archivo_nombre)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <img 
                                src={getFileUrl(mensaje.archivo_nombre)} 
                                alt="Imagen adjunta" 
                                style={{
                                  maxWidth: '200px',
                                  maxHeight: '150px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px'
                                }}
                              />
                            </a>
                          ) : esPDF(mensaje.archivo_nombre) ? (
                            <a 
                              href={getFileUrl(mensaje.archivo_nombre)} 
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
                              href={getFileUrl(mensaje.archivo_nombre)} 
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
                              <span style={{marginTop: '5px', fontSize: '12px', textAlign: 'center', wordBreak: 'break-all'}}>
                                {mensaje.archivo_nombre.length > 15 
                                  ? mensaje.archivo_nombre.substring(0, 12) + '...' 
                                  : mensaje.archivo_nombre}
                              </span>
                            </a>
                          )}
                          
                          {puedeBorrar(mensaje) && (
                            <div style={{ 
                              marginTop: '5px', 
                              textAlign: 'center', 
                              display: 'flex', 
                              gap: '5px', 
                              justifyContent: 'center' 
                            }}>
                              <button
                                onClick={() => eliminarArchivo(mensaje.id)}
                                style={{
                                  backgroundColor: '#e74c3c',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '3px 8px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                Eliminar archivo
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Fecha y acciones */}
                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(0,0,0,0.1)',
                    paddingTop: '8px',
                    fontSize: '12px'
                  }}>
                    <div style={{color: '#777'}}>
                      {new Date(mensaje.fecha).toLocaleTimeString()}
                    </div>
                    
                    <div>
                      {/* Botones de acción */}
                      {puedeEditar(mensaje) && editando !== mensaje.id && (
                        <button
                          onClick={() => iniciarEdicion(mensaje)}
                          style={{
                            backgroundColor: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            marginRight: '8px',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          ✏️ Editar
                        </button>
                      )}
                      
                      {puedeBorrar(mensaje) && (
                        <button
                          onClick={() => eliminarMensaje(mensaje.id)}
                          style={{
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          🗑️ Borrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Botón para ir al final (visible solo cuando scroll automático está desactivado) */}
        {!scrollAutomatico && mensajes.length > 10 && (
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
      
      {/* Formulario de envío */}
      <form onSubmit={enviarMensaje} style={{marginTop: '20px'}}>
        {/* Input de mensaje */}
        <div style={{marginBottom: '10px'}}>
          <input
            type="text"
            value={mensajeTexto}
            onChange={e => setMensajeTexto(e.target.value)}
            placeholder={`Escribe un mensaje para ${recipient.nombre}...`}
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
        
        {/* Selector de archivos */}
        <div>
          <input
            id="fileInput-private"
            type="file"
            onChange={handleFileChange}
            style={{marginBottom: '10px'}}
            disabled={enviando}
            multiple
          />
          
          {/* Lista de archivos seleccionados */}
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
      
      {/* Mensaje de error */}
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
      
      {/* Información de última actualización */}
      {ultimaActualizacion && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '15px',
          fontSize: '12px',
          color: '#777'
        }}>
          Última actualización: {ultimaActualizacion}
        </div>
      )}
    </div>
  );
}

export default PrivateChat;