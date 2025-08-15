import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function ChatGeneral({ token, usuario }) {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchMensajes() {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/chat/group`, {
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

    // Socket.IO: actualiza mensajes en tiempo real
    const socket = io(process.env.REACT_APP_API_URL.replace('/api', ''), {
      transports: ['websocket'],
      autoConnect: true
    });
    socket.on('nuevo-mensaje', (nuevoMensaje) => {
      setMensajes(mensajes => [...mensajes, nuevoMensaje]);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const enviarMensaje = async () => {
    if (!texto.trim()) return;
    setLoading(true);
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/chat/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          usuario_id: usuario.id,
          nombre_usuario: usuario.nombre,
          texto
        })
      });
      setTexto('');
    } catch (err) {
      // Error al enviar mensaje
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #ccc', marginBottom: 20 }}>
        {mensajes.map((msg, idx) => (
          <div key={msg.id || idx} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
            <strong>{msg.nombre_usuario}:</strong> {msg.texto}
            <span style={{ float: 'right', color: '#888', fontSize: 12 }}>
              {msg.fecha ? new Date(msg.fecha).toLocaleString() : ''}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          style={{ flex: 1, padding: 8, fontSize: 16 }}
          placeholder="Escribe tu mensaje..."
        />
        <button onClick={enviarMensaje} disabled={loading || !texto.trim()} style={{ padding: '8px 16px', fontSize: 16 }}>
          Enviar
        </button>
      </div>
    </div>
  );
}

export default ChatGeneral;