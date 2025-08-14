import React, { useEffect, useState } from 'react';
import ChatGeneral from './ChatGeneral';

const initialForm = { nombre: '', email: '', password: '', rol: 'usuario' };

function SupervisorPanel({ token, usuario }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('usuarios');
  const [sinLeerGeneral, setSinLeerGeneral] = useState(0);

  // Obtener lista de usuarios
  const fetchUsuarios = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/users', {
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

  // Cargar los mensajes sin leer del chat general (NO cuenta los propios)
  const fetchSinLeerGeneral = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/chat/group/unread/${usuario.id}`, {
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
    return () => clearInterval(interval);
  }, [usuario.id, token, activeTab]);

  const handleChatGeneralClick = async () => {
    setActiveTab('chat-general');
    try {
      await fetch('http://localhost:3001/api/chat/group/visit', {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const url = editId
        ? `http://localhost:3001/api/users/${editId}`
        : 'http://localhost:3001/api/users/register';
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
        const res = await fetch(`http://localhost:3001/api/users/${id}`, {
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
        {/* Columna izquierda: botones pegados al margen izquierdo */}
        <div style={{
          minWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          alignItems: 'flex-start',
          marginLeft: 0 // <- pegado al margen!
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
            onClick={() => setActiveTab('usuarios')}
          >
            Administración de Usuarios
          </button>
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
            onClick={() => setActiveTab('chat-privado')}
          >
            Chat privado
          </button>
        </div>
        {/* Columna derecha: contenido de pestañas */}
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
            <ChatGeneral token={token} usuario={usuario} />
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