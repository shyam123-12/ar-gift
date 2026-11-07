
const elements = {
  welcome: document.getElementById("welcome-screen"),
  arScreen: document.getElementById("ar-screen"),
  startButton: document.getElementById("start-button"),
  loading: document.getElementById("ar-loading"),
  instructions: document.getElementById("ar-instructions"),
  error: document.getElementById("ar-error"),
  container: document.getElementById("ar-container"),
  controls: document.getElementById("ar-controls"),
  soundButton: document.getElementById("sound-button"),
  trackingStatus: document.getElementById("tracking-status")
};

let scene;
let video;
let target;
let arSystem;

let tracking = false;
let soundEnabled = false;
let started = false;

const frameId = new URLSearchParams(
  window.location.search
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
    throw new Error("No frame ID provided. Use ?id=demo");
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

function createScene(frame) {
  return new Promise((resolve, reject) => {
    scene = document.createElement("a-scene");

    scene.setAttribute(
      "mindar-image",
      [
        `imageTargetSrc: ${frame.target}`,
        "autoStart: false",
        "showStats: false",
        "uiLoading: no",
        "uiError: no",
        "uiScanning: no"
      ].join("; ")
    );

    scene.setAttribute("embedded", "");
    scene.setAttribute("color-space", "sRGB");

    scene.setAttribute(
      "renderer",
      "colorManagement: true, physicallyCorrectLights"
    );

    scene.setAttribute(
      "vr-mode-ui",
      "enabled: false"
    );

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
          crossorigin="anonymous"
        ></video>
      </a-assets>

      <a-camera
        position="0 0 0"
        look-controls="enabled: false"
      ></a-camera>

      <a-entity
        id="gift-target"
        mindar-image-target="targetIndex: ${frame.targetIndex ?? 0}"
      >
        <a-video
          id="gift-video-plane"
          src="#gift-video"
          position="0 0 0.01"
          width="${frame.videoWidth}"
          height="${frame.videoHeight}"
          rotation="0 0 0"
          visible="true"
        ></a-video>
      </a-entity>
    `;

    target = null;

    scene.addEventListener("loaded", () => {
      target = scene.querySelector("#gift-target");
      video = document.getElementById("gift-video");

      arSystem = scene.systems["mindar-image"];

      if (!arSystem || !target || !video) {
        reject(new Error("AR engine initialization failed."));
        return;
      }

      setupTrackingEvents();

      resolve();
    }, { once: true });

    scene.addEventListener("error", () => {
      reject(new Error("Unable to initialize the AR scene."));
    });

    elements.container.appendChild(scene);
  });
}

function setupTrackingEvents() {
  target.addEventListener("targetFound", handleTargetFound);
  target.addEventListener("targetLost", handleTargetLost);
}

async function handleTargetFound() {
  tracking = true;

  elements.trackingStatus.textContent = "Photograph detected!";
  elements.controls.classList.remove("hidden");

  try {
    await video.play();
  } catch (error) {
    console.warn("Video autoplay requires interaction:", error);
    elements.trackingStatus.textContent =
      "Photograph detected. Tap Enable Sound to start playback.";
  }
}

function handleTargetLost() {
  tracking = false;

  if (video) {
    video.pause();
  }

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
    // Called directly from the user's button interaction.
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
      console.error("Audio playback failed:", error);
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

    elements.startButton.disabled = true;

    showError(error.message);
  }
}

initialize();

