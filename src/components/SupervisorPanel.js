import React, { useEffect, useState } from 'react';
import ChatGeneral from './ChatGeneral'; // Importa tu chat general

const initialForm = { nombre: '', email: '', password: '', rol: 'usuario' };

function SupervisorPanel({ token, usuario }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('usuarios'); // pestañas: usuarios, chat-general, chat-privado

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

  useEffect(() => {
    if (activeTab === 'usuarios') fetchUsuarios();
    setError('');
  }, [activeTab]);

  // Crear o actualizar usuario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const url = editId
        ? `http://localhost:3001/api/users/${editId}`
        : 'http://localhost:3001/api/users';
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

  // Borrar usuario
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

  // Rellenar formulario para editar
  const handleEdit = (user) => {
    setForm({ nombre: user.nombre, email: user.email, password: '', rol: user.rol });
    setEditId(user.id);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setForm(initialForm);
    setEditId(null);
  };

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: 20 }}>
      <h2>Panel de Supervisor</h2>
      {/* Pestañas */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
        <button
          style={{
            padding: '8px 20px',
            background: activeTab === 'usuarios' ? '#007bff' : '#eee',
            color: activeTab === 'usuarios' ? '#fff' : '#333',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: activeTab === 'usuarios' ? 'bold' : 'normal'
          }}
          onClick={() => setActiveTab('usuarios')}
        >
          Usuarios
        </button>
        <button
          style={{
            padding: '8px 20px',
            background: activeTab === 'chat-general' ? '#007bff' : '#eee',
            color: activeTab === 'chat-general' ? '#fff' : '#333',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: activeTab === 'chat-general' ? 'bold' : 'normal'
          }}
          onClick={() => setActiveTab('chat-general')}
        >
          Chat general
        </button>
        <button
          style={{
            padding: '8px 20px',
            background: activeTab === 'chat-privado' ? '#007bff' : '#eee',
            color: activeTab === 'chat-privado' ? '#fff' : '#333',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: activeTab === 'chat-privado' ? 'bold' : 'normal'
          }}
          onClick={() => setActiveTab('chat-privado')}
        >
          Chat privado
        </button>
      </div>

      {/* Contenido de pestañas */}
      {activeTab === 'usuarios' && (
        <>
          <h3>{editId ? 'Editar usuario' : 'Crear usuario'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400, marginBottom: 20 }}>
            <input
              type="text"
              placeholder="Nombre"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required={!editId}
            />
            <select
              value={form.rol}
              onChange={e => setForm({ ...form, rol: e.target.value })}
            >
              <option value="usuario">Usuario normal</option>
              <option value="supervisor">Supervisor</option>
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit">{editId ? 'Actualizar' : 'Crear'} usuario</button>
              {editId && <button type="button" onClick={handleCancelEdit}>Cancelar</button>}
            </div>
            {error && <p style={{ color: 'red' }}>{error}</p>}
          </form>

          <h3>Lista de usuarios</h3>
          <table border="1" cellPadding="6" style={{ width: '100%', marginTop: 10 }}>
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
                    <button onClick={() => handleEdit(user)}>Editar</button>
                    <button onClick={() => handleDelete(user.id)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
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
  );
}

export default SupervisorPanel;