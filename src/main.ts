import {app, BrowserWindow, screen} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {registerAllIpcHandlers} from "./ipc";
import {loadSettings} from "./settings";
import {startServer} from "./ipc/server";


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  console.log('icon',path.join(__dirname, 'assets/icons/png/logo1024.png'))
  const mainWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    frame: false,
    icon: 'assets/logo1024.png',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.maximize();
  if (app.isPackaged) mainWindow.removeMenu();

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  if (!app.isPackaged) mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  registerAllIpcHandlers();
  createWindow();

  const settings = loadSettings();
  if (settings.serverAutoStart) {
    startServer(settings.serverPort).catch((err) =>
        console.error("Failed to auto-start i18next server:", err)
    );
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

