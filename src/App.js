import React, { useState, useRef } from 'react';
import Login from './components/Login';
import SupervisorPanel from './components/SupervisorPanel';
import UserPanel from './components/UserPanel';
import { io } from 'socket.io-client';

function App() {
  // Leer token y usuario desde localStorage al iniciar
  const [user, setUser] = useState(
    localStorage.getItem('usuario') ? JSON.parse(localStorage.getItem('usuario')) : null
  );
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  // Referencia global al socket
  const socketRef = useRef(null);

  // Inicializar socket solo si hay usuario y token
  React.useEffect(() => {
    if (user && token && !socketRef.current) {
      socketRef.current = io(process.env.REACT_APP_API_URL.replace('/api', ''), {
        transports: ['websocket'],
        autoConnect: true
      });

      socketRef.current.on('connect', () => {
        socketRef.current.emit('usuario-en-linea', {
          usuario_id: user.id,
          nombre: user.nombre,
          enLinea: true
        });
      });
    }
    // No desconectar aquí, solo en logout
    // eslint-disable-next-line
  }, [user, token]);

  // Recibe { user, token } del Login
  const handleLogin = ({ user, token }) => {
    setUser(user);
    setToken(token);
    localStorage.setItem('usuario', JSON.stringify(user));
    localStorage.setItem('token', token);
  };

  const handleLogout = () => {
    // Solo aquí se desconecta y se pone fuera de línea
    if (socketRef.current) {
      socketRef.current.emit('usuario-en-linea', {
        usuario_id: user.id,
        nombre: user.nombre,
        enLinea: false
      });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('usuario');
    localStorage.removeItem('token');
    localStorage.removeItem('supervisorActiveTab');
    localStorage.removeItem('userActiveTab');
    localStorage.removeItem('userChatPrivadoDestinatario');
    localStorage.removeItem('supervisorChatPrivadoDestinatario');
  };

  return (
    <div>
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px' }}>
            <h1>Hola, {user.nombre}</h1>
            <button onClick={handleLogout}>Cerrar sesión</button>
          </div>
          {user.rol === 'supervisor' ? (
            <SupervisorPanel token={token} usuario={user} socket={socketRef.current} />
          ) : (
            <UserPanel token={token} usuario={user} socket={socketRef.current} />
          )}
        </>
      )}
    </div>
  );
}

export default App;