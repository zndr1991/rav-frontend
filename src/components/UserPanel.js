import React, { useState, useEffect, useRef } from 'react';
import ChatGeneral from './ChatGeneral';
import ChatPrivado from './ChatPrivado';
import { io } from 'socket.io-client';
import Toasts from './Toasts';

function UserPanel({ token, usuario }) {
  const [activeTab, setActiveTab] = useState('perfil');
  const [sinLeerGeneral, setSinLeerGeneral] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [destinatario, setDestinatario] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosEnLinea, setUsuariosEnLinea] = useState([]);
  const socketRef = useRef(null);

  // Persistencia de pestaña activa
  const setActiveTabPersist = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('userActiveTab', tab);
  };

  useEffect(() => {
    const savedTab = localStorage.getItem('userActiveTab');
    if (savedTab) setActiveTab(savedTab);
  }, []);

  const fetchSinLeerGeneral = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/group/unread/${usuario.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSinLeerGeneral(data.sin_leer || 0);
    } catch {
      setSinLeerGeneral(0);
    }
  };

  // Obtener todos los usuarios
  const fetchUsuarios = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/users`, {
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
    if (activeTab === 'chat-privado') {
      fetchUsuarios();
    }
  }, [activeTab, token]);

  useEffect(() => {
    if (window.Notification && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  const showToast = (title, body, mensajeId) => {
    setToasts(prev => [...prev, { title, body, mensajeId }]);
    setTimeout(() => setToasts(prev => prev.slice(1)), 4000);
  };

  const handleToastClick = (mensajeId) => {
    setActiveTabPersist('chat-general');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('ir-a-mensaje', { detail: mensajeId }));
    }, 200);
  };

  // Mantener el socket abierto y emitir en línea al conectar
  useEffect(() => {
    if (usuario?.id && token) {
      fetchSinLeerGeneral();

      const interval = setInterval(fetchSinLeerGeneral, 10000);

      // Conexión Socket.IO
      const socket = io(process.env.REACT_APP_API_URL.replace('/api', ''), {
        transports: ['websocket'],
        autoConnect: true
      });
      socketRef.current = socket;

      // Notificar al backend que el usuario está en línea
      socket.emit('usuario-en-linea', {
        usuario_id: usuario.id,
        nombre: usuario.nombre,
        enLinea: true
      });

      socketRef.current.on('connect', () => {
        socketRef.current.emit('usuario-en-linea', {
          usuario_id: usuario.id,
          nombre: usuario.nombre,
          enLinea: true
        });
      });

      socketRef.current.on('usuarios-en-linea', (usuarios) => {
        setUsuariosEnLinea(usuarios);
      });

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

      // Al desmontar, notificar que el usuario está fuera de línea
      return () => {
        clearInterval(interval);
        if (socket) {
          socket.emit('usuario-en-linea', {
            usuario_id: usuario.id,
            nombre: usuario.nombre,
            enLinea: false
          });
          socket.disconnect();
        }
      };
    }
  }, [usuario?.id, token]);

  const handleChatGeneralClick = async () => {
    setActiveTabPersist('chat-general');
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/chat/group/visit`, {
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

  // Cambiar estado en línea manualmente al hacer clic en el icono
  const cambiarEstadoLineaManual = () => {
    const nuevoEstado = !enLinea;
    setEnLinea(nuevoEstado);
    localStorage.setItem(`enLinea_${usuario.id}`, nuevoEstado ? 'true' : 'false');
    if (socketRef.current) {
      socketRef.current.emit('usuario-en-linea', {
        usuario_id: usuario.id,
        nombre: usuario.nombre,
        enLinea: nuevoEstado
      });
    }
  };

  // Selección de destinatario para chat privado (muestra todos los usuarios)
  const handleSelectDestinatario = (user) => {
    setDestinatario(user);
    setActiveTabPersist('chat-privado');
  };

  // Panel de usuarios conectados y desconectados (por fuera de las pestañas)
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
          {conectados.map(u => (
            <li key={u.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              fontSize: 14
            }}>
              <span title="En línea" style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#28a745',
                display: 'inline-block'
              }}></span>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 80
              }}>{u.nombre || u.email || `ID ${u.id}`}</span>
            </li>
          ))}
          {desconectados.map(u => (
            <li key={u.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              fontSize: 14
            }}>
              <span title="Desconectado" style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#ccc',
                display: 'inline-block'
              }}></span>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 80
              }}>{u.nombre || u.email || `ID ${u.id}`}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Icono de estado en línea/desconectado arriba de perfil, clickeable
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
          {/* Icono de estado en línea/desconectado arriba de perfil */}
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
          <button
            style={{
              width: 120,
              padding: '8px 0',
              background: activeTab === 'chat-privado' ? '#007bff' : '#eee',
              color: activeTab === 'chat-privado' ? '#fff' : '#333',
              border: activeTab === 'chat-privado' ? '2px solid #222' : 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 16,
              boxShadow: activeTab === 'chat-privado' ? '0 2px 6px rgba(0,0,0,0.09)' : undefined,
              textAlign: 'center'
            }}
            onClick={() => setActiveTabPersist('chat-privado')}
          >
            Chat privado
          </button>
          <div style={{
            marginTop: 18,
            background: '#eef6ff',
            border: '1px solid #007bff',
            borderRadius: 8,
            padding: '8px 10px',
            width: '100%',
            minHeight: 48
          }}>
            <b style={{ color: '#007bff', fontSize: 15 }}>Usuarios en línea:</b>
            <ul style={{ margin: '8px 0 0 0', padding: 0, listStyle: 'none', color: '#444', fontSize: 14 }}>
              {usuariosEnLinea.length === 0 ? (
                <li style={{ color: '#888' }}>Nadie en línea</li>
              ) : (
                usuariosEnLinea.map(u => (
                  <li key={u.usuario_id} style={{ marginBottom: 2 }}>
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#28a745',
                      marginRight: 6,
                      verticalAlign: 'middle'
                    }}></span>
                    {u.nombre}
                  </li>
                ))
              )}
            </ul>
          </div>
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
          {activeTab === 'chat-privado' && (
            <div>
              <h3>Selecciona un usuario para chatear en privado:</h3>
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                {usuarios
                  .filter(u => u.id !== usuario.id)
                  .map(u => {
                    const enLinea = usuariosEnLinea.some(ul => ul.usuario_id === u.id);
                    return (
                      <button
                        key={u.id}
                        style={{
                          padding: '6px 14px',
                          background: destinatario?.id === u.id ? '#007bff' : '#e6f7ff',
                          color: destinatario?.id === u.id ? '#fff' : '#007bff',
                          border: '1px solid #007bff',
                          borderRadius: 6,
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                        onClick={() => handleSelectDestinatario(u)}
                      >
                        {u.nombre}
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: enLinea ? '#28a745' : '#ccc',
                            display: 'inline-block'
                          }}
                          title={enLinea ? 'En línea' : 'Desconectado'}
                        ></span>
                      </button>
                    );
                  })}
              </div>
              {destinatario ? (
                <ChatPrivado
                  token={token}
                  usuario={usuario}
                  socket={null}
                  destinatario={{ id: destinatario.id, nombre: destinatario.nombre }}
                />
              ) : (
                <p style={{ color: '#888' }}>Selecciona un usuario para iniciar el chat privado.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserPanel;