// Colección de capturas de fotografía virtual (La galeria)
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

// Hash criptográfico SHA-256 de la contraseña de administración
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

  // Delegación de clics y accesibilidad con teclado en la rejilla principal de álbumes
  if (mainGrid) {
    mainGrid.addEventListener("click", (e) => {
      // Evitar abrir la carpeta si se hace clic en cualquier control de administración del álbum
      if (e.target.closest(".admin-album-controls")) {
        const btn = e.target.closest("button");
        if (btn) {
          const action = btn.getAttribute("data-action");
          if (action === "move-album-left" || action === "move-album-right") {
            e.stopPropagation();
            const card = btn.closest("article[data-game]");
            if (card) {
              const gameName = card.getAttribute("data-game");
              moveAlbumPosition(gameName, action === "move-album-left" ? -1 : 1);
            }
          }
        }
        return;
      }
      if (e.target.closest("button")) return;
      const card = e.target.closest("article[data-game]");
      if (!card) return;
      const gameName = card.getAttribute("data-game");
      if (gameName) {
        openFolder(gameName);
      }
    });

    mainGrid.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        if (e.target.closest(".admin-album-controls") || e.target.closest("button")) return;
        const card = e.target.closest("article[data-game]");
        if (card && e.target === card) {
          e.preventDefault();
          const gameName = card.getAttribute("data-game");
          if (gameName) openFolder(gameName);
        }
      }
    });

    // Drag & Drop para reordenar álbumes en la rejilla principal
    mainGrid.addEventListener("dragstart", (e) => {
      const isAdmin = localStorage.getItem("admin_session") === "true";
      if (!isAdmin || currentFolder !== null) return;
      const card = e.target.closest("article[data-game]");
      if (!card) return;
      draggedAlbumName = card.getAttribute("data-game");
      if (!draggedAlbumName) return;
      e.dataTransfer.setData("text/plain", draggedAlbumName);
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => {
        card.classList.add("opacity-40", "scale-95");
      }, 0);
    });

    mainGrid.addEventListener("dragover", (e) => {
      const isAdmin = localStorage.getItem("admin_session") === "true";
      if (!isAdmin || currentFolder !== null || !draggedAlbumName) return;
      const card = e.target.closest("article[data-game]");
      if (card) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        card.classList.add("ring-2", "ring-amber-400");
      }
    });

    mainGrid.addEventListener("dragleave", (e) => {
      const card = e.target.closest("article[data-game]");
      if (card) {
        card.classList.remove("ring-2", "ring-amber-400");
      }
    });

    mainGrid.addEventListener("drop", (e) => {
      const isAdmin = localStorage.getItem("admin_session") === "true";
      if (!isAdmin || currentFolder !== null || !draggedAlbumName) return;
      const card = e.target.closest("article[data-game]");
      if (!card) return;
      e.preventDefault();
      card.classList.remove("ring-2", "ring-amber-400");
      const targetGame = card.getAttribute("data-game");
      if (targetGame && targetGame !== draggedAlbumName) {
        handleAlbumDrop(draggedAlbumName, targetGame);
      }
      draggedAlbumName = null;
    });

    mainGrid.addEventListener("dragend", () => {
      document.querySelectorAll("article[data-game]").forEach(card => {
        card.classList.remove("opacity-40", "scale-95", "ring-2", "ring-amber-400");
      });
      draggedAlbumName = null;
    });
  }

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

// Fallback predeterminado si falla la carga externa de captures.json
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

// Guardar capturas personalizadas en localStorage con manejo seguro de cuota
function saveCustomCaptures() {
  try {
    localStorage.setItem("user_custom_captures", JSON.stringify(captures));
  } catch (e) {
    console.warn("No se pudo guardar en localStorage:", e);
    if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
      showToast("Límite de almacenamiento del navegador alcanzado", "fa-solid fa-triangle-exclamation text-amber-400");
    }
  }
}

// Gestión de portadas personalizadas fijadas por el administrador
let folderCovers = {};

function loadFolderCovers() {
  try {
    const saved = localStorage.getItem("custom_folder_covers");
    if (saved) folderCovers = JSON.parse(saved) || {};
  } catch (e) {
    folderCovers = {};
  }
}

function saveFolderCovers() {
  try {
    localStorage.setItem("custom_folder_covers", JSON.stringify(folderCovers));
  } catch (e) {}
}

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

