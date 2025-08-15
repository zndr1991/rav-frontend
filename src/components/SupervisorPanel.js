import React, { useEffect, useState } from 'react';
import ChatGeneral from './ChatGeneral';
import { io } from 'socket.io-client';

const initialForm = { nombre: '', email: '', password: '', rol: 'usuario' };

function SupervisorPanel({ token, usuario }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('usuarios');
  const [sinLeerGeneral, setSinLeerGeneral] = useState(0);

  // Persistencia de pestaña activa
  const setActiveTabPersist = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('supervisorActiveTab', tab);
  };

  useEffect(() => {
    const savedTab = localStorage.getItem('supervisorActiveTab');
    if (savedTab) setActiveTab(savedTab);
  }, []);

  const fetchUsuarios = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsuarios(data);
      } else {
        setError(data.error || 'No se pudo cargar usuarios');
      }
    } catch {
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
    fetchSinLeerGeneral();
    const interval = setInterval(fetchSinLeerGeneral, 15000);

    // Socket.IO: actualiza la burbuja al instante
    const socket = io(process.env.REACT_APP_API_URL.replace('/api', ''), {
      transports: ['websocket'],
      autoConnect: true
    });
    socket.on('nuevo-mensaje', () => {
      fetchSinLeerGeneral();
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [usuario.id, token, activeTab]);

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
    } catch {
      // Si falla, el globito se queda igual
    }
  };

  const handleBorrarChatGeneral = async () => {
    if (window.confirm('¿Seguro que quieres borrar TODOS los mensajes del chat general?')) {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/group`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          alert('Chat general borrado correctamente.');
          setSinLeerGeneral(0);
        } else {
          alert('Error al borrar el chat.');
        }
      } catch {
        alert('No se pudo conectar al servidor.');
      }
    }
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

  return (
    <div style={{ maxWidth: 1300, margin: 'auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 36 }}>
        <div style={{
          minWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          alignItems: 'flex-start',
          marginLeft: 0
        }}>
          <button
            style={{
              width: 400,
              padding: '15px 0',
              background: activeTab === 'usuarios' ? '#007bff' : '#eee',
              color: activeTab === 'usuarios' ? '#fff' : '#333',
              border: activeTab === 'usuarios' ? '2px solid #222' : 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 21,
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
                width: 400,
                padding: '15px 0',
                background: activeTab === 'chat-general' ? '#007bff' : '#eee',
                color: activeTab === 'chat-general' ? '#fff' : '#333',
                border: activeTab === 'chat-general' ? '2px solid #222' : 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 21,
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
                top: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#21c321',
                color: '#fff',
                borderRadius: '30px',
                padding: '4px 14px',
                fontWeight: 700,
                fontSize: 15,
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
              width: 400,
              padding: '15px 0',
              background: activeTab === 'chat-privado' ? '#007bff' : '#eee',
              color: activeTab === 'chat-privado' ? '#fff' : '#333',
              border: activeTab === 'chat-privado' ? '2px solid #222' : 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 21,
              boxShadow: activeTab === 'chat-privado' ? '0 2px 6px rgba(0,0,0,0.09)' : undefined,
              textAlign: 'center'
            }}
            onClick={() => setActiveTabPersist('chat-privado')}
          >
            Chat privado
          </button>
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
              {usuario.rol === 'supervisor' && (
                <button
                  style={{
                    width: 400,
                    padding: '15px 0',
                    background: '#dc3545',
                    color: '#fff',
                    border: '2px solid #222',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: 21,
                    marginTop: 18
                  }}
                  onClick={handleBorrarChatGeneral}
                >
                  Borrar chat general
                </button>
              )}
            </div>
          )}

          {activeTab === 'chat-privado' && (
            <div>
              {/* Aquí irá el chat privado en el futuro */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupervisorPanel;