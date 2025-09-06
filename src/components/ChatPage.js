import React from 'react';
import ChatSelector from '../components/ChatSelector'; // Cambia la importación

function ChatPage({ token, user }) {
  return (
    <div className="container">
      <h1>Sistema de Chat y Archivos</h1>
      <ChatSelector token={token} user={user} /> {/* Cambia el componente */}
    </div>
  );
}

export default ChatPage;