// Cargar capturas unificando captures.json, fotos añadidas y filtrando eliminadas
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

  if (baseCaptures.length === 0) {
    baseCaptures = [...DEFAULT_INITIAL_CAPTURES];
  }

  const deletedIds = new Set(getDeletedCaptureIds());
  baseCaptures = baseCaptures.filter(c => !deletedIds.has(c.id));

  // Cargar fotos añadidas o editadas localmente por el usuario
  try {
    const saved = localStorage.getItem("user_custom_captures");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validLocal = parsed.filter(c => c && c.game && c.imageUrl && !deletedIds.has(c.id));
        const existingIds = new Set(baseCaptures.map(c => c.id));
        const newLocalItems = validLocal.filter(c => !existingIds.has(c.id));

        // Actualizar propiedades editadas de capturas existentes (ej. isSpoiler)
        const localOverrides = new Map(validLocal.filter(c => existingIds.has(c.id)).map(c => [c.id, c]));
        baseCaptures = baseCaptures.map(c => localOverrides.get(c.id) || c);

        captures = [...newLocalItems, ...baseCaptures].filter(c => !deletedIds.has(c.id));
        return;
      }
    }
  } catch (e) {
    console.warn("Error leyendo capturas personalizadas:", e);
  }

  captures = baseCaptures;
}

// Restaurar la galería a los juegos originales por defecto (limpia eliminados, portadas y custom)
function resetGalleryToDefaults() {
  try {
    localStorage.removeItem("user_custom_captures");
    localStorage.removeItem("user_deleted_capture_ids");
    localStorage.removeItem("custom_folder_covers");
    localStorage.removeItem("custom_album_order");
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
  renderApp();
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
let draggedAlbumName = null;

function loadCustomAlbumOrder() {
  try {
    const saved = localStorage.getItem("custom_album_order");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        customAlbumOrder = parsed;
      }
    }
  } catch (e) {
    customAlbumOrder = [];
  }
}

function saveCustomAlbumOrder() {
  try {
    localStorage.setItem("custom_album_order", JSON.stringify(customAlbumOrder));
  } catch (e) {}
}

function getAvailableGames() {
  const foldersMap = {};
  captures.forEach(item => {
    if (item.game) foldersMap[item.game] = true;
  });
  return Object.keys(foldersMap);
}

function moveAlbumPosition(gameName, direction) {
  if (!gameName) return;
  loadCustomAlbumOrder();

  const currentGames = getAvailableGames();
  let order = customAlbumOrder.length > 0 ? [...customAlbumOrder] : [...currentGames];

  currentGames.forEach(g => {
    if (!order.includes(g)) order.push(g);
  });
  order = order.filter(g => currentGames.includes(g));

  const fromIdx = order.indexOf(gameName);
  if (fromIdx === -1) return;

  const toIdx = fromIdx + direction;
  if (toIdx < 0 || toIdx >= order.length) return;

  order.splice(fromIdx, 1);
  order.splice(toIdx, 0, gameName);

  customAlbumOrder = order;
  saveCustomAlbumOrder();
  showToast(`Carpeta "${gameName}" reordenada`, "fa-solid fa-arrows-left-right text-amber-400");
  renderApp();
}

function handleAlbumDrop(sourceGame, targetGame) {
  if (!sourceGame || !targetGame || sourceGame === targetGame) return;
  loadCustomAlbumOrder();

  const currentGames = getAvailableGames();
  let order = customAlbumOrder.length > 0 ? [...customAlbumOrder] : [...currentGames];

  currentGames.forEach(g => {
    if (!order.includes(g)) order.push(g);
  });
  order = order.filter(g => currentGames.includes(g));

  const fromIdx = order.indexOf(sourceGame);
  const toIdx = order.indexOf(targetGame);

  if (fromIdx !== -1 && toIdx !== -1) {
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, sourceGame);
    customAlbumOrder = order;
    saveCustomAlbumOrder();
    showToast(`Carpeta "${sourceGame}" reordenada`, "fa-solid fa-arrows-up-down-left-right text-amber-400");
    renderApp();
  }
}

