import { io } from 'socket.io-client';


// URLs para fallback
const REMOTE_BACKEND_URL = "https://rav-backend.onrender.com";
const LOCAL_BACKEND_URL = "http://localhost:3001";

// Intenta primero localhost, si falla usa Render
export async function fetchWithFallback(path, options = {}) {
  try {
    // Intentar con localhost
    const res = await fetch(`${LOCAL_BACKEND_URL}/api${path}`, options);
    if (!res.ok) throw new Error('Localhost error');
    return res;
  } catch (err) {
    // Si falla, intenta con Render
    return fetch(`${REMOTE_BACKEND_URL}/api${path}`, options);
  }
}

// Para compatibilidad con el resto del código
const BASE_URL = LOCAL_BACKEND_URL; // Para WebSocket y archivos
const API_URL = LOCAL_BACKEND_URL + "/api"; // Para fetch HTTP

let socketInstance = null;

// Inicializar Socket.io con mejor manejo de token
export const initSocket = (token) => {
  if (!token) {
    console.error("No se puede inicializar WebSocket sin token");
    return null;
  }
  
  try {
    // Cerrar conexión existente si la hay
    if (socketInstance && socketInstance.connected) {
      console.log("Cerrando conexión Socket.io anterior");
      socketInstance.disconnect();
    }
    
    // Asegurarse de que el token esté en formato limpio (sin 'Bearer ')
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    // Configurar nueva conexión enviando el token en todos los lugares posibles
    console.log(`Inicializando WebSocket con token: ${cleanToken.substring(0, 15)}...`);
    
    socketInstance = io(BASE_URL, {
      // Auth object (método principal)
      auth: { token: cleanToken },
      
      // Query params (método alternativo)
      query: { token: cleanToken },
      
      // Headers para HTTP long-polling
      transportOptions: {
        polling: {
          extraHeaders: {
            Authorization: `Bearer ${cleanToken}`
          }
        }
      },
      
      // Configuración de transporte
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });
    
    // Configurar manejadores de eventos básicos con más detalles
    socketInstance.on('connect', () => {
      console.log("Socket.io conectado exitosamente:", socketInstance.id);
    });
    
    socketInstance.on('connect_error', (err) => {
      console.error("Error de conexión Socket.io:", err.message);
      console.log("Detalles adicionales:", err);
      
      // Intento de diagnóstico
  fetchWithFallback('/verify-token', {
        headers: { Authorization: `Bearer ${cleanToken}` }
      })
      .then(res => res.json())
      .then(data => {
        console.log("Resultado de verificación de token:", data);
      })
      .catch(error => {
        console.error("Error verificando token:", error);
      });
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.log("Socket.io desconectado:", reason);
    });
    
    socketInstance.on('connection-status', (data) => {
      console.log("Estado de conexión Socket.io:", data);
    });
    
    return socketInstance;
  } catch (err) {
    console.error("Error al inicializar Socket.io:", err);
    return null;
  }
};

// Verificar si hay conexión Socket.io activa
export const isSocketConnected = () => {
  return socketInstance && socketInstance.connected;
};

// Obtener la instancia del socket
export const getSocket = () => {
  return socketInstance;
};

// Reconectar si la conexión se perdió
export const reconnectSocket = (token) => {
  if (socketInstance && !socketInstance.connected) {
    console.log("Intentando reconectar socket existente...");
    socketInstance.connect();
    return true;
  } else if (!socketInstance) {
    console.log("Creando nueva instancia de socket...");
    return initSocket(token) !== null;
  }
  
  console.log("Socket ya está conectado");
  return false;
};

// Verificar explícitamente un token
export async function verifyToken(token) {
  try {
  const res = await fetchWithFallback('/verify-token', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return await res.json();
  } catch (error) {
    console.error("Error verificando token:", error);
    return { error: error.message };
  }
}

export async function login(email, password) {
  const res = await fetchWithFallback('/users/login', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  
  // Si el login fue exitoso, iniciar el socket automáticamente
  if (data.token) {
    console.log("Login exitoso, inicializando socket");
    initSocket(data.token);
  }
  
  return data;
}

export async function register(nombre, email, password, rol) {
  const res = await fetchWithFallback('/users/register', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, email, password, rol }),
  });
  return res.json();
}

export async function fetchChat(token) {
  try {
  const res = await fetchWithFallback('/chat/general', {
      headers: { Authorization: "Bearer " + token },
    });
    return res.json();
  } catch (error) {
    console.error("Error fetchChat:", error);
    return [];
  }
}

