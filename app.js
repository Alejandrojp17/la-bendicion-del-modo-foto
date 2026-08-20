// Colección de capturas de fotografía virtual (Pura Galería Minimalista)
let captures = [
  {
    id: 1,
    title: "La Majestad de Leyndell",
    game: "Elden Ring",
    imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1400&auto=format&fit=crop",
    date: "24 de Julio, 2026"
  },
  {
    id: 2,
    title: "Geometría Nocturna en el Distrito Corporativo",
    game: "Cyberpunk 2077",
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1400&auto=format&fit=crop",
    date: "20 de Julio, 2026"
  },
  {
    id: 3,
    title: "Niebla Matutina en las Montañas",
    game: "Red Dead Redemption 2",
    imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1400&auto=format&fit=crop",
    date: "15 de Julio, 2026"
  },
  {
    id: 4,
    title: "El Silencio sobre las Rocas de Skellige",
    game: "The Witcher 3",
    imageUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1400&auto=format&fit=crop",
    date: "10 de Julio, 2026"
  },
  {
    id: 5,
    title: "Ecos del Lago de los Nueve",
    game: "God of War",
    imageUrl: "https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?q=80&w=1400&auto=format&fit=crop",
    date: "05 de Julio, 2026"
  },
  {
    id: 6,
    title: "Bruma y Siluetas en la Costa",
    game: "Ghost of Tsushima",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop",
    date: "01 de Julio, 2026"
  }
];

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

// Hash criptográfico SHA-256 irreversible de la contraseña maestra 'Proyectopropro'
const MASTER_PASSWORD_HASH = "737f56f0b1b93d4328e10c687e407aa0f17c15e235d1e44b0ccebe007d0926f4";

// Función asíncrona para calcular Hash SHA-256
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

let titleClickCount = 0;
let titleClickTimer = null;

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  loadSavedCaptures();
  checkAdminSession();
  renderApp();

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
});

// Comprobar si hay sesión admin activa guardada
function checkAdminSession() {
  const isSavedAdmin = localStorage.getItem("admin_session") === "true";
  if (isSavedAdmin) {
    toggleAdminMode(true);
  } else {
    toggleAdminMode(false);
  }
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

// Activar/Desactivar modo administración
function toggleAdminMode(enable) {
  if (enable) {
    localStorage.setItem("admin_session", "true");
    if (adminContainer) adminContainer.classList.remove("hidden");
  } else {
    localStorage.removeItem("admin_session");
    if (adminContainer) adminContainer.classList.add("hidden");
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
function openFolderView() {
  currentFolder = null;
  renderApp();
}

// Abrir una carpeta en específico
function openFolder(gameName) {
  currentFolder = gameName;
  renderApp();
}

// 1. RENDERIZAR VISTA DE CARPETAS DE VIDEOJUEGOS
function renderFoldersView() {
  const foldersMap = {};
  captures.forEach(item => {
    if (!foldersMap[item.game]) {
      foldersMap[item.game] = [];
    }
    foldersMap[item.game].push(item);
  });

  const games = Object.keys(foldersMap);

  navigationHeader.innerHTML = `
    <div>
      <span class="text-xs font-semibold text-zinc-300 tracking-wider uppercase flex items-center gap-2">
        <i class="fa-regular fa-folder text-zinc-400"></i> Carpetas de Videojuegos
      </span>
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

  mainGrid.innerHTML = games.map(gameName => {
    const photos = foldersMap[gameName];
    const coverPhoto = photos[0].imageUrl;
    const count = photos.length;

    return `
      <article 
        onclick="openFolder('${gameName.replace(/'/g, "\\'")}')"
        class="relative overflow-hidden rounded-lg aspect-[16/10] bg-black group cursor-pointer border border-zinc-800/80 hover:border-zinc-600 transition-all duration-300 shadow-md"
      >
        <img 
          src="${coverPhoto}" 
          alt="${gameName}" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-75 group-hover:opacity-90"
          loading="lazy"
        >
        
        <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent opacity-90 group-hover:opacity-75 transition-opacity"></div>

        <div class="absolute top-3.5 left-3.5 px-2.5 py-1 rounded bg-zinc-950/80 border border-zinc-800/90 text-[11px] font-mono text-zinc-300 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
          <i class="fa-solid fa-folder-closed text-zinc-400"></i>
          <span>Álbum</span>
        </div>

        <div class="absolute bottom-0 inset-x-0 p-5 flex items-end justify-between">
          <div>
            <h3 class="text-base font-semibold text-white tracking-wide group-hover:translate-x-1 transition-transform">
              ${gameName}
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

// 2. RENDERIZAR FOTOS DENTRO DE LA CARPETA SELECCIONADA
function renderPhotosInFolderView() {
  const photos = captures.filter(item => item.game === currentFolder);

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
      <span class="text-xs font-semibold text-zinc-100 uppercase tracking-wider">${currentFolder}</span>
    </div>
    <span class="text-xs font-mono text-zinc-500">${photos.length} ${photos.length === 1 ? 'captura' : 'capturas'}</span>
  `;

  if (photos.length === 0) {
    mainGrid.innerHTML = "";
    emptyState.classList.remove("hidden");
    emptyState.classList.add("flex");
    return;
  }

  emptyState.classList.add("hidden");
  emptyState.classList.remove("flex");

  mainGrid.innerHTML = photos.map(item => {
    return `
      <article 
        onclick="openViewerModal(${item.id})"
        class="relative overflow-hidden rounded-lg aspect-[16/10] bg-black group cursor-pointer border border-zinc-800/80 hover:border-zinc-500 transition-all duration-300 shadow-md"
      >
        <img 
          src="${item.imageUrl}" 
          alt="" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
          loading="lazy"
        >
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
      </article>
    `;
  }).join("");
}

// Abrir Modal de Visor Ampliado (Sólo Imagen en Grande)
function openViewerModal(id) {
  const item = captures.find(c => c.id === id);
  if (!item) return;

  activeCaptureId = id;

  if (viewerImage) {
    viewerImage.src = item.imageUrl;
    viewerImage.alt = item.title;
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

// Navegar entre capturas del álbum (Flecha Izquierda / Derecha)
function navigateViewer(direction) {
  if (activeCaptureId === null) return;

  // Filtrar fotos pertenecientes al álbum activo (o todas las fotos si no hay álbum activo)
  const currentPhotos = currentFolder !== null 
    ? captures.filter(c => c.game === currentFolder)
    : captures;

  if (currentPhotos.length <= 1) return;

  let currentIndex = currentPhotos.findIndex(c => c.id === activeCaptureId);
  if (currentIndex === -1) currentIndex = 0;

  // Calcular siguiente/anterior de forma cíclica
  const newIndex = (currentIndex + direction + currentPhotos.length) % currentPhotos.length;
  const nextCapture = currentPhotos[newIndex];
  activeCaptureId = nextCapture.id;

  // Transición suave de opacidad
  if (viewerImage) {
    viewerImage.classList.add("opacity-40");
    setTimeout(() => {
      viewerImage.src = nextCapture.imageUrl;
      viewerImage.alt = nextCapture.title || "";
      viewerImage.classList.remove("opacity-40");
    }, 120);
  }
}

// Abrir Modal de Administración
function openAdminModal() {
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
  }, 300);
}

// Configuración por defecto de Cloudinary
let CLOUDINARY_CLOUD_NAME = localStorage.getItem("cloudinary_cloud_name") || "m44qkn0g";
let CLOUDINARY_UPLOAD_PRESET = localStorage.getItem("cloudinary_preset") || "ml_default";

// Cargar capturas personalizadas del almacenamiento local si existen
function loadSavedCaptures() {
  const savedCaptures = localStorage.getItem("user_custom_captures");
  if (savedCaptures) {
    try {
      const parsed = JSON.parse(savedCaptures);
      if (Array.isArray(parsed) && parsed.length > 0) {
        captures = parsed;
      }
    } catch (e) {}
  }
}

// Configurar claves de Cloudinary (Opcional desde consola o panel)
function setCloudinaryConfig(cloudName, uploadPreset) {
  CLOUDINARY_CLOUD_NAME = cloudName;
  CLOUDINARY_UPLOAD_PRESET = uploadPreset;
  localStorage.setItem("cloudinary_cloud_name", cloudName);
  localStorage.setItem("cloudinary_preset", uploadPreset);
}

// Manejar la adición de una captura desde Administración (Soporta Nube Cloudinary, Archivo Local y URL)
async function handleAdminUpload(event) {
  event.preventDefault();

  const game = document.getElementById("adminGame").value.trim();
  const title = document.getElementById("adminTitle").value.trim() || game;
  const fileInput = document.getElementById("adminFileInput");
  const urlInput = document.getElementById("adminUrl");
  const uploadStatus = document.getElementById("uploadStatus");
  const uploadStatusText = document.getElementById("uploadStatusText");
  const submitBtn = document.getElementById("adminSubmitBtn");

  if (!game) return;

  let finalImageUrl = urlInput ? urlInput.value.trim() : "";

  // Si el usuario seleccionó un archivo local de imagen desde su dispositivo
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];

    // Si Cloudinary está configurado, subir directamente a la nube
    if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET) {
      try {
        if (uploadStatus) {
          uploadStatus.classList.remove("hidden");
          uploadStatus.classList.add("flex");
          if (uploadStatusText) uploadStatusText.textContent = "Optimizando y subiendo foto a Cloudinary...";
        }
        if (submitBtn) submitBtn.disabled = true;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: "POST",
          body: formData
        });

        if (!res.ok) throw new Error("Error en servidor Cloudinary");
        const data = await res.json();
        finalImageUrl = data.secure_url;
      } catch (err) {
        console.warn("Cloudinary error, aplicando fallback a DataURL local", err);
        finalImageUrl = await readFileAsDataURL(file);
      } finally {
        if (uploadStatus) uploadStatus.classList.add("hidden");
        if (submitBtn) submitBtn.disabled = false;
      }
    } else {
      // Si aún no se configuraron claves de Cloudinary, genera vista previa inmediata del archivo local
      finalImageUrl = await readFileAsDataURL(file);
    }
  }

  if (!finalImageUrl) {
    alert("Por favor, selecciona un archivo de imagen desde tu dispositivo o pega una URL válida.");
    return;
  }

  const newCapture = {
    id: Date.now(),
    title: title,
    game: game,
    imageUrl: finalImageUrl,
    date: "Hoy"
  };

  captures.unshift(newCapture);

  // Guardar en el almacenamiento local para persistencia
  try {
    localStorage.setItem("user_custom_captures", JSON.stringify(captures));
  } catch (e) {}

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
