import React, { useEffect, useState } from "react";
import { fetchFiles, uploadFile } from "../api";

export default function Files({ token }) {
  const [archivos, setArchivos] = useState([]);
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");

  const cargarArchivos = async () => {
    const data = await fetchFiles(token);
    setArchivos(data);
  };

  useEffect(() => {
    cargarArchivos();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setMsg("");
    const data = await uploadFile(file, token);
    if (data.message) {
      setMsg("Archivo subido correctamente.");
      setFile(null);
      cargarArchivos();
    } else {
      setMsg(data.error || "No se pudo subir el archivo.");
    }
  };

  return (
    <div>
      <h2>Archivos</h2>
      <form onSubmit={handleUpload}>
        <input
          type="file"
          onChange={e => setFile(e.target.files[0])}
        />
        <button type="submit">Subir</button>
      </form>
      {msg && <p>{msg}</p>}
      <ul>
        {archivos.map(a=>(
          <li key={a.id}>
            {a.nombre_original} ({a.autor}) - {new Date(a.fecha).toLocaleString()}
            {" "}
            <a href={`http://localhost:3001/api/files/download/${a.id}`} target="_blank" rel="noopener noreferrer">
              Descargar
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}