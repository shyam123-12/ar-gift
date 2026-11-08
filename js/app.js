
const elements = {
  welcome: document.getElementById("welcome-screen"),
  loading: document.getElementById("ar-loading"),
  instructions: document.getElementById("ar-instructions"),
  error: document.getElementById("ar-error"),
  container: document.getElementById("ar-container"),
  controls: document.getElementById("ar-controls"),
  soundButton: document.getElementById("sound-button"),
  trackingStatus: document.getElementById("tracking-status"),
  startButton: document.getElementById("start-button")
};

let scene;
let video;
let target;
let arSystem;

let started = false;
let soundEnabled = false;

const frameId = new URLSearchParams(
  location.search
).get("id");

function showError(message) {
  elements.loading.classList.add("hidden");
  elements.instructions.classList.add("hidden");
  elements.welcome.classList.remove("hidden");

  document.querySelector(".description").textContent = message;

  elements.startButton.disabled = true;
  elements.startButton.textContent = "Unavailable";
}

async function loadFrame() {
  if (!frameId) {
    throw new Error("Missing frame ID. Use ?id=demo-center");
  }

  const response = await fetch("./data/frames.json");

  if (!response.ok) {
    throw new Error("Unable to load frame configuration.");
  }

  const frames = await response.json();
  const frame = frames[frameId];

  if (!frame) {
    throw new Error("This gift frame does not exist.");
  }

  return frame;
}

function getVideoDimensions(layout, aspectRatio) {
  const width = Number(layout.width);
  const height = Number(layout.height);

  if (layout.sizeBy === "height") {
    if (!(height > 0)) {
      throw new Error("Invalid video height.");
    }

    return {
      width: height * aspectRatio,
      height
    };
  }

  if (!(width > 0)) {
    throw new Error("Invalid video width.");
  }

  return {
    width,
    height: width / aspectRatio
  };
}

function createScene(frame) {
  return new Promise((resolve, reject) => {
    const layout = frame.layout || {};

    scene = document.createElement("a-scene");

    scene.setAttribute("mindar-image", [
      `imageTargetSrc: ${frame.target}`,
      "autoStart: false",
      "showStats: false",
      "uiLoading: no",
      "uiError: no",
      "uiScanning: no"
    ].join("; "));

    scene.setAttribute("embedded", "");
    scene.setAttribute("color-space", "sRGB");
    scene.setAttribute("vr-mode-ui", "enabled: false");
    scene.setAttribute(
      "device-orientation-permission-ui",
      "enabled: false"
    );

    scene.innerHTML = `
      <a-assets>
        <video
          id="gift-video"
          src="${frame.video}"
          preload="auto"
          muted
          playsinline
          webkit-playsinline
          loop
          crossorigin="anonymous">
        </video>
      </a-assets>

      <a-camera
        position="0 0 0"
        look-controls="enabled: false">
      </a-camera>

      <a-entity
        id="gift-target"
        mindar-image-target="targetIndex: ${frame.targetIndex ?? 0}">

        <a-video
          id="gift-video-plane"
          src="#gift-video"
          position="${Number(layout.x ?? 0)} ${Number(layout.y ?? 0)} ${Number(layout.z ?? 0.02)}"
          rotation="0 0 ${Number(layout.rotation ?? 0)}"
          width="1"
          height="1">
        </a-video>

      </a-entity>
    `;

    const onLoaded = () => {
      video = scene.querySelector("#gift-video");
      target = scene.querySelector("#gift-target");
      const plane = scene.querySelector("#gift-video-plane");

      if (!video || !target || !plane) {
        reject(new Error("AR elements could not be created."));
        return;
      }

      const configureVideo = () => {
        const aspectRatio = video.videoWidth / video.videoHeight;

        if (!aspectRatio || !Number.isFinite(aspectRatio)) {
          reject(new Error("Invalid video dimensions."));
          return;
        }

        try {
          const dimensions = getVideoDimensions(
            layout,
            aspectRatio
          );

          plane.setAttribute("width", dimensions.width);
          plane.setAttribute("height", dimensions.height);

          arSystem = scene.systems["mindar-image-system"];

          if (!arSystem) {
            reject(new Error("MindAR system initialization failed."));
            return;
          }

          setupTrackingEvents();
          resolve();

        } catch (error) {
          reject(error);
        }
      };

      if (video.readyState >= 1) {
        configureVideo();
      } else {
        video.addEventListener(
          "loadedmetadata",
          configureVideo,
          { once: true }
        );

        video.addEventListener("error", () => {
          reject(new Error("Unable to load the video."));
        }, { once: true });
      }
    };

    scene.addEventListener("loaded", onLoaded, { once: true });

    scene.addEventListener("error", () => {
      reject(new Error("Unable to initialize AR scene."));
    }, { once: true });

    elements.container.appendChild(scene);
  });
}

function setupTrackingEvents() {
  target.addEventListener("targetFound", handleTargetFound);
  target.addEventListener("targetLost", handleTargetLost);
}

async function handleTargetFound() {
  elements.trackingStatus.textContent = "Photograph detected!";
  elements.controls.classList.remove("hidden");

  try {
    await video.play();
  } catch (error) {
    console.warn("Video playback needs interaction:", error);
    elements.trackingStatus.textContent =
      "Photograph detected. Tap the playback control.";
  }
}

function handleTargetLost() {
  video.pause();

  elements.controls.classList.add("hidden");
  elements.trackingStatus.textContent =
    "Looking for your photograph...";
}

async function startExperience() {
  if (started || !arSystem) return;

  started = true;

  elements.startButton.disabled = true;
  elements.startButton.textContent = "Starting camera...";

  elements.welcome.classList.add("hidden");
  elements.loading.classList.remove("hidden");
  elements.instructions.classList.remove("hidden");
  elements.trackingStatus.classList.remove("hidden");

  try {
    await arSystem.start();
    elements.loading.classList.add("hidden");

  } catch (error) {
    console.error("Camera startup failed:", error);

    started = false;

    elements.welcome.classList.remove("hidden");
    elements.instructions.classList.add("hidden");
    elements.trackingStatus.classList.add("hidden");

    elements.startButton.disabled = false;
    elements.startButton.textContent = "Try Again";

    document.querySelector(".description").textContent =
      "Camera unavailable. Please check browser permissions and try again.";
  }
}

async function toggleSound() {
  if (!video) return;

  soundEnabled = !soundEnabled;
  video.muted = !soundEnabled;

  if (soundEnabled) {
    try {
      await video.play();
      elements.soundButton.textContent = "Mute Sound";
    } catch (error) {
      soundEnabled = false;
      video.muted = true;
      elements.soundButton.textContent = "Enable Sound";
    }
  } else {
    elements.soundButton.textContent = "Enable Sound";
  }
}

async function initialize() {
  try {
    const frame = await loadFrame();
    await createScene(frame);

    elements.loading.classList.add("hidden");
    elements.startButton.disabled = false;

    elements.startButton.addEventListener(
      "click",
      startExperience
    );

    elements.soundButton.addEventListener(
      "click",
      toggleSound
    );

    console.log("AR frame ready:", frame.name);

  } catch (error) {
    console.error(error);
    showError(error.message);
  }
}

initialize();
