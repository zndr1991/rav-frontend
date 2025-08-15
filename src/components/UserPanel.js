import React, { useState } from 'react';
import ChatGeneral from './ChatGeneral';

function UserPanel({ token, usuario }) {
  const [activeTab, setActiveTab] = useState('perfil');
  const [sinLeerGeneral, setSinLeerGeneral] = useState(0);

  // Obtener mensajes sin leer del chat general
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

  // Marcar como leídos al abrir el chat general
  const handleChatGeneralClick = async () => {
    setActiveTab('chat-general');
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
          marginLeft: 0
        }}>
          <button
            style={{
              width: 400,
              padding: '15px 0',
              background: activeTab === 'perfil' ? '#007bff' : '#eee',
              color: activeTab === 'perfil' ? '#fff' : '#333',
              border: activeTab === 'perfil' ? '2px solid #222' : 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 21,
              boxShadow: activeTab === 'perfil' ? '0 2px 6px rgba(0,0,0,0.09)' : undefined,
              textAlign: 'center'
            }}
            onClick={() => setActiveTab('perfil')}
          >
            Perfil
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
            onClick={() => setActiveTab('chat-privado')}
          >
            Chat privado
          </button>
        </div>
        {/* Columna derecha: contenido según pestaña */}
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
              {/* Aquí irá el chat privado en el futuro */}
              <p>Chat privado próximamente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserPanel;