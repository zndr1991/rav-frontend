import { io } from 'socket.io-client';

const API_URL = "https://rav-backend.onrender.com/api";
const BASE_URL = "https://rav-backend.onrender.com";

// Variable global para mantener la instancia del socket
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
      fetch(`${API_URL}/verify-token`, {
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
    const res = await fetch(`${API_URL}/verify-token`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return await res.json();
  } catch (error) {
    console.error("Error verificando token:", error);
    return { error: error.message };
  }
}

export async function login(email, password) {
  const res = await fetch(`${API_URL}/users/login`, {
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
  const res = await fetch(`${API_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, email, password, rol }),
  });
  return res.json();
}

export async function fetchChat(token) {
  try {
    const res = await fetch(`${API_URL}/chat/general`, {
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
      
      if (archivos.length === 1) {
        formData.append("archivos", archivos[0]);
      }
      
      const res = await fetch(`${API_URL}/chat/general`, {
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
    primerFormData.append("archivos", archivos[0]);
    
    const respuestaPrimero = await fetch(`${API_URL}/chat/general`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: primerFormData,
    });
    ultimaRespuesta = await respuestaPrimero.json();
    
    // Si hay más archivos, enviar el resto uno por uno
    for(let i = 1; i < archivos.length; i++) {
      const otroFormData = new FormData();
      otroFormData.append("mensaje", ""); // Mensaje vacío
      otroFormData.append("archivos", archivos[i]);
      
      const respuesta = await fetch(`${API_URL}/chat/general`, {
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

// NUEVAS FUNCIONES PARA CHAT PRIVADO

// Obtener lista de usuarios
export async function getUsers(token) {
  try {
    const res = await fetch(`${API_URL}/users`, {
      headers: { Authorization: "Bearer " + token },
    });
    return await res.json();
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return { error: error.message || 'Error al cargar la lista de usuarios' };
  }
}

// Obtener mensajes privados con un usuario específico
export async function fetchPrivateChat(token, userId) {
  try {
    const res = await fetch(`${API_URL}/chat/privado/${userId}`, {
      headers: { Authorization: "Bearer " + token },
    });
    return await res.json();
  } catch (error) {
    console.error("Error al cargar chat privado:", error);
    return { error: error.message || 'Error al cargar mensajes privados' };
  }
}

// Función optimizada para enviar mensajes privados con múltiples archivos
export async function sendPrivateMessage(mensaje, token, userId, archivos = []) {
  try {
    console.log(`Enviando mensaje a usuario ${userId} con ${archivos.length} archivos`);
    
    // Enfoque alternativo: enviar archivos uno por uno
    if (archivos.length === 0) {
      // Sin archivos, enviar solo mensaje
      const formData = new FormData();
      formData.append("mensaje", mensaje || "");
      formData.append("para_usuario", userId);
      
      const res = await fetch(`${API_URL}/chat/privado`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
        },
        body: formData,
      });
      
      return await res.json();
    } else {
      // Con archivos, enviar primero el mensaje con el primer archivo
      const primerFormData = new FormData();
      primerFormData.append("mensaje", mensaje || "");
      primerFormData.append("para_usuario", userId);
      primerFormData.append("archivos", archivos[0]);
      
      const primerRes = await fetch(`${API_URL}/chat/privado`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
        },
        body: primerFormData,
      });
      
      let resultadoPrincipal = await primerRes.json();
      
      // Si hay más archivos, enviarlos uno por uno
      const archivosSiguientes = archivos.slice(1);
      for (let i = 0; i < archivosSiguientes.length; i++) {
        const formData = new FormData();
        formData.append("mensaje", ""); // Mensaje vacío para archivos adicionales
        formData.append("para_usuario", userId);
        formData.append("archivos", archivosSiguientes[i]);
        
        const res = await fetch(`${API_URL}/chat/privado`, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
          },
          body: formData,
        });
        
        await res.json(); // Procesamos pero no necesitamos guardar cada respuesta
      }
      
      // Devolver resultado con información adicional
      return {
        ...resultadoPrincipal,
        totalArchivos: archivos.length,
        mensaje: "Mensaje enviado correctamente con múltiples archivos"
      };
    }
  } catch (error) {
    console.error("Error enviando mensaje privado:", error);
    return { error: "Error al enviar mensaje: " + error.message };
  }
}

// Obtener conteo de mensajes no leídos
export async function getUnreadMessages(token) {
  try {
    const res = await fetch(`${API_URL}/chat/no-leidos`, {
      headers: { Authorization: "Bearer " + token },
    });
    return await res.json();
  } catch (error) {
    console.error("Error al obtener mensajes no leídos:", error);
    return { error: error.message || 'Error al obtener mensajes no leídos' };
  }
}

// Marcar mensajes como leídos para un usuario específico
export async function markMessagesAsRead(token, userId) {
  try {
    const res = await fetch(`${API_URL}/chat/marcar-leidos/${userId}`, {
      method: "POST",
      headers: { 
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    return await res.json();
  } catch (error) {
    console.error("Error al marcar mensajes como leídos:", error);
    return { error: error.message || 'Error al actualizar estado de lectura' };
  }
}

// Eliminar todos los archivos adjuntos de un mensaje o grupo de mensajes - VERSIÓN COMPLETAMENTE MEJORADA
export async function deletePrivateAttachments(token, options = {}) {
  try {
    console.log("Solicitud para eliminar grupo de archivos:", options);
    
    // Verificar que las opciones son válidas
    if (!options || typeof options !== 'object') {
      return { error: "Opciones de eliminación inválidas" };
    }
    
    // Asegurarse de que tenemos al menos un parámetro de filtrado
    if (!options.timestamp && !options.usuario_id && !options.mensaje_id && !options.grupo_id) {
      return { error: "Debe proporcionar al menos un criterio de filtrado" };
    }
    
    // Preparar request con método alternativo y mejor tratamiento de errores
    try {
      const response = await fetch(`${API_URL}/chat/privado/archivos`, {
        method: "DELETE",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(options)
      });
      
      // Verificar primero si hubo un error HTTP
      if (!response.ok) {
        // Intentar obtener el mensaje de error del servidor
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || `Error ${response.status}: ${response.statusText}`;
        } catch (parseError) {
          // Si no podemos parsear la respuesta como JSON
          const errorText = await response.text();
          errorMessage = `Error ${response.status}: ${errorText.substring(0, 100)}`;
        }
        
        console.error("Error al eliminar archivos:", errorMessage);
        return { 
          error: errorMessage,
          status: response.status
        };
      }
      
      // Si la respuesta está bien, intentar parsear como JSON
      try {
        const data = await response.json();
        console.log("Respuesta exitosa al eliminar archivos:", data);
        return data;
      } catch (jsonError) {
        // Manejar caso donde la respuesta no es JSON
        const responseText = await response.text();
        console.error("Error al procesar respuesta JSON:", jsonError);
        console.error("Texto de respuesta:", responseText.substring(0, 200));
        
        // Como la operación HTTP fue exitosa, asumimos que los archivos se eliminaron
        return { 
          success: true,
          warning: "Operación exitosa pero formato de respuesta no esperado",
          responseText: responseText.substring(0, 100)
        };
      }
    } catch (fetchError) {
      // Error de red o solicitud
      console.error("Error de red en la solicitud:", fetchError);
      return { 
        error: "Error de red al eliminar archivos: " + fetchError.message
      };
    }
  } catch (generalError) {
    // Error general (muy improbable que ocurra, pero por si acaso)
    console.error("Error general en deletePrivateAttachments:", generalError);
    return { 
      error: "Error inesperado: " + generalError.message
    };
  }
}

export async function deleteMessage(id, token) {
  const res = await fetch(`${API_URL}/chat/general/${id}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });
  return res.json();
}

// Eliminar un archivo adjunto específico
export async function deleteFile(id, token) {
  const res = await fetch(`${API_URL}/chat/archivo/${id}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });
  return res.json();
}

export async function editMessage(id, mensaje, token) {
  const res = await fetch(`${API_URL}/chat/general/${id}`, {
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
  const res = await fetch(`${API_URL}/files/`, {
    headers: { Authorization: "Bearer " + token },
  });
  return res.json();
}

export async function uploadFile(file, token) {
  const formData = new FormData();
  formData.append("archivo", file);

  const res = await fetch(`${API_URL}/files/upload`, {
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
    
    const res = await fetch(`${API_URL}/chat/test-upload`, {
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