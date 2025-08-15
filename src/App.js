import React, { useState } from 'react';
import Login from './components/Login';
import SupervisorPanel from './components/SupervisorPanel';
import UserPanel from './components/UserPanel';

function App() {
  // Leer token y usuario desde localStorage al iniciar
  const [user, setUser] = useState(
    localStorage.getItem('usuario') ? JSON.parse(localStorage.getItem('usuario')) : null
  );
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  // Recibe { user, token } del Login
  const handleLogin = ({ user, token }) => {
    setUser(user);
    setToken(token);
    localStorage.setItem('usuario', JSON.stringify(user));
    localStorage.setItem('token', token);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('usuario');
    localStorage.removeItem('token');
    localStorage.removeItem('supervisorActiveTab'); // Opcional: limpiar pestaña activa
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