// 1. RENDERIZAR VISTA DE CARPETAS DE VIDEOJUEGOS
function renderFoldersView() {
  loadFolderCovers();
  loadCustomAlbumOrder();

  const foldersMap = {};
  captures.forEach(item => {
    if (!foldersMap[item.game]) {
      foldersMap[item.game] = [];
    }
    foldersMap[item.game].push(item);
  });

  const games = Object.keys(foldersMap);
  const isAdmin = localStorage.getItem("admin_session") === "true";

  // Ordenar álbumes según la ordenación personalizada del administrador
  if (customAlbumOrder && customAlbumOrder.length > 0) {
    games.sort((a, b) => {
      const idxA = customAlbumOrder.indexOf(a);
      const idxB = customAlbumOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
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

  mainGrid.innerHTML = games.map((gameName, index) => {
    const photos = foldersMap[gameName];
    // Ordenar con la misma lógica cronológica para consistencia total
    const sortedPhotos = [...photos].sort((a, b) => getPhotoSortKey(a).localeCompare(getPhotoSortKey(b), undefined, { numeric: true, sensitivity: 'base' }));
    
    // Usar la portada seleccionada si existe o la primera foto cronológica por defecto
    let coverPhotoItem = sortedPhotos[0];
    if (folderCovers[gameName]) {
      const chosen = photos.find(p => String(p.id) === String(folderCovers[gameName]));
      if (chosen) coverPhotoItem = chosen;
    }
    const coverPhoto = coverPhotoItem ? coverPhotoItem.imageUrl : "";
    const count = photos.length;
    const escapedGame = escapeHtml(gameName);

    const isFirst = index === 0;
    const isLast = index === games.length - 1;

    return `
      <article 
        data-game="${escapedGame}"
        tabindex="0"
        role="button"
        aria-label="Abrir álbum ${escapedGame}"
        ${isAdmin ? 'draggable="true"' : ''}
        class="relative overflow-hidden rounded-lg aspect-[16/10] bg-black group cursor-pointer border border-zinc-800/80 hover:border-zinc-600 focus:outline-none focus:border-amber-400 transition-all duration-300 shadow-md select-none"
      >
        <img 
          src="${coverPhoto}" 
          alt="${escapedGame}" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-75 group-hover:opacity-90 pointer-events-none select-none"
          loading="lazy"
          draggable="false"
        >
        
        <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent opacity-90 group-hover:opacity-75 transition-opacity pointer-events-none"></div>

        ${isAdmin ? `
          <div class="admin-album-controls absolute top-3 right-3 z-20 flex items-center gap-1 bg-zinc-950/90 border border-zinc-700/90 rounded-full px-2 py-1 shadow-lg backdrop-blur-md transition-all">
            <button 
              type="button" 
              data-action="move-album-left" 
              class="w-6 h-6 rounded-full hover:bg-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer ${isFirst ? 'opacity-30 pointer-events-none' : ''}" 
              title="Mover hacia la izquierda"
              ${isFirst ? 'disabled' : ''}
            >
              <i class="fa-solid fa-chevron-left text-[10px] pointer-events-none"></i>
            </button>
            <span class="text-[10px] text-zinc-400 font-mono px-1 flex items-center gap-1 cursor-grab active:cursor-grabbing" title="Arrastrar para reordenar carpeta">
              <i class="fa-solid fa-grip-vertical text-zinc-400 pointer-events-none"></i>
            </span>
            <button 
              type="button" 
              data-action="move-album-right" 
              class="w-6 h-6 rounded-full hover:bg-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer ${isLast ? 'opacity-30 pointer-events-none' : ''}" 
              title="Mover hacia la derecha"
              ${isLast ? 'disabled' : ''}
            >
              <i class="fa-solid fa-chevron-right text-[10px] pointer-events-none"></i>
            </button>
          </div>
        ` : ''}

        <div class="absolute bottom-0 inset-x-0 p-5 flex items-end justify-between pointer-events-none">
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
  saveCustomCaptures();

  const stateText = targetCapture.isSpoiler ? "marcada como Spoiler" : "desmarcada de Spoiler";
  showToast(`Foto ${stateText}`, "fa-solid fa-eye-slash text-red-400");
  renderApp();
}

// Obtener clave de ordenación cronológica por nombre de archivo original (ej. 20240418011914_1.jpg)
function getPhotoSortKey(photo) {
  if (photo.filename) return photo.filename;
  if (photo.imageUrl) {
    const filename = photo.imageUrl.split('/').pop();
    return filename;
  }
  return String(photo.id);
}

// 2. RENDERIZAR FOTOS DENTRO DE LA CARPETA SELECCIONADA
function renderPhotosInFolderView() {
  loadFolderCovers();
  // Ordenar fotos cronológicamente por nombre de archivo original
  const photos = captures
    .filter(item => item.game === currentFolder)
    .sort((a, b) => getPhotoSortKey(a).localeCompare(getPhotoSortKey(b), undefined, { numeric: true, sensitivity: 'base' }));

  const isAdmin = localStorage.getItem("admin_session") === "true";
  const currentCoverId = folderCovers[currentFolder] || null;
  
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
    currentFolder = null;
    renderFoldersView();
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
    const isCurrentCover = currentCoverId !== null && String(item.id) === String(currentCoverId);
    const isPhotoBlurred = item.isSpoiler && !areAlbumSpoilersRevealed && !individuallyRevealedPhotos[item.id];

    let adminButtonHTML = "";
    if (isAdmin) {
      const coverBtn = isCurrentCover ? `
        <button 
          onclick="removeFolderCover(event, '${escapeHtml(currentFolder).replace(/'/g, "\\'")}')"
          title="Portada fijada del álbum (clic para desmarcar)"
          class="bg-amber-500/20 border border-amber-500/80 text-amber-300 hover:bg-red-950/80 hover:border-red-600 hover:text-red-200 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 shadow-lg backdrop-blur-md transition-all cursor-pointer group/cov"
        >
          <i class="fa-solid fa-star text-amber-400 text-[9px] group-hover/cov:hidden"></i>
          <i class="fa-solid fa-xmark text-red-400 text-[9px] hidden group-hover/cov:inline"></i>
          <span class="group-hover/cov:hidden">Portada</span>
          <span class="hidden group-hover/cov:inline">Desmarcar</span>
        </button>
      ` : `
        <button 
          onclick="setAsFolderCover(event, ${item.id})"
          title="Fijar como portada del álbum"
          class="opacity-0 group-hover:opacity-100 bg-zinc-950/90 border border-zinc-700 hover:border-amber-400 text-zinc-300 hover:text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 shadow-xl backdrop-blur-md transition-all cursor-pointer"
        >
          <i class="fa-regular fa-star text-amber-400 text-[9px]"></i> Fijar Portada
        </button>
      `;

      const spoilerBtn = item.isSpoiler ? `
        <button 
          onclick="togglePhotoSpoiler(event, ${item.id})"
          title="Quitar marca de spoiler"
          class="bg-red-950/90 border border-red-700 hover:bg-red-900 text-red-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg backdrop-blur-md flex items-center gap-1 transition-all cursor-pointer"
        >
          <i class="fa-solid fa-eye-slash text-red-400 text-[9px]"></i> Spoiler ON
        </button>
      ` : `
        <button 
          onclick="togglePhotoSpoiler(event, ${item.id})"
          title="Marcar como spoiler"
          class="opacity-0 group-hover:opacity-100 bg-zinc-950/90 border border-zinc-800 hover:border-red-500 text-zinc-400 hover:text-red-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg backdrop-blur-md transition-all cursor-pointer"
        >
          <i class="fa-solid fa-eye-slash text-red-400 text-[9px]"></i> Marcar Spoiler
        </button>
      `;

      const deleteBtn = `
        <button 
          onclick="confirmDeleteCapture(event, ${item.id})"
          title="Eliminar esta captura"
          class="opacity-0 group-hover:opacity-100 bg-red-950/90 hover:bg-red-900 border border-red-800 text-red-200 hover:text-white px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 shadow-xl backdrop-blur-md transition-all cursor-pointer"
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
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (id === null || id === undefined) return;

  const captureToDelete = captures.find(c => String(c.id) === String(id));
  if (!captureToDelete) return;

  const gameName = captureToDelete.game;

  if (confirm(`¿Estás seguro de que deseas eliminar esta captura de "${gameName}"?`)) {
    captures = captures.filter(c => String(c.id) !== String(id));
    saveDeletedCaptureId(id);
    saveCustomCaptures();

    // Si la captura era la portada guardada, liberarla
    loadFolderCovers();
    if (folderCovers[gameName] && String(folderCovers[gameName]) === String(id)) {
      delete folderCovers[gameName];
      saveFolderCovers();
    }

    if (viewerModal && !viewerModal.classList.contains("hidden")) {
      closeViewerModal();
    }

    showToast(`Foto eliminada de "${gameName}"`, "fa-solid fa-trash-can text-red-400");
    renderApp();
  }
}

// Establecer una foto como portada del álbum (Modo Admin)
function setAsFolderCover(event, id) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const targetCapture = captures.find(c => String(c.id) === String(id));
  if (!targetCapture) return;

  const gameName = targetCapture.game;
  loadFolderCovers();
  folderCovers[gameName] = targetCapture.id;
  saveFolderCovers();

  showToast(`¡Portada de "${gameName}" actualizada!`, "fa-solid fa-star text-amber-400");
  renderApp();
}

// Quitar portada fijada de un álbum (volver a la miniatura por defecto)
function removeFolderCover(event, gameName) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  loadFolderCovers();
  if (folderCovers[gameName]) {
    delete folderCovers[gameName];
    saveFolderCovers();
    showToast(`Portada de "${gameName}" restablecida`, "fa-solid fa-rotate-left text-zinc-300");
    renderApp();
  }
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

  saveCustomCaptures();

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

// Abrir Modal de Administración
function openAdminModal() {
  populateAdminGameSelect();
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

      // Guardar en el almacenamiento local para persistencia con manejo seguro
      saveCustomCaptures();

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

    saveCustomCaptures();

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
