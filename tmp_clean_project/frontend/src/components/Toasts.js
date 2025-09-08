import React from 'react';

function Toasts({ toasts, removeToast, onToastClick }) {
  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 30,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }}>
      {toasts.map((toast, idx) => (
        <div
          key={idx}
          className="toast"
          onClick={() => {
            if (toast.mensajeId && onToastClick) {
              onToastClick(toast.mensajeId);
            }
            removeToast(idx);
          }}
          style={{
            background: '#007bff',
            color: '#fff',
            padding: '18px 22px',
            borderRadius: 12,
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
            fontWeight: 'bold',
            fontSize: 19,
            cursor: toast.mensajeId ? 'pointer' : 'default',
            minWidth: 260,
            maxWidth: 400,
            userSelect: 'none'
          }}
        >
          <div>{toast.title}</div>
          <div style={{ fontWeight: 400, fontSize: 17, marginTop: 2 }}>{toast.body}</div>
        </div>
      ))}
    </div>
  );
}

export default Toasts;