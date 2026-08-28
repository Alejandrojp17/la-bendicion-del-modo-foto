// Colección de capturas de fotografía virtual (La Bendición del Modo Foto)
let captures = [];

// Estado de navegación
let currentFolder = null; // null = Vista de Carpetas, string = Nombre del juego abierto
let activeCaptureId = null;

// Elementos DOM
const navigationHeader = document.getElementById("navigationHeader");
const mainGrid = document.getElementById("mainGrid");
const emptyState = document.getElementById("emptyState");

// Modal de Visor Ampliado (Sólo Imagen)
const viewerModal = document.getElementById("viewerModal");
const viewerContent = document.getElementById("viewerContent");
const viewerImage = document.getElementById("viewerImage");
const closeViewerBtn = document.getElementById("closeViewerBtn");

// Contenedor y Modales de Administración
const adminContainer = document.getElementById("adminContainer");
const adminModal = document.getElementById("adminModal");
const openAdminBtn = document.getElementById("openAdminBtn");
const closeAdminBtn = document.getElementById("closeAdminBtn");
const adminUploadForm = document.getElementById("adminUploadForm");

// Modal de Contraseña
const passwordModal = document.getElementById("passwordModal");
const passwordForm = document.getElementById("passwordForm");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const passwordError = document.getElementById("passwordError");

// Hash criptográfico SHA-256 de 'Proyectopropro'
const MASTER_PASSWORD_HASH = "737f56f0b1b93d4328e10c687e407aa0f17c15e235d1e44b0ccebe007d0926f4";

// Configuración por defecto de Cloudinary
let CLOUDINARY_CLOUD_NAME = localStorage.getItem("cloudinary_cloud_name") || "m44qkn0g";
let CLOUDINARY_UPLOAD_PRESET = localStorage.getItem("cloudinary_preset") || "ml_default";

// Función asíncrona para calcular Hash SHA-256
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

let titleClickCount = 0;
let titleClickTimer = null;

// Inicialización asíncrona limpia
async function initApp() {
  await loadSavedCaptures();
  initDragAndDrop();
  checkAdminSession();
  checkUrlHashNavigation();
  renderApp();

  // Escuchar la flecha Atrás / Adelante del navegador (Historial SPA)
  window.addEventListener("popstate", () => {
    checkUrlHashNavigation();
    renderApp();
  });

  // Listeners del visor modal
  if (closeViewerBtn) closeViewerBtn.addEventListener("click", closeViewerModal);
  if (viewerModal) {
    viewerModal.addEventListener("click", (e) => {
      if (e.target === viewerModal) closeViewerModal();
    });
  }

  // Atajo de teclado: Esc para cerrar, Flecha Izquierda / Derecha para navegar capturas
  document.addEventListener("keydown", (e) => {
    if (viewerModal && !viewerModal.classList.contains("hidden")) {
      if (e.key === "Escape") closeViewerModal();
      if (e.key === "ArrowLeft") navigateViewer(-1);
      if (e.key === "ArrowRight") navigateViewer(1);
      return;
    }

    if (e.key === "Escape") {
      if (adminModal && !adminModal.classList.contains("hidden")) closeAdminModal();
      if (passwordModal && !passwordModal.classList.contains("hidden")) closePasswordModal();
    }
    
    // Atajo secreto Ctrl + Shift + A
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      requestAdminAccess();
    }
  });

  // Listeners de administración
  if (openAdminBtn) openAdminBtn.addEventListener("click", openAdminModal);
  if (closeAdminBtn) closeAdminBtn.addEventListener("click", closeAdminModal);
  if (adminModal) {
    adminModal.addEventListener("click", (e) => {
      if (e.target === adminModal) closeAdminModal();
    });
  }
  if (passwordModal) {
    passwordModal.addEventListener("click", (e) => {
      if (e.target === passwordModal) closePasswordModal();
    });
  }
}



