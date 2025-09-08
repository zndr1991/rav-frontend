const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');

function createWindow() {

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Forzar el foco en la ventana al crearla
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    // Abrir DevTools automáticamente para depuración
    try {
      win.webContents.openDevTools({ mode: 'right' });
    } catch (e) {
      console.warn('No se pudo abrir DevTools automáticamente:', e);
    }
  });

  // Cargar el index.html usando file:// y path.join para compatibilidad empaquetada
  win.loadURL(
    url.format({
      pathname: path.join(__dirname, 'build', 'index.html'),
      protocol: 'file:',
      slashes: true
    })
  );
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
