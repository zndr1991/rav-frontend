import React, { useEffect, useState, useRef } from 'react';
import ChatGeneral from './ChatGeneral';
import ChatPrivado from './ChatPrivado';
import { io } from 'socket.io-client';
import Toasts from './Toasts';

const initialForm = { nombre: '', email: '', password: '', rol: 'usuario' };

function SupervisorPanel({ token, usuario }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('usuarios');
  const [sinLeerGeneral, setSinLeerGeneral] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [destinatario, setDestinatario] = useState(null);
  const [usuariosEnLinea, setUsuariosEnLinea] = useState([]);
  const [usuariosTodos, setUsuariosTodos] = useState([]);
  const [privadosNoLeidos, setPrivadosNoLeidos] = useState(() => {
    const guardados = localStorage.getItem('privadosNoLeidos');
    return guardados ? JSON.parse(guardados) : {};
  });
  const socketRef = useRef(null);

  const [enLinea, setEnLinea] = useState(
    localStorage.getItem(`enLinea_${usuario.id}`) === 'false' ? false : true
  );

  useEffect(() => {
    const savedTab = localStorage.getItem('supervisorActiveTab');
    const savedDestinatario = localStorage.getItem('supervisorChatPrivadoDestinatario');
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
        const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/private/unread/${usuario.id}`, {
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
    localStorage.setItem('supervisorActiveTab', tab);
  };

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
        setError(data.error || 'No se pudo cargar usuarios');
      }
    } catch {
      setUsuarios([]);
      setUsuariosTodos([]);
      setError('No se pudo cargar usuarios');
    }
  };

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

  useEffect(() => {
    if (activeTab === 'usuarios') fetchUsuarios();
    setError('');
  }, [activeTab]);

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

  useEffect(() => {
    if (!socketRef.current && usuario?.id && token) {
      socketRef.current = io(process.env.REACT_APP_API_URL.replace('/api', ''), {
        transports: ['websocket'],
        autoConnect: true
      });

      socketRef.current.on('connect', () => {
        socketRef.current.emit('usuario-en-linea', {
          usuario_id: usuario.id,
          nombre: usuario.nombre,
          enLinea: enLinea
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

      socketRef.current.on('nuevo-mensaje-privado', (mensaje) => {
        if (
          mensaje.destinatario_id === usuario.id &&
          (!destinatario || destinatario.id !== mensaje.remitente_id || activeTab !== 'chat-privado')
        ) {
          setPrivadosNoLeidos(prev => ({
            ...prev,
            [mensaje.remitente_id]: (prev[mensaje.remitente_id] || 0) + 1
          }));
        }
      });
    }
    return () => {};
  }, [usuario?.id, token, enLinea, destinatario, activeTab]);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit('usuario-en-linea', {
        usuario_id: usuario.id,
        nombre: usuario.nombre,
        enLinea: enLinea
      });
      localStorage.setItem(`enLinea_${usuario.id}`, enLinea ? 'true' : 'false');
    }
  }, [enLinea, usuario.id]);

  const cambiarEstadoLineaManual = () => {
    setEnLinea(prev => !prev);
  };

  // Marcar mensajes privados como leídos en el backend
  const marcarMensajesPrivadosLeidos = async (remitenteId) => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/chat/private/read`, {
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

  // Reinicia el contador y marca como leídos en el backend al abrir el chat privado
  const handleSelectDestinatario = (user) => {
    setDestinatario(user);
    setActiveTab('chat-privado');
    localStorage.setItem('supervisorActiveTab', 'chat-privado');
    localStorage.setItem('supervisorChatPrivadoDestinatario', JSON.stringify(user));
    setPrivadosNoLeidos(prev => ({ ...prev, [user.id]: 0 }));
    marcarMensajesPrivadosLeidos(user.id);
  };

  const handleVolver = () => {
    setActiveTab('usuarios');
    setDestinatario(null);
    localStorage.setItem('supervisorActiveTab', 'usuarios');
    localStorage.removeItem('supervisorChatPrivadoDestinatario');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const url = editId
        ? `${process.env.REACT_APP_API_URL}/users/${editId}`
        : `${process.env.REACT_APP_API_URL}/users/register`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        fetchUsuarios();
        setForm(initialForm);
        setEditId(null);
      } else {
        setError(data.error || 'Error al guardar');
      }
    } catch {
      setError('No se pudo conectar al servidor');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Seguro que quieres borrar este usuario?')) {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/users/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          fetchUsuarios();
        } else {
          setError('Error al borrar usuario');
        }
      } catch {
        setError('No se pudo conectar al servidor');
      }
    }
  };

  const handleEdit = (user) => {
    setForm({ nombre: user.nombre, email: user.email, password: '', rol: user.rol });
    setEditId(user.id);
  };

  const handleCancelEdit = () => {
    setForm(initialForm);
    setEditId(null);
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
              background: activeTab === 'usuarios' ? '#007bff' : '#eee',
              color: activeTab === 'usuarios' ? '#fff' : '#333',
              border: activeTab === 'usuarios' ? '2px solid #222' : 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 16,
              boxShadow: activeTab === 'usuarios' ? '0 2px 6px rgba(0,0,0,0.09)' : undefined,
              textAlign: 'center'
            }}
            onClick={() => setActiveTabPersist('usuarios')}
          >
            Administración de Usuarios
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
          {activeTab === 'usuarios' && (
            <div>
              <h3 style={{ fontSize: 20, marginBottom: 14 }}>{editId ? 'Editar usuario' : 'Crear usuario'}</h3>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500, marginBottom: 20 }}>
                <input
                  type="text"
                  placeholder="Nombre"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  required
                  style={{ fontSize: 17, padding: 6 }}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                  style={{ fontSize: 17, padding: 6 }}
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required={!editId}
                  style={{ fontSize: 17, padding: 6 }}
                />
                <select
                  value={form.rol}
                  onChange={e => setForm({ ...form, rol: e.target.value })}
                  style={{ fontSize: 17, padding: 6 }}
                >
                  <option value="usuario">Usuario normal</option>
                  <option value="supervisor">Supervisor</option>
                </select>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" style={{ fontSize: 17 }}>{editId ? 'Actualizar' : 'Crear'} usuario</button>
                  {editId && <button type="button" onClick={handleCancelEdit} style={{ fontSize: 17 }}>Cancelar</button>}
                </div>
                {error && <p style={{ color: 'red' }}>{error}</p>}
              </form>

              <h3 style={{ fontSize: 20, margin: '20px 0 14px' }}>Lista de usuarios</h3>
              <table border="1" cellPadding="6" style={{ width: '100%', maxWidth: 600, marginTop: 10, borderCollapse: 'collapse', fontSize: 17 }}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(user => (
                    <tr key={user.id}>
                      <td>{user.nombre}</td>
                      <td>{user.email}</td>
                      <td>{user.rol}</td>
                      <td>
                        <button style={{ fontSize: 15, marginRight: 5 }} onClick={() => handleEdit(user)}>Editar</button>
                        <button style={{ fontSize: 15 }} onClick={() => handleDelete(user.id)}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'chat-general' && (
            <div>
              <ChatGeneral token={token} usuario={usuario} />
            </div>
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

export default SupervisorPanel;