const DEFAULT_INITIAL_CAPTURES = [
  { id: 1, game: "ASTRO BOT", imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1400&auto=format&fit=crop", date: "2026" },
  { id: 2, game: "Cyberpunk 2077", imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1400&auto=format&fit=crop", date: "2026" },
  { id: 3, game: "DayZ", imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1400&auto=format&fit=crop", date: "2026" },
  { id: 4, game: "God of War Ragnarök", imageUrl: "https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?q=80&w=1400&auto=format&fit=crop", date: "2026" },
  { id: 5, game: "Laika: Aged Through Blood", imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1400&auto=format&fit=crop", date: "2026" },
  { id: 6, game: "Marvel's Spider-Man 2", imageUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1400&auto=format&fit=crop", date: "2026" },
  { id: 7, game: "Modern Warfare 3", imageUrl: "https://images.unsplash.com/photo-1542751110-97427bbecf20?q=80&w=1400&auto=format&fit=crop", date: "2026" },
  { id: 8, game: "Red Dead Redemption", imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1400&auto=format&fit=crop", date: "2026" },
  { id: 9, game: "Sea of Thieves", imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop", date: "2026" },
  { id: 10, game: "Uncharted: Colección Legado de los Ladrones", imageUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1400&auto=format&fit=crop", date: "2026" }
];

// Obtener lista de IDs de capturas eliminadas por el administrador
function getDeletedCaptureIds() {
  try {
    const saved = localStorage.getItem("user_deleted_capture_ids");
    if (saved) return JSON.parse(saved) || [];
  } catch (e) {}
  return [];
}

function saveDeletedCaptureId(id) {
  try {
    const deleted = getDeletedCaptureIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem("user_deleted_capture_ids", JSON.stringify(deleted));
    }
  } catch (e) {}
}

// Cargar capturas unificando captures.json oficial con las nuevas subidas locales del administrador
async function loadSavedCaptures() {
  let baseCaptures = [];

  try {
    const res = await fetch("./captures.json?v=" + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        baseCaptures = data;
      }
    }
  } catch (e) {
    console.warn("Nota: usando fallback por defecto", e);
  }

  const deletedIds = new Set(getDeletedCaptureIds());

  try {
    const saved = localStorage.getItem("user_custom_captures");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(c => c && c.game && c.imageUrl && !deletedIds.has(c.id));
        const existingIds = new Set(baseCaptures.map(c => c.id));
        const newLocalItems = valid.filter(c => !existingIds.has(c.id));
        captures = [...newLocalItems, ...baseCaptures].filter(c => !deletedIds.has(c.id));
        if (captures.length > 0) return;
      }
    }
  } catch (e) {}

  if (baseCaptures.length === 0) {
    baseCaptures = [...DEFAULT_INITIAL_CAPTURES];
  }

  captures = baseCaptures.filter(c => !deletedIds.has(c.id));
}

// Restaurar la galería a los juegos originales por defecto
function resetGalleryToDefaults() {
  try {
    localStorage.removeItem("user_custom_captures");
  } catch (e) {}
  location.reload();
}

// Comprobar si hay sesión admin activa guardada
function checkAdminSession() {
  const isSavedAdmin = localStorage.getItem("admin_session") === "true";
  if (isSavedAdmin) {
    toggleAdminMode(true);
  } else {
    toggleAdminMode(false);
  }
}

// Comprobar la URL Hash para la navegación por Historial del Navegador
function checkUrlHashNavigation() {
  const hash = window.location.hash;
  if (hash && hash.startsWith("#album=")) {
    try {
      const gameName = decodeURIComponent(hash.replace("#album=", ""));
      const uniqueGames = Array.from(new Set(captures.map(c => c.game)));
      if (uniqueGames.includes(gameName)) {
        currentFolder = gameName;
        return;
      }
    } catch (e) {}
  }
  currentFolder = null;
}

// Solicitar acceso admin
function requestAdminAccess() {
  const isSavedAdmin = localStorage.getItem("admin_session") === "true";
  if (isSavedAdmin) {
    openAdminModal();
  } else {
    openPasswordModal();
  }
}

// Abrir Modal de Contraseña
function openPasswordModal() {
  if (!passwordModal) return;
  passwordError.classList.add("hidden");
  adminPasswordInput.value = "";
  passwordModal.classList.remove("hidden");
  setTimeout(() => {
    passwordModal.classList.remove("opacity-0");
    document.getElementById("passwordModalContent")?.classList.remove("scale-95");
    adminPasswordInput.focus();
  }, 10);
}

// Cerrar Modal de Contraseña
function closePasswordModal() {
  if (!passwordModal) return;
  passwordModal.classList.add("opacity-0");
  document.getElementById("passwordModalContent")?.classList.add("scale-95");
  setTimeout(() => {
    passwordModal.classList.add("hidden");
    passwordForm.reset();
    passwordError.classList.add("hidden");
  }, 300);
}

// Manejar el envío de contraseña
async function handlePasswordSubmit(event) {
  event.preventDefault();
  const enteredPassword = adminPasswordInput.value.trim();
  const enteredHash = await sha256(enteredPassword);

  if (enteredHash === MASTER_PASSWORD_HASH) {
    passwordError.classList.add("hidden");
    closePasswordModal();
    toggleAdminMode(true);
    setTimeout(() => {
      openAdminModal();
    }, 350);
  } else {
    passwordError.classList.remove("hidden");
    adminPasswordInput.value = "";
    adminPasswordInput.focus();
  }
}

// Helper para escapar HTML en cadenas
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Activar/Desactivar modo administración
function toggleAdminMode(enable) {
  const publicAdminTrigger = document.getElementById("publicAdminTrigger");
  if (enable) {
    localStorage.setItem("admin_session", "true");
    if (adminContainer) adminContainer.classList.remove("hidden");
    if (publicAdminTrigger) publicAdminTrigger.classList.add("hidden");
  } else {
    localStorage.removeItem("admin_session");
    if (adminContainer) adminContainer.classList.add("hidden");
    if (publicAdminTrigger) publicAdminTrigger.classList.remove("hidden");
  }
}

// Triple clic en el título para solicitar acceso
function handleTitleClick() {
  openFolderView();
  titleClickCount++;
  clearTimeout(titleClickTimer);

  if (titleClickCount >= 3) {
    titleClickCount = 0;
    requestAdminAccess();
  } else {
    titleClickTimer = setTimeout(() => {
      titleClickCount = 0;
    }, 800);
  }
}

// Renderizador principal (Carpeta vs Fotos dentro de carpeta)
function renderApp() {
  if (currentFolder === null) {
    renderFoldersView();
  } else {
    renderPhotosInFolderView();
  }
}

// Abrir vista principal de carpetas
function openFolderView(updateHistory = true) {
  currentFolder = null;
  if (updateHistory) {
    if (window.location.hash) {
      history.pushState(null, "", window.location.pathname + window.location.search);
    }
  }
  renderApp();
}

// Abrir una carpeta en específico con entrada en el Historial del Navegador
function openFolder(gameName, updateHistory = true) {
  currentFolder = gameName;
  if (updateHistory) {
    const hash = "#album=" + encodeURIComponent(gameName);
    if (window.location.hash !== hash) {
      history.pushState({ folder: gameName }, "", hash);
    }
  }
  renderApp();
}

// Estado y gestión del orden personalizado de álbumes
let customAlbumOrder = [];

function loadCustomAlbumOrder() {
  try {
    const saved = localStorage.getItem("custom_album_order");
    if (saved) {
      customAlbumOrder = JSON.parse(saved);
    }
  } catch (e) {}
}

function saveCustomAlbumOrder() {
  try {
    localStorage.setItem("custom_album_order", JSON.stringify(customAlbumOrder));
  } catch (e) {}
}

let draggedAlbumName = null;

function handleAlbumDragStart(e, gameName) {
  draggedAlbumName = gameName;
  e.dataTransfer.setData("text/plain", gameName);
  e.currentTarget.classList.add("opacity-50", "scale-95");
}

function handleAlbumDragEnd(e) {
  e.currentTarget.classList.remove("opacity-50", "scale-95");
}

function handleAlbumDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function handleAlbumDrop(e, targetGameName) {
  e.preventDefault();
  if (!draggedAlbumName || draggedAlbumName === targetGameName) return;

  const foldersMap = {};
  captures.forEach(item => { foldersMap[item.game] = true; });
  const currentGames = Object.keys(foldersMap);

  let order = customAlbumOrder.length > 0 ? [...customAlbumOrder] : [...currentGames];
  currentGames.forEach(g => {
    if (!order.includes(g)) order.push(g);
  });

  const fromIdx = order.indexOf(draggedAlbumName);
  const toIdx = order.indexOf(targetGameName);

  if (fromIdx !== -1 && toIdx !== -1) {
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, draggedAlbumName);
    customAlbumOrder = order;
    saveCustomAlbumOrder();
    showToast(`Álbum "${draggedAlbumName}" reordenado`, "fa-solid fa-arrows-up-down-left-right text-amber-400");
    renderApp();
  }
  draggedAlbumName = null;
}

function moveAlbumPosition(e, gameName, direction) {
  e.stopPropagation();
  const foldersMap = {};
  captures.forEach(item => { foldersMap[item.game] = true; });
  const currentGames = Object.keys(foldersMap);

  let order = customAlbumOrder.length > 0 ? [...customAlbumOrder] : [...currentGames];
  currentGames.forEach(g => {
    if (!order.includes(g)) order.push(g);
  });

  const fromIdx = order.indexOf(gameName);
  if (fromIdx === -1) return;

  const toIdx = fromIdx + direction;
  if (toIdx < 0 || toIdx >= order.length) return;

  order.splice(fromIdx, 1);
  order.splice(toIdx, 0, gameName);

  customAlbumOrder = order;
  saveCustomAlbumOrder();
  showToast(`Álbum "${gameName}" reordenado`, "fa-solid fa-arrow-left-long text-amber-400");
  renderApp();
}

// 1. RENDERIZAR VISTA DE CARPETAS DE VIDEOJUEGOS
function renderFoldersView() {
  loadCustomAlbumOrder();

  const foldersMap = {};
  captures.forEach(item => {
    if (item && item.game) {
      if (!foldersMap[item.game]) {
        foldersMap[item.game] = [];
      }
      foldersMap[item.game].push(item);
    }
  });

  const games = Object.keys(foldersMap);
  const isAdmin = localStorage.getItem("admin_session") === "true";

  // Ordenar álbumes según la ordenación personalizada del administrador
  if (customAlbumOrder.length > 0) {
    games.sort((a, b) => {
      const idxA = customAlbumOrder.indexOf(a);
      const idxB = customAlbumOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  navigationHeader.innerHTML = `
    <div>
      <span class="text-xs font-semibold text-zinc-300 tracking-wider uppercase flex items-center gap-2">
        <i class="fa-regular fa-folder text-zinc-400"></i> Carpetas de Videojuegos
      </span>
      ${isAdmin ? '<p class="text-[11px] text-amber-400/90 font-mono mt-0.5 flex items-center gap-1.5"><i class="fa-solid fa-up-down-left-right text-[10px]"></i>Modo Edición: Arrastra las carpetas o usa ◄ ► para reordenarlas</p>' : ''}
    </div>
    <span class="text-xs font-mono text-zinc-500">${games.length} ${games.length === 1 ? 'carpeta' : 'carpetas'}</span>
  `;

  if (games.length === 0) {
    mainGrid.innerHTML = "";
    emptyState.classList.remove("hidden");
    emptyState.classList.add("flex");
    return;
  }

  emptyState.classList.add("hidden");
  emptyState.classList.remove("flex");

  loadFolderCovers();

  mainGrid.innerHTML = games.map(gameName => {
    const photos = foldersMap[gameName];
    let coverPhotoItem = photos[0];
    if (folderCovers[gameName]) {
      const chosen = photos.find(p => p.id === folderCovers[gameName]);
      if (chosen) coverPhotoItem = chosen;
    }
    const coverPhoto = coverPhotoItem ? coverPhotoItem.imageUrl : "";
    const count = photos.length;
    const escapedGame = escapeHtml(gameName);

    return `
      <article 
        data-game="${escapedGame}"
        onclick="openFolder(this.getAttribute('data-game'))"
        ${isAdmin ? `
          draggable="true" 
          ondragstart="handleAlbumDragStart(event, this.getAttribute('data-game'))"
          ondragend="handleAlbumDragEnd(event)"
          ondragover="handleAlbumDragOver(event)"
          ondrop="handleAlbumDrop(event, this.getAttribute('data-game'))"
        ` : ''}
        class="relative overflow-hidden rounded-lg aspect-[16/10] bg-black group cursor-pointer border border-zinc-800/80 hover:border-zinc-600 transition-all duration-300 shadow-md"
      >
        <img 
          src="${coverPhoto}" 
          alt="${escapedGame}" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-75 group-hover:opacity-90"
          loading="lazy"
        >
        
        <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent opacity-90 group-hover:opacity-75 transition-opacity"></div>

        ${isAdmin ? `
          <div class="absolute top-3 right-3 z-20 flex items-center gap-1 bg-zinc-950/90 border border-zinc-700/90 rounded-full px-2 py-1 shadow-lg backdrop-blur-md" onclick="event.stopPropagation()">
            <button onclick="moveAlbumPosition(event, this.parentElement.parentElement.getAttribute('data-game'), -1)" class="w-6 h-6 rounded-full hover:bg-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer" title="Mover a la izquierda">
              <i class="fa-solid fa-chevron-left text-[10px]"></i>
            </button>
            <span class="text-[10px] text-zinc-400 font-mono px-1 flex items-center gap-1 cursor-grab" title="Arrastrar para reordenar álbum">
              <i class="fa-solid fa-grip-vertical text-zinc-400"></i>
            </span>
            <button onclick="moveAlbumPosition(event, this.parentElement.parentElement.getAttribute('data-game'), 1)" class="w-6 h-6 rounded-full hover:bg-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer" title="Mover a la derecha">
              <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        ` : ''}

        <div class="absolute bottom-0 inset-x-0 p-5 flex items-end justify-between">
          <div>
            <h3 class="text-base font-semibold text-white tracking-wide group-hover:translate-x-1 transition-transform">
              ${escapedGame}
            </h3>
            <p class="text-xs text-zinc-400 font-mono mt-0.5">${count} ${count === 1 ? 'captura' : 'capturas'}</p>
          </div>

          <div class="w-8 h-8 rounded-full bg-zinc-950/80 border border-zinc-700/80 flex items-center justify-center text-zinc-300 group-hover:bg-white group-hover:text-zinc-950 group-hover:border-white transition-all shadow-md">
            <i class="fa-solid fa-arrow-right text-xs"></i>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

// Estado global de spoilers
let revealedSpoilersPerFolder = {};
let individuallyRevealedPhotos = {};

// Cambiar la preferencia de revelar spoilers en el álbum activo
function toggleAlbumSpoilers(revealAll) {
  if (currentFolder) {
    revealedSpoilersPerFolder[currentFolder] = revealAll;
    renderApp();
  }
}

// Revelar u ocultar spoiler de una foto individual
function toggleSinglePhotoSpoilerReveal(event, id) {
  event.stopPropagation();
  individuallyRevealedPhotos[id] = !individuallyRevealedPhotos[id];
  renderApp();
}

// Marcar / Desmarcar foto como spoiler (Modo Admin)
function togglePhotoSpoiler(event, id) {
  event.stopPropagation();
  const targetCapture = captures.find(c => c.id === id);
  if (!targetCapture) return;

  targetCapture.isSpoiler = !targetCapture.isSpoiler;

  try {
    localStorage.setItem("user_custom_captures", JSON.stringify(captures));
  } catch (e) {}

  const stateText = targetCapture.isSpoiler ? "marcada como Spoiler" : "desmarcada de Spoiler";
  showToast(`Foto ${stateText}`, "fa-solid fa-eye-slash text-red-400");
  renderApp();
}

// Obtener clave de ordenación cronológica por nombre de archivo original (ej. 20240418011914_1.jpg)
function getPhotoSortKey(photo) {
  if (!photo) return "";
  if (photo.filename) return photo.filename;
  if (photo.imageUrl) {
    const filename = photo.imageUrl.split('/').pop();
    return filename;
  }
  return String(photo.id || "");
}

// 2. RENDERIZAR FOTOS DENTRO DE LA CARPETA SELECCIONADA
function renderPhotosInFolderView() {
  if (!currentFolder) return;

  // Filtrar fotos asociadas a la carpeta actual (coincidencia segura insensible a espacios/mayúsculas)
  const targetFolderNorm = currentFolder.trim().toLowerCase();
  const photos = captures
    .filter(item => item && item.game && item.game.trim().toLowerCase() === targetFolderNorm);

  try {
    photos.sort((a, b) => getPhotoSortKey(a).localeCompare(getPhotoSortKey(b), undefined, { numeric: true, sensitivity: 'base' }));
  } catch (e) {}

  loadFolderCovers();
  let currentCoverId = folderCovers[currentFolder];
  if (!currentCoverId && photos.length > 0) {
    const rawPhoto = captures.find(c => c && c.game && c.game.trim().toLowerCase() === targetFolderNorm);
    if (rawPhoto) currentCoverId = rawPhoto.id;
  }
  
  const hasSpoilers = photos.some(p => p.isSpoiler);
  const areAlbumSpoilersRevealed = revealedSpoilersPerFolder[currentFolder] === true;

  navigationHeader.innerHTML = `
    <div class="flex items-center gap-3">
      <button 
        onclick="openFolderView()" 
        class="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white font-medium transition-all flex items-center gap-1.5"
      >
        <i class="fa-solid fa-arrow-left text-[11px]"></i>
        <span>Volver a Carpetas</span>
      </button>
      <span class="text-xs text-zinc-500">/</span>
      <span class="text-xs font-semibold text-zinc-100 uppercase tracking-wider">${escapeHtml(currentFolder)}</span>
    </div>
    <span class="text-xs font-mono text-zinc-500">${photos.length} ${photos.length === 1 ? 'captura' : 'capturas'}</span>
  `;

  if (photos.length === 0) {
    mainGrid.innerHTML = `
      <div class="col-span-full py-16 text-center text-zinc-500 font-mono text-sm border border-dashed border-zinc-800 rounded-xl">
        No se encontraron capturas asociadas a esta carpeta.
      </div>
    `;
    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");
    return;
  }

  emptyState.classList.add("hidden");
  emptyState.classList.remove("flex");

  // Generar aviso rojo de spoilers si el álbum contiene capturas marcadas
  let spoilerBannerHTML = "";
  if (hasSpoilers) {
    spoilerBannerHTML = `
      <div class="col-span-full mb-2 p-4 rounded-xl bg-red-950/40 border border-red-900/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 text-red-200 shadow-xl">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400 shrink-0">
            <i class="fa-solid fa-triangle-exclamation text-sm"></i>
          </div>
          <div>
            <h4 class="text-xs font-semibold text-red-200 uppercase tracking-wider">¡Atención! Este álbum contiene capturas con Spoilers</h4>
            <p class="text-[11px] text-red-300/80 mt-0.5">
              ${areAlbumSpoilersRevealed ? 'Los spoilers están actualmente visibles.' : 'Las imágenes con spoiler se muestran desenfocadas para proteger tu experiencia.'}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${areAlbumSpoilersRevealed ? `
            <button 
              onclick="toggleAlbumSpoilers(false)" 
              class="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow flex items-center gap-1.5"
            >
              <i class="fa-solid fa-eye-slash text-red-400 text-xs"></i> Ocultar Spoilers
            </button>
          ` : `
            <button 
              onclick="toggleAlbumSpoilers(true)" 
              class="px-3 py-1.5 rounded bg-red-900/90 hover:bg-red-800 border border-red-700 text-xs font-semibold text-white transition-all shadow-md flex items-center gap-1.5"
            >
              <i class="fa-solid fa-eye text-xs"></i> Ver Spoilers
            </button>
          `}
        </div>
      </div>
    `;
  }

  const cardsHTML = photos.map(item => {
    const isCurrentCover = item.id === currentCoverId;
    const isPhotoBlurred = item.isSpoiler && !areAlbumSpoilersRevealed && !individuallyRevealedPhotos[item.id];

    let adminButtonHTML = "";
    if (isAdmin) {
      const coverBtn = isCurrentCover ? `
        <span class="bg-zinc-950/90 border border-amber-500/50 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg backdrop-blur-md flex items-center gap-1">
          <i class="fa-solid fa-star text-amber-400 text-[9px]"></i> Portada
        </span>
      ` : `
        <button 
          onclick="setAsFolderCover(event, ${item.id})"
          title="Establecer como portada"
          class="opacity-0 group-hover:opacity-100 bg-zinc-950/90 border border-zinc-700 hover:border-amber-400 text-zinc-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 shadow-xl backdrop-blur-md transition-all"
        >
          <i class="fa-solid fa-star text-amber-400 text-[9px]"></i> Fijar Portada
        </button>
      `;

      const spoilerBtn = item.isSpoiler ? `
        <button 
          onclick="togglePhotoSpoiler(event, ${item.id})"
          title="Quitar marca de spoiler"
          class="bg-red-950/90 border border-red-700 hover:bg-red-900 text-red-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg backdrop-blur-md flex items-center gap-1 transition-all"
        >
          <i class="fa-solid fa-eye-slash text-red-400 text-[9px]"></i> Spoiler ON
        </button>
      ` : `
        <button 
          onclick="togglePhotoSpoiler(event, ${item.id})"
          title="Marcar como spoiler"
          class="opacity-0 group-hover:opacity-100 bg-zinc-950/90 border border-zinc-800 hover:border-red-500 text-zinc-400 hover:text-red-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg backdrop-blur-md transition-all"
        >
          <i class="fa-solid fa-eye-slash text-red-400 text-[9px]"></i> Marcar Spoiler
        </button>
      `;

      const deleteBtn = `
        <button 
          onclick="confirmDeleteCapture(event, ${item.id})"
          title="Eliminar esta captura"
          class="opacity-0 group-hover:opacity-100 bg-red-950/90 hover:bg-red-900 border border-red-800 text-red-200 hover:text-white px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 shadow-xl backdrop-blur-md transition-all"
        >
          <i class="fa-solid fa-trash-can text-red-400 text-[9px]"></i> Eliminar
        </button>
      `;

      adminButtonHTML = `
        <div class="absolute top-2 right-2 z-30 flex items-center gap-1.5">
          ${coverBtn}
          ${spoilerBtn}
          ${deleteBtn}
        </div>
      `;
    }

    // Overlay de desenfoque de Spoiler
    let spoilerOverlayHTML = "";
    if (isPhotoBlurred) {
      spoilerOverlayHTML = `
        <div 
          onclick="toggleSinglePhotoSpoilerReveal(event, ${item.id})"
          class="absolute inset-0 z-20 flex flex-col items-center justify-center p-3 bg-zinc-950/70 backdrop-blur-xs text-center cursor-pointer group-hover:bg-zinc-950/50 transition-colors"
          title="Haz clic para revelar esta captura"
        >
          <span class="px-3 py-1 rounded bg-red-950/90 border border-red-800 text-red-200 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-xl">
            <i class="fa-solid fa-eye-slash text-red-400 text-xs"></i> Spoiler
          </span>
          <span class="text-[10px] text-zinc-400 mt-1.5 font-mono">Clic para revelar</span>
        </div>
      `;
    }

    return `
      <article 
        onclick="${isPhotoBlurred ? `toggleSinglePhotoSpoilerReveal(event, ${item.id})` : `openViewerModal(${item.id})`}"
        class="relative overflow-hidden rounded-lg aspect-[16/10] bg-black group cursor-pointer border border-zinc-800/80 hover:border-zinc-500 transition-all duration-300 shadow-md"
      >
        <img 
          src="${item.imageUrl}" 
          alt="" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isPhotoBlurred ? 'blur-lg scale-105 opacity-60' : 'opacity-90 group-hover:opacity-100'}"
          loading="lazy"
        >
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
        ${spoilerOverlayHTML}
        ${adminButtonHTML}
      </article>
    `;
  }).join("");

  mainGrid.innerHTML = spoilerBannerHTML + cardsHTML;
}

// Eliminar una captura con confirmación (Modo Admin)
function confirmDeleteCapture(event, id) {
  if (event) event.stopPropagation();
  if (id === null || id === undefined) return;

  const captureToDelete = captures.find(c => c.id === id);
  if (!captureToDelete) return;

  const gameName = captureToDelete.game;

  if (confirm(`¿Estás seguro de que deseas eliminar esta captura de "${gameName}"?`)) {
    captures = captures.filter(c => c.id !== id);
    saveDeletedCaptureId(id);

    try {
      localStorage.setItem("user_custom_captures", JSON.stringify(captures));
    } catch (e) {}

    if (viewerModal && !viewerModal.classList.contains("hidden")) {
      closeViewerModal();
    }

    showToast(`Foto eliminada de "${gameName}"`, "fa-solid fa-trash-can text-red-400");
    renderApp();
    queueGitHubSync();
  }
}

// Estado y gestión de portadas personalizadas por álbum
let folderCovers = {};

function loadFolderCovers() {
  try {
    const saved = localStorage.getItem("custom_folder_covers");
    if (saved) folderCovers = JSON.parse(saved) || {};
  } catch (e) {}
}

function saveFolderCovers() {
  try {
    localStorage.setItem("custom_folder_covers", JSON.stringify(folderCovers));
  } catch (e) {}
}

// Establecer una foto como portada del álbum (Modo Admin)
function setAsFolderCover(event, id) {
  event.stopPropagation();

  const targetCapture = captures.find(c => c.id === id);
  if (!targetCapture) return;

  const gameName = targetCapture.game;
  loadFolderCovers();
  folderCovers[gameName] = id;
  saveFolderCovers();

  // Mover también la portada al inicio en la estructura base
  const idx = captures.findIndex(c => c.id === id);
  if (idx !== -1) {
    captures.splice(idx, 1);
    captures.unshift(targetCapture);
  }

  try {
    localStorage.setItem("user_custom_captures", JSON.stringify(captures));
  } catch (e) {}

  showToast(`¡Portada de "${gameName}" actualizada!`, "fa-solid fa-star text-amber-400");
  renderApp();
  queueGitHubSync();
}

// Mostrar notificación Toast discreta
function showToast(message, iconClass = "fa-solid fa-star text-amber-400") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  const toastIcon = document.getElementById("toastIcon");

  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  if (toastIcon) toastIcon.className = iconClass;

  toast.classList.remove("translate-y-20", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-20", "opacity-0");
  }, 2500);
}

// Actualizar estado de los botones de administración dentro del visor (Eliminar y Spoiler)
function updateViewerAdminButtons() {
  const deleteViewerBtn = document.getElementById("deleteViewerBtn");
  const spoilerViewerBtn = document.getElementById("spoilerViewerBtn");
  const spoilerViewerText = document.getElementById("spoilerViewerText");
  const isAdmin = localStorage.getItem("admin_session") === "true";

  if (!isAdmin) {
    if (deleteViewerBtn) { deleteViewerBtn.classList.add("hidden"); deleteViewerBtn.classList.remove("flex"); }
    if (spoilerViewerBtn) { spoilerViewerBtn.classList.add("hidden"); spoilerViewerBtn.classList.remove("flex"); }
    return;
  }

  if (deleteViewerBtn) { deleteViewerBtn.classList.remove("hidden"); deleteViewerBtn.classList.add("flex"); }

  const item = captures.find(c => c.id === activeCaptureId);
  if (spoilerViewerBtn && item) {
    spoilerViewerBtn.classList.remove("hidden");
    spoilerViewerBtn.classList.add("flex");

    if (item.isSpoiler) {
      spoilerViewerBtn.className = "flex px-3 py-1 rounded-full bg-red-950/90 border border-red-700 text-red-200 text-xs font-mono items-center gap-1.5 transition-all shadow-md cursor-pointer";
      if (spoilerViewerText) spoilerViewerText.textContent = "Spoiler ON";
    } else {
      spoilerViewerBtn.className = "flex px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono items-center gap-1.5 transition-all shadow-md cursor-pointer";
      if (spoilerViewerText) spoilerViewerText.textContent = "Marcar Spoiler";
    }
  }
}

// Marcar o desmarcar spoiler directamente desde el visor de pantalla completa
function togglePhotoSpoilerFromViewer() {
  if (activeCaptureId === null) return;
  const targetCapture = captures.find(c => c.id === activeCaptureId);
  if (!targetCapture) return;

  targetCapture.isSpoiler = !targetCapture.isSpoiler;

  try {
    localStorage.setItem("user_custom_captures", JSON.stringify(captures));
  } catch (e) {}

  const stateText = targetCapture.isSpoiler ? "marcada como Spoiler" : "desmarcada de Spoiler";
  showToast(`Foto ${stateText}`, "fa-solid fa-eye-slash text-red-400");
  updateViewerAdminButtons();
  updateViewerSpoilerState(targetCapture);
  renderApp();
}

// Actualizar desenfoque y capa de advertencia de Spoiler en el visor ampliado
function updateViewerSpoilerState(item) {
  const viewerImage = document.getElementById("viewerImage");
  const overlay = document.getElementById("viewerSpoilerOverlay");
  if (!item || !viewerImage) return;

  const areAlbumSpoilersRevealed = currentFolder && revealedSpoilersPerFolder[currentFolder] === true;
  const isSingleRevealed = individuallyRevealedPhotos[item.id] === true;

  const isPhotoBlurred = item.isSpoiler && !areAlbumSpoilersRevealed && !isSingleRevealed;

  if (isPhotoBlurred) {
    viewerImage.classList.add("blur-2xl", "scale-105", "opacity-40");
    if (overlay) {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
    }
  } else {
    viewerImage.classList.remove("blur-2xl", "scale-105", "opacity-40");
    viewerImage.classList.add("opacity-100");
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
    }
  }
}

// Revelar spoiler desde el botón central del visor ampliado
function revealCurrentViewerSpoiler(event) {
  if (event) event.stopPropagation();
  if (activeCaptureId === null) return;
  individuallyRevealedPhotos[activeCaptureId] = true;
  const item = captures.find(c => c.id === activeCaptureId);
  if (item) updateViewerSpoilerState(item);
  renderApp();
}

// Abrir Modal de Visor Ampliado (Sólo Imagen en Grande)
function openViewerModal(id) {
  const item = captures.find(c => c.id === id);
  if (!item) return;

  activeCaptureId = id;
  updateViewerAdminButtons();
  updateViewerSpoilerState(item);

  if (viewerImage) {
    viewerImage.src = item.imageUrl;
    viewerImage.alt = item.title || "";
  }

  if (viewerModal) {
    viewerModal.classList.remove("hidden");
    setTimeout(() => {
      viewerModal.classList.remove("opacity-0");
      viewerContent?.classList.remove("scale-95");
    }, 10);
  }

  document.body.style.overflow = "hidden";
}

// Cerrar Modal de Visor
function closeViewerModal() {
  if (document.fullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen();
  }

  if (viewerModal) {
    viewerModal.classList.add("opacity-0");
    viewerContent?.classList.add("scale-95");
    setTimeout(() => {
      viewerModal.classList.add("hidden");
      document.body.style.overflow = "";
      activeCaptureId = null;
    }, 300);
  }
}

// Activar / Desactivar pantalla completa nativa del navegador
function toggleFullscreenViewer() {
  const viewerModal = document.getElementById("viewerModal");
  const icon = document.getElementById("fullscreenIcon");

  if (!document.fullscreenElement) {
    if (viewerModal?.requestFullscreen) {
      viewerModal.requestFullscreen();
    } else if (viewerModal?.webkitRequestFullscreen) {
      viewerModal.webkitRequestFullscreen();
    }
    if (icon) icon.className = "fa-solid fa-compress text-xs";
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
    if (icon) icon.className = "fa-solid fa-expand text-xs";
  }
}

// Escuchar cambios de estado en la pantalla completa del sistema
document.addEventListener("fullscreenchange", () => {
  const icon = document.getElementById("fullscreenIcon");
  if (icon) {
    if (document.fullscreenElement) {
      icon.className = "fa-solid fa-compress text-xs";
    } else {
      icon.className = "fa-solid fa-expand text-xs";
    }
  }
});

// Mostrar aviso de ciclo al volver al principio o final en el visor
let cycleNoticeTimer = null;
function showViewerCycleNotice(message) {
  const notice = document.getElementById("viewerCycleNotice");
  const noticeText = document.getElementById("viewerCycleNoticeText");

  if (!notice || !noticeText) return;

  noticeText.textContent = message;
  notice.classList.remove("opacity-0");
  notice.classList.add("opacity-100");

  clearTimeout(cycleNoticeTimer);
  cycleNoticeTimer = setTimeout(() => {
    notice.classList.remove("opacity-100");
    notice.classList.add("opacity-0");
  }, 1100);
}

// Navegar entre capturas del álbum (Flecha Izquierda / Derecha)
function navigateViewer(direction) {
  if (activeCaptureId === null) return;

  const currentPhotos = (currentFolder !== null 
    ? captures.filter(c => c.game === currentFolder)
    : captures).sort((a, b) => getPhotoSortKey(a).localeCompare(getPhotoSortKey(b), undefined, { numeric: true, sensitivity: 'base' }));

  if (currentPhotos.length <= 1) return;

  let currentIndex = currentPhotos.findIndex(c => c.id === activeCaptureId);
  if (currentIndex === -1) currentIndex = 0;

  // Detectar ciclo de principio o final de álbum
  if (direction === 1 && currentIndex === currentPhotos.length - 1) {
    showViewerCycleNotice("Volviendo al principio");
  } else if (direction === -1 && currentIndex === 0) {
    showViewerCycleNotice("Volviendo al final");
  }

  const newIndex = (currentIndex + direction + currentPhotos.length) % currentPhotos.length;
  const nextCapture = currentPhotos[newIndex];
  activeCaptureId = nextCapture.id;
  updateViewerAdminButtons();
  updateViewerSpoilerState(nextCapture);

  if (viewerImage) {
    viewerImage.classList.add("opacity-40");
    setTimeout(() => {
      viewerImage.src = nextCapture.imageUrl;
      viewerImage.alt = nextCapture.title || "";
      viewerImage.classList.remove("opacity-40");
    }, 120);
  }
}

// Poblar selector desplegable de juegos ordenado alfabéticamente
function populateAdminGameSelect() {
  const adminGameSelect = document.getElementById("adminGameSelect");
  const newGameContainer = document.getElementById("newGameContainer");
  const adminNewGameInput = document.getElementById("adminNewGameInput");

  if (!adminGameSelect) return;

  // Obtener nombres de juegos únicos y ordenarlos alfabéticamente
  const uniqueGames = Array.from(new Set(captures.map(c => c.game)));
  uniqueGames.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true }));

  let optionsHTML = uniqueGames.map(game => `<option value="${escapeHtml(game)}">${escapeHtml(game)}</option>`).join("");
  optionsHTML += `<option value="__NEW_GAME__">+ Crear Nuevo Juego / Carpeta...</option>`;

  adminGameSelect.innerHTML = optionsHTML;

  // Si hay una carpeta seleccionada actualmente en la galería, seleccionarla por defecto
  if (currentFolder && uniqueGames.includes(currentFolder)) {
    adminGameSelect.value = currentFolder;
    if (newGameContainer) newGameContainer.classList.add("hidden");
  } else if (uniqueGames.length > 0) {
    adminGameSelect.selectedIndex = 0;
    if (newGameContainer) newGameContainer.classList.add("hidden");
  } else {
    adminGameSelect.value = "__NEW_GAME__";
    if (newGameContainer) newGameContainer.classList.remove("hidden");
  }
  if (adminNewGameInput) adminNewGameInput.value = "";
}

// Al cambiar opción en el desplegable de juegos
function handleGameSelectChange(selectElem) {
  const newGameContainer = document.getElementById("newGameContainer");
  const adminNewGameInput = document.getElementById("adminNewGameInput");

  if (selectElem.value === "__NEW_GAME__") {
    if (newGameContainer) newGameContainer.classList.remove("hidden");
    if (adminNewGameInput) adminNewGameInput.focus();
  } else {
    if (newGameContainer) newGameContainer.classList.add("hidden");
  }
}

// Alternar entre desplegable de juegos y crear nuevo juego
function toggleNewGameInput() {
  const adminGameSelect = document.getElementById("adminGameSelect");
  const newGameContainer = document.getElementById("newGameContainer");
  const adminNewGameInput = document.getElementById("adminNewGameInput");

  if (!adminGameSelect || !newGameContainer) return;

  if (newGameContainer.classList.contains("hidden")) {
    adminGameSelect.value = "__NEW_GAME__";
    newGameContainer.classList.remove("hidden");
    if (adminNewGameInput) adminNewGameInput.focus();
  } else {
    adminGameSelect.selectedIndex = 0;
    newGameContainer.classList.add("hidden");
  }
}

// Guardar Token de GitHub API
function saveGithubToken() {
  const input = document.getElementById("adminGithubTokenInput");
  if (!input) return;
  const token = input.value.trim();
  if (token) {
    localStorage.setItem("github_pat", token);
    showToast("Token de GitHub guardado correctamente", "fa-solid fa-key text-amber-400");
  } else {
    localStorage.removeItem("github_pat");
    showToast("Token de GitHub eliminado", "fa-solid fa-circle-info text-zinc-400");
  }
}

// Cargar Token de GitHub al abrir el modal de Admin
function populateGithubTokenInput() {
  const input = document.getElementById("adminGithubTokenInput");
  if (input) {
    input.value = localStorage.getItem("github_pat") || "";
  }
}

// Temporizador y cola inteligente para agrupar eliminaciones seguidas
let githubSyncTimer = null;

function queueGitHubSync() {
  const token = localStorage.getItem("github_pat");
  if (!token) return;

  clearTimeout(githubSyncTimer);
  githubSyncTimer = setTimeout(() => {
    syncCapturesToGitHubAPI();
  }, 2000);
}

// Sincronizar automáticamente la base de datos captures.json directamente con GitHub API
async function syncCapturesToGitHubAPI() {
  const token = localStorage.getItem("github_pat");
  if (!token) return false;

  try {
    const repoOwner = "Alejandrojp17";
    const repoName = "la-bendicion-del-modo-foto";
    const filePath = "captures.json";
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

    const getRes = await fetch(apiUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!getRes.ok) throw new Error("Error leyendo SHA de GitHub API");
    const getData = await getRes.json();
    const currentSha = getData.sha;

    const jsonString = JSON.stringify(captures, null, 2);
    const encoder = new TextEncoder();
    const dataUint8 = encoder.encode(jsonString);
    let binaryString = "";
    dataUint8.forEach(b => { binaryString += String.fromCharCode(b); });
    const contentBase64 = btoa(binaryString);

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "auto: sincronización en vivo desde panel de administración",
        content: contentBase64,
        sha: currentSha
      })
    });

    if (!putRes.ok) throw new Error("Error enviando actualización a GitHub");
    showToast("¡Cambios sincronizados en vivo con GitHub!", "fa-solid fa-cloud-check text-emerald-400");
    return true;
  } catch (err) {
    console.warn("Error en sincronización automática con GitHub API:", err);
    return false;
  }
}

// Abrir Modal de Administración
function openAdminModal() {
  populateAdminGameSelect();
  populateGithubTokenInput();
  adminModal.classList.remove("hidden");
  setTimeout(() => {
    adminModal.classList.remove("opacity-0");
    adminModal.querySelector("div").classList.remove("scale-95");
  }, 10);
}

// Cerrar Modal de Administración
function closeAdminModal() {
  adminModal.classList.add("opacity-0");
  adminModal.querySelector("div").classList.add("scale-95");
  setTimeout(() => {
    adminModal.classList.add("hidden");
    adminUploadForm.reset();
    document.getElementById("newGameContainer")?.classList.add("hidden");
  }, 300);
}

// Inicializar zona de Drag & Drop para subida múltiple
function initDragAndDrop() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("adminFileInput");

  if (!dropZone || !fileInput) return;

  fileInput.addEventListener("change", updateFilePreview);

  ["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("border-amber-400", "bg-zinc-900");
    }, false);
  });

  ["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("border-amber-400", "bg-zinc-900");
    }, false);
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      fileInput.files = dt.files;
      updateFilePreview();
    }
  });
}

// Actualizar texto de vista previa de archivos seleccionados
function updateFilePreview() {
  const fileInput = document.getElementById("adminFileInput");
  const preview = document.getElementById("fileListPreview");

  if (!fileInput || !preview) return;

  const count = fileInput.files ? fileInput.files.length : 0;
  if (count > 0) {
    preview.classList.remove("hidden");
    if (count === 1) {
      preview.textContent = `📷 1 foto seleccionada: ${fileInput.files[0].name}`;
    } else {
      preview.textContent = `📁 ${count} fotos seleccionadas para subir en lote`;
    }
  } else {
    preview.classList.add("hidden");
    preview.textContent = "";
  }
}

// Manejar la adición de una o varias capturas desde Administración (Subida Múltiple en Lote)
async function handleAdminUpload(event) {
  event.preventDefault();

  const adminGameSelect = document.getElementById("adminGameSelect");
  const adminNewGameInput = document.getElementById("adminNewGameInput");
  
  let game = "";
  if (adminGameSelect && adminGameSelect.value !== "__NEW_GAME__") {
    game = adminGameSelect.value;
  } else if (adminNewGameInput) {
    game = adminNewGameInput.value.trim();
  }

  if (!game) {
    alert("Por favor, selecciona un juego de la lista o escribe el nombre del nuevo videojuego.");
    return;
  }

  const fileInput = document.getElementById("adminFileInput");
  const urlInput = document.getElementById("adminUrl");
  const uploadStatus = document.getElementById("uploadStatus");
  const uploadStatusText = document.getElementById("uploadStatusText");
  const submitBtn = document.getElementById("adminSubmitBtn");
  const isSpoilerCheckbox = document.getElementById("adminIsSpoiler");
  const isSpoiler = isSpoilerCheckbox ? isSpoilerCheckbox.checked : false;

  const files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];

  if (files.length > 0) {
    if (uploadStatus) {
      uploadStatus.classList.remove("hidden");
      uploadStatus.classList.add("flex");
    }
    if (submitBtn) submitBtn.disabled = true;

    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (uploadStatusText) {
          uploadStatusText.textContent = files.length === 1 
            ? "Optimizando y subiendo foto a Cloudinary..." 
            : `Subiendo foto ${i + 1} de ${files.length} a Cloudinary...`;
        }

        let uploadedUrl = "";
        if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
              method: "POST",
              body: formData
            });

            if (!res.ok) throw new Error("Error en servidor Cloudinary");
            const data = await res.json();
            uploadedUrl = data.secure_url;
          } catch (err) {
            console.warn("Cloudinary error, aplicando fallback a DataURL", err);
            uploadedUrl = await readFileAsDataURL(file);
          }
        } else {
          uploadedUrl = await readFileAsDataURL(file);
        }

        if (uploadedUrl) {
          const newCapture = {
            id: Date.now() + i,
            game: game,
            imageUrl: uploadedUrl,
            isSpoiler: isSpoiler,
            date: "2026"
          };
          captures.unshift(newCapture);
          successCount++;
        }
      }

      // Guardar en el almacenamiento local para persistencia
      try {
        localStorage.setItem("user_custom_captures", JSON.stringify(captures));
      } catch (e) {}

      syncCapturesToGitHubAPI();

      showToast(`¡${successCount} ${successCount === 1 ? 'captura publicada' : 'capturas publicadas'} en "${game}"!`, "fa-solid fa-cloud-arrow-up text-amber-400");
    } finally {
      if (uploadStatus) uploadStatus.classList.add("hidden");
      if (submitBtn) submitBtn.disabled = false;
      if (isSpoilerCheckbox) isSpoilerCheckbox.checked = false;
      if (fileInput) fileInput.value = "";
      updateFilePreview();
    }
  } else if (urlInput && urlInput.value.trim()) {
    const finalImageUrl = urlInput.value.trim();

    const newCapture = {
      id: Date.now(),
      game: game,
      imageUrl: finalImageUrl,
      isSpoiler: isSpoiler,
      date: "2026"
    };

    captures.unshift(newCapture);

    try {
      localStorage.setItem("user_custom_captures", JSON.stringify(captures));
    } catch (e) {}

    showToast(`¡Captura publicada en "${game}"!`, "fa-solid fa-cloud-arrow-up text-amber-400");
    if (isSpoilerCheckbox) isSpoilerCheckbox.checked = false;
  } else {
    alert("Por favor, arrastra una o varias fotos o pega una URL válida.");
    return;
  }

  currentFolder = game;
  renderApp();
  closeAdminModal();
}

// Convertir archivo de imagen local a DataURL
function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// Ejecutar inicialización tras definir todas las funciones
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
