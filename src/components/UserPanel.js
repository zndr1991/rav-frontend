import React, { useState, useEffect } from 'react';
import ChatGeneral from './ChatGeneral';
import { io } from 'socket.io-client';
import Toasts from './Toasts';

function UserPanel({ token, usuario }) {
  const [activeTab, setActiveTab] = useState('perfil');
  const [sinLeerGeneral, setSinLeerGeneral] = useState(0);
  const [toasts, setToasts] = useState([]);

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

  // Solicitar permiso de notificación al montar el componente
  useEffect(() => {
    if (window.Notification && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  // Toast personalizado con mensajeId
  const showToast = (title, body, mensajeId) => {
    setToasts(prev => [...prev, { title, body, mensajeId }]);
    setTimeout(() => setToasts(prev => prev.slice(1)), 4000);
  };

  // Maneja el click en el toast para ir al chat general y al mensaje
  const handleToastClick = (mensajeId) => {
    setActiveTabPersist('chat-general');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('ir-a-mensaje', { detail: mensajeId }));
    }, 200); // Espera a que se monte ChatGeneral
    // Elimina la notificación pendiente
    localStorage.removeItem('mensajePendiente');
    localStorage.removeItem('mensajePendienteHora');
  };

  useEffect(() => {
    if (usuario?.id && token) {
      fetchSinLeerGeneral();

      const interval = setInterval(fetchSinLeerGeneral, 10000);

      // Socket.IO: actualiza la burbuja al instante y muestra notificación
      const socket = io(process.env.REACT_APP_API_URL.replace('/api', ''), {
        transports: ['websocket'],
        autoConnect: true
      });
      socket.on('nuevo-mensaje', (mensaje) => {
        fetchSinLeerGeneral();
        // Solo notificar si el mensaje NO es del propio usuario
        if (mensaje.usuario_id !== usuario.id) {
          const nombreRemitente = mensaje.nombre_usuario || mensaje.nombre || mensaje.autor || 'Desconocido';
          // Notificación nativa con click para ir al mensaje
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
              localStorage.removeItem('mensajePendiente');
              localStorage.removeItem('mensajePendienteHora');
            };
          }
          // Toast personalizado con mensajeId
          showToast(`Nuevo mensaje de ${nombreRemitente}`, mensaje.texto, mensaje.id);

          // Si no está en el chat general, guarda el mensaje pendiente y la hora
          if (activeTab !== 'chat-general') {
            localStorage.setItem('mensajePendiente', mensaje.id);
            localStorage.setItem('mensajePendienteHora', Date.now());
          }
        }
      });

      return () => {
        clearInterval(interval);
        socket.disconnect();
      };
    }
  }, [usuario?.id, token, activeTab]);

  // Revisa cada minuto si hay una notificación pendiente sin atender
  useEffect(() => {
    const interval = setInterval(() => {
      const mensajePendiente = localStorage.getItem('mensajePendiente');
      const horaPendiente = localStorage.getItem('mensajePendienteHora');
      if (mensajePendiente && horaPendiente) {
        const minutos = (Date.now() - Number(horaPendiente)) / 60000;
        if (minutos >= 3) {
          showToast('Tienes un mensaje sin atender', 'Haz clic para ir al mensaje', mensajePendiente);
          localStorage.setItem('mensajePendienteHora', Date.now());
        }
      }
    }, 60000); // cada minuto

    return () => clearInterval(interval);
  }, []);

  // Marcar como leídos al abrir el chat general
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
      // Elimina la notificación pendiente al abrir el chat
      localStorage.removeItem('mensajePendiente');
      localStorage.removeItem('mensajePendienteHora');
    } catch {
      // Si falla, el globito se queda igual
    }
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
            onClick={() => setActiveTabPersist('perfil')}
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
            onClick={() => setActiveTabPersist('chat-privado')}
          >
            Chat privado
          </button>
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
              <p>Chat privado próximamente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserPanel;