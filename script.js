const menuButton = document.querySelector("[data-menu-button]");
const navigation = document.querySelector("[data-navigation]");
const header = document.querySelector("[data-site-header]");
const year = document.querySelector("[data-current-year]");
const projectGrid = document.querySelector("[data-project-grid]");

function renderIcons() {
  if (!window.lucide?.createIcons) return;
  window.lucide.createIcons();
  document.documentElement.classList.add("has-lucide");
}

function setMenuState(isOpen, moveFocus = false) {
  if (!menuButton || !navigation) return;

  const openIcon = menuButton.querySelector("[data-menu-open-icon]");
  const closeIcon = menuButton.querySelector("[data-menu-close-icon]");
  const label = menuButton.querySelector("[data-menu-label]");

  navigation.classList.toggle("show", isOpen);
  header?.classList.toggle("is-menu-open", isOpen);
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute(
    "aria-label",
    isOpen ? "Close the menu" : "Open the menu",
  );
  if (openIcon) openIcon.hidden = isOpen;
  if (closeIcon) closeIcon.hidden = !isOpen;
  if (label) label.textContent = isOpen ? "Close" : "Menu";
  if (moveFocus) menuButton.focus();
}

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    setMenuState(menuButton.getAttribute("aria-expanded") !== "true");
  });

  navigation.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a"))
      setMenuState(false);
  });

  document.addEventListener("pointerdown", (event) => {
    if (menuButton.getAttribute("aria-expanded") !== "true") return;
    if (event.target instanceof Node && !header?.contains(event.target))
      setMenuState(false);
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menuButton.getAttribute("aria-expanded") === "true"
    ) {
      setMenuState(false, true);
    }
  });

  const expandedNavigation = window.matchMedia("(min-width: 48rem)");
  expandedNavigation.addEventListener("change", (event) => {
    if (event.matches) setMenuState(false);
  });
}

if (header) {
  let scrollFrame = 0;
  const setHeaderState = () => {
    scrollFrame = 0;
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  setHeaderState();
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(setHeaderState);
    },
    { passive: true },
  );
}

if (year) year.textContent = String(new Date().getFullYear());
renderIcons();

(function initGallery() {
  if (!projectGrid) return;

  const lightbox = document.querySelector("[data-lightbox]");
  const lightboxContent = document.querySelector("[data-lightbox-content]");
  const lightboxBackdrop = document.querySelector("[data-lightbox-backdrop]");
  const lightboxStage = document.querySelector("[data-lightbox-stage]");
  const lightboxTitle = document.querySelector("[data-lightbox-title]");
  const lightboxCategory = document.querySelector("[data-lightbox-category]");
  const lightboxCount = document.querySelector("[data-lightbox-count]");
  const closeButton = document.querySelector("[data-lightbox-close]");
  const previousButton = document.querySelector("[data-lightbox-prev]");
  const nextButton = document.querySelector("[data-lightbox-next]");
  const zoomOutButton = document.querySelector("[data-zoom-out]");
  const zoomInButton = document.querySelector("[data-zoom-in]");
  const zoomResetButton = document.querySelector("[data-zoom-reset]");
  const zoomValue = document.querySelector("[data-zoom-value]");

  if (!lightbox || !lightboxStage) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const precisePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  );
  const minimumZoom = 1;
  const maximumZoom = 4;
  const zoomStep = 0.25;

  let galleryItems = [];
  let galleryImages = [];
  let galleryMedia = [];
  let galleryButtons = [];
  let activeImage = null;
  let activeMedia = null;
  let selectedPhotoButton = null;
  let currentIndex = 0;
  let requestedIndex = 0;
  let requestedDirection = 1;
  let viewerIsOpen = false;
  let viewerIsOpening = false;
  let viewerIsClosing = false;
  let viewerIsChanging = false;
  let closeWasRequested = false;
  let zoomLevel = minimumZoom;
  let panX = 0;
  let panY = 0;
  let dragStart = null;
  let pinchStart = null;
  let suppressNextClick = false;
  let resizeFrame = 0;
  let wheelFrame = 0;
  let wheelDelta = 0;
  let wheelPoint = null;
  const activePointers = new Map();

  function getFullImageSource(source) {
    if (
      /^(?:[a-z]+:)?\/\//i.test(source) ||
      source.startsWith("data:") ||
      source.startsWith("./") ||
      source.startsWith("gallery/") ||
      source.startsWith("/")
    ) {
      return source;
    }
    return `./gallery/${source}`;
  }

  function getThumbnailImageSource(fullSrc) {
    if (
      /^(?:[a-z]+:)?\/\//i.test(fullSrc) ||
      fullSrc.startsWith("data:")
    ) {
      return fullSrc;
    }
    // E.g. ./gallery/headshot/headshot-romilia-1.JPG -> ./gallery/headshot/thumbnail/headshot-romilia-1.jpg
    const parts = fullSrc.split("/");
    const filename = parts.pop();
    const basename = filename.substring(0, filename.lastIndexOf(".")) || filename;
    const dir = parts.join("/");
    return `${dir}/thumbnail/${basename}.jpg`;
  }

  function normalizeItem(rawItem, index = 0) {
    const defaultTitle = `Portfolio photograph ${String(index + 1).padStart(2, "0")}`;

    if (typeof rawItem === "string") {
      const src = getFullImageSource(rawItem);
      return {
        src,
        thumbSrc: getThumbnailImageSource(src),
        title: defaultTitle,
        category: "Selected work",
      };
    }

    const source = rawItem.src || rawItem.filename || rawItem.url || "";
    const src = getFullImageSource(source);
    const suppliedTitle = String(rawItem.title || "").trim();
    const suppliedCategory = String(
      rawItem.category || rawItem.details || "",
    ).trim();
    return {
      src,
      thumbSrc: getThumbnailImageSource(src),
      title:
        suppliedTitle && suppliedTitle.toLowerCase() !== "title"
          ? suppliedTitle
          : defaultTitle,
      category:
        suppliedCategory && suppliedCategory.toLowerCase() !== "category"
          ? suppliedCategory
          : "Selected work",
    };
  }

  function renderGrid(items) {
    galleryItems = items;
    galleryImages = [];
    galleryMedia = [];
    galleryButtons = [];
    projectGrid.replaceChildren();

    if (!items.length) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "grid-loading";
      emptyMessage.textContent = "No photos were found in the gallery.";
      projectGrid.append(emptyMessage);
      projectGrid.setAttribute("aria-busy", "false");
      return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
      const card = document.createElement("article");
      const button = document.createElement("button");
      const media = document.createElement("span");
      const thumbImage = document.createElement("img");
      const fullImage = document.createElement("img");
      const viewAction = document.createElement("span");
      const viewIcon = document.createElement("i");
      const viewText = document.createElement("span");
      const caption = document.createElement("span");
      const title = document.createElement("span");
      const category = document.createElement("span");

      card.className = "project-card";
      card.dataset.index = String(index);
      button.type = "button";
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-label", `Open the large view of ${item.title}`);
      media.className = "project-card__media";
      if (item.width && item.height)
        media.style.aspectRatio = `${item.width} / ${item.height}`;

      // Low-res thumbnail image placeholder
      thumbImage.className = "project-card__thumb";
      thumbImage.src = item.thumbSrc || item.src;
      thumbImage.alt = "";
      thumbImage.draggable = false;
      thumbImage.loading = index < 6 ? "eager" : "lazy";

      // Full resolution image
      fullImage.className = "project-card__image";
      fullImage.src = item.src;
      fullImage.alt = item.title;
      fullImage.loading = index < 4 ? "eager" : "lazy";
      fullImage.decoding = "async";
      fullImage.fetchPriority = index < 2 ? "high" : "auto";
      fullImage.draggable = false;
      if (item.width && item.height) {
        fullImage.width = item.width;
        fullImage.height = item.height;
      }

      viewAction.className = "project-card__view-action";
      viewAction.setAttribute("aria-hidden", "true");
      viewIcon.className = "icon";
      viewIcon.dataset.lucide = "maximize-2";
      viewText.textContent = "View photo";
      caption.className = "project-caption";
      title.className = "project-caption__title";
      title.textContent = item.title;
      category.className = "project-caption__category";
      category.textContent = item.category;

      viewAction.append(viewIcon, viewText);
      media.append(thumbImage, fullImage, viewAction);
      caption.append(title, category);
      button.append(media);
      card.append(button);

      const pokeImage = () => {
        if (fullImage.naturalWidth && fullImage.naturalHeight) {
          media.style.aspectRatio = `${fullImage.naturalWidth} / ${fullImage.naturalHeight}`;
        }
        fullImage.classList.add("is-image-loaded");
        card.classList.add("is-loaded");
      };

      const showLoadedImage = () => {
        pokeImage();
        if (typeof fullImage.decode === "function") {
          fullImage.decode().then(pokeImage).catch(pokeImage);
        }
      };

      if (fullImage.complete) {
        showLoadedImage();
      } else {
        fullImage.addEventListener("load", showLoadedImage, { once: true });
        fullImage.addEventListener("error", pokeImage, { once: true });
      }

      // IntersectionObserver fallback poke in case browser defers render until scroll/interaction
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                if (fullImage.complete) pokeImage();
                observer.unobserve(card);
              }
            });
          },
          { rootMargin: "200px" },
        );
        observer.observe(card);
      }

      galleryImages.push(fullImage);
      galleryMedia.push(media);
      galleryButtons.push(button);
      fragment.append(card);
    });

    projectGrid.append(fragment);
    projectGrid.setAttribute("aria-busy", "false");
    if (previousButton) previousButton.hidden = items.length < 2;
    if (nextButton) nextButton.hidden = items.length < 2;
    renderIcons();

    // Secondary global poke pass to guarantee paint without user interaction
    requestAnimationFrame(() => {
      galleryImages.forEach((img, idx) => {
        if (img.complete && img.naturalWidth) {
          img.classList.add("is-image-loaded");
          const c = img.closest(".project-card");
          if (c) c.classList.add("is-loaded");
        }
      });
    });
  }

  function waitForImage(image) {
    image.loading = "eager";
    if (image.complete) return Promise.resolve();

    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }

  async function prepareImage(image) {
    await waitForImage(image);
    if (typeof image.decode === "function" && image.naturalWidth) {
      try {
        await image.decode();
      } catch {
        return;
      }
    }
  }

  function waitForFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  async function waitForLayout() {
    await waitForFrame();
    await waitForFrame();
  }

  async function playAnimation(element, keyframes, options) {
    if (reducedMotion.matches || typeof element.animate !== "function") return;

    const animation = element.animate(keyframes, options);
    try {
      await animation.finished;
    } catch {
      return;
    } finally {
      animation.cancel();
    }
  }

  function rectIsVisible(rect) {
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 &&
      rect.left < window.innerWidth
    );
  }

  async function animateFromRect(image, startRect) {
    const endRect = image.getBoundingClientRect();
    if (!rectIsVisible(startRect) || !endRect.width || !endRect.height) {
      await playAnimation(
        image,
        [
          { opacity: 0, transform: "translate3d(0, 0.5rem, 0) scale(0.99)" },
          { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        ],
        { duration: 180, easing: "ease-out" },
      );
      return;
    }

    const moveX =
      startRect.left + startRect.width / 2 - (endRect.left + endRect.width / 2);
    const moveY =
      startRect.top + startRect.height / 2 - (endRect.top + endRect.height / 2);
    const scaleX = startRect.width / endRect.width;
    const scaleY = startRect.height / endRect.height;

    await playAnimation(
      image,
      [
        {
          transform: `translate3d(${moveX}px, ${moveY}px, 0) scale(${scaleX}, ${scaleY})`,
        },
        { transform: "translate3d(0, 0, 0) scale(1, 1)" },
      ],
      { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }

  async function animateToRect(image, endRect) {
    const startRect = image.getBoundingClientRect();
    if (!rectIsVisible(endRect) || !startRect.width || !startRect.height) {
      await playAnimation(
        image,
        [
          { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
          { opacity: 0, transform: "translate3d(0, 0.4rem, 0) scale(0.99)" },
        ],
        { duration: 140, easing: "ease-in" },
      );
      return;
    }

    const moveX =
      endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2);
    const moveY =
      endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2);
    const scaleX = endRect.width / startRect.width;
    const scaleY = endRect.height / startRect.height;

    await playAnimation(
      image,
      [
        { transform: "translate3d(0, 0, 0) scale(1, 1)" },
        {
          transform: `translate3d(${moveX}px, ${moveY}px, 0) scale(${scaleX}, ${scaleY})`,
        },
      ],
      { duration: 240, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    );
  }

  function setViewerBusy(isBusy) {
    lightbox.setAttribute("aria-busy", String(isBusy));
  }

  function setPhotoDetails(index) {
    const item = galleryItems[index];
    if (lightboxTitle) lightboxTitle.textContent = item.title;
    if (lightboxCategory) lightboxCategory.textContent = item.category;
    if (lightboxCount)
      lightboxCount.textContent = `${index + 1} / ${galleryItems.length}`;
    selectedPhotoButton = galleryButtons[index];
  }

  function preloadNearbyPhotos(index) {
    if (galleryItems.length < 2) return;
    const nearbyIndices = [
      (index - 1 + galleryItems.length) % galleryItems.length,
      (index + 1) % galleryItems.length,
    ];

    nearbyIndices.forEach((nearbyIndex) => {
      const image = galleryImages[nearbyIndex];
      image.loading = "eager";
      if (typeof image.decode === "function") image.decode().catch(() => {});
    });
  }

  function constrainPan() {
    if (!activeImage) return;
    const imageWidth = activeImage.offsetWidth * zoomLevel;
    const imageHeight = activeImage.offsetHeight * zoomLevel;
    const maximumPanX = Math.max(
      0,
      (imageWidth - lightboxStage.clientWidth) / 2,
    );
    const maximumPanY = Math.max(
      0,
      (imageHeight - lightboxStage.clientHeight) / 2,
    );
    panX = Math.min(maximumPanX, Math.max(-maximumPanX, panX));
    panY = Math.min(maximumPanY, Math.max(-maximumPanY, panY));
  }

  function updateZoomControls() {
    lightbox.classList.toggle("is-zoomed", zoomLevel > minimumZoom);
    if (zoomValue) zoomValue.textContent = `${Math.round(zoomLevel * 100)}%`;
    if (zoomOutButton) zoomOutButton.disabled = zoomLevel <= minimumZoom;
    if (zoomInButton) zoomInButton.disabled = zoomLevel >= maximumZoom;
    if (zoomResetButton) {
      zoomResetButton.disabled =
        zoomLevel <= minimumZoom && panX === 0 && panY === 0;
    }
  }

  function applyPhotoView() {
    if (!activeImage) {
      updateZoomControls();
      return;
    }
    constrainPan();
    activeImage.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoomLevel})`;
    updateZoomControls();
  }

  function applyPhotoViewImmediately() {
    lightbox.classList.add("is-adjusting");
    applyPhotoView();
    void lightbox.offsetWidth;
    lightbox.classList.remove("is-adjusting");
  }

  function fitActiveImage() {
    if (!activeImage) return;
    const item = galleryItems[currentIndex];
    const naturalWidth = activeImage.naturalWidth || item.width || 1;
    const naturalHeight = activeImage.naturalHeight || item.height || 1;
    const widthLimit = Math.max(1, lightboxStage.clientWidth * 0.96);
    const heightLimit = Math.max(1, lightboxStage.clientHeight * 0.96);
    const fitScale = Math.min(
      widthLimit / naturalWidth,
      heightLimit / naturalHeight,
    );

    activeImage.style.width = `${Math.max(1, Math.floor(naturalWidth * fitScale))}px`;
    activeImage.style.height = `${Math.max(1, Math.floor(naturalHeight * fitScale))}px`;
    applyPhotoViewImmediately();
  }

  function setZoom(nextZoom, clientX, clientY) {
    if (!activeImage || viewerIsOpening || viewerIsClosing || viewerIsChanging)
      return;
    const newZoom = Math.min(maximumZoom, Math.max(minimumZoom, nextZoom));

    if (
      clientX !== undefined &&
      clientY !== undefined &&
      newZoom !== zoomLevel
    ) {
      const stageRect = lightboxStage.getBoundingClientRect();
      const pointX = clientX - (stageRect.left + stageRect.width / 2);
      const pointY = clientY - (stageRect.top + stageRect.height / 2);
      const scaleChange = newZoom / zoomLevel;
      panX = pointX - (pointX - panX) * scaleChange;
      panY = pointY - (pointY - panY) * scaleChange;
    }

    zoomLevel = newZoom;
    if (zoomLevel === minimumZoom) {
      panX = 0;
      panY = 0;
    }
    applyPhotoView();
  }

  function resetZoom(isImmediate = false) {
    zoomLevel = minimumZoom;
    panX = 0;
    panY = 0;
    if (isImmediate) applyPhotoViewImmediately();
    else applyPhotoView();
  }

  function moveImageToViewer(index) {
    activeImage = galleryImages[index];
    activeMedia = galleryMedia[index];
    activeImage.classList.add("lightbox__image");
    lightboxStage.append(activeImage);
  }

  function returnImageToGallery() {
    if (!activeImage || !activeMedia) return;
    activeImage.getAnimations().forEach((animation) => animation.cancel());
    activeImage.classList.remove("lightbox__image");
    activeImage.style.removeProperty("width");
    activeImage.style.removeProperty("height");
    activeImage.style.removeProperty("transform");
    activeMedia.prepend(activeImage);
    activeImage = null;
    activeMedia = null;
  }

  async function openLightbox(index) {
    if (!galleryItems.length || index < 0 || index >= galleryItems.length)
      return;
    if (viewerIsOpen) {
      requestedIndex = index;
      requestedDirection = index >= currentIndex ? 1 : -1;
      changePhotoLoop();
      return;
    }

    const image = galleryImages[index];
    const startRect = image.getBoundingClientRect();
    viewerIsOpen = true;
    viewerIsOpening = true;
    closeWasRequested = false;
    currentIndex = index;
    requestedIndex = index;
    zoomLevel = minimumZoom;
    panX = 0;
    panY = 0;
    setPhotoDetails(index);
    setViewerBusy(true);
    lightbox.classList.add("is-active", "is-opening");
    lightbox.inert = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-viewer-open");

    await prepareImage(image);
    moveImageToViewer(index);
    await waitForLayout();
    fitActiveImage();
    lightbox.classList.add("is-moving");
    await animateFromRect(image, startRect);
    lightbox.classList.remove("is-moving", "is-opening");
    viewerIsOpening = false;
    setViewerBusy(false);
    preloadNearbyPhotos(index);

    if (closeWasRequested) performClose();
    else closeButton?.focus({ preventScroll: true });
  }

  async function changePhotoLoop() {
    if (!viewerIsOpen || viewerIsOpening || viewerIsClosing || viewerIsChanging)
      return;
    viewerIsChanging = true;

    while (
      viewerIsOpen &&
      !closeWasRequested &&
      requestedIndex !== currentIndex
    ) {
      const nextIndex = requestedIndex;
      const direction = requestedDirection;
      const nextImage = galleryImages[nextIndex];
      setViewerBusy(true);
      await prepareImage(nextImage);
      if (closeWasRequested || !viewerIsOpen) break;

      resetZoom(true);
      if (activeImage) {
        await playAnimation(
          activeImage,
          [
            { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
            {
              opacity: 0,
              transform: `translate3d(${-direction * 1.25}rem, 0, 0) scale(0.99)`,
            },
          ],
          { duration: 90, easing: "ease-in" },
        );
      }
      returnImageToGallery();

      currentIndex = nextIndex;
      setPhotoDetails(currentIndex);
      moveImageToViewer(currentIndex);
      await waitForLayout();
      fitActiveImage();
      await playAnimation(
        activeImage,
        [
          {
            opacity: 0,
            transform: `translate3d(${direction * 1.25}rem, 0, 0) scale(0.99)`,
          },
          { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        ],
        { duration: 140, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      preloadNearbyPhotos(currentIndex);
    }

    viewerIsChanging = false;
    setViewerBusy(false);
    if (closeWasRequested) performClose();
  }

  function showPreviousPhoto() {
    if (!viewerIsOpen || galleryItems.length < 2 || viewerIsClosing) return;
    requestedIndex =
      (requestedIndex - 1 + galleryItems.length) % galleryItems.length;
    requestedDirection = -1;
    changePhotoLoop();
  }

  function showNextPhoto() {
    if (!viewerIsOpen || galleryItems.length < 2 || viewerIsClosing) return;
    requestedIndex = (requestedIndex + 1) % galleryItems.length;
    requestedDirection = 1;
    changePhotoLoop();
  }

  function requestClose() {
    if (!viewerIsOpen || viewerIsClosing || closeWasRequested) return;
    closeWasRequested = true;
    if (!viewerIsOpening && !viewerIsChanging) performClose();
  }

  async function performClose() {
    if (!viewerIsOpen || viewerIsClosing || viewerIsOpening || viewerIsChanging)
      return;
    viewerIsClosing = true;
    viewerIsOpen = false;
    lightbox.classList.add("is-closing");
    setViewerBusy(false);
    resetZoom(true);
    await waitForFrame();

    if (activeImage && activeMedia) {
      const endRect = activeMedia.getBoundingClientRect();
      lightbox.classList.add("is-moving");
      await animateToRect(activeImage, endRect);
      returnImageToGallery();
    }

    lightbox.classList.remove(
      "is-active",
      "is-closing",
      "is-moving",
      "is-dragging",
      "is-pinching",
      "is-zoomed",
    );
    lightbox.inert = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-viewer-open");
    activePointers.clear();
    dragStart = null;
    pinchStart = null;
    closeWasRequested = false;
    viewerIsClosing = false;
    selectedPhotoButton?.focus({ preventScroll: true });
  }

  function getPointerDistance(firstPointer, secondPointer) {
    return Math.hypot(
      secondPointer.x - firstPointer.x,
      secondPointer.y - firstPointer.y,
    );
  }

  function getPointerMidpoint(firstPointer, secondPointer) {
    return {
      x: (firstPointer.x + secondPointer.x) / 2,
      y: (firstPointer.y + secondPointer.y) / 2,
    };
  }

  function startPinch() {
    const pointers = [...activePointers.values()];
    if (pointers.length < 2) return;
    const [firstPointer, secondPointer] = pointers;
    firstPointer.wasInPinch = true;
    secondPointer.wasInPinch = true;
    const stageRect = lightboxStage.getBoundingClientRect();
    const midpoint = getPointerMidpoint(firstPointer, secondPointer);
    pinchStart = {
      distance: Math.max(1, getPointerDistance(firstPointer, secondPointer)),
      zoom: zoomLevel,
      panX,
      panY,
      midpointX: midpoint.x - (stageRect.left + stageRect.width / 2),
      midpointY: midpoint.y - (stageRect.top + stageRect.height / 2),
    };
    dragStart = null;
    lightbox.classList.remove("is-dragging");
    lightbox.classList.add("is-pinching");
  }

  lightboxStage.addEventListener(
    "wheel",
    (event) => {
      if (event.target !== activeImage || viewerIsOpening || viewerIsChanging)
        return;
      event.preventDefault();
      wheelDelta += event.deltaY;
      wheelPoint = { x: event.clientX, y: event.clientY };
      if (wheelFrame) return;

      wheelFrame = requestAnimationFrame(() => {
        const zoomFactor = Math.exp(-wheelDelta * 0.0015);
        setZoom(zoomLevel * zoomFactor, wheelPoint?.x, wheelPoint?.y);
        wheelDelta = 0;
        wheelPoint = null;
        wheelFrame = 0;
      });
    },
    { passive: false },
  );

  lightboxStage.addEventListener("click", (event) => {
    if (event.target !== activeImage) return;
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (precisePointer.matches && zoomLevel === minimumZoom) {
      setZoom(2, event.clientX, event.clientY);
    }
  });

  lightboxStage.addEventListener("pointerdown", (event) => {
    if (event.target !== activeImage || viewerIsOpening || viewerIsChanging)
      return;
    const pointer = {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      type: event.pointerType,
      wasInPinch: false,
    };
    activePointers.set(event.pointerId, pointer);
    lightboxStage.setPointerCapture(event.pointerId);

    if (activePointers.size === 2) startPinch();
    else if (zoomLevel > minimumZoom) {
      dragStart = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        panX,
        panY,
      };
      lightbox.classList.add("is-dragging");
    }
  });

  lightboxStage.addEventListener("pointermove", (event) => {
    const pointer = activePointers.get(event.pointerId);
    if (!pointer) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (
      Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 7
    ) {
      suppressNextClick = true;
    }

    if (activePointers.size === 2 && pinchStart) {
      const [firstPointer, secondPointer] = [...activePointers.values()];
      const midpoint = getPointerMidpoint(firstPointer, secondPointer);
      const stageRect = lightboxStage.getBoundingClientRect();
      const midpointX = midpoint.x - (stageRect.left + stageRect.width / 2);
      const midpointY = midpoint.y - (stageRect.top + stageRect.height / 2);
      const nextZoom = Math.min(
        maximumZoom,
        Math.max(
          minimumZoom,
          (pinchStart.zoom * getPointerDistance(firstPointer, secondPointer)) /
            pinchStart.distance,
        ),
      );
      const scaleChange = nextZoom / pinchStart.zoom;
      zoomLevel = nextZoom;
      panX = midpointX - (pinchStart.midpointX - pinchStart.panX) * scaleChange;
      panY = midpointY - (pinchStart.midpointY - pinchStart.panY) * scaleChange;
      if (zoomLevel === minimumZoom) {
        panX = 0;
        panY = 0;
      }
      applyPhotoView();
      return;
    }

    if (dragStart?.pointerId === event.pointerId && zoomLevel > minimumZoom) {
      panX = dragStart.panX + event.clientX - dragStart.x;
      panY = dragStart.panY + event.clientY - dragStart.y;
      applyPhotoView();
    }
  });

  function endPointer(event, wasCancelled = false) {
    const pointer = activePointers.get(event.pointerId);
    if (!pointer) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const pointerWasSingle = activePointers.size === 1;
    const moveX = pointer.x - pointer.startX;
    const moveY = pointer.y - pointer.startY;
    const duration = performance.now() - pointer.startTime;

    if (
      !wasCancelled &&
      pointer.type === "touch" &&
      pointerWasSingle &&
      !pointer.wasInPinch &&
      zoomLevel === minimumZoom &&
      duration < 700 &&
      Math.abs(moveX) > 48 &&
      Math.abs(moveX) > Math.abs(moveY) * 1.2
    ) {
      suppressNextClick = true;
      if (moveX < 0) showNextPhoto();
      else showPreviousPhoto();
    }

    activePointers.delete(event.pointerId);
    if (lightboxStage.hasPointerCapture(event.pointerId)) {
      lightboxStage.releasePointerCapture(event.pointerId);
    }
    if (dragStart?.pointerId === event.pointerId) dragStart = null;
    if (activePointers.size < 2) {
      pinchStart = null;
      lightbox.classList.remove("is-pinching");
    }
    if (activePointers.size === 1 && zoomLevel > minimumZoom) {
      const [remainingPointerId, remainingPointer] = [
        ...activePointers.entries(),
      ][0];
      dragStart = {
        pointerId: remainingPointerId,
        x: remainingPointer.x,
        y: remainingPointer.y,
        panX,
        panY,
      };
      lightbox.classList.add("is-dragging");
    }
    if (!dragStart) lightbox.classList.remove("is-dragging");
    if (suppressNextClick) {
      window.setTimeout(() => {
        suppressNextClick = false;
      }, 0);
    }
  }

  lightboxStage.addEventListener("pointerup", (event) => endPointer(event));
  lightboxStage.addEventListener("pointercancel", (event) =>
    endPointer(event, true),
  );

  lightbox.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-lightbox-close]")) {
      requestClose();
      return;
    }
    if (
      event.target === lightbox ||
      event.target === lightboxBackdrop ||
      event.target === lightboxContent ||
      event.target === lightboxStage
    ) {
      requestClose();
    }
  });

  projectGrid.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest(".project-card button");
    const card = button?.closest(".project-card");
    if (!card) return;
    openLightbox(Number(card.dataset.index));
  });

  previousButton?.addEventListener("click", showPreviousPhoto);
  nextButton?.addEventListener("click", showNextPhoto);
  zoomOutButton?.addEventListener("click", () => setZoom(zoomLevel - zoomStep));
  zoomInButton?.addEventListener("click", () => setZoom(zoomLevel + zoomStep));
  zoomResetButton?.addEventListener("click", () => resetZoom());

  document.addEventListener("keydown", (event) => {
    if (!viewerIsOpen) return;

    if (event.key === "Tab") {
      const focusableControls = [
        ...lightbox.querySelectorAll("button:not(:disabled):not([hidden])"),
      ];
      if (!focusableControls.length) return;
      const firstControl = focusableControls[0];
      const lastControl = focusableControls[focusableControls.length - 1];
      if (!lightbox.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastControl : firstControl).focus();
      } else if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl.focus();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPreviousPhoto();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNextPhoto();
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoom(zoomLevel + zoomStep);
      return;
    }

    if (event.key === "-") {
      event.preventDefault();
      setZoom(zoomLevel - zoomStep);
      return;
    }

    if (event.key === "0") {
      event.preventDefault();
      resetZoom();
      return;
    }

    if (zoomLevel > minimumZoom && event.key === "ArrowUp") {
      event.preventDefault();
      panY += 48;
      applyPhotoView();
    }

    if (zoomLevel > minimumZoom && event.key === "ArrowDown") {
      event.preventDefault();
      panY -= 48;
      applyPhotoView();
    }
  });

  window.addEventListener("resize", () => {
    if (!viewerIsOpen || !activeImage || resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      fitActiveImage();
    });
  });

  [projectGrid, lightbox].forEach((protectedArea) => {
    protectedArea.addEventListener("contextmenu", (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("img, .project-card__media, .lightbox__stage")
      ) {
        event.preventDefault();
      }
    });
    protectedArea.addEventListener("dragstart", (event) => {
      if (event.target instanceof Element && event.target.closest("img"))
        event.preventDefault();
    });
  });

  function fetchImageDimensionsSingle(item) {
    return new Promise((resolve) => {
      if (item.width && item.height) {
        item.aspectRatio = item.width / item.height;
        return resolve(item);
      }
      const img = new Image();
      img.onload = () => {
        item.width = img.naturalWidth;
        item.height = img.naturalHeight;
        item.aspectRatio = img.naturalWidth / img.naturalHeight;
        resolve(item);
      };
      img.onerror = () => {
        item.width = 300;
        item.height = 400;
        item.aspectRatio = 0.75;
        resolve(item);
      };
      img.src = item.src;
    });
  }

  function getGridColumnCount() {
    const width = window.innerWidth;
    if (width <= 576) return 1;
    if (width <= 832) return 2;
    if (width <= 1152) return 3;
    return 4;
  }

  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function organizeItemsByDimensions(items, numCols = 4) {
    if (numCols <= 1 || items.length <= 1) return items;

    // Separate landscape (aspectRatio > 1.1) and portrait/square (aspectRatio <= 1.1)
    const landscapes = [];
    const portraits = [];

    items.forEach((item) => {
      const ratio = item.width && item.height ? item.width / item.height : 0.75;
      if (ratio > 1.1) landscapes.push(item);
      else portraits.push(item);
    });

    // Interleave landscape and portrait images to create a balanced stream
    const mixedQueue = [];
    let lIdx = 0;
    let pIdx = 0;
    const lLen = landscapes.length;
    const pLen = portraits.length;

    while (lIdx < lLen || pIdx < pLen) {
      // Determine ratio of portraits to landscapes remaining
      if (lIdx < lLen && (pIdx >= pLen || (lIdx / lLen <= pIdx / pLen))) {
        mixedQueue.push(landscapes[lIdx++]);
      } else if (pIdx < pLen) {
        mixedQueue.push(portraits[pIdx++]);
      }
    }

    // Distribute into columns minimizing height disparity and avoiding consecutive orientation clustering
    const columns = Array.from({ length: numCols }, () => []);
    const columnHeights = new Array(numCols).fill(0);

    mixedQueue.forEach((item) => {
      const itemRatio =
        item.height && item.width ? item.height / item.width : 1.33;
      let minCol = 0;
      for (let i = 1; i < numCols; i++) {
        if (columnHeights[i] < columnHeights[minCol]) {
          minCol = i;
        }
      }
      columns[minCol].push(item);
      columnHeights[minCol] += itemRatio;
    });

    // Flatten in round-robin fashion so rows seamlessly alternate between aspect ratios visually
    const maxItems = Math.max(...columns.map((col) => col.length));
    const result = [];
    for (let r = 0; r < maxItems; r++) {
      for (let c = 0; c < numCols; c++) {
        if (r < columns[c].length) {
          result.push(columns[c][r]);
        }
      }
    }
    return result;
  }

  async function getGalleryManifest() {
    const manifestPaths = ["./gallery/images.json", "./images.json"];

    for (const manifestPath of manifestPaths) {
      try {
        const response = await fetch(manifestPath);
        if (!response.ok) continue;
        const data = await response.json();
        if (Array.isArray(data)) {
          return { organizeByDimensions: false, shuffleImages: false, items: data };
        }
        if (typeof data === "object" && data !== null) {
          const items = Array.isArray(data.images)
            ? data.images
            : Array.isArray(data.gallery)
              ? data.gallery
              : [];
          return {
            organizeByDimensions: Boolean(data.organizeByDimensions),
            shuffleImages: Boolean(data.shuffleImages),
            items,
          };
        }
      } catch (error) {
        if (manifestPath === manifestPaths[manifestPaths.length - 1])
          throw error;
      }
    }

    throw new Error("The gallery data could not be loaded.");
  }

  getGalleryManifest()
    .then(async ({ organizeByDimensions, shuffleImages, items }) => {
      const normalized = items.map(normalizeItem);
      let initialList = shuffleImages ? shuffleArray(normalized) : normalized;
      
      let sortedItems = initialList;
      const allHaveDims = initialList.every(
        (item) => item.width && item.height,
      );

      if (organizeByDimensions && allHaveDims) {
        sortedItems = organizeItemsByDimensions(
          initialList,
          getGridColumnCount(),
        );
      }

      // Initial render with placeholder ratios
      renderGrid(sortedItems);

      // Asynchronously process photos one by one to ensure fast display & progress on slow connections
      for (let i = 0; i < sortedItems.length; i++) {
        await fetchImageDimensionsSingle(sortedItems[i]);
        // Update DOM element ratio if it was measured dynamically
        const cardMedia = galleryMedia[i];
        if (cardMedia && sortedItems[i].width && sortedItems[i].height) {
          cardMedia.style.aspectRatio = `${sortedItems[i].width} / ${sortedItems[i].height}`;
        }
        // Poke loaded card & image immediately as each finishes
        if (galleryImages[i]) {
          galleryImages[i].classList.add("is-image-loaded");
          const card = galleryImages[i].closest(".project-card");
          if (card) card.classList.add("is-loaded");
        }
      }

      // If dimensions were not pre-calculated and organizeByDimensions was requested, re-organize grid once dimensions are known
      if (organizeByDimensions && !allHaveDims) {
        const reordered = organizeItemsByDimensions(
          sortedItems,
          getGridColumnCount(),
        );
        renderGrid(reordered);
      }
    })
    .catch(async (error) => {
      console.error("Gallery load error:", error);
      const fallbackList = [
        "headshot/headshot-romilia-1.JPG",
        "headshot/headshot-romilia-2.JPG",
        "location/collaborative-mai-space-1.jpg",
        "location/collaborative-mai-space-2.jpg",
        "studio/studio-mai-space-1.jpeg",
      ];
      const normalizedFallback = fallbackList.map(normalizeItem);
      renderGrid(normalizedFallback);
    });
})();

document.querySelectorAll("[data-product-gallery]").forEach((gallery) => {
  const mainImage = gallery.querySelector("[data-product-main-image]");
  const thumbnails = [...gallery.querySelectorAll("[data-product-thumbnail]")];

  if (!mainImage || !thumbnails.length) return;

  function showProductImage(thumbnail) {
    const source = thumbnail.dataset.imageSource;
    if (!source || mainImage.getAttribute("src") === source) return;

    thumbnails.forEach((item) => {
      item.setAttribute("aria-pressed", String(item === thumbnail));
    });

    mainImage.classList.add("is-changing");
    mainImage.addEventListener(
      "load",
      () => mainImage.classList.remove("is-changing"),
      { once: true },
    );
    mainImage.addEventListener(
      "error",
      () => mainImage.classList.remove("is-changing"),
      { once: true },
    );
    mainImage.src = source;
    mainImage.alt = thumbnail.dataset.imageAlt || "Romilia service sample";
  }

  thumbnails.forEach((thumbnail, index) => {
    thumbnail.addEventListener("click", () => showProductImage(thumbnail));
    thumbnail.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex =
        (index + direction + thumbnails.length) % thumbnails.length;
      thumbnails[nextIndex].focus();
      showProductImage(thumbnails[nextIndex]);
    });
  });
});

const requestedService = new URLSearchParams(window.location.search).get(
  "service",
);

document.querySelectorAll("[data-service-select]").forEach((select) => {
  if (!requestedService) return;
  const matchingOption = [...select.options].find(
    (option) => option.value === requestedService,
  );
  if (matchingOption) select.value = requestedService;
});

const today = new Date();
const minimumDate = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

document.querySelectorAll('input[type="date"]').forEach((dateInput) => {
  dateInput.min = minimumDate;
});

const enquiryFunctionUrl =
  "https://aghyubnxgqcfwjnfusuv.supabase.co/functions/v1/submit-enquiry";
const supabasePublishableKey = "sb_publishable_NgHXckWRnnpghrppc-Qqjw_pP0fYBM0";
const enquiryEmailAddress = "romiliawear@gmail.com";

function selectedOptionText(field) {
  if (!(field instanceof HTMLSelectElement) || !field.value) return "";
  return field.selectedOptions[0]?.textContent?.trim() || "";
}

function createEnquiryPayload(form) {
  const formData = new FormData(form);
  const serviceField = form.elements.namedItem("service");
  const budgetField = form.elements.namedItem("budget");

  return {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    service: selectedOptionText(serviceField),
    budget: selectedOptionText(budgetField),
    preferredDate: String(formData.get("preferred-date") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    message: String(formData.get("project-details") || "").trim(),
    privacyConsent: formData.get("privacy-consent") === "on",
    website: String(formData.get("website") || "").trim(),
  };
}

function createFallbackEmailUrl(payload) {
  const subject = `Romilia website enquiry — ${payload.name || "New project"}`;
  const body = [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone || "Not provided"}`,
    `Service: ${payload.service}`,
    `Budget: ${payload.budget || "Not provided"}`,
    `Preferred date: ${payload.preferredDate || "Not provided"}`,
    `Location: ${payload.location || "Not provided"}`,
    "",
    "Project details:",
    payload.message,
  ].join("\n");

  return `mailto:${enquiryEmailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function setFormStatus(status, options = {}) {
  if (!status) return;

  const {
    eyebrow = "",
    title = "",
    message = "",
    state = "",
    fallbackUrl = "",
  } = options;

  status.classList.remove("is-sending", "is-success", "is-error");
  if (state) status.classList.add(`is-${state}`);
  status.replaceChildren();

  if (eyebrow) {
    const eyebrowElement = document.createElement("span");
    eyebrowElement.className = "form-status__eyebrow";
    eyebrowElement.textContent = eyebrow;
    status.append(eyebrowElement);
  }

  if (title) {
    const titleElement = document.createElement("strong");
    titleElement.className = "form-status__title";
    titleElement.textContent = title;
    status.append(titleElement);
  }

  if (message) {
    const messageElement = document.createElement("span");
    messageElement.className = "form-status__copy";
    messageElement.textContent = message;
    status.append(messageElement);
  }

  if (fallbackUrl) {
    const emailLink = document.createElement("a");
    emailLink.className = "form-status__link";
    emailLink.href = fallbackUrl;
    emailLink.textContent = "Email Romilia instead";
    status.append(emailLink);
  }

  status.focus();
}

function setSubmittingState(form, isSubmitting) {
  const button = form.querySelector('button[type="submit"]');
  const label = button?.querySelector("span");

  form.setAttribute("aria-busy", String(isSubmitting));
  if (button) button.disabled = isSubmitting;
  if (label) label.textContent = isSubmitting ? "Sending…" : "Send the enquiry";
}

document.querySelectorAll("[data-enquiry-form]").forEach((form) => {
  const status = form.querySelector("[data-form-status]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.getAttribute("aria-busy") === "true") return;

    const payload = createEnquiryPayload(form);
    const fallbackUrl = createFallbackEmailUrl(payload);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    setSubmittingState(form, true);
    setFormStatus(status, {
      message: "Sending your enquiry…",
      state: "sending",
    });

    try {
      if (!navigator.onLine) {
        throw new Error("offline");
      }

      const response = await fetch(enquiryFunctionUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          apikey: supabasePublishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        // The generic response below handles a non-JSON server response.
      }

      if (!response.ok || result?.ok !== true) {
        const error = new Error(
          result?.message || "The form could not send your enquiry.",
        );
        error.serviceUnavailable = response.status >= 500;
        throw error;
      }

      form.reset();
      setFormStatus(status, {
        eyebrow: "Enquiry received",
        title: "It’s with Romilia.",
        message: `Romilia will read the details and reply to ${payload.email}.`,
        state: "success",
      });
    } catch (error) {
      const serviceUnavailable =
        error?.serviceUnavailable === true ||
        error?.name === "AbortError" ||
        error?.message === "offline" ||
        error instanceof TypeError;

      const message = serviceUnavailable
        ? "The form is not available now. Your details were not sent."
        : error?.message || "Your enquiry could not be sent.";

      setFormStatus(status, {
        eyebrow: "Not sent",
        title: "Let’s try another way.",
        message,
        state: "error",
        fallbackUrl,
      });

      if (serviceUnavailable) {
        form.dispatchEvent(
          new CustomEvent("romilia:form-offline", { bubbles: true }),
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSubmittingState(form, false);
    }
  });
});

document.addEventListener("contextmenu", (event) => {
  if (event.target instanceof Element && event.target.closest("img")) {
    event.preventDefault();
  }
});

document.addEventListener("dragstart", (event) => {
  if (event.target instanceof Element && event.target.closest("img")) {
    event.preventDefault();
  }
});
