import React, { useState, useEffect } from 'react';
import Chat from './Chat';
import PrivateChat from './PrivateChat';
import { getUsers, getUnreadMessages } from '../api';

function ChatSelector({ token, user }) {
  const [activeChat, setActiveChat] = useState('general');
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  
  // Cargar la lista de usuarios disponibles
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const data = await getUsers(token);
        console.log("Datos de usuarios recibidos:", data); // Para depuración
        
        if (Array.isArray(data)) {
          // Filtrar al usuario actual de la lista
          setUsers(data.filter(u => u.id !== user.id));
        } else if (data.error) {
          setError(data.error);
        }
      } catch (err) {
        console.error("Error al cargar usuarios:", err);
        setError('Error al cargar usuarios: ' + (err.message || 'Error desconocido'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [token, user.id]);
  
  // Actualizar contador de mensajes no leídos periódicamente
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      try {
        const data = await getUnreadMessages(token);
        if (!data.error) {
          setUnreadCounts(data);
        }
      } catch (err) {
        console.error('Error al obtener mensajes no leídos:', err);
      }
    };
    
    // Cargar inicialmente
    fetchUnreadCounts();
    
    // Configurar actualización periódica
    const intervalId = setInterval(fetchUnreadCounts, 10000); // Cada 10 segundos
    
    return () => clearInterval(intervalId);
  }, [token]);
  
  // Manejar la selección de un usuario para chat privado
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setActiveChat('private');
  };
  
  // Volver al chat general
  const handleBackToGeneral = () => {
    setActiveChat('general');
    setSelectedUser(null);
  };
  
  return (
    <div className="chat-selector-container" style={{ 
      display: 'flex', 
      height: '100%', 
      minHeight: '500px'
    }}>
      {/* Panel lateral con lista de usuarios */}
      <div className="user-list-panel" style={{
        width: '250px',
        borderRight: '1px solid #ddd',
        padding: '15px',
        backgroundColor: '#f5f5f5'
      }}>
        <h3 style={{ marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
          Chat
        </h3>
        
        {/* Botón para chat general */}
        <div 
          onClick={() => handleBackToGeneral()}
          style={{
            padding: '10px 15px',
            margin: '5px 0',
            backgroundColor: activeChat === 'general' ? '#3498db' : '#e0e0e0',
            color: activeChat === 'general' ? 'white' : 'black',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: activeChat === 'general' ? 'bold' : 'normal',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Chat General</span>
          {unreadCounts['general'] && unreadCounts['general'] > 0 && (
            <span style={{
              backgroundColor: '#e74c3c',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              {unreadCounts['general']}
            </span>
          )}
        </div>
        
        {/* Título de mensajes privados */}
        <div style={{ 
          margin: '15px 0 10px', 
          fontSize: '14px', 
          color: '#666', 
          fontWeight: 'bold' 
        }}>
          Mensajes Privados
        </div>
        
        {/* Lista de usuarios */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            Cargando usuarios...
          </div>
        ) : (
          <div className="users-list">
            {users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '10px', color: '#666' }}>
                No hay usuarios disponibles
              </div>
            ) : (
              users.map(u => (
                <div 
                  key={u.id}
                  onClick={() => handleUserSelect(u)}
                  style={{
                    padding: '10px 15px',
                    margin: '5px 0',
                    backgroundColor: (activeChat === 'private' && selectedUser?.id === u.id) 
                      ? '#3498db' 
                      : '#e0e0e0',
                    color: (activeChat === 'private' && selectedUser?.id === u.id) 
                      ? 'white' 
                      : 'black',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>
                    {u.nombre}
                    {(u.rol === 'admin' || u.rol === 'supervisor' || u.rol === 'administrador') && (
                      <small style={{
                        backgroundColor: '#7f8c8d',
                        color: 'white',
                        padding: '2px 5px',
                        borderRadius: '3px',
                        marginLeft: '5px',
                        fontSize: '10px'
                      }}>
                        Admin
                      </small>
                    )}
                  </span>
                  {unreadCounts[u.id] && unreadCounts[u.id] > 0 && (
                    <span style={{
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px'
                    }}>
                      {unreadCounts[u.id]}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Mostrar error si existe */}
        {error && (
          <div style={{ 
            color: '#e74c3c', 
            padding: '10px', 
            marginTop: '10px', 
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}
      </div>
      
      {/* Área principal de chat */}
      <div className="chat-area" style={{ 
        flex: 1,
        padding: '15px'
      }}>
        {activeChat === 'general' ? (
          <Chat token={token} user={user} />
        ) : (
          <PrivateChat 
            token={token} 
            user={user} 
            recipient={selectedUser} 
            onBack={handleBackToGeneral}
          />
        )}
      </div>
    </div>
  );
}

export default ChatSelector;