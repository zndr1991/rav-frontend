import React, { useEffect, useState } from 'react';

/**
 * Este componente muestra SOLO el chat grupal.
 * El badge/globito de mensajes sin leer debe aparecer en el tab superior (en SupervisorPanel.js), NO aquí.
 */

function ChatGeneral({ token, usuario }) {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);

  // Cargar mensajes al montar el componente
  useEffect(() => {
    async function fetchMensajes() {
      try {
        const res = await fetch('http://localhost:3001/api/chat/group', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setMensajes(data);
        } else {
          setMensajes([{ texto: 'Error al cargar mensajes.' }]);
        }
      } catch (err) {
        setMensajes([{ texto: 'Error al cargar mensajes.' }]);
      }
    }
    fetchMensajes();
  }, [token]);

  // Enviar mensaje
  async function enviarMensaje(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/chat/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          usuario_id: usuario.id,
          nombre_usuario: usuario.nombre,
          texto
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMensajes(mensajes => [...mensajes, data]);
        setTexto('');
      } else {
        alert(data.error || 'Error al enviar mensaje');
      }
    } catch (err) {
      alert('Error al conectar con el servidor');
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 500, margin: 'auto', marginTop: 40 }}>
      <div style={{
        border: '1px solid #CCC',
        borderRadius: 6,
        padding: 10,
        height: 300,
        overflowY: 'auto',
        marginBottom: 15,
        background: '#fafafa'
      }}>
        {mensajes.length === 0 && <div>No hay mensajes aún.</div>}
        {mensajes.map(msg => (
          <div key={msg.id || Math.random()} style={{ marginBottom: 10 }}>
            <b>{msg.nombre_usuario}</b> <span style={{ color: '#888', fontSize: 12 }}>
              {msg.fecha ? new Date(msg.fecha).toLocaleString() : ''}
            </span>
            <div>{msg.texto}</div>
          </div>
        ))}
      </div>
      <form onSubmit={enviarMensaje} style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribe tu mensaje..."
          style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #CCC' }}
          disabled={loading}
        />
        <button
          type="submit"
          style={{ padding: '8px 20px', borderRadius: 4, border: 'none', background: '#007bff', color: '#fff' }}
          disabled={loading || !texto.trim()}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

export default ChatGeneral;