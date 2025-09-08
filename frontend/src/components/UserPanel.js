import React, { useState, useEffect, useRef } from 'react';
import ChatGeneral from './ChatGeneral';
import ChatPrivado from './ChatPrivado';
import { io } from 'socket.io-client';
import Toasts from './Toasts';

// Inicializa el socket UNA SOLA VEZ fuera del componente
const socketInstance = io(
  process.env.REACT_APP_API_URL.replace('/api', ''),
  {
    transports: ['websocket', 'polling'],
    autoConnect: true
  }
);

function UserPanel({ token, usuario }) {
  // Eliminado el código que borra la sesión al refrescar/cerrar la ventana
  const [activeTab, setActiveTab] = useState('perfil');
  const [sinLeerGeneral, setSinLeerGeneral] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [destinatario, setDestinatario] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosEnLinea, setUsuariosEnLinea] = useState([]);
  const [usuariosTodos, setUsuariosTodos] = useState([]);
  const [privadosNoLeidos, setPrivadosNoLeidos] = useState(() => {
    const guardados = localStorage.getItem('privadosNoLeidos');
    return guardados ? JSON.parse(guardados) : {};
  });
  const socketRef = useRef(socketInstance);

  const [enLinea, setEnLinea] = useState(
    localStorage.getItem(`enLinea_${usuario.id}`) === 'false' ? false : true
  );

  useEffect(() => {
    const savedTab = localStorage.getItem('userActiveTab');
    const savedDestinatario = localStorage.getItem('userChatPrivadoDestinatario');
    if (savedTab) setActiveTab(savedTab);
    if (savedTab === 'chat-privado' && savedDestinatario) {
      try {
        setDestinatario(JSON.parse(savedDestinatario));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('privadosNoLeidos', JSON.stringify(privadosNoLeidos));
  }, [privadosNoLeidos]);

  useEffect(() => {
    const fetchNoLeidosPrivados = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/chat/private/unread/${usuario.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.noLeidos) {
          setPrivadosNoLeidos(data.noLeidos);
        }
      } catch {}
    };
    if (usuario?.id && token) {
      fetchNoLeidosPrivados();
    }
  }, [usuario?.id, token]);

  const setActiveTabPersist = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('userActiveTab', tab);
  };

  const fetchSinLeerGeneral = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/chat/group/unread/${usuario.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSinLeerGeneral(data.sin_leer || 0);
    } catch {
      setSinLeerGeneral(0);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsuarios(data);
        setUsuariosTodos(data);
      } else {
        setUsuarios([]);
        setUsuariosTodos([]);
      }
    } catch {
      setUsuarios([]);
      setUsuariosTodos([]);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'perfil' || activeTab === 'chat-general') {
      fetchUsuarios();
    }
  }, [activeTab, token]);

  useEffect(() => {
    if (window.Notification && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  const showToast = (title, body, mensajeId) => {
    setToasts(prev => {
      if (prev.some(t => t.title === title && t.body === body)) return prev;
      return [...prev, { title, body, mensajeId }];
    });
    setTimeout(() => setToasts(prev => prev.slice(1)), 4000);
  };

  const handleToastClick = (mensajeId) => {
    // Buscar el toast correspondiente
    const toast = toasts.find(t => t.mensajeId === mensajeId);
    // Si es mensaje privado, buscar el remitente
    if (toast && toast.title && toast.title.startsWith('Mensaje privado de')) {
      // Extraer nombre del remitente del título
      const nombreRemitente = toast.title.replace('Mensaje privado de ', '').trim();
      // Buscar usuario por nombre
      const usuarioRemitente = usuariosTodos.find(u => (u.nombre || u.email) === nombreRemitente);
      if (usuarioRemitente) {
        setDestinatario(usuarioRemitente);
        setActiveTabPersist('chat-privado');
        localStorage.setItem('userActiveTab', 'chat-privado');
        localStorage.setItem('userChatPrivadoDestinatario', JSON.stringify(usuarioRemitente));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('ir-a-mensaje', { detail: mensajeId }));
        }, 300);
        return;
      }
    }
    // Si no es privado o no se encontró el usuario, ir al chat general
    setActiveTabPersist('chat-general');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('ir-a-mensaje', { detail: mensajeId }));
    }, 200);
  };

  useEffect(() => {
    if (usuario?.id && token) {
      fetchSinLeerGeneral();

      const interval = setInterval(fetchSinLeerGeneral, 10000);

      socketRef.current.on('connect', () => {
        socketRef.current.emit('usuario-en-linea', {
          usuario_id: usuario.id,
          nombre: usuario.nombre,
          enLinea: enLinea
        });
      });

      socketRef.current.off('nuevo-mensaje');
      socketRef.current.on('nuevo-mensaje', (mensaje) => {
        fetchSinLeerGeneral();
        if (mensaje.usuario_id !== usuario.id) {
          const nombreRemitente = mensaje.nombre_usuario || mensaje.nombre || mensaje.autor || 'Desconocido';
          if (window.Notification && Notification.permission === 'granted') {
            const noti = new Notification(`Nuevo mensaje de ${nombreRemitente}`, {
              body: mensaje.texto,
              icon: '/icono.png'
            });
            noti.onclick = () => {
              setActiveTabPersist('chat-general');
              setTimeout(() => {
                window.focus();
                window.dispatchEvent(new CustomEvent('ir-a-mensaje', { detail: mensaje.id }));
              }, 200);
              noti.close();
            };
          }
          showToast(`Nuevo mensaje de ${nombreRemitente}`, mensaje.texto, mensaje.id);

          if (activeTab !== 'chat-general') {
            localStorage.setItem('mensajePendiente', mensaje.id);
          }
        }
      });

      socketRef.current.on('nuevo-mensaje-privado', async (mensaje) => {
        if (
          mensaje.destinatario_id === usuario.id &&
          (!destinatario || destinatario.id !== mensaje.remitente_id || activeTab !== 'chat-privado')
        ) {
          try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/chat/private/unread/${usuario.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.noLeidos) {
              setPrivadosNoLeidos(data.noLeidos);
            }
          } catch {}
            // Mostrar toast de mensaje privado recibido
            const nombreRemitente = mensaje.nombre_remitente || mensaje.nombre || mensaje.autor || 'Desconocido';
            showToast(`Mensaje privado de ${nombreRemitente}`, mensaje.texto, mensaje.id);
            // Notificación nativa opcional
            if (window.Notification && Notification.permission === 'granted') {
              const noti = new Notification(`Mensaje privado de ${nombreRemitente}`, {
                body: mensaje.texto,
                icon: '/icono.png'
              });
              noti.onclick = () => {
                // Buscar usuario por nombre
                const usuarioRemitente = usuariosTodos.find(u => (u.nombre || u.email) === nombreRemitente);
                if (usuarioRemitente) {
                  setDestinatario(usuarioRemitente);
                  setActiveTabPersist('chat-privado');
                  localStorage.setItem('userActiveTab', 'chat-privado');
                  localStorage.setItem('userChatPrivadoDestinatario', JSON.stringify(usuarioRemitente));
                  setTimeout(() => {
                    window.focus();
                    window.dispatchEvent(new CustomEvent('ir-a-mensaje', { detail: mensaje.id }));
                  }, 300);
                } else {
                  setActiveTabPersist('chat-general');
                  setTimeout(() => {
                    window.focus();
                    window.dispatchEvent(new CustomEvent('ir-a-mensaje', { detail: mensaje.id }));
                  }, 200);
                }
                noti.close();
              };
            }
        }
      });

      return () => {
        clearInterval(interval);
        socketRef.current.off('nuevo-mensaje');
        socketRef.current.off('nuevo-mensaje-privado');
      };
    }
  }, [usuario?.id, token, enLinea, destinatario, activeTab]);

  useEffect(() => {
    localStorage.setItem(`enLinea_${usuario.id}`, enLinea ? 'true' : 'false');
  }, [enLinea, usuario.id]);

  const cambiarEstadoLineaManual = () => {
    setEnLinea(prev => {
      const nuevoEstado = !prev;
      socketRef.current.emit('usuario-en-linea', {
        usuario_id: usuario.id,
        nombre: usuario.nombre,
        enLinea: nuevoEstado,
        manual: true
      });
      localStorage.setItem(`enLinea_${usuario.id}`, nuevoEstado ? 'true' : 'false');
      return nuevoEstado;
    });
  };

  // --- CORRECCIÓN: useRef para usuariosEneaPrev ---
  const usuariosEnLineaPrevRef = useRef([]);

  useEffect(() => {
    if (!usuario?.id) return;
    const socket = socketRef.current;

    const handleUsuariosEnLinea = (usuariosEnLineaActual) => {
      const usuariosEnLineaPrev = usuariosEnLineaPrevRef.current;
    // Eliminadas notificaciones toast de conexión/desconexión
      usuariosEnLineaPrevRef.current = usuariosEnLineaActual;
      setUsuariosEnLinea(usuariosEnLineaActual);
    };

    socket.on('usuarios-en-linea', handleUsuariosEnLinea);

    return () => {
      socket.off('usuarios-en-linea', handleUsuariosEnLinea);
    };
  }, [usuario.id]);

  const marcarMensajesPrivadosLeidos = async (remitenteId) => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/api/chat/private/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          usuario_id: usuario.id,
          remitente_id: remitenteId
        })
      });
    } catch {}
  };

  const handleSelectDestinatario = (user) => {
    setDestinatario(user);
    setActiveTab('chat-privado');
    localStorage.setItem('userActiveTab', 'chat-privado');
    localStorage.setItem('userChatPrivadoDestinatario', JSON.stringify(user));
    setPrivadosNoLeidos(prev => ({ ...prev, [user.id]: 0 }));
    marcarMensajesPrivadosLeidos(user.id);
  };

  const handleVolver = () => {
    setActiveTab('perfil');
    setDestinatario(null);
    localStorage.setItem('userActiveTab', 'perfil');
    localStorage.removeItem('userChatPrivadoDestinatario');
  };

  const handleChatGeneralClick = async () => {
    setActiveTabPersist('chat-general');
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/api/chat/group/visit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ usuario_id: usuario.id })
      });
      setSinLeerGeneral(0);
    } catch {}
  };

  const renderUsuariosPanel = () => {
    const conectadosIds = usuariosEnLinea.map(u => u.usuario_id);
    const conectados = usuariosTodos.filter(u => conectadosIds.includes(u.id));
    const desconectados = usuariosTodos.filter(u => !conectadosIds.includes(u.id));

    return (
      <div style={{
        background: '#f8f9fa',
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 18,
        minWidth: 120,
        maxWidth: 120,
        width: 120,
        boxSizing: 'border-box'
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: 15, color: '#007bff', textAlign: 'center' }}>Usuarios</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[...conectados, ...desconectados].map(u => (
            <li
              key={u.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
                fontSize: 14,
                cursor: u.id !== usuario.id ? 'pointer' : 'default',
                opacity: u.id === usuario.id ? 0.6 : 1
              }}
              onClick={() => u.id !== usuario.id && handleSelectDestinatario(u)}
              title={u.id !== usuario.id ? 'Ir al chat privado' : 'Este eres tú'}
            >
              <span title={conectadosIds.includes(u.id) ? "En línea" : "Desconectado"} style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: conectadosIds.includes(u.id) ? '#28a745' : '#ccc',
                display: 'inline-block'
              }}></span>
              <span style={{
                overflow: 'visible',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 100,
                textDecoration: u.id !== usuario.id ? 'underline' : 'none',
                color: u.id !== usuario.id ? '#007bff' : '#333',
                position: 'relative',
                display: 'inline-block',
                paddingRight: 28
              }}>
                {u.nombre || u.email || `ID ${u.id}`}
                                {privadosNoLeidos[u.id] > 0 && (
                  <span style={{
                    position: 'absolute',
                    right: 2,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#dc3545',
                    color: '#fff',
                    borderRadius: '50%',
                    minWidth: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 'bold',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                    zIndex: 2,
                    border: '2px solid #fff'
                  }}>
                    {privadosNoLeidos[u.id]}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderEstadoEnLinea = () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        marginLeft: 4,
        cursor: 'pointer',
        userSelect: 'none'
      }}
      onClick={cambiarEstadoLineaManual}
      title={enLinea ? 'Haz clic para ponerte fuera de línea' : 'Haz clic para ponerte en línea'}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: enLinea ? '#28a745' : '#ccc',
          display: 'inline-block',
          border: '2px solid #fff',
          boxShadow: enLinea ? '0 0 4px #28a745' : undefined
        }}
      ></span>
      <span style={{
        fontWeight: 'bold',
        color: enLinea ? '#28a745' : '#888',
        fontSize: 15
      }}>
        {enLinea ? 'En línea' : 'Desconectado'}
      </span>
    </div>
  );

  return (
    <div style={{ maxWidth: 1300, margin: 'auto', padding: 20 }}>
      <Toasts
        toasts={toasts}
        removeToast={idx => setToasts(prev => prev.filter((_, i) => i !== idx))}
        onToastClick={handleToastClick}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 36 }}>
        <div style={{
          width: 160,
          minWidth: 120,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignItems: 'flex-start',
          marginLeft: 0,
          position: 'sticky',
          top: 40
        }}>
          {renderEstadoEnLinea()}
          <button
            style={{
              width: 120,
              padding: '8px 0',
              background: activeTab === 'perfil' ? '#007bff' : '#eee',
              color: activeTab === 'perfil' ? '#fff' : '#333',
              border: activeTab === 'perfil' ? '2px solid #222' : 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 16,
              boxShadow: activeTab === 'perfil' ? '0 2px 6px rgba(0,0,0,0.09)' : undefined,
              textAlign: 'center'
            }}
            onClick={() => setActiveTabPersist('perfil')}
          >
            Perfil
          </button>
          <div style={{ position: 'relative', width: '100%' }}>
            <button
              style={{
                width: 120,
                padding: '8px 0',
                background: activeTab === 'chat-general' ? '#007bff' : '#eee',
                color: activeTab === 'chat-general' ? '#fff' : '#333',
                border: activeTab === 'chat-general' ? '2px solid #222' : 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 16,
                boxShadow: activeTab === 'chat-general' ? '0 2px 6px rgba(0,0,0,0.09)' : undefined,
                textAlign: 'center'
              }}
              onClick={handleChatGeneralClick}
            >
              Chat general
            </button>
            {sinLeerGeneral > 0 && (
              <span style={{
                position: 'absolute',
                top: -8,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#21c321',
                color: '#fff',
                borderRadius: '20px',
                padding: '2px 8px',
                fontWeight: 700,
                fontSize: 14,
                minWidth: 22,
                textAlign: 'center',
                zIndex: 2
              }}>
                {sinLeerGeneral}
              </span>
            )}
          </div>
          {renderUsuariosPanel()}
        </div>
        <div style={{ flex: 1 }}>
          {activeTab === 'perfil' && (
            <div>
              <h3>Tu perfil</h3>
              <p>Nombre: {usuario?.nombre}</p>
              <p>Email: {usuario?.email}</p>
              <p>Rol: {usuario?.rol}</p>
            </div>
          )}
          {activeTab === 'chat-general' && (
            <ChatGeneral token={token} usuario={usuario} />
          )}
          {activeTab === 'chat-privado' && destinatario && (
            <ChatPrivado
              token={token}
              usuario={usuario}
              socket={socketRef.current}
              destinatario={{ id: destinatario.id, nombre: destinatario.nombre }}
              onVolver={handleVolver}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default UserPanel;