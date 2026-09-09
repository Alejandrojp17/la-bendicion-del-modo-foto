# 📷 La galería

> **Portfolio minimalista de fotografía virtual y capturas de videojuegos por Alejandro J.**

Una aplicación web moderna, estética y ultra rápida desarrollada con Vanilla JavaScript y Tailwind CSS para exhibir colecciones de capturas *in-game* en alta resolución, organizadas en carpetas temáticas por título.

---

## ✨ Características Principales

* **📁 Organización por Álbumes:** Visualización limpia en cuadrícula de carpetas por videojuego con conteo dinámico de capturas y carátula personalizable.
* **🖼️ Visor Inmersivo:** Modal de alta fidelidad para contemplar cada captura a pantalla completa, con transiciones suaves y detección de ciclo de principio a fin.
* **⌨️ Navegación Fluida:**
  * Flechas `←` y `→` para pasar a la captura anterior o siguiente.
  * Tecla `Escape` para cerrar cualquier visor o ventana modal.
  * Navegación por teclado en cuadrícula con `Tab` + `Enter` / `Espacio`.
* **⚠️ Sistema Anti-Spoilers:** Las imágenes marcadas como spoiler se presentan desenfocadas de manera preventiva, permitiendo su revelado individual con un clic o a nivel de álbum completo.
* **⭐ Portadas Personalizadas:** Permite a la administración fijar cualquier captura de un álbum como su portada exterior o desmarcarla en cualquier momento.
* **🔒 Panel de Administración Protegido:**
  * Autenticación segura en el cliente mediante hash criptográfico **SHA-256**.
  * Acceso mediante botón en cabecera, atajo rápido **`Ctrl + Shift + A`** o triple clic en el título del portfolio.
  * **Subida en lote (Drag & Drop):** Arrastra y suelta múltiples capturas simultáneamente o pega URLs directas.
  * **Integración con Cloudinary:** Carga directa optimizada a CDN con fallback automático a almacenamiento local.
  * **Gestión total:** Marcar/desmarcar spoilers y eliminar capturas con un clic.
* **💾 Persistencia en el Navegador:** Sincronización robusta en `localStorage` con la base de datos `captures.json`, conservando fotos subidas, borradas y portadas fijadas entre recargas de página.

---

## 🛠️ Tecnologías

* **Core:** HTML5 semántico + JavaScript moderno (ES6+) sin frameworks pesados.
* **Estilos:** [Tailwind CSS](https://tailwindcss.com/) (modo oscuro personalizado `zinc-950`).
* **Tipografía:** [Inter](https://fonts.google.com/specimen/Inter) vía Google Fonts.
* **Iconografía:** [FontAwesome 6](https://fontawesome.com/).
* **Almacenamiento & Hosting de Imágenes:** [Cloudinary](https://cloudinary.com/) API.

---

## 🚀 Cómo Ejecutar el Proyecto

No requiere pasos de compilación ni instalación de dependencias complejas:

### Opción 1: Servidor Local Rápido (Recomendado)
Con cualquier servidor local como **Live Server** (extensión de VS Code) o desde la terminal:

```bash
# Con Node.js
npx serve .

# O con Python
python -m http.server 3000
```

Luego abre tu navegador en `http://localhost:3000`.

### Opción 2: Doble Clic Directo
Abre directamente `index.html` en tu navegador favorito. El proyecto cuenta con un sistema de reserva (*fallback*) que garantiza su funcionamiento visual incluso sin servidor web activo.

---

## ⌨️ Atajos de Teclado y Trucos

| Atajo | Acción |
| :--- | :--- |
| `←` / `→` | Navegar a la foto anterior o siguiente en el visor |
| `Esc` | Cerrar visor ampliado o modales |
| `Ctrl + Shift + A` | Solicitar acceso al panel de administración |
| **Triple clic en el título** | Atajo discreto para desbloquear el panel admin |
| `Tab` + `Enter` / `Espacio` | Navegar y abrir carpetas de videojuegos con el teclado |

---

## 📂 Estructura del Proyecto

```text
├── index.html       # Estructura principal, modales y estilos base
├── app.js           # Lógica interactiva, navegación SPA, visor y admin
├── captures.json    # Base de datos JSON con las colecciones de capturas
└── README.md        # Documentación del portfolio
```

---

## 👤 Autor

Desarrollado con dedicación por **Alejandro J.**
* Portfolio y capturas de videojuegos: [GitHub Repository](https://github.com/Alejandrojp17/la-bendicion-del-modo-foto)
