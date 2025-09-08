import React from 'react';
import Chat from './Chat';

function ChatSelector({ token, user }) {
  return (
    <div className="chat-selector-container" style={{ 
      display: 'flex', 
      height: '100%', 
      minHeight: '500px'
    }}>
      {/* Panel lateral solo con botón de Chat General */}
      <div className="user-list-panel" style={{
        width: '250px',
        borderRight: '1px solid #ddd',
        padding: '15px',
        backgroundColor: '#f5f5f5'
      }}>
        <h3 style={{ marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
          Chat
        </h3>
        <div
          style={{
            padding: '10px 15px',
            margin: '5px 0',
            backgroundColor: '#3498db',
            color: 'white',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Chat General</span>
        </div>
      </div>
      {/* Área principal de chat */}
      <div className="chat-area" style={{ 
        flex: 1,
        padding: '15px'
      }}>
        <Chat token={token} user={user} />
      </div>
    </div>
  );
}

export default ChatSelector;