export async function sendMessage(mensaje, token, archivos = []) {
  try {
    // Si no hay archivos o solo hay uno, enviar en una sola petición
    if (archivos.length <= 1) {
      const formData = new FormData();
      formData.append("mensaje", mensaje || "");
      formData.append("de_usuario", "1");
      
      if (archivos.length === 1) {
        formData.append("archivos", archivos[0]);
      }
      
  const res = await fetchWithFallback('/chat/general', {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
        },
        body: formData,
      });
      
      return await res.json();
    }
    
    // Si hay múltiples archivos, usamos el enfoque original
    let ultimaRespuesta;
    
    // Primer archivo con el mensaje
    const primerFormData = new FormData();
    primerFormData.append("mensaje", mensaje);
    primerFormData.append("de_usuario", "1");
    primerFormData.append("archivos", archivos[0]);
    
  const respuestaPrimero = await fetchWithFallback('/chat/general', {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: primerFormData,
    });
    ultimaRespuesta = await respuestaPrimero.json();
    
    // Si hay más archivos, enviar el resto uno por uno
    for(let i = 1; i < archivos.length; i++) {
      const otroFormData = new FormData();
      otroFormData.append("mensaje", ""); // Mensaje vacío
      otroFormData.append("de_usuario", "1");
      otroFormData.append("archivos", archivos[i]);
      
  const respuesta = await fetchWithFallback('/chat/general', {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: otroFormData,
      });
      ultimaRespuesta = await respuesta.json();
    }
    
    return {
      message: `Mensaje enviado con ${archivos.length} archivos.`,
      archivos_enviados: archivos.length,
      ...ultimaRespuesta
    };
  } catch (error) {
    console.error("Error enviando mensaje:", error);
    return {
      error: "Error al enviar: " + error.message
    };
  }
}

// Obtener lista de usuarios
export async function getUsers(token) {
  try {
  const res = await fetchWithFallback('/users', {
      headers: { Authorization: "Bearer " + token },
    });
    return await res.json();
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return { error: error.message || 'Error al cargar la lista de usuarios' };
  }
}

// Obtener usuarios en línea
export async function getOnlineUsers() {
  try {
  const res = await fetchWithFallback('/users/online');
    return await res.json();
  } catch (error) {
    console.error("Error al obtener usuarios en línea:", error);
    return [];
  }
}

export async function deleteMessage(id, token) {
  const res = await fetchWithFallback(`/chat/general/${id}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });
  return res.json();
}

// Eliminar un archivo adjunto específico
export async function deleteFile(id, token) {
  const res = await fetchWithFallback(`/chat/archivo/${id}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });
  return res.json();
}

export async function editMessage(id, mensaje, token) {
  const res = await fetchWithFallback(`/chat/general/${id}`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ mensaje })
  });
  return res.json();
}

export async function fetchFiles(token) {
  const res = await fetchWithFallback('/files/', {
    headers: { Authorization: "Bearer " + token },
  });
  return res.json();
}

export async function uploadFile(file, token) {
  const formData = new FormData();
  formData.append("archivo", file);

  const res = await fetchWithFallback('/files/upload', {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: formData,
  });

  return res.json();
}

// Obtiene la URL para descargar un archivo
export function getFileUrl(filename) {
  if (!filename) return "";
  return `${BASE_URL}/uploads/${filename}`;
}

// Función de prueba para verificar la carga de múltiples archivos
export async function testFileUpload(token, archivos = []) {
  try {
    const formData = new FormData();
    archivos.forEach(archivo => {
      formData.append("archivos", archivo);
    });
    
  const res = await fetchWithFallback('/chat/test-upload', {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
      },
      body: formData
    });
    
    return await res.json();
  } catch (error) {
    console.error("Error en prueba de carga:", error);
    return { error: "Error en prueba de carga: " + error.message };
  }
}

// Subir adjunto a mensaje privado
export async function subirAdjuntoPrivado(formData, token) {
  const res = await fetchWithFallback('/chat/privado/subir-adjunto', {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token
    },
    body: formData
  });
  return await res.json();
}

// Eliminar adjunto de mensaje privado
export async function eliminarAdjuntoPrivado({ mensajeId, adjuntoIdx }, token) {
  const res = await fetchWithFallback('/chat/privado/eliminar-adjunto', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ mensajeId, adjuntoIdx })
  });
  return await res.json();
}