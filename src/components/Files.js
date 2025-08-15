import React, { useEffect, useState, useCallback } from "react";
import { fetchFiles, uploadFile } from "../api";

export default function Files({ token }) {
  const [archivos, setArchivos] = useState([]);
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");

  // Usa useCallback para que cargarArchivos pueda ir en dependencias de useEffect
  const cargarArchivos = useCallback(async () => {
    const data = await fetchFiles(token);
    setArchivos(data);
  }, [token]);

  useEffect(() => {
    cargarArchivos();
  }, [cargarArchivos]);

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
            <a
              href={`${process.env.REACT_APP_API_URL}/files/download/${a.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Descargar
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}