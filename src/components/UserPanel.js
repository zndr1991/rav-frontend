import React, { useState } from 'react';
import ChatGeneral from './ChatGeneral';

function UserPanel({ token, usuario }) {
  const [activeTab, setActiveTab] = useState('perfil'); // pestañas: perfil, chat-general, chat-privado

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: 20 }}>
      <h2>Panel de Usuario</h2>
      {/* Pestañas */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
        <button
          style={{
            padding: '8px 20px',
            background: activeTab === 'perfil' ? '#007bff' : '#eee',
            color: activeTab === 'perfil' ? '#fff' : '#333',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: activeTab === 'perfil' ? 'bold' : 'normal'
          }}
          onClick={() => setActiveTab('perfil')}
        >
          Perfil
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
          {/* Aquí irá el chat privado en el futuro */}
          <p>Chat privado próximamente.</p>
        </div>
      )}
    </div>
  );
}

export default UserPanel;