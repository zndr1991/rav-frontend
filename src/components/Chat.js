import React, { useState, useEffect, useRef } from 'react';
import { fetchChat, sendMessage, deleteMessage, editMessage, getFileUrl, deleteFile, initSocket, getSocket } from '../api';

// Componente de Chat con control de acceso para características administrativas
function Chat({ token, user }) {
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
  const [archivosExpandidos, setArchivosExpandidos] = useState({});
  const [modoDiagnostico, setModoDiagnostico] = useState(false);
  const [mensajesRaw, setMensajesRaw] = useState([]);
  const [scrollAutomatico, setScrollAutomatico] = useState(true);
  const [historialEdiciones, setHistorialEdiciones] = useState({});
  
  // Referencias
  const scrollRef = useRef(null);
  const cargandoRef = useRef(false);
  const socketRef = useRef(null);
  const actualizacionProgramadaRef = useRef(null);
  const usuarioScrolleando = useRef(false);
  const ultimaAlturaScroll = useRef(0);
  const tooltipRef = useRef(null);

  // Verificar si el usuario tiene permisos de administrador
  const esAdministrador = () => {
    return user && (user.rol === 'admin' || user.rol === 'supervisor' || user.rol === 'administrador');
  };

  // Cargar mensajes y configurar socket
  useEffect(() => {
    // Cargar mensajes iniciales
    cargarMensajes();
    
    // Configurar actualizaciones periódicas (cada 2.5 segundos)
    const intervalId = setInterval(() => {
      if (!cargandoRef.current) {
        cargarMensajes(true); // silencioso
      }
    }, 2500);
    
    // Configurar socket para actualizaciones en tiempo real
    const socket = getSocket() || initSocket(token);
    if (socket) {
      socketRef.current = socket;
      setConectado(socket.connected);
      
      // Eventos de conexión
      socket.on('connect', () => {
        console.log("Socket conectado");
        setConectado(true);
      });
      
      socket.on('disconnect', () => {
        console.log("Socket desconectado");
        setConectado(false);
      });
      
      // Evento de nuevo mensaje
      socket.on('nuevo-mensaje', () => {
        console.log("Evento nuevo-mensaje recibido");
        
        // Programar actualización con un pequeño retraso
        if (actualizacionProgramadaRef.current) {
          clearTimeout(actualizacionProgramadaRef.current);
        }
        
        actualizacionProgramadaRef.current = setTimeout(() => {
          cargarMensajes(true);
        }, 300);
      });
      
      // Eventos de cambios en mensajes
      socket.on('mensaje-eliminado', () => cargarMensajes(true));
      socket.on('mensaje-editado', () => cargarMensajes(true));
    }
    
    // Verificar estado de conexión periódicamente
    const checkConnectionId = setInterval(() => {
      const socket = getSocket();
      if (socket) {
        setConectado(socket.connected);
      }
    }, 3000);

    // Cargar el historial de ediciones desde localStorage al iniciar
    const historialGuardado = localStorage.getItem('historial_ediciones');
    if (historialGuardado) {
      try {
        setHistorialEdiciones(JSON.parse(historialGuardado));
      } catch (err) {
        console.error("Error al cargar historial de ediciones:", err);
        localStorage.removeItem('historial_ediciones');
      }
    }
    
    // Limpiar
    return () => {
      clearInterval(intervalId);
      clearInterval(checkConnectionId);
      if (actualizacionProgramadaRef.current) {
        clearTimeout(actualizacionProgramadaRef.current);
      }
    };
  }, [token]);

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
    // Prevenir múltiples solicitudes simultáneas
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    
    if (!silencioso) setCargando(true);
    
    try {
      console.log("Solicitando mensajes...");
      const data = await fetchChat(token);
      
      if (Array.isArray(data)) {
        console.log(`Recibidos ${data.length} mensajes de la API`);
        
        // Guardar datos crudos para diagnóstico
        setMensajesRaw(data);
        
        // Ordenar mensajes por fecha
        const mensajesOrdenados = [...data].sort((a, b) => 
          new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        );
        
        // IMPORTANTE: No filtrar mensajes, mostrar todos sin excepción
        console.log(`Mostrando ${mensajesOrdenados.length} mensajes ordenados`);
        
        // Actualizar estado
        setMensajes(mensajesOrdenados);
        setUltimaActualizacion(new Date().toLocaleTimeString());
      } else if (data.error && !silencioso) {
        console.error("Error en respuesta:", data);
        setError(`Error: ${data.error}`);
      }
    } catch (err) {
      if (!silencioso) {
        console.error("Error cargando mensajes:", err);
        setError(`Error al cargar mensajes: ${err.message}`);
      }
    } finally {
      if (!silencioso) setCargando(false);
      cargandoRef.current = false;
    }
  };

  // Agrupar mensajes con lógica ultra estricta (casi sin agrupación)
  const agruparMensajes = () => {
    if (!mensajes.length) return [];
    
    // En modo diagnóstico, no agrupar nada
    if (modoDiagnostico) {
      return mensajes.map(msg => [msg]);
    }
    
    // SOLUCIÓN FINAL: Casi no agrupar mensajes
    // Por defecto, mostrar cada mensaje individualmente excepto en casos muy específicos
    
    const grupos = [];
    let grupoActual = [mensajes[0]];
    
    // Ventana de tiempo MUY reducida (1 segundo)
    const VENTANA_TIEMPO_MS = 1000;
    
    for (let i = 1; i < mensajes.length; i++) {
      const mensajeActual = mensajes[i];
      const mensajeAnterior = mensajes[i-1];
      
      const mismoAutor = mensajeActual.de_usuario === mensajeAnterior.de_usuario;
      const tiempoCercano = Math.abs(
        new Date(mensajeActual.fecha).getTime() - 
        new Date(mensajeAnterior.fecha).getTime()
      ) < VENTANA_TIEMPO_MS;
      
      // SÓLO agrupar mensajes en estas condiciones específicas:
      // 1. Es el mismo autor y están MUY cercanos en tiempo (menos de 1 segundo)
      // 2. Y uno de los mensajes NO tiene texto pero tiene archivo (adjunto de archivo)
      const esArchivoSinTexto = 
        (mensajeActual.archivo_nombre && (!mensajeActual.mensaje || mensajeActual.mensaje.trim() === '')) ||
        (mensajeAnterior.archivo_nombre && (!mensajeAnterior.mensaje || mensajeAnterior.mensaje.trim() === ''));
      
      // Condición ultra estricta para agrupar - casi nunca se cumplirá para mensajes de texto
      if (mismoAutor && tiempoCercano && esArchivoSinTexto) {
        grupoActual.push(mensajeActual);
      } else {
        grupos.push([...grupoActual]);
        grupoActual = [mensajeActual];
      }
    }
    
    // Añadir el último grupo
    grupos.push(grupoActual);
    
    return grupos;
  };

  // Enviar mensaje
  const enviarMensaje = async (e) => {
    e.preventDefault();
    
    const texto = mensajeTexto.trim();
    if (!texto && archivos.length === 0) return;
    
    setEnviando(true);
    
    try {
      console.log(`Enviando mensaje "${texto}" con ${archivos.length} archivos`);
      const resultado = await sendMessage(texto, token, archivos);
      
      if (resultado && resultado.error) {
        console.error("Error al enviar:", resultado.error);
        setError(`Error al enviar: ${resultado.error}`);
      } else {
        // Limpiar formulario
        setMensajeTexto('');
        setArchivos([]);
        
        // Limpiar input de archivos
        const fileInput = document.getElementById('fileInput');
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

  // Eliminar todos los archivos de un grupo
  const eliminarTodosArchivos = async (archivos) => {
    if (!window.confirm(`¿Seguro que deseas eliminar todos los archivos (${archivos.length})?`)) return;
    
    setCargando(true);
    let errores = 0;
    
    try {
      // Eliminar archivos uno por uno
      for (const archivo of archivos) {
        try {
          await deleteFile(archivo.mensaje_id, token);
        } catch (err) {
          console.error(`Error eliminando archivo ${archivo.id}:`, err);
          errores++;
        }
      }
      
      if (errores > 0) {
        setError(`Hubo problemas al eliminar ${errores} archivos.`);
      }
      
      // Recargar mensajes después de eliminar
      setTimeout(() => cargarMensajes(), 500);
    } catch (err) {
      setError(`Error general: ${err.message}`);
    } finally {
      setCargando(false);
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
        localStorage.setItem('historial_ediciones', JSON.stringify(nuevoHistorial));
        
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

  // Forzar reconexión del socket
  const forzarReconexion = async () => {
    try {
      // Desconectar socket actual
      const socket = getSocket();
      if (socket) socket.disconnect();
      
      // Crear nuevo socket
      const nuevoSocket = initSocket(token);
      if (nuevoSocket) {
        setConectado(nuevoSocket.connected);
        
        // Configurar eventos básicos
        nuevoSocket.on('connect', () => setConectado(true));
        nuevoSocket.on('disconnect', () => setConectado(false));
        nuevoSocket.on('nuevo-mensaje', () => cargarMensajes(true));
      }
      
      // Recargar mensajes
      await cargarMensajes();
    } catch (err) {
      setError(`Error al reconectar: ${err.message}`);
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
  
  // Toggle para expandir/contraer archivos
  const toggleArchivosExpandidos = (id) => {
    setArchivosExpandidos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Alternar modo diagnóstico
  const toggleModoDiagnostico = () => {
    setModoDiagnostico(!modoDiagnostico);
  };

  // Forzar scroll hacia abajo
  const forzarScrollAbajo = () => {
    if (scrollRef.current) {
      setScrollAutomatico(true);
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Verificar permisos
  const puedeBorrar = (msg) => user && (user.id === msg.de_usuario || user.rol === 'supervisor' || user.rol === 'admin' || user.rol === 'administrador');
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

  // Renderizar mensaje individual para el modo diagnóstico
  const renderizarMensajeIndividual = (msg) => {
    return (
      <div 
        key={msg.id}
        style={{
          padding: '10px',
          margin: '8px 0',
          borderRadius: '5px',
          border: '1px solid #ddd',
          backgroundColor: '#fff8e6', // Color especial para modo diagnóstico
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
  };

  // Renderizar un grupo de mensajes
  const renderizarGrupo = (grupo) => {
    if (!grupo || grupo.length === 0) return null;
    
    // En modo diagnóstico, renderizar cada mensaje por separado
    if (modoDiagnostico) {
      return renderizarMensajeIndividual(grupo[0]);
    }
    
    // Encontrar el mensaje principal (con texto)
    const mensajePrincipal = grupo.find(m => m.mensaje && m.mensaje.trim() !== '') || grupo[0];
    
    // Recopilar todos los archivos del grupo
    const archivosGrupo = grupo.filter(m => m.archivo_nombre).map(m => ({
      id: m.id,
      nombre: m.archivo_nombre,
      de_usuario: m.de_usuario,
      mensaje_id: m.id
    }));
    
    // Determinar si mostrar archivos expandidos
    const mostrarExpandidos = archivosExpandidos[mensajePrincipal.id] || false;
    
    // Verificar si este mensaje ha sido editado
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
        {/* Autor */}
        <div style={{fontWeight: 'bold'}}>
          {mensajePrincipal.autor}:
        </div>
        
        {/* Contenido */}
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
              {/* Mensaje con tooltip para ver contenido original si fue editado */}
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
              
              {/* Indicador de edición con hora */}
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
        
        {/* Archivos adjuntos */}
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
                    {/* Botón para eliminar todos los archivos */}
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
        
        {/* Fecha y acciones */}
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
            {/* Botones de acción */}
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

  // Generar grupos de mensajes para mostrar
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
      
      {/* Panel de información mejorado - SOLO PARA ADMINISTRADORES */}
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
          
          {/* Estadísticas detalladas */}
          <div style={{marginTop: '8px', fontSize: '13px'}}>
            <span>
              {mensajesRaw.filter(m => m.mensaje && m.mensaje.trim() !== '').length} con texto |
              {mensajesRaw.filter(m => m.archivo_nombre).length} con archivos |
              IDs: {mensajesRaw.map(m => m.id).join(', ')}
            </span>
          </div>
        </div>
      )}
      
      {/* Área de mensajes con indicador de scroll */}
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
        
        {/* Botón para ir al final (visible solo cuando scroll automático está desactivado) */}
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
      
      {/* Formulario de envío */}
      <form onSubmit={enviarMensaje} style={{marginTop: '20px'}}>
        {/* Input de mensaje */}
        <div style={{marginBottom: '10px'}}>
          <input
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
        
        {/* Selector de archivos */}
        <div>
          <input
            id="fileInput"
            type="file"
            onChange={handleFileChange}
            multiple
            style={{marginBottom: '10px'}}
            disabled={enviando}
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
      
      {/* Botones de acción - SOLO PARA ADMINISTRADORES */}
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
      
      {/* Panel de diagnóstico detallado (visible solo en modo diagnóstico y para admins) */}
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