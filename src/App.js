import React, { useState } from 'react';
import Login from './components/Login';
import SupervisorPanel from './components/SupervisorPanel';
import UserPanel from './components/UserPanel';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const handleLogin = ({ usuario, token }) => {
    setUser(usuario);
    setToken(token);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <div>
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px' }}>
            <h1>Bienvenido, {user.nombre}</h1>
            <button onClick={handleLogout}>Cerrar sesión</button>
          </div>
          {user.rol === 'supervisor' ? (
            <SupervisorPanel token={token} usuario={user} />
          ) : (
            <UserPanel token={token} usuario={user} />
          )}
        </>
      )}
    </div>
  );
}

export default App;