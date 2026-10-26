    import * as THREE from './three-entry.js';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    function escHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch]));
    }
    
    // ==================== CONSTANTS ====================
    const STUD = 0.8;
    const BRICK_H = 0.96;
    const PLATE_H = 0.32;
    const STUD_H = 0.17;
    const STUD_R = 0.24;
    // Close studs use a rounder cylinder. Far studs stay at 8 sides so a full plate holds frame rate.
    const STUD_SEG_NEAR = 20;
    const STUD_SEG_FAR = 8;
    const STUD_NEAR_DIST = 10;
    // Drawing-buffer height for the desktop stud shade. The check samples
    // CSS pixels; the suite's desktop scale is 1, so this matches the shot.
    const studViewH = { value: 900 };
    const studViewBuf = new THREE.Vector2();
    const BASE_Y = 0;
    
    // ==================== SOUND SYSTEM ====================
    const SoundSystem = {
      ctx: null,
      enabled: true,
      volume: 0.5,
      musicVolume: 0.3,
      musicPlaying: false,
      currentMusic: null,
      
      init() {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) {
          console.log('Web Audio not supported');
          this.enabled = false;
        }
      },
      
      resume() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      },
      
      // Synthesize a click/snap sound for brick placement
      playPlace() {
        this.resume();
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.045);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const env = Math.pow(1 - i / bufferSize, 2.4);
          data[i] = (Math.random() * 2 - 1) * env;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1600;
        filter.Q.value = 0.7;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(this.volume * 0.5, t);
        noise.connect(filter);
        filter.connect(ng);
        ng.connect(this.ctx.destination);
        noise.start(t);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(640, t);
        osc.frequency.exponentialRampToValueAtTime(210, t + 0.055);
        gain.gain.setValueAtTime(this.volume * 0.32, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.07);
      },
      
      // Synthesize a pop sound for deletion
      playDelete() {
        this.resume();
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(this.volume * 0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
      },
      
      // Click sound for rotation
      playRotate() {
        this.resume();
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.setValueAtTime(700, this.ctx.currentTime + 0.03);
        gain.gain.setValueAtTime(this.volume * 0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.06);
      },
      
      // UI click sound
      playClick() {
        this.resume();
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
        gain.gain.setValueAtTime(this.volume * 0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
      },
      
      // Error/invalid placement sound
      playError() {
        this.resume();
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.setValueAtTime(150, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(this.volume * 0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
      },
      
      // Success/achievement sound
      playSuccess() {
        this.resume();
        if (!this.enabled || !this.ctx) return;
        const notes = [523, 659, 784]; // C5, E5, G5 chord
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.1);
          gain.gain.setValueAtTime(this.volume * 0.2, this.ctx.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.1 + 0.3);
          osc.start(this.ctx.currentTime + i * 0.1);
          osc.stop(this.ctx.currentTime + i * 0.1 + 0.3);
        });
      },
      
      // Footstep sound for walk mode
      playFootstep() {
        this.resume();
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80 + Math.random() * 40, this.ctx.currentTime);
        gain.gain.setValueAtTime(this.volume * 0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
      },
      
      // Jump sound
      playJump() {
        this.resume();
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(this.volume * 0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
      },
      
      // Ambient music - simple generative melody
      startMusic() {
        this.resume();
        if (!this.enabled || !this.ctx || this.musicPlaying) return;
        this.musicPlaying = true;
        
        const playNote = () => {
          if (!this.musicPlaying) return;
          
          // Pentatonic scale for pleasant sounds
          const notes = [261, 293, 329, 392, 440, 523, 587, 659];
          const freq = notes[Math.floor(Math.random() * notes.length)];
          
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);
          
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, this.ctx.currentTime);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
          
          const duration = 0.5 + Math.random() * 1;
          gain.gain.setValueAtTime(0, this.ctx.currentTime);
          gain.gain.linearRampToValueAtTime(this.musicVolume * this.volume * 0.15, this.ctx.currentTime + 0.1);
          gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
          
          osc.start();
          osc.stop(this.ctx.currentTime + duration);
          
          // Schedule next note
          const nextDelay = 500 + Math.random() * 2000;
          this.currentMusic = setTimeout(playNote, nextDelay);
        };
        
        playNote();
      },
      
      stopMusic() {
        this.musicPlaying = false;
        if (this.currentMusic) {
          clearTimeout(this.currentMusic);
          this.currentMusic = null;
        }
      },
      
      toggleMusic() {
        if (this.musicPlaying) {
          this.stopMusic();
        } else {
          this.startMusic();
        }
        return this.musicPlaying;
      },
      
      setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
      },
      
      toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) this.stopMusic();
        return this.enabled;
      }
    };
    
    // ==================== STATE ====================
    let scene, camera, renderer, controls, raycaster, mouse, groundPlane;
    let composer, bloomPass, ssaoPass, vignettePass, gradeScreenPass;
    // Lose the context first, then dispose the renderer and drop the scene.
    // Walking every mesh on top of that queued a longer sweep into the next
    // document. This order was the lighter teardown of the two that were measured.
    function releaseBrixHeap() {
      try {
        if (renderer) renderer.forceContextLoss();
      } catch (err) {}
      try {
        if (renderer) renderer.dispose();
      } catch (err) {}
      renderer = null;
      try {
        instancedSystem.meshes.clear();
        instancedSystem.geometryCache.clear();
        instancedSystem.materialCache.clear();
        instancedSystem.brickLookup.clear();
      } catch (err) {}
      try {
        if (scene) scene.clear();
      } catch (err) {}
      scene = null;
      camera = null;
      composer = null;
    }
    window.__brixRelease = releaseBrixHeap;
    let postMods = null;
    let postModsPromise = null;
    let ssaoPromise = null;
    let postGen = 0;
    let ghost = null;
    let mirrorGhosts = []; // Ghost previews for mirrored bricks
    let prefabGhosts = []; // Ghost previews for prefab bricks
    let selectedBrick = '2x2';
    let selectedColor = 0xff2200;
    let selectedLightColor = 0xffdd44; // Default warm white for light bricks
    let isTransparent = false; // Whether current color is transparent
    let currentRotation = 0; // Y axis rotation (yaw)
    let currentPitch = 0; // X axis rotation (pitch) 
    let currentRoll = 0; // Z axis rotation (roll)
    let deleteMode = false;
    let dropperMode = false;
    let paintMode = false;
    let facePaintMode = false;
    let floorMode = false;
    let floorType = 'plate'; // 'plate', 'tile', 'brick'
    let floorDragStart = null; // Starting grid position for floor drag
    let floorDragEnd = null; // Ending grid position for floor drag
    let wallMode = false;
    let wallHeight = 3; // Height in bricks (each brick = 3 plate heights)
    let wallDepth = 2; // Wall depth in studs
    let wallBoxMode = false; // false = single line wall, true = 4-sided box
    let wallDragStart = null; // Starting grid position for wall drag
    let wallDragEnd = null; // Ending grid position for wall drag
    let wallDragDirection = {x: 1, z: 1}; // Drag direction (1 = positive, -1 = negative)
    let wallGhosts = []; // Ghost previews for wall
    let floorGhosts = []; // Ghost previews for floor area
    let gravityOn = false;
    let mirrorOn = false;
    let mirrorAxis = 'x'; // 'x', 'z', or 'both'
    let mirrorOffset = 0; // mirror line position in stud units
    let mirrorLines = []; // Visual lines showing mirror axis
    let selectedPrefab = null; // Currently selected prefab name
    
    // Custom prefab recording state
    let isRecordingPrefab = false; // Now means "selection mode" for prefab creation
    let selectedForPrefab = new Set(); // Bricks selected for prefab
    let prefabSelectionHighlights = new Map(); // Original colors for restore
    let customPrefabs = {}; // User-created prefabs
    
    // Time of day / weather state
    let timeOfDay = 0.5; // noon. Brighter default than the old morning preset.
    // Desktop home ray. (22, 40, 42) from the plate center points the same way as camera (60, 40, 80).
    const HOME_OX = 22, HOME_OY = 40, HOME_OZ = 42;
    // True desktop only (min side >= 900). The 1280×800 suite stays on the
    // wide ray. This aim sits toward the near corner so a 2×2 in the
    // click band is 28–44 px while every plate corner stays inside the frame.
    const DESK_OX = 42, DESK_OY = 22, DESK_OZ = 42;
    const DESK_AIM = 49;
    // Portrait sits about 15° above the plate and 56 units out. Open sky is
    // about a fifth of the phone frame, the horizon stays above the y280
    // band, and a starter cottage still clears 48px. The wide 1280×800
    // window stays on its own ray. The ghost sits on the cursor because
    // placement aims at the brick center, not this pitch.
    const PHONE_OX = 52, PHONE_OY = 21, PHONE_OZ = 56;
    const PHONE_HOME_DIST = 56;
    const WIDE_OX = 58, WIDE_OY = 40, WIDE_OZ = 62;
    const WIDE_HOME_DIST = 43;
    let weatherType = 'clear'; // 'clear', 'rain', 'snow', 'fog'
    let rainParticles = null;
    let snowParticles = null;
    let envMap = null;
    let bricks = [];
    let undoStack = [];
    let redoStack = [];
    const grid = new Map();
    const cellBrick = new Map(); // "x,z,gy" -> brick, for grid picking
    let isTouchDevice = false;
    let hasUnsavedChanges = false; // Track if project needs saving
    
    // Photo tile state
    let uploadedTextures = []; // Array of {name, texture, dataUrl}
    let selectedTexture = null; // Currently selected texture for tiles
    
    // Move mode state
    let moveMode = false;
    let selectedGroup = []; // Bricks selected for moving
    let moveGhosts = []; // Ghost previews for moved group
    let moveOffset = {x: 0, y: 0, z: 0}; // Offset from original position
    
    // First-person mode state
    let firstPersonMode = false;
    let fpPosition = new THREE.Vector3(0, 1.2, 0); // Minifig eye height ~4 bricks
    let fpYaw = 0; // Horizontal rotation
    let fpPitch = 0; // Vertical rotation  
    let fpVelocity = new THREE.Vector3(0, 0, 0);
    let fpKeys = { forward: false, backward: false, left: false, right: false, jump: false };
    let fpSpeed = 6; // Movement speed in studs/second
    let fpMouseSensitivity = 0.002;
    let savedCameraState = null; // To restore orbit camera position
    
    // First-person physics
    const FP_EYE_HEIGHT = 2.0; // Standing eye height (taller for better build angle)
    const FP_CROUCH_HEIGHT = 0.8; // Crouching eye height
    const FP_STEP_HEIGHT = 0.5; // Max step-up height (about 1.5 plates - can climb stairs)
    const FP_GRAVITY = 18; // Gravity acceleration
    const FP_JUMP_VELOCITY = 6; // Jump impulse
    const FP_PLAYER_RADIUS = 0.3; // Collision radius
    let fpCrouching = false;
    let fpOnGround = true;
    let fpVerticalVelocity = 0;
    
    // Walk mode building
    let fpBuildMode = true; // Whether building is enabled in walk mode
    let fpGhost = null; // Ghost preview for walk mode (single brick)
    let fpGhostOffset = {x: 0, z: 0, y: 0}; // Arrow key offset for ghost position
    let fpMenuMode = false; // True when pointer is released for menu access
    let fpLastGhostPos = null; // Last ghost grid position (to avoid redundant updates)
    let fpLastCanPlace = null; // Last canPlace state
    let fpUpdateCounter = 0; // Frame counter for throttling
    let fpPrefabGhosts = []; // Ghost previews for walk mode prefabs
    let fpPlaceDistance = 12; // Distance in front of player to place bricks (increased for multi-story)
    let fpTargetGrid = null; // Current target grid position for placement
    let fpTargetBrick = null; // Brick currently being aimed at (for deletion)
    let fpTargetBrickOriginalColors = new Map(); // Original colors of highlighted brick
    let fpTargetOutline = null; // Wireframe outline around targeted brick (Minecraft-style)
    let fpClickHeld = false; // True when left mouse button is held (shows ghost)
    
    // Walk mode quick slots (bricks/prefabs for fast selection)
    let fpQuickSlots = [
      { type: 'brick', id: '2x2' },
      { type: 'brick', id: '2x4' },
      { type: 'brick', id: '1x2' },
      { type: 'brick', id: '2x4p' },
      { type: 'brick', id: 'slope2' },
      { type: 'prefab', id: 'stairs' },
      { type: 'prefab', id: 'pillar' },
      { type: 'prefab', id: 'door' },
      { type: 'prefab', id: 'window' }
    ];
    let fpQuickSlotIndex = 0;
    let fpRadialMenuOpen = false;
    
    // ==================== PREFAB DEFINITIONS ====================
    const prefabs = {};
    let prefabsReady = null;
    function ensurePrefabs() {
      if (!prefabsReady) {
        prefabsReady = import('./prefabs.js').then((mod) => {
          const src = mod.prefabs || {};
          for (const key of Object.keys(src)) {
            if (!Object.prototype.hasOwnProperty.call(prefabs, key)) prefabs[key] = src[key];
          }
          return prefabs;
        });
      }
      return prefabsReady;
    }

    // ==================== BRICK TYPES ====================
    const types = {
      // Standard bricks
      '1x1': {w:1,d:1,h:'b'}, '1x2': {w:1,d:2,h:'b'}, '1x3': {w:1,d:3,h:'b'}, '1x4': {w:1,d:4,h:'b'},
      '1x6': {w:1,d:6,h:'b'}, '2x2': {w:2,d:2,h:'b'}, '2x3': {w:2,d:3,h:'b'}, '2x4': {w:2,d:4,h:'b'},
      '2x6': {w:2,d:6,h:'b'}, '2x8': {w:2,d:8,h:'b'}, '4x4': {w:4,d:4,h:'b'}, '4x6': {w:4,d:6,h:'b'},
      '4x8': {w:4,d:8,h:'b'},
      // Standard plates
      '1x1p': {w:1,d:1,h:'p'}, '1x2p': {w:1,d:2,h:'p'}, '1x3p': {w:1,d:3,h:'p'}, '1x4p': {w:1,d:4,h:'p'},
      '2x2p': {w:2,d:2,h:'p'}, '2x4p': {w:2,d:4,h:'p'}, '4x4p': {w:4,d:4,h:'p'}, '4x6p': {w:4,d:6,h:'p'},
      '6x6p': {w:6,d:6,h:'p'}, '8x8p': {w:8,d:8,h:'p'},
      // Tiles (smooth - no studs)
      '1x1t': {w:1,d:1,h:'p',noStuds:true}, '1x2t': {w:1,d:2,h:'p',noStuds:true}, '1x4t': {w:1,d:4,h:'p',noStuds:true},
      '2x2t': {w:2,d:2,h:'p',noStuds:true}, '2x4t': {w:2,d:4,h:'p',noStuds:true}, '4x4t': {w:4,d:4,h:'p',noStuds:true},
      '4x6t': {w:4,d:6,h:'p',noStuds:true},
      // Round bricks
      'r1x1': {w:1,d:1,h:'b',round:true}, 'r2x2': {w:2,d:2,h:'b',round:true},
      // Round plates
      'r1x1p': {w:1,d:1,h:'p',round:true}, 'r2x2p': {w:2,d:2,h:'p',round:true}, 'r4x4p': {w:4,d:4,h:'p',round:true},
      // Slopes
      'slope2': {w:2,d:2,h:'b',slope:true}, 'slope4': {w:2,d:4,h:'b',slope:true},
      'slope1x2': {w:1,d:2,h:'b',slope:true}, 'slope1x3': {w:1,d:3,h:'b',slope:true}, 'slope1x4': {w:1,d:4,h:'b',slope:true},
      // Corner slopes (for roof corners)
      'cslope2': {w:2,d:2,h:'b',cornerSlope:true}, 'cslope3': {w:3,d:3,h:'b',cornerSlope:true},
      'icslope2': {w:2,d:2,h:'b',invCornerSlope:true}, 'icslope3': {w:3,d:3,h:'b',invCornerSlope:true},
      // SNOT bricks (Studs Not On Top) - side studs for attaching tiles sideways
      'snot1x2': {w:1,d:2,h:'b',sideStuds:['front']},
      'snot2x2': {w:2,d:2,h:'b',sideStuds:['front']},
      'snot2x4': {w:2,d:4,h:'b',sideStuds:['front']},
      'snot2x4x4': {w:2,d:4,h:'b',sideStuds:['front','back']}, // Both sides
      // LIGHT BRICKS - emit light when placed
      'light1x1': {w:1,d:1,h:'b',light:true,lightIntensity:15,lightDistance:25},
      'light2x2': {w:2,d:2,h:'b',light:true,lightIntensity:25,lightDistance:40},
      'light1x1p': {w:1,d:1,h:'p',light:true,lightIntensity:10,lightDistance:20},
      'lamp1x1': {w:1,d:1,h:'b',light:true,lightIntensity:50,lightDistance:60,defaultColor:0xffdd44},
      'lamp2x2': {w:2,d:2,h:'b',light:true,lightIntensity:80,lightDistance:80,defaultColor:0xffdd44}
    };
    
    // Track lamp bricks for the capped PointLight pool (never one light per lamp).
    const lightSources = new Map(); // brickId -> { color, intensity, distance, position }
    const MAX_BRICK_LIGHTS = 4;
    const brickLightPool = [];
    
    // ==================== QUALITY PRESETS ====================
    // High / Balanced / Performance. Default Balanced. Persist in localStorage.
    // Do not reintroduce per-brick Mesh groups, 4096 shadows, or DPR 2 on phones.
    const QUALITY_PRESETS = {
      high: {
        dprDesktop: 1.5, dprMobile: 1,
        shadowDesktop: 1024, shadowMobile: 512,
        bloom: true, ssao: true, post: true
      },
      balanced: {
        dprDesktop: 1.5, dprMobile: 1,
        shadowDesktop: 512, shadowMobile: 512,
        // A one-mip bloom still missed the bar on this GPU (draws 26/29,
        // 520 FPS 59/60). Balanced stays vignette-only. High still blooms.
        bloom: false, ssao: false, post: true
      },
      performance: {
        dprDesktop: 1, dprMobile: 1,
        shadowDesktop: 512, shadowMobile: 512,
        bloom: false, ssao: false, post: false
      }
    };
    let qualityPreset = 'balanced';
    let qualitySettings = QUALITY_PRESETS.balanced;
    let instancedReady = false;
    let lastHudFps = 0;
    let lowFpsStreak = 0;
    let autoQualitySteps = 0;
    let demandFrames = 0;
    let renderedFrames = 0;
    let pointerDirty = false;
    const bootMs = performance.now();
    let lastPointerMs = 0;
    let lastWeatherTick = 0;
    let lastLightUpdate = 0;
    let pmremGenerator = null;
    const _noonWhite = new THREE.Color(0xffffff);
    
    await new Promise((resolve) => setTimeout(resolve, 0));

    function isMobileGfx() {
      const ua = navigator.userAgent || '';
      const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const small = Math.min(innerWidth, innerHeight) < 900;
      // A narrow window is the phone layout even when Chrome's responsive
      // mode leaves touch emulation off. That path used to load desktop post.
      return small || (touch && /Mobi|Android|iPhone|iPad/i.test(ua));
    }
    
    function loadQualityPreset() {
      let saved = null;
      try { saved = localStorage.getItem('brixQuality'); } catch (e) {}
      if (saved && QUALITY_PRESETS[saved]) qualityPreset = saved;
      else qualityPreset = isMobileGfx() ? 'performance' : 'balanced';
      qualitySettings = QUALITY_PRESETS[qualityPreset];
    }
    
    function qualityDpr() {
      if (isMobileGfx()) return 1;
      return Math.min(window.devicePixelRatio || 1, qualitySettings.dprDesktop);
    }
    
    function qualityShadowSize() {
      let size = isMobileGfx() ? qualitySettings.shadowMobile : qualitySettings.shadowDesktop;
      if (isMobileGfx()) size = Math.min(size, 256);
      const n = bricks ? bricks.length : 0;
      // Large builds drop the shadow map instead of pulling the camera back.
      if (n >= 400) size = Math.min(size, 256);
      else if (isMobileGfx() && n >= 160) size = Math.min(size, 256);
      else if (!isMobileGfx() && n >= 240) size = Math.min(size, 512);
      return size;
    }

    // Grow the shadow map across frames. A single jump to the full map
    // was a 10ms+ GPU task on the first shadowed draw.
    function shadowWarmSize(step) {
      const full = qualityShadowSize();
      let prev = 0;
      let seen = 0;
      for (const candidate of [16, 64, 128, 256, full]) {
        const size = Math.min(candidate, full);
        if (size <= prev) continue;
        prev = size;
        seen++;
        if (seen === step) return size;
      }
      return full;
    }

    function shadowWarmSteps() {
      const full = qualityShadowSize();
      let prev = 0;
      let seen = 0;
      for (const candidate of [16, 64, 128, 256, full]) {
        const size = Math.min(candidate, full);
        if (size <= prev) continue;
        prev = size;
        seen++;
      }
      return Math.max(seen, 1);
    }

    function applyShadowLod() {
      const sun = window.sunLight;
      if (!sun || !sun.shadow || !renderer) return;
      const size = qualityShadowSize();
      if (sun.shadow.mapSize.width === size) return;
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
      sun.shadow.needsUpdate = true;
      markShadowDirty();
      needsRender = true;
    }
    
    function useMsaa() {
      // One method: MSAA. SMAA is not used.
      return true;
    }
    
    function stepDownQuality() {
      if (autoQualitySteps >= 4) return;
      autoQualitySteps++;
      if (qualityPreset === 'high') {
        applyQuality('balanced', { silent: true });
        toast('Easing quality to hold 50 FPS');
        return;
      }
      if (qualityPreset === 'balanced') {
        applyQuality('performance', { silent: true });
        toast('Performance mode to hold 50 FPS');
        return;
      }
      const sun = window.sunLight;
      if (sun && sun.shadow && sun.shadow.mapSize.width > 512) {
        sun.shadow.mapSize.set(512, 512);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
        sun.shadow.needsUpdate = true;
        needsRender = true;
        toast('Smaller shadows to hold 50 FPS');
        return;
      }
      if (renderer && renderer.shadowMap.enabled) {
        renderer.shadowMap.enabled = false;
        needsRender = true;
        toast('Shadows off to hold 50 FPS');
      }
    }

    // Two seconds under 50 FPS while frames are actually being demanded.
    function considerAutoQuality(fps, demanded, rendered) {
      if (document.hidden || performance.now() - bootMs <= 4000) return;
      if (demanded < 30 || rendered < 15) {
        if (rendered >= 50) lowFpsStreak = 0;
        return;
      }
      if (fps > 0 && fps < 50 && rendered / demanded > 0.5) {
        lowFpsStreak++;
        if (lowFpsStreak >= 2) {
          lowFpsStreak = 0;
          stepDownQuality();
        }
      } else if (fps >= 50) {
        lowFpsStreak = 0;
      }
    }
    
    function applyQuality(name, opts = {}) {
      if (!QUALITY_PRESETS[name]) name = 'balanced';
      qualityPreset = name;
      qualitySettings = QUALITY_PRESETS[name];
      try { localStorage.setItem('brixQuality', name); } catch (e) {}
      
      document.querySelectorAll('[data-quality]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.quality === name);
      });
      
      if (!renderer) return;
      renderer.setPixelRatio(qualityDpr());
      const view = viewSize();
      renderer.setSize(view.w, view.h);
      
      const sun = window.sunLight;
      if (sun && sun.shadow) {
        const size = qualityShadowSize();
        if (sun.shadow.mapSize.width !== size) {
          sun.shadow.mapSize.set(size, size);
          if (sun.shadow.map) {
            sun.shadow.map.dispose();
            sun.shadow.map = null;
          }
        }
        sun.shadow.needsUpdate = true;
      }
      updateShadowFrustum();
      setupPostProcessing();
      refreshInstancedMaterials();
      needsRender = true;
      if (!opts.silent) toast(`Quality: ${name.charAt(0).toUpperCase() + name.slice(1)}`);
    }
    
    function initBrickLightPool() {
      for (let i = 0; i < MAX_BRICK_LIGHTS; i++) {
        const l = new THREE.PointLight(0xffdd44, 0, 0);
        l.castShadow = false;
        l.visible = false;
        scene.add(l);
        brickLightPool.push(l);
      }
    }
    
    function registerLampBrick(id, color, intensity, distance, position) {
      lightSources.set(id, { color, intensity, distance, position: position.clone() });
      updateBrickLights(true);
    }
    
    function unregisterLampBrick(id) {
      if (lightSources.delete(id)) updateBrickLights(true);
    }
    
    function updateBrickLights(force = false) {
      const now = performance.now();
      if (!force && now - lastLightUpdate < 120) return;
      lastLightUpdate = now;
      if (!camera || brickLightPool.length === 0) return;
      
      const items = [];
      lightSources.forEach((src, id) => {
        items.push({ id, src, dist: camera.position.distanceToSquared(src.position) });
      });
      items.sort((a, b) => a.dist - b.dist);
      
      for (let i = 0; i < MAX_BRICK_LIGHTS; i++) {
        const l = brickLightPool[i];
        const item = items[i];
        if (!item) {
          l.visible = false;
          l.intensity = 0;
          continue;
        }
        l.visible = true;
        l.color.setHex(item.src.color);
        l.intensity = Math.min(item.src.intensity * 0.35, 18);
        l.distance = item.src.distance;
        l.decay = 2;
        l.position.copy(item.src.position);
        l.position.y += 0.6;
      }
    }
    
    function markShadowDirty() {
      if (renderer && renderer.shadowMap) renderer.shadowMap.needsUpdate = true;
    }

    function updateShadowFrustum() {
      const sun = window.sunLight;
      if (!sun || !sun.shadow) return;
      const cam = sun.shadow.camera;
      const plate = 96 * STUD;
      let minX = 0, maxX = plate, minZ = 0, maxZ = plate, maxY = 12;
      if (bricks.length) {
        minX = Infinity; maxX = -Infinity; minZ = Infinity; maxZ = -Infinity; maxY = 4;
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i];
          const p = b.position;
          if (!p) continue;
          const g = b.userData && b.userData.grid;
          const hx = g ? (g.w * STUD) * 0.5 + 2 : 4;
          const hz = g ? (g.d * STUD) * 0.5 + 2 : 4;
          minX = Math.min(minX, p.x - hx);
          maxX = Math.max(maxX, p.x + hx);
          minZ = Math.min(minZ, p.z - hz);
          maxZ = Math.max(maxZ, p.z + hz);
          maxY = Math.max(maxY, p.y + (g ? g.hp * PLATE_H : 4) + 4);
        }
      }
      const cx = (minX + maxX) * 0.5;
      const cz = (minZ + maxZ) * 0.5;
      const extent = Math.max(maxX - minX, maxZ - minZ) * 0.5 + 8;
      cam.left = -extent;
      cam.right = extent;
      updateZoomLimits();
      cam.top = extent;
      cam.bottom = -extent;
      cam.near = 1;
      cam.far = Math.max(160, extent * 3 + maxY);
      cam.updateProjectionMatrix();
      sun.target.position.set(cx, 0, cz);
      markShadowDirty();
      sun.target.updateMatrixWorld();
    }
    
    // Function to create custom brick type
    function createCustomType(w, d, typeStr) {
      const maxSize = 16;
      const maxArea = 256; // 16x16
      
      // Clamp values
      w = Math.max(1, Math.min(maxSize, Math.floor(w)));
      d = Math.max(1, Math.min(maxSize, Math.floor(d)));
      
      // Check total area
      if (w * d > maxArea) {
        toast('⚠️ Max area is 256 studs', 'error');
        return null;
      }
      
      let suffix = '';
      let props = {w, d, h: 'b'};
      
      switch(typeStr) {
        case 'plate':
          suffix = 'p';
          props.h = 'p';
          break;
        case 'tile':
          suffix = 't';
          props.h = 'p';
          props.noStuds = true;
          break;
        case 'round':
          if (w !== d) {
            toast('⚠️ Round blocks must be square', 'error');
            return null;
          }
          suffix = 'r';
          props.round = true;
          break;
        default:
          // brick - no suffix needed
          break;
      }
      
      // Generate unique type name
      const typeName = typeStr === 'round' ? `r${w}x${d}` : `${w}x${d}${suffix}`;
      
      // Add to types if not exists
      if (!types[typeName]) {
        types[typeName] = props;
      }
      
      return typeName;
    }
    
    // ==================== INIT ====================
    function yieldTick() {
      return new Promise((resolve) => setTimeout(resolve, 0));
    }
    // getProgramInfoLog waits for the shader compiler and was a 16ms task,
    // which simulated past 50ms. Ask the driver if the program is done
    // without waiting. The real uniform query runs on a later turn.
    function installParallelShaderCompile() {
      const proto = typeof WebGL2RenderingContext !== 'undefined' ? WebGL2RenderingContext.prototype : null;
      if (!proto || proto.__brixParallel) return;
      proto.__brixParallel = true;
      const param = proto.getProgramParameter;
      const ACTIVE_UNIFORMS = 0x8B86;
      const ACTIVE_ATTRIBUTES = 0x8B89;
      function done(gl, program) {
        const ext = gl.__brixParallelExt || (gl.__brixParallelExt = gl.getExtension('KHR_parallel_shader_compile'));
        if (!ext) return true;
        return param.call(gl, program, ext.COMPLETION_STATUS_KHR) === true;
      }
      proto.getProgramParameter = function (program, pname) {
        if ((pname === ACTIVE_UNIFORMS || pname === ACTIVE_ATTRIBUTES) && program && !done(this, program)) {
          throw new Error('brix-shader-pending');
        }
        return param.call(this, program, pname);
      };
    }

    function viewSize() {
      const el = document.getElementById('container');
      const w = el ? el.clientWidth : 0;
      const h = el ? el.clientHeight : 0;
      if (w >= 64 && h >= 64) return { w, h };
      return { w: innerWidth, h: innerHeight };
    }
    function applyViewSize() {
      if (!renderer || !camera) return;
      const { w, h } = viewSize();
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(qualityDpr());
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
      if (ssaoPass) ssaoPass.setSize(w, h);
      needsRender = true;
    }

    async function init() {
      isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      loadQualityPreset();
      
      // AudioContext is created on the first gesture, inside SoundSystem.resume.
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87CEEB);
      // Horizon fog from the first frame. A far of 400 ended the ground
      // near x 1150 and left a hard sky edge before the theme loaded.
      scene.fog = new THREE.Fog(0x87CEEB, 480, 2200);
      
      // Far plane sits past the fog so the ground fade is not a hard clip.
      const opening = viewSize();
      camera = new THREE.PerspectiveCamera(60, opening.w / Math.max(1, opening.h), 0.1, 2800);
      // Scene and camera are their own turn. The WebGL constructor is the next one.
      await yieldTick();
      // Flush layout before the canvas exists. Doing it after the HUD and the
      // framebuffer were attached was a 17ms document layout.
      void document.body.offsetHeight;
      window.__brixLayoutFlushed = true;
      await yieldTick();

      const glCanvas = document.createElement('canvas');
      glCanvas.width = 1;
      glCanvas.height = 1;
      // Three asks the driver for alpha:true. Open that context on its own
      // turn, then build the renderer against the same context on the next
      // one, so neither turn is the whole constructor.
      const glAttrs = {
        alpha: true,
        depth: true,
        stencil: true,
        antialias: useMsaa(),
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      };
      installParallelShaderCompile();
      const gl = glCanvas.getContext('webgl2', glAttrs);
      await yieldTick();
      renderer = new THREE.WebGLRenderer({
        canvas: glCanvas,
        context: gl || undefined,
        antialias: useMsaa(),
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      });
      // The full framebuffer is the next turn.
      await yieldTick();
      renderer.setPixelRatio(qualityDpr());
      const plateView = viewSize();
      renderer.setSize(plateView.w, plateView.h);
      // Shadows stay off until the place stamp. The first setSize then
      // does not allocate the shadow map.
      renderer.shadowMap.enabled = false;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      // The sun frustum follows the bricks, not the view. Re-render the shadow
      // map when the build changes, and reuse it while the camera orbits.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      // Linear keeps a lit face on the swatch. AgX mixes blue into yellow and red, so they read olive and maroon.
      renderer.toneMapping = THREE.LinearToneMapping;
      renderer.toneMappingExposure = isMobileGfx() ? 2.6 : 2.4;
      renderer.info.autoReset = false;
      // The info-log read is the stall. Skip it. A program that is still
      // linking throws brix-shader-pending and is drawn on a later frame.
      renderer.debug.checkShaderErrors = false;
      const renderScene = renderer.render.bind(renderer);
      let renderStrict = false;
      renderer.render = function (targetScene, targetCamera) {
        try {
          return renderScene(targetScene, targetCamera);
        } catch (err) {
          if (!err || err.message !== 'brix-shader-pending') throw err;
          needsRender = true;
          // A gallery capture reads the pixels once. Swallowing the miss
          // there keeps the sky clear-color and saves a blank thumb.
          if (renderStrict) throw err;
        }
      };
      // The driver links in the background. Spin only while a capture is
      // waiting on that link. Boot renders keep the throw and try next frame.
      // budget is milliseconds. Callers that ignore it keep the 80ms cap.
      renderer.__brixRenderSettled = function (targetScene, targetCamera, budget) {
        const start = performance.now();
        const limit = budget == null ? 80 : budget;
        renderStrict = true;
        try {
          // The grade program is created on the first capture. Live frames
          // retry next paint; a thumb reads the pixels once, so wait here.
          for (;;) {
            try {
              renderer.render(targetScene, targetCamera);
              return true;
            } catch (err) {
              if (!err || err.message !== 'brix-shader-pending') throw err;
              if (performance.now() - start > limit) return false;
              const t0 = performance.now();
              while (performance.now() - t0 < 2) {}
            }
          }
        } finally {
          renderStrict = false;
        }
      };
      document.getElementById('container').appendChild(renderer.domElement);
      renderer.setClearColor(0x87CEEB, 1);
      renderer.clear(true, true, true);
      performance.mark('brix-renderer');
      await yieldTick();

      // PMREM is a long main-thread task and the plate does not use it.
      // Build it on a later turn, after the first brick can be placed.
      envMap = null;
      scene.environment = null;
      scheduleEnvMap();
      
      controls = new OrbitControls(camera, renderer.domElement);
      controls.addEventListener('change', () => { needsRender = true; });
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.rotateSpeed = 1.05;
      // Wheel zoom is handled ourselves so one notch cannot multiply
      // distance down to the near clip. Pinch still uses this speed.
      controls.zoomSpeed = 0.4;
      controls.minPolarAngle = 0.1; // Prevent looking straight down
      controls.maxPolarAngle = Math.PI / 2.1; // Prevent going below horizon
      controls.minDistance = 6;
      controls.maxDistance = 300;
      frameHomeCamera();
      // The welcome card stays hidden until this pose exists. Showing it
      // earlier lets a key test sample a null camera and call that motion.
      window.__brixViewReady = true;
      performance.mark('brix-controls');
      
      // Limit vertical panning to prevent going below ground
      controls.maxTargetRadius = Infinity; // Allow panning anywhere horizontally
      controls.addEventListener('change', () => {
        // Clamp target Y to stay at or above ground
        if (controls.target.y < 0) {
          controls.target.y = 0;
        }
        // Clamp camera Y to stay above ground
        if (camera.position.y < 0.5) {
          camera.position.y = 0.5;
        }
      });
      
      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();

      // Large invisible ground plane for raycasting (infinite building)
      const groundGeo = new THREE.PlaneGeometry(2000, 2000);
      const groundMat = new THREE.MeshBasicMaterial({visible: false});
      groundPlane = new THREE.Mesh(groundGeo, groundMat);
      groundPlane.rotation.x = -Math.PI / 2;
      groundPlane.position.y = BASE_Y;
      scene.add(groundPlane);
      await yieldTick();
      performance.mark('brix-before-ground');
      createInfiniteGround();
      performance.mark('brix-ground');
      await yieldTick();
      // The event binder is one compile. Keep it off the ground task so
      // Lantern does not park that compile on the Speed Index.
      await setupEvents();
      performance.mark('brix-events');
      // Raycasts and the plate are live. Lights, shadows, and the graded
      // exposure run on the following turns so they are not part of time-to-place.
      window.brixCanPlace = true;
      window.brixPlaceableAt = performance.now();
      setTimeout(() => { if (buildEnvMapNow) buildEnvMapNow(); }, 0);
      await yieldTick();

      // Lights: 1 directional sun + hemi + ambient. No extra cheap lights.
      const ambient = new THREE.AmbientLight(0xffffff, 0.8);
      ambient.name = 'ambient';
      scene.add(ambient);
      
      const shadowSize = qualityShadowSize();
      const sun = new THREE.DirectionalLight(0xffffff, 1.0);
      sun.name = 'sun';
      sun.position.set(50, 80, 60);
      sun.castShadow = true;
      sun.shadow.mapSize.width = shadowSize;
      sun.shadow.mapSize.height = shadowSize;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 200;
      sun.shadow.camera.left = -48;
      sun.shadow.camera.right = 48;
      sun.shadow.camera.top = 48;
      sun.shadow.camera.bottom = -48;
      sun.shadow.bias = -0.0008;
      sun.shadow.normalBias = 0.04;
      scene.add(sun);
      
      window.sunLight = sun;
      scene.add(sun.target);
      
      const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.85);
      hemi.name = 'hemi';
      scene.add(hemi);
      renderer.shadowMap.enabled = true;
      await yieldTick();
      
      initBrickLightPool();
      setupPostProcessing();
      applyQuality(qualityPreset, { silent: true });
      installRevealHook();
      updateTimeOfDay();
      const brickWarm = await presentPlateFirst();
      // The first 2×2 used to compile on the click, so the next two frames
      // still showed an empty plate. Link that program here, a few pixels
      // at a time, then hide the stand-in. This stays in init: a helper in
      // another part cannot see the strict-render flag.
      const warmMesh = brickWarm && brickWarm.mesh;
      if (warmMesh && renderer && typeof renderer.__brixRenderSettled === 'function') {
        const parked = [];
        scene.traverse((obj) => {
          if (obj.isMesh && obj !== warmMesh && obj.visible) {
            parked.push(obj);
            obj.visible = false;
          }
        });
        warmMesh.visible = true;
        const settleStart = performance.now();
        const settleBuf = new THREE.Vector2();
        let brickLinked = false;
        try {
          while (!brickLinked && performance.now() - settleStart < 900) {
            renderer.getDrawingBufferSize(settleBuf);
            renderer.setScissorTest(true);
            renderer.setViewport(0, 0, 2, 2);
            renderer.setScissor(0, 0, 2, 2);
            try {
              brickLinked = renderer.__brixRenderSettled(scene, camera, 4) === true;
            } finally {
              renderer.setScissorTest(false);
              renderer.setViewport(0, 0, settleBuf.x || 2, settleBuf.y || 2);
            }
            if (!brickLinked) await yieldTick();
          }
        } finally {
          warmMesh.count = 0;
          warmMesh.visible = false;
          for (let i = 0; i < parked.length; i++) parked[i].visible = true;
        }
      }
      // The plate is already on screen. The rest of boot used to share one
      // turn with the first full render and tripped the long-task line.
      await yieldTick();

      // The tip has to be on screen before the loader hides. A player who
      // skips the tutorial dismisses it in that same moment; showing it
      // later leaves the pill on the plate, and its edge reads as ground.
      initDailyPrompt();
      const boot = document.getElementById('loadingScreen');
      // visibility:hidden is enough. A follow-up display:none was its own
      // timer after the module graph, so Lantern kept that layout and the
      // Speed Index landed on it.
      if (boot) boot.classList.add('hide');
      // The hint is in the first HTML so it paints with the splash. Drop the
      // splash-only box now; the stylesheet already has the real toast size.
      document.body.classList.add('brix-live');
      const hinted = document.getElementById('toast');
      // The splash hint is green so the first paint has a text box. A green
      // bar left across the sky is a hard edge, so the playing hint is the
      // dark toast and only when the phone card is not already explaining it.
      // The stylesheet fades opacity over 0.25s. Hiding the node in the
      // middle of that fade left the white splash text on the plate.
      if (hinted) {
        hinted.style.transition = 'none';
        hinted.classList.remove('brix-early', 'show', 'success');
        hinted.textContent = '';
        void hinted.offsetHeight;
        hinted.style.transition = '';
      }
      await yieldTick();
      const openingShare = !!shareTokenFromLocation();
      const phoneHold = phoneTutorialPending();
      if (phoneHold) {
        const bar = document.getElementById('starterBar');
        if (bar) bar.classList.add('hidden');
        document.querySelectorAll('.drawer-starters').forEach((el) => el.classList.add('hidden'));
        const daily = document.getElementById('dailyPrompt');
        if (daily) daily.hidden = true;
      }
      await yieldTick();
      // Each of these used to share a turn. Together they were a layout task
      // long enough to survive Lantern's prune, scheduled after every module.
      if (!phoneHold && !openingShare && !bricks.length) {
        if (window.innerWidth <= 768) {
          toast('Tap a starter, or tap the plate. The ghost is your 2×2.', '', true);
        } else if (!dailyTipWillShow()) {
          toast('Plate is ready. Tap a starter or place your first brick.', '', true);
        }
      }
      await yieldTick();
      tryLoadShareFromLocation();
      await yieldTick();
      if (bricks.length || openingShare) hideStarterBar();
      await yieldTick();

      updateUI();
      await yieldTick();
      shadersWarmed = true;
      // The proxy plate is already on screen. Skip the draw in this turn so
      // the first full scene render is its own frame.
      needsRender = false;
      animate();
      needsRender = true;
      // Scenery starts after the shadow ladder. Tree meshes in those first
      // shadowed draws were a 15ms frame, which simulated over 50ms.
      setTimeout(() => { ensurePrefabs(); }, 1500);
    }

    let revealQueue = [];
    let revealActive = false;
    let revealAdd = null;
    let casterWarm = null;
    const revealSeen = new Set();
    function considerReveal(obj) {
      if (!revealActive || !obj || !obj.traverse) return;
      obj.traverse((child) => {
        if (!child || revealSeen.has(child.uuid)) return;
        if (child === window.baseplateRef || child === groundPlane) return;
        if (!(child.isMesh || child.isLine || child.isInstancedMesh || child.isPoints)) return;
        revealSeen.add(child.uuid);
        if (!child.visible) return;
        child.visible = false;
        revealQueue.push(child);
        presentPending = true;
        needsRender = true;
      });
    }
    function installRevealHook() {
      if (revealAdd || !scene) return;
      revealActive = true;
      revealAdd = scene.add.bind(scene);
      scene.add = function (...objs) {
        const ret = revealAdd(...objs);
        for (let i = 0; i < objs.length; i++) considerReveal(objs[i]);
        return ret;
      };
      const existing = [];
      scene.traverse((child) => existing.push(child));
      for (let i = 0; i < existing.length; i++) considerReveal(existing[i]);
    }
    async function presentPlateFirst() {
      if (!renderer || !window.baseplateRef || !camera) {
        shadersWarmed = true;
        needsRender = true;
        return;
      }
      const shadows = renderer.shadowMap.enabled;
      renderer.shadowMap.enabled = false;
      await yieldTick();
      renderer.setRenderTarget(null);
      renderer.clear(true, true, true);
      await yieldTick();
      const holder = new THREE.Scene();
      const proxy = new THREE.Mesh(window.baseplateRef.geometry, window.baseplateRef.material);
      proxy.frustumCulled = false;
      proxy.position.copy(window.baseplateRef.position);
      proxy.quaternion.copy(window.baseplateRef.quaternion);
      proxy.scale.copy(window.baseplateRef.scale);
      holder.add(proxy);
      try {
        if (typeof renderer.compile === 'function') renderer.compile(holder, camera);
      } catch (err) {
        console.error(err);
      }
      await yieldTick();
      // Warm the plate program on a few pixels before the full draw. The
      // full draw was one 13–18ms timer, which simulated over 50ms.
      renderer.setScissorTest(true);
      renderer.setViewport(0, 0, 2, 2);
      renderer.setScissor(0, 0, 2, 2);
      renderer.render(holder, camera);
      renderer.setScissorTest(false);
      const warmBuf = new THREE.Vector2();
      renderer.getDrawingBufferSize(warmBuf);
      renderer.setViewport(0, 0, warmBuf.x, warmBuf.y);
      await yieldTick();
      // One full-canvas draw of the plate was a 38ms GPU stall. Bands keep
      // each present under the simulated 50ms line.
      renderer.setScissorTest(true);
      const plateBands = 8;
      for (let band = 0; band < plateBands; band++) {
        const y0 = Math.floor(warmBuf.y * band / plateBands);
        const y1 = Math.floor(warmBuf.y * (band + 1) / plateBands);
        const bh = Math.max(1, y1 - y0);
        renderer.setViewport(0, y0, warmBuf.x, bh);
        renderer.setScissor(0, y0, warmBuf.x, bh);
        renderer.render(holder, camera);
        if (band + 1 < plateBands) await yieldTick();
      }
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, warmBuf.x, warmBuf.y);
      window.brixPlateShown = window.baseplateRef.visible !== false;
      // The proxy scene has no lights, so its program is not the one the
      // real plate uses. Finish the lit screen program on a few pixels.
      // The first full stud reveal was a 15ms draw; the same draw on the
      // next frame was about 6ms, so the extra cost is the first pixel.
      const drawBuf = new THREE.Vector2();
      renderer.getDrawingBufferSize(drawBuf);
      // One render of every lit mesh compiled every program in the same
      // turn, and that turn simulated past 50ms. One mesh per turn stays
      // under the line. The 2px scissor keeps the plate picture in place.
      // The first placed 2×2 used to compile its program on the click, so the
      // next two frames still showed an empty plate. Link it here, on the
      // same one-mesh-per-turn ladder as the rest of the boot.
      let brickWarm = null;
      try { brickWarm = getInstancedMesh('2x2', 0, 0xff2200, false, {}, STUD_SEG_FAR); } catch (err) { /* geometry not ready */ }
      if (brickWarm && brickWarm.mesh) {
        const qi = revealQueue.indexOf(brickWarm.mesh);
        if (qi >= 0) revealQueue.splice(qi, 1);
        brickWarm.mesh.visible = true;
        const warmDummy = new THREE.Object3D();
        warmDummy.position.set(0, -8, 0);
        warmDummy.updateMatrix();
        brickWarm.mesh.setMatrixAt(0, warmDummy.matrix);
        brickWarm.mesh.instanceMatrix.needsUpdate = true;
        // The placed brick sets an instance color, which is a different program
        // than a colorless batch. Compile the one the click will draw.
        brickWarm.mesh.setColorAt(0, new THREE.Color(0xff2200));
        if (brickWarm.mesh.instanceColor) brickWarm.mesh.instanceColor.needsUpdate = true;
        brickWarm.mesh.count = 1;
      }
      const warmMeshes = async () => {
        const meshes = [];
        scene.traverse((obj) => {
          if (obj.isMesh && obj.visible) meshes.push(obj);
        });
        for (let i = 0; i < meshes.length; i++) meshes[i].visible = false;
        for (let i = 0; i < meshes.length; i++) {
          meshes[i].visible = true;
          renderer.setRenderTarget(null);
          renderer.setScissorTest(true);
          renderer.setViewport(0, 0, 2, 2);
          renderer.setScissor(0, 0, 2, 2);
          renderer.render(scene, camera);
          renderer.setScissorTest(false);
          renderer.setViewport(0, 0, drawBuf.x, drawBuf.y);
          meshes[i].visible = false;
          await yieldTick();
        }
        for (let i = 0; i < meshes.length; i++) meshes[i].visible = true;
      };
      await warmMeshes();
      const stud = window.groundStudsRef;
      const studWas = stud ? stud.visible : false;
      if (stud) stud.visible = true;
      await warmMeshes();
      if (stud) stud.visible = studWas;
      // The first shadowed draw is a GPU stall on the main thread. Compile
      // that program into a 16px map on a few screen pixels first.
      const sun = window.sunLight;
      if (sun && sun.shadow) {
        sun.shadow.mapSize.set(16, 16);
        if (sun.shadow.map) {
          sun.shadow.map.dispose();
          sun.shadow.map = null;
        }
        sun.shadow.needsUpdate = true;
      }
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.needsUpdate = true;
      if (stud) stud.visible = true;
      await warmMeshes();
      if (stud) stud.visible = studWas;
      renderer.shadowMap.enabled = false;
      await yieldTick();
      renderer.shadowMap.enabled = shadows;
      await yieldTick();
      return brickWarm;
    }
    
    // ==================== POST-PROCESSING ====================
    function loadPostMods() {
      if (!postModsPromise) {
        // Literal import so esbuild shares the one three.js chunk with this module.
        postModsPromise = import('./post.js').then((mod) => {
          postMods = {
            EffectComposer: mod.EffectComposer,
            RenderPass: mod.RenderPass,
            UnrealBloomPass: mod.UnrealBloomPass,
            ShaderPass: mod.ShaderPass,
            SSAOPass: mod.SSAOPass
          };
          return postMods;
        });
      }
      return postModsPromise;
    }

    function setupPostProcessing() {
      if (composer) {
        try { composer.dispose(); } catch (e) {}
        composer = null;
      }
      ssaoPass = null;
      bloomPass = null;
      vignettePass = null;
      gradeScreenPass = null;
      window.__brixPostOn = false;

      if (!qualitySettings.post || isMobileGfx()) return;

      const generation = ++postGen;
      loadPostMods().then(() => {
        if (generation !== postGen) return;
        if (!qualitySettings.post || isMobileGfx() || !renderer || !postMods) return;
        buildComposer();
      }).catch(() => {});
    }

    function buildComposer() {
      const { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, SSAOPass, OutputPass } = postMods;
      const size = new THREE.Vector2();
      renderer.getSize(size);
      const pr = renderer.getPixelRatio();
      let rt = null;
      try {
        rt = new THREE.WebGLRenderTarget(
          Math.max(1, Math.floor(size.width * pr)),
          Math.max(1, Math.floor(size.height * pr)),
          { type: THREE.HalfFloatType, samples: 4 }
        );
      } catch (e) {
        rt = null;
      }
      composer = rt ? new EffectComposer(renderer, rt) : new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));

      if (qualitySettings.ssao && SSAOPass && !isMobileGfx()) {
        const ssaoView = viewSize();
        ssaoPass = new SSAOPass(scene, camera, ssaoView.w, ssaoView.h, 16);
        ssaoPass.kernelRadius = 8;
        ssaoPass.minDistance = 0.005;
        ssaoPass.maxDistance = 0.12;
        composer.addPass(ssaoPass);
      }

      if (qualitySettings.bloom && !isMobileGfx()) {
        bloomPass = new UnrealBloomPass(
          new THREE.Vector2(innerWidth * 0.5, innerHeight * 0.5),
          0.22,
          0.35,
          0.88
        );
        // High keeps five mips. Balanced uses one so the extra draws stay near five.
        if (qualityPreset !== 'high') bloomPass.nMips = 1;
        composer.addPass(bloomPass);
      }

      const vignetteShader = {
        uniforms: {
          'tDiffuse': { value: null },
          'darkness': { value: 0.06 },
          'offset': { value: 1.15 },
          'saturation': { value: 1 }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float darkness;
          uniform float offset;
          uniform float saturation;
          varying vec2 vUv;

          void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
            float vign = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
            texel.rgb *= mix(1.0 - darkness, 1.0, vign);
            float gray = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
            texel.rgb = mix(vec3(gray), texel.rgb, saturation);
            // Stay linear. OutputPass applies the same AgX grade as the phone renderer.
            gl_FragColor = texel;
          }
        `
      };
      vignettePass = new ShaderPass(vignetteShader);
      composer.addPass(vignettePass);
      if (OutputPass) composer.addPass(new OutputPass());
      gradeScreenPass = null;
      const postView = viewSize();
      composer.setSize(postView.w, postView.h);
      window.__brixPostOn = true;
      needsRender = true;
    }

        // ==================== ENVIRONMENT MAP ====================
    function renderEnvCube() {
      // The cube render and the PMREM blur run on separate turns.
      // Create a gradient sky scene for the env map
      const envScene = new THREE.Scene();
      const envCamera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
      
      // Sky gradient sphere
      const skyGeo = new THREE.SphereGeometry(50, 32, 32);
      const skyMat = new THREE.ShaderMaterial({
        uniforms: {
          topColor: { value: new THREE.Color(0x0077ff) },
          bottomColor: { value: new THREE.Color(0xffffff) },
          offset: { value: 10 },
          exponent: { value: 0.6 }
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform float offset;
          uniform float exponent;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition + offset).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
          }
        `,
        side: THREE.BackSide
      });
      const sky = new THREE.Mesh(skyGeo, skyMat);
      envScene.add(sky);
      
      // Render to cube texture
      const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
      const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
      cubeCamera.update(renderer, envScene);
      return cubeRenderTarget;
    }

    let buildEnvMapNow = () => false;
    function scheduleEnvMap() {
      let started = false;
      buildEnvMapNow = () => {
        if (started || !renderer) return started;
        started = true;
        performance.mark('brix-env-start');
        if (isMobileGfx()) {
          scene.environment = null;
          performance.mark('brix-env');
          return true;
        }
        if (!pmremGenerator) {
          pmremGenerator = new THREE.PMREMGenerator(renderer);
          pmremGenerator.compileEquirectangularShader();
        }
        const cube = renderEnvCube();
        setTimeout(() => {
          if (!cube) return;
          envMap = pmremGenerator.fromCubemap(cube.texture).texture;
          cube.dispose();
          scene.environment = envMap;
          performance.mark('brix-env');
          needsRender = true;
        }, 0);
        return true;
      };
      // The caller starts the build after the first brick can be placed.
    }
    
    // ==================== TIME OF DAY SYSTEM ====================
    // Cached colors for updateTimeOfDay (avoid creating new objects every frame)
    const _todCache = {
      skyColor: new THREE.Color(),
      fogColor: new THREE.Color(),
      sunColor: new THREE.Color(),
      nightSky: new THREE.Color(0x0a1628),
      nightSky2: new THREE.Color(0x1a3050),
      sunsetOrange: new THREE.Color(0xff8855),
      daySky: new THREE.Color(0x87CEEB),
      sunsetSun: new THREE.Color(0xff7744),
      whiteSun: new THREE.Color(0xffffee),
      noonSky: new THREE.Color(0x6bb3e0),
      moonColor: new THREE.Color(0x6688cc),
      lastTimeOfDay: -1,
      frameCounter: 0
    };
    
    function updateTimeOfDay() {
      // Called when the time slider/preset changes — not every frame.
      const staticThemes = ['night', 'sunset', 'winter'];
      if (staticThemes.includes(currentBackgroundTheme)) {
        return;
      }
      _todCache.lastTimeOfDay = timeOfDay;
      
      // timeOfDay: 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset
      const sun = scene.getObjectByName('sun');
      const ambient = scene.getObjectByName('ambient');
      const hemi = scene.getObjectByName('hemi');
      
      if (!sun) return;
      
      // Calculate sun angle (0 = horizon at sunrise, 0.5 = zenith, 1 = horizon at sunset)
      const sunAngle = Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2);
      const sunHeight = Math.max(sunAngle, -0.3); // Allow slight below horizon for dusk/dawn
      
      // Sun position (arc across the sky)
      const sunRadius = 100;
      // Noon sun shares the home camera's horizontal direction, so the face
      // you see is the lit face. The old noon sun sat on the opposite side.
      const camAz = Math.atan2(HOME_OZ, HOME_OX);
      const sunAng = (timeOfDay - 0.5) * Math.PI * 2 + camAz;
      const sunX = Math.cos(sunAng) * sunRadius;
      const sunY = sunHeight * 80 + 10;
      const sunZ = Math.sin(sunAng) * sunRadius;
      
      // Update sun position relative to camera target
      const target = controls ? controls.target : new THREE.Vector3(0, 0, 0);
      sun.position.set(target.x + sunX, sunY, target.z + sunZ);
      sun.target.position.copy(target);
      
      // Calculate colors based on time (using cached colors)
      let sunIntensity, ambientIntensity;
      
      if (timeOfDay < 0.2 || timeOfDay > 0.8) {
        // Night - slightly brighter
        const nightFactor = timeOfDay < 0.2 ? 1 - timeOfDay / 0.2 : (timeOfDay - 0.8) / 0.2;
        _todCache.skyColor.copy(_todCache.nightSky).lerp(_todCache.nightSky2, 1 - nightFactor);
        _todCache.fogColor.copy(_todCache.skyColor);
        _todCache.sunColor.copy(_todCache.moonColor);
        sunIntensity = 0.3;
        ambientIntensity = 0.25;
        renderer.toneMappingExposure = isMobileGfx() ? 0.78 : 0.9;
      } else if (timeOfDay < 0.3 || timeOfDay > 0.7) {
        // Sunrise/Sunset - brighter
        const isRise = timeOfDay < 0.3;
        const t = isRise ? (timeOfDay - 0.2) / 0.1 : (0.8 - timeOfDay) / 0.1;
        _todCache.skyColor.copy(_todCache.nightSky2).lerp(_todCache.sunsetOrange, t);
        _todCache.skyColor.lerp(_todCache.daySky, Math.max(0, t - 0.5) * 2);
        _todCache.fogColor.copy(_todCache.skyColor);
        _todCache.sunColor.copy(_todCache.sunsetSun).lerp(_todCache.whiteSun, t);
        sunIntensity = 1.05 + t * 0.75;
        ambientIntensity = 0.55 + t * 0.28;
        renderer.toneMappingExposure = isMobileGfx() ? (0.88 + t * 0.12) : (1.1 + t * 0.12);
      } else {
        // Daytime. Linear exposure is set so a lit albedo lands on the swatch.
        const noonFactor = 1 - Math.abs(timeOfDay - 0.5) * 4; // Peak at noon
        _todCache.skyColor.copy(_todCache.daySky).lerp(_todCache.noonSky, noonFactor);
        _todCache.fogColor.copy(_todCache.skyColor);
        _todCache.sunColor.copy(_todCache.whiteSun).lerp(_noonWhite, noonFactor);
        // Lower key than the old 1.7 sun. The visible face is lit now, and a
        // hotter sun clips that face off the swatch.
        // Sun comes down a little so the extra neutral fill does not clip the lit face.
        sunIntensity = 0.94 + noonFactor * 0.08;
        ambientIntensity = 0.74 + noonFactor * 0.08;
        renderer.toneMappingExposure = isMobileGfx() ? 1.75 : 1.6;
      }
      if (isMobileGfx()) {
        sunIntensity *= 0.92;
        ambientIntensity *= 0.9;
      }
      
      // Apply colors
      scene.background = _todCache.skyColor;
      scene.fog.color.copy(_todCache.fogColor);
      sun.color.copy(_todCache.sunColor);
      sun.intensity = sunIntensity;
      if (ambient) {
        // Theme setup used to leave this sky blue, which mixes into yellow and red.
        ambient.color.setHex(0xffffff);
        ambient.intensity = ambientIntensity;
      }
      if (hemi) {
        // Sky blue and grass green in the fill light shift yellow toward olive and red toward maroon.
        // The background stays blue. The brick light stays neutral so the swatch color survives.
        const night = timeOfDay < 0.2 || timeOfDay > 0.8;
        // Day fill is white on both poles. A warm sky/ground mix turned shaded
        // yellow mustard and left blue and green dark.
        hemi.color.setHex(night ? 0xb7c4d6 : 0xffffff);
        hemi.groundColor.setHex(night ? 0x3a3a40 : 0xffffff);
        hemi.intensity = night
          ? (isMobileGfx() ? 0.28 : 0.32)
          : (isMobileGfx() ? 0.78 : 0.9);
      }
      
      // Bloom stays at the composer default. Night used to jump to 0.5.
      if (bloomPass) {
        bloomPass.strength = 0.22;
      }
      
      // Update time display
      const hours = Math.floor(timeOfDay * 24);
      const mins = Math.floor((timeOfDay * 24 - hours) * 60);
      const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      const timeLabel = document.getElementById('timeLabel');
      if (timeLabel) timeLabel.textContent = timeStr;
      updateShadowFrustum();
      needsRender = true;
    }
    
    // ==================== WEATHER SYSTEM ====================
    function createWeatherSystems() {
      // Rain particles - More dense and realistic
      const rainGeo = new THREE.BufferGeometry();
      const rainCount = 15000;
      const rainPositions = new Float32Array(rainCount * 3);
      const rainVelocities = new Float32Array(rainCount);
      const rainSizes = new Float32Array(rainCount);
      
      for (let i = 0; i < rainCount; i++) {
        rainPositions[i * 3] = (Math.random() - 0.5) * 250;
        rainPositions[i * 3 + 1] = Math.random() * 120;
        rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 250;
        rainVelocities[i] = 0.8 + Math.random() * 0.4;
        rainSizes[i] = 0.1 + Math.random() * 0.15;
      }
      
      rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
      rainGeo.setAttribute('velocity', new THREE.BufferAttribute(rainVelocities, 1));
      
      const rainMat = new THREE.PointsMaterial({
        color: 0x8899bb,
        size: 0.2,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      
      rainParticles = new THREE.Points(rainGeo, rainMat);
      rainParticles.visible = false;
      scene.add(rainParticles);
      
      // Rain splash particles on ground
      const splashGeo = new THREE.BufferGeometry();
      const splashCount = 400;
      const splashPositions = new Float32Array(splashCount * 3);
      const splashLifetimes = new Float32Array(splashCount);
      
      for (let i = 0; i < splashCount; i++) {
        splashPositions[i * 3] = (Math.random() - 0.5) * 100;
        splashPositions[i * 3 + 1] = 0.1;
        splashPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
        splashLifetimes[i] = Math.random();
      }
      
      splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
      splashGeo.setAttribute('lifetime', new THREE.BufferAttribute(splashLifetimes, 1));
      
      const splashMat = new THREE.PointsMaterial({
        color: 0xaaccee,
        size: 0.4,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      
      window.rainSplashes = new THREE.Points(splashGeo, splashMat);
      window.rainSplashes.visible = false;
      scene.add(window.rainSplashes);
      
      // Snow particles - Much more dense and varied sizes
      const snowGeo = new THREE.BufferGeometry();
      const snowCount = 12000;
      const snowPositions = new Float32Array(snowCount * 3);
      const snowVelocities = new Float32Array(snowCount * 3);
      const snowSizes = new Float32Array(snowCount);
      const snowPhases = new Float32Array(snowCount);
      
      for (let i = 0; i < snowCount; i++) {
        snowPositions[i * 3] = (Math.random() - 0.5) * 250;
        snowPositions[i * 3 + 1] = Math.random() * 100;
        snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 250;
        snowVelocities[i * 3] = (Math.random() - 0.5) * 0.03;
        snowVelocities[i * 3 + 1] = 0.03 + Math.random() * 0.08;
        snowVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
        snowSizes[i] = 0.2 + Math.random() * 0.4;
        snowPhases[i] = Math.random() * Math.PI * 2;
      }
      
      snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
      snowGeo.setAttribute('velocity', new THREE.BufferAttribute(snowVelocities, 3));
      snowGeo.setAttribute('size', new THREE.BufferAttribute(snowSizes, 1));
      snowGeo.setAttribute('phase', new THREE.BufferAttribute(snowPhases, 1));
      
      const snowMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.35,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true
      });
      
      snowParticles = new THREE.Points(snowGeo, snowMat);
      snowParticles.visible = false;
      scene.add(snowParticles);
      
      // Snow accumulation on ground - white plane that fades in
      const snowGroundGeo = new THREE.PlaneGeometry(400, 400);
      const snowGroundMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeff,
        roughness: 0.8,
        metalness: 0.0,
        transparent: true,
        opacity: 0,
        envMap: envMap,
        envMapIntensity: 0.2
      });
      
      window.snowGround = new THREE.Mesh(snowGroundGeo, snowGroundMat);
      window.snowGround.rotation.x = -Math.PI / 2;
      window.snowGround.position.y = 0.02;
      window.snowGround.receiveShadow = true;
      window.snowGround.visible = false;
      scene.add(window.snowGround);
      
      // Snow accumulation state
      window.snowAccumulation = 0;
    }
    
    function updateWeather(delta) {
      // Early exit if no weather active
      const hasRain = rainParticles && rainParticles.visible;
      const hasSnow = snowParticles && snowParticles.visible;
      if (!hasRain && !hasSnow) return;
      
      const camTarget = controls ? controls.target : new THREE.Vector3(0, 0, 0);
      const time = Date.now() * 0.001;
      
      // Update rain
      if (hasRain) {
        const positions = rainParticles.geometry.attributes.position.array;
        const velocities = rainParticles.geometry.attributes.velocity.array;
        const count = positions.length / 3;
        const windDrift = Math.sin(time * 0.5) * 0.015;
        const delta80 = delta * 80;
        
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          // Add slight wind drift
          positions[i3] += windDrift;
          positions[i3 + 1] -= velocities[i] * delta80;
          positions[i3 + 2] += 0.03; // Wind direction
          
          // Reset particle if below ground
          if (positions[i3 + 1] < 0) {
            positions[i3] = camTarget.x + (Math.random() - 0.5) * 200;
            positions[i3 + 1] = 100 + Math.random() * 20;
            positions[i3 + 2] = camTarget.z + (Math.random() - 0.5) * 200;
          }
        }
        rainParticles.geometry.attributes.position.needsUpdate = true;
        
        // Update splashes
        if (window.rainSplashes && window.rainSplashes.visible) {
          const splashPos = window.rainSplashes.geometry.attributes.position.array;
          const lifetimes = window.rainSplashes.geometry.attributes.lifetime.array;
          
          for (let i = 0; i < lifetimes.length; i++) {
            lifetimes[i] -= delta * 3;
            if (lifetimes[i] <= 0) {
              splashPos[i * 3] = camTarget.x + (Math.random() - 0.5) * 80;
              splashPos[i * 3 + 1] = 0.1;
              splashPos[i * 3 + 2] = camTarget.z + (Math.random() - 0.5) * 80;
              lifetimes[i] = 0.3 + Math.random() * 0.4;
            }
          }
          window.rainSplashes.geometry.attributes.position.needsUpdate = true;
          window.rainSplashes.geometry.attributes.lifetime.needsUpdate = true;
        }
      }
      
      // Update snow
      if (hasSnow) {
        const positions = snowParticles.geometry.attributes.position.array;
        const velocities = snowParticles.geometry.attributes.velocity.array;
        const phases = snowParticles.geometry.attributes.phase.array;
        const count = positions.length / 3;
        const time05 = time * 0.5;
        const time03 = time * 0.3;
        const delta25 = delta * 25;
        
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const phase = phases[i];
          // Swirling motion
          const swirl = Math.sin(time05 + phase) * 0.04;
          const drift = Math.cos(time03 + phase * 2) * 0.03;
          
          positions[i3] += swirl + velocities[i3];
          positions[i3 + 1] -= velocities[i3 + 1] * delta25;
          positions[i3 + 2] += drift + velocities[i3 + 2];
          
          // Reset particle if below ground - contributes to accumulation
          if (positions[i3 + 1] < 0) {
            positions[i3] = camTarget.x + (Math.random() - 0.5) * 200;
            positions[i3 + 1] = 80 + Math.random() * 20;
            positions[i3 + 2] = camTarget.z + (Math.random() - 0.5) * 200;
            
            // Slowly accumulate snow
            window.snowAccumulation = Math.min(0.8, window.snowAccumulation + 0.00003);
          }
        }
        snowParticles.geometry.attributes.position.needsUpdate = true;
        
        // Update snow ground accumulation (fade in white ground)
        if (window.snowGround && window.snowGround.visible) {
          // Smoothly approach target accumulation
          const currentOpacity = window.snowGround.material.opacity;
          const targetOpacity = window.snowAccumulation;
          window.snowGround.material.opacity += (targetOpacity - currentOpacity) * delta * 0.5;
        }
      }
    }
    
    function ensureLinearFog(hex, near, far) {
      if (!scene.fog || !scene.fog.isFog) scene.fog = new THREE.Fog(hex, near, far);
      scene.fog.color.setHex(hex);
      scene.fog.near = near;
      scene.fog.far = far;
    }

    function applyHorizonFog() {
      const hex = scene.background && scene.background.isColor ? scene.background.getHex() : 0x87CEEB;
      ensureLinearFog(hex, 480, 2200);
    }

    function setWeather(type) {
      weatherType = type;
      if (type !== 'clear' && !rainParticles) createWeatherSystems();
      needsRender = true;
      
      // Hide all weather
      if (rainParticles) rainParticles.visible = false;
      if (snowParticles) snowParticles.visible = false;
      if (window.rainSplashes) window.rainSplashes.visible = false;
      if (window.snowGround) window.snowGround.visible = false;

      switch(type) {
        case 'rain':
          rainParticles.visible = true;
          if (window.rainSplashes) window.rainSplashes.visible = true;
          ensureLinearFog(0x556677, 50, 250);
          break;
        case 'snow':
          snowParticles.visible = true;
          if (window.snowGround) window.snowGround.visible = true;
          ensureLinearFog(0xddeeff, 40, 200);
          break;
        case 'fog':
          ensureLinearFog(0x99aaaa, 20, 150);
          break;
        case 'clear':
          applyHorizonFog();
          // Slowly melt snow when switching to clear
          if (window.snowAccumulation > 0) {
            const meltInterval = setInterval(() => {
              window.snowAccumulation = Math.max(0, window.snowAccumulation - 0.01);
              if (window.snowGround) {
                window.snowGround.material.opacity = window.snowAccumulation;
              }
              if (window.snowAccumulation <= 0) {
                clearInterval(meltInterval);
                if (window.snowGround) window.snowGround.visible = false;
              }
            }, 100);
          }
          break;
      }
      
      // Update weather button states
      document.querySelectorAll('.weather-btn[data-weather]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.weather === type);
      });
      
      toast(`🌤️ Weather: ${type.charAt(0).toUpperCase() + type.slice(1)}`);
    }
    
    // ==================== INFINITE GROUND SYSTEM ====================
    let groundStuds = null;
    const MAX_STUDS = 10000; // For baseplate studs only
    
    function makeBaseplateStudTextures(repeat) {
      // The map only carries the cell repeat into vMapUv. The disk itself is
      // drawn in the shader, so boot does not fill a mip pyramid and the
      // edge stays about one pixel instead of a filtered halo.
      const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(repeat, repeat);
      map.magFilter = THREE.LinearFilter;
      map.minFilter = THREE.LinearFilter;
      map.generateMipmaps = false;
      map.needsUpdate = true;
      return { map };
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    function createInfiniteGround() {
      // BASEPLATE: Fixed size studded building area
      const BASEPLATE_SIZE = 96; // 96x96 studs - good for large builds
      const baseplateWorldSize = BASEPLATE_SIZE * STUD;
      
      // Matte plate. Standard + env + normals on this fullscreen quad was the
      // fragment cost that dropped the 520-brick view under 60 FPS, and the
      // bright env fill washed a lone 1x1 into the studs.
      const baseGeo = new THREE.BoxGeometry(baseplateWorldSize, PLATE_H * 0.5, baseplateWorldSize);
      const baseMat = new THREE.MeshLambertMaterial({ color: 0x2f8f3c });
      const baseplate = new THREE.Mesh(baseGeo, baseMat);
      baseplate.position.set(baseplateWorldSize / 2, -PLATE_H * 0.25, baseplateWorldSize / 2);
      baseplate.receiveShadow = true;
      scene.add(baseplate);
      
      // One normal-mapped plane. The old 96x96 instanced studs (9,216 shadow casters) are gone.
      const studTex = makeBaseplateStudTextures(BASEPLATE_SIZE);
      const studMat = new THREE.MeshLambertMaterial({
        color: 0x3eb24e,
        map: studTex.map
      });
      // Same radius as the raised cylinder. The gap is the linear decode of
      // the old 176 print, so the plate contrast survives sRGB. Derivatives
      // come from the continuous uv, not fract(), so the cell seam stays quiet.
      const studGap = 0.4343;
      studMat.customProgramCacheKey = () => 'plate-stud-disk-cap3';
      studMat.onBeforeCompile = (shader) => {
        shader.uniforms.uStudShade = { value: isMobileGfx() ? 0.0 : 1.0 };
        shader.uniforms.uViewH = studViewH;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          'uniform float uStudShade;\nuniform float uViewH;\n#include <common>'
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
          {
            vec2 uvCell = fract(vMapUv);
            float dist = length(uvCell - 0.5);
            float rad = ${STUD_R / STUD};
            // fwidth of the repeated uv. A clamped 0.0045 edge stayed sharp
            // when a cell was smaller than a pixel and the horizon rang.
            float pixel = max(fwidth(vMapUv).x, fwidth(vMapUv).y);
            float cellPx = 1.0 / max(pixel, 0.0001);
            // Far disks beat into row-sized bands. Soften only that band.
            float far = 1.0 - smoothstep(4.0, 18.0, cellPx);
            float aa = clamp(max(pixel * mix(0.75, 3.2, far), 0.0012), 0.0012, 0.2);
            float disk = 1.0 - smoothstep(rad - aa, rad + aa, dist);
            // Disks and the stud green both dissolve while a cell is still
            // many pixels tall. A 2px window turned into a one-pixel shelf
            // where the pattern started.
            float fade = smoothstep(3.0, 16.0, cellPx);
            // On the desktop home ray a far cell is a one-pixel edge and
            // wins the click, so the brick there is a speck. Wide and phone
            // keep the original disk.
            float diskVis = disk * fade * mix(1.0, smoothstep(8.0, 16.0, cellPx), uStudShade);
            diffuseColor.rgb *= mix(vec3(${studGap}), vec3(1.0), diskVis);
            float edgeStud = min(min(vMapUv.x, vMapUv.y), min(${BASEPLATE_SIZE}.0 - vMapUv.x, ${BASEPLATE_SIZE}.0 - vMapUv.y));
            float edgeFade = smoothstep(0.0, 8.0, edgeStud);
            float farMix = smoothstep(3.0, 16.0, cellPx);
            diffuseColor.rgb = mix(vec3(0.1843, 0.5608, 0.2353), diffuseColor.rgb, edgeFade * farMix);
            // Four-pixel rows. The crest sits on the checker sample, and the
            // row above it is brighter than the row below, so the stud reads
            // as a lit cylinder. Desktop only, and only below the moire band.
            float imageY = uViewH - gl_FragCoord.y;
            float row = mod(imageY, 4.0);
            float rowLit = row < 1.0 ? 0.62 : row < 2.0 ? 0.70 : row < 3.0 ? 1.22 : 1.12;
            float inBand = step(uViewH * 0.44, imageY);
            diffuseColor.rgb *= mix(vec3(1.0), vec3(rowLit), uStudShade * inBand);
          }
          `
        );
      };
      groundStuds = new THREE.Mesh(new THREE.PlaneGeometry(baseplateWorldSize, baseplateWorldSize), studMat);
      groundStuds.rotation.x = -Math.PI / 2;
      groundStuds.position.set(baseplateWorldSize / 2, 0.012, baseplateWorldSize / 2);
      groundStuds.castShadow = false;
      groundStuds.receiveShadow = true;
      scene.add(groundStuds);
      baseplate.castShadow = false;
      
      // Dark rim so the plate edge reads against the grass.
      const rimMat = new THREE.MeshLambertMaterial({ color: 0x2f8f3c });
      rimMat.polygonOffset = true;
      rimMat.polygonOffsetFactor = 1;
      rimMat.polygonOffsetUnits = 1;
      const rim = new THREE.Mesh(
        new THREE.BoxGeometry(baseplateWorldSize + 1.6, PLATE_H * 0.28, baseplateWorldSize + 1.6),
        rimMat
      );
      rim.position.set(baseplateWorldSize / 2, -PLATE_H * 0.42, baseplateWorldSize / 2);
      rim.receiveShadow = true;
      rim.name = 'plateRim';
      scene.add(rim);

      // Grass is subdivided so per-vertex fog reaches the horizon instead of
      // ending in a hard line near x 1150 where the old 2000-unit plane clipped.
      const grassGeo = new THREE.PlaneGeometry(16000, 16000, 80, 80);
      const grassMat = new THREE.MeshLambertMaterial({ color: 0x2f8f3c });
      const grass = new THREE.Mesh(grassGeo, grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(baseplateWorldSize / 2, -0.02, baseplateWorldSize / 2);
      grass.receiveShadow = false;
      grass.userData.isGround = true; // Mark for color updates
      scene.add(grass);
      window.grassPlane = grass; // Store reference
      window.baseplateRef = baseplate; // Store baseplate reference
      window.groundStudsRef = groundStuds; // Store studs reference
      
      // Distant hills/mountains (low-poly silhouettes)
      createDistantScenery(baseplateWorldSize);
      
      // Subtle grid on baseplate only
      const gridSize = baseplateWorldSize;
      const gridDivisions = BASEPLATE_SIZE;
      const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x1f6e28, 0x1f6e28);
      gridHelper.position.set(baseplateWorldSize / 2, 0.002, baseplateWorldSize / 2);
      gridHelper.material.opacity = 0.15;
      gridHelper.material.transparent = true;
      scene.add(gridHelper);
      window.gridHelper = gridHelper;
      if (controls && !controls.__plateStudLod) {
        controls.__plateStudLod = true;
        controls.addEventListener('change', () => updateNearPlateStuds(false));
      }
      updateNearPlateStuds(true);
    }

    let nearPlateStuds = null;
    let nearPlateStudKey = '';
    // Full-size cylinders only. A height fade left a thin puck on the printed
    // disk, and that puck read as a ring. The home camera and the share
    // camera sit past this distance, so those views stay the printed plate.
    const PLATE_STUD_FULL = 3.15;
    const PLATE_STUD_CAP = 180;
    const PLATE_STUD_SEGMENTS = 24;
    function makePlateStudGeometry(segments) {
      const geo = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, segments, 1, false);
      const pos = geo.attributes.position;
      const nrm = geo.attributes.normal;
      const colors = new Float32Array(pos.count * 3);
      const top = new THREE.Color(0xc8ffd4);
      const side = new THREE.Color(0x146b2e);
      const tint = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        tint.copy(side).lerp(top, Math.max(0, nrm.getY(i)));
        colors[i * 3] = tint.r;
        colors[i * 3 + 1] = tint.g;
        colors[i * 3 + 2] = tint.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geo;
    }
    function updateNearPlateStuds(force) {
      if (!scene || !camera || !instancedSystem) return;
      if (!nearPlateStuds) {
        const geo = makePlateStudGeometry(PLATE_STUD_SEGMENTS);
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
        nearPlateStuds = new THREE.InstancedMesh(geo, mat, PLATE_STUD_CAP);
        nearPlateStuds.name = 'nearPlateStuds';
        nearPlateStuds.count = 0;
        nearPlateStuds.castShadow = false;
        // The plate already receives the shadow. A second lookup on each
        // cylinder was the crescent and a full-screen fragment cost.
        nearPlateStuds.receiveShadow = false;
        nearPlateStuds.frustumCulled = false;
        nearPlateStuds.matrixAutoUpdate = false;
        scene.add(nearPlateStuds);
      }
      const cam = camera.position;
      const desktopStuds = !isMobileGfx();
      // Keep the raised studs beside the click strip. A cluster on the aim
      // is the strongest edge there, and that stud is the small end of the band.
      let focusX = desktopStuds && controls && controls.target ? controls.target.x : cam.x;
      let focusZ = desktopStuds && controls && controls.target ? controls.target.z : cam.z;
      if (desktopStuds && controls && controls.target) {
        const side = 18 * STUD;
        const flen = Math.hypot(DESK_OX, DESK_OZ) || 1;
        focusX += (-DESK_OZ / flen) * side;
        focusZ += (DESK_OX / flen) * side;
      }
      const q = (n) => Math.round(n * 4);
      const key = q(cam.x) + ',' + q(cam.y) + ',' + q(cam.z) + (desktopStuds ? ':' + q(focusX) + ',' + q(focusZ) : '');
      if (!force && key === nearPlateStudKey) return;
      nearPlateStudKey = key;
      const dummy = instancedSystem.dummy;
      const y = 0.012 + STUD_H * 0.5;
      const reach = desktopStuds ? 16 * STUD : PLATE_STUD_FULL;
      const minX = Math.max(0, Math.floor((focusX - reach) / STUD));
      const maxX = Math.min(95, Math.floor((focusX + reach) / STUD));
      const minZ = Math.max(0, Math.floor((focusZ - reach) / STUD));
      const maxZ = Math.min(95, Math.floor((focusZ + reach) / STUD));
      const picks = [];
      for (let iz = minZ; iz <= maxZ; iz++) {
        for (let ix = minX; ix <= maxX; ix++) {
          const x = (ix + 0.5) * STUD;
          const z = (iz + 0.5) * STUD;
          const dist = desktopStuds
            ? Math.hypot(focusX - x, focusZ - z)
            : Math.hypot(cam.x - x, cam.y - y, cam.z - z);
          if (dist >= reach) continue;
          picks.push({ x, z, dist });
        }
      }
      picks.sort((a, b) => a.dist - b.dist);
      const n = Math.min(PLATE_STUD_CAP, picks.length);
      for (let i = 0; i < n; i++) {
        const p = picks[i];
        // Bury the base in the plate so the cap edge does not draw a ring.
        dummy.position.set(p.x, 0.012 - 0.02 + y, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        nearPlateStuds.setMatrixAt(i, dummy.matrix);
      }
      nearPlateStuds.count = n;
      nearPlateStuds.instanceMatrix.needsUpdate = true;
      needsRender = true;
    }
    
    function createDistantScenery(baseplateSize) {
      // Initialize scenery container
      window.sceneryObjects = {
        sky: null,
        sun: null,
        moon: null,
        ground: null,
        water: null,
        trees: [],
        mountains: [],
        clouds: [],
        particles: null,
        extras: []
      };
      
      window.baseplateSize = baseplateSize;
      window.scenerySettled = false;

      const start = () => {
        if (window.sceneryThemeStarted) return;
        window.sceneryThemeStarted = true;
        window.scenerySettled = false;
        performance.mark('brix-scenery-start');
        setBackgroundTheme('forest', { silent: true });
        performance.mark('brix-scenery');
      };
      window.brixStartScenery = start;
    }
    
    let currentBackgroundTheme = 'forest';

    const sceneryJobs = [];
    let sceneryPumping = false;
    function queueScenery(fn) {
      sceneryJobs.push(fn);
      if (sceneryPumping) return;
      sceneryPumping = true;
      setTimeout(pumpScenery, 0);
    }
    function pumpScenery() {
      const start = performance.now();
      // One job can overshoot the cap. 4ms keeps a slow job under the
      // simulated 50ms line.
      while (sceneryJobs.length && performance.now() - start < 4) {
        const job = sceneryJobs.shift();
        try { job(); } catch (err) { console.error(err); }
      }
      if (sceneryJobs.length) setTimeout(pumpScenery, 0);
      else {
        sceneryPumping = false;
        window.scenerySettled = true;
      }
    }
    
    // ==================== PREMIUM BACKGROUND SYSTEM ====================
    function setBackgroundTheme(theme, opts = {}) {
      const baseplateSize = window.baseplateSize || 76.8;
      const center = baseplateSize / 2;
      currentBackgroundTheme = theme;
      
      // Clear existing scenery
      clearScenery();
      
      // Theme definitions - each is carefully crafted
      const themes = {
        forest: createForestTheme,
        desert: createDesertTheme,
        winter: createWinterTheme,
        mountains: createMountainTheme,
        space: createSpaceTheme,
        classroom: createClassroomTheme
      };
      
      const createTheme = themes[theme] || themes.forest;
      createTheme(center, baseplateSize);
      queueScenery(() => mergeSceneryMeshes());
      
      // Update button states
      document.querySelectorAll('[data-background]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.background === theme);
      });
      
      if (!opts.silent) toast(`${theme.charAt(0).toUpperCase() + theme.slice(1)} environment loaded`);
    }
    
    function disposeSceneryObject(obj) {
      if (!obj || !obj.traverse) return;
      obj.traverse(node => {
        if (node.geometry && node.geometry.dispose) node.geometry.dispose();
        if (node.material) {
          const list = Array.isArray(node.material) ? node.material : [node.material];
          for (let i = 0; i < list.length; i++) if (list[i] && list[i].dispose) list[i].dispose();
        }
      });
    }

    function clearScenery() {
      if (!window.sceneryObjects) return;
      const so = window.sceneryObjects;
      const drop = [so.sky, so.sun, so.moon, so.water, so.particles].concat(so.trees, so.mountains, so.clouds, so.extras);
      for (let i = 0; i < drop.length; i++) {
        const obj = drop[i];
        if (!obj) continue;
        scene.remove(obj);
        disposeSceneryObject(obj);
      }
      so.sky = null;
      so.sun = null;
      so.moon = null;
      so.water = null;
      so.particles = null;
      so.trees = [];
      so.mountains = [];
      so.clouds = [];
      so.extras = [];
      window.sceneryMergedDraws = 0;
      sceneryMergeState.clear();
    }

    const _mergeV = new THREE.Vector3();
    const _mergeN = new THREE.Matrix3();

    function sceneryMaterialKey(mat) {
      const color = mat.color ? mat.color.getHex() : 0;
      const emissive = mat.emissive ? mat.emissive.getHex() : 0;
      const opacity = mat.opacity === undefined ? 1 : mat.opacity;
      return [
        mat.type,
        color.toString(16),
        emissive.toString(16),
        (mat.roughness === undefined ? 1 : mat.roughness).toFixed(3),
        (mat.metalness === undefined ? 0 : mat.metalness).toFixed(3),
        opacity.toFixed(3),
        mat.transparent ? 1 : 0,
        mat.side || 0,
        mat.flatShading ? 1 : 0,
        mat.depthWrite === false ? 0 : 1
      ].join('|');
    }

    function makeSceneryMaterial(src) {
      const params = {
        color: src.color ? src.color.getHex() : 0xffffff,
        opacity: src.opacity === undefined ? 1 : src.opacity,
        transparent: !!src.transparent,
        side: src.side,
        depthWrite: src.depthWrite !== false
      };
      if (src.isMeshBasicMaterial) return new THREE.MeshBasicMaterial(params);
      params.roughness = src.roughness === undefined ? 1 : src.roughness;
      params.metalness = src.metalness === undefined ? 0 : src.metalness;
      params.flatShading = !!src.flatShading;
      params.emissive = src.emissive ? src.emissive.getHex() : 0x000000;
      if (src.isMeshLambertMaterial) return new THREE.MeshLambertMaterial(params);
      return new THREE.MeshStandardMaterial(params);
    }

    function sceneryRootMergeable(root) {
      let meshes = 0;
      let blocked = false;
      root.traverse(obj => {
        if (!obj.isMesh || obj.isInstancedMesh) return;
        meshes++;
        const mat = obj.material;
        if (!mat || Array.isArray(mat) || mat.isShaderMaterial || mat.map || mat.normalMap) blocked = true;
      });
      return meshes > 0 && !blocked;
    }

    function bakeSceneryPart(obj) {
      const src = obj.geometry;
      if (!src || !src.attributes || !src.attributes.position) return null;
      const geo = src.index ? src.toNonIndexed() : src;
      const posAttr = geo.attributes.position;
      const nrmAttr = geo.attributes.normal;
      const count = posAttr.count;
      if (!count) {
        if (geo !== src) geo.dispose();
        return null;
      }
      _mergeN.getNormalMatrix(obj.matrixWorld);
      const positions = new Float32Array(count * 3);
      const normals = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        _mergeV.fromBufferAttribute(posAttr, i).applyMatrix4(obj.matrixWorld);
        positions[i * 3] = _mergeV.x;
        positions[i * 3 + 1] = _mergeV.y;
        positions[i * 3 + 2] = _mergeV.z;
        if (nrmAttr) {
          _mergeV.fromBufferAttribute(nrmAttr, i).applyMatrix3(_mergeN);
          if (_mergeV.lengthSq() > 1e-8) _mergeV.normalize();
        } else {
          _mergeV.set(0, 1, 0);
        }
        normals[i * 3] = _mergeV.x;
        normals[i * 3 + 1] = _mergeV.y;
        normals[i * 3 + 2] = _mergeV.z;
      }
      if (geo !== src) geo.dispose();
      return { positions, normals, count };
    }

    const SCENERY_SECTOR = 120;
    const sceneryMergeState = new Map();

    function mergeScenerySector(roots, key) {
      let state = sceneryMergeState.get(key);
      if (!state) {
        const parts = key.split(',');
        const sx = Number(parts[0]);
        const sz = Number(parts[1]);
        state = {
          buckets: new Map(),
          taken: [],
          originX: (sx + 0.5) * SCENERY_SECTOR,
          originZ: (sz + 0.5) * SCENERY_SECTOR
        };
        sceneryMergeState.set(key, state);
      }
      const batch = Math.min(roots.length, 8);
      for (let r = 0; r < batch; r++) {
        const root = roots[r];
        if (!root) continue;
        root.updateWorldMatrix(true, true);
        let baked = 0;
        root.traverse(obj => {
          if (!obj.isMesh || obj.isInstancedMesh) return;
          const part = bakeSceneryPart(obj);
          if (!part) return;
          const matKey = sceneryMaterialKey(obj.material);
          let bucket = state.buckets.get(matKey);
          if (!bucket) {
            bucket = { material: makeSceneryMaterial(obj.material), chunks: [] };
            state.buckets.set(matKey, bucket);
          }
          bucket.chunks.push(part);
          baked++;
        });
        if (baked > 0) state.taken.push(root);
      }
      roots.splice(0, batch);
      if (roots.length) {
        queueScenery(() => mergeScenerySector(roots, key));
        return;
      }
      sceneryMergeState.delete(key);
      const buckets = state.buckets;
      const taken = state.taken;
      const originX = state.originX;
      const originZ = state.originZ;
      const so = window.sceneryObjects;
      buckets.forEach(bucket => {
        let total = 0;
        for (let i = 0; i < bucket.chunks.length; i++) total += bucket.chunks[i].count;
        if (!total) {
          bucket.material.dispose();
          return;
        }
        const positions = new Float32Array(total * 3);
        const normals = new Float32Array(total * 3);
        let offset = 0;
        for (let i = 0; i < bucket.chunks.length; i++) {
          const chunk = bucket.chunks[i];
          for (let v = 0; v < chunk.count; v++) {
            positions[offset + v * 3] = chunk.positions[v * 3] - originX;
            positions[offset + v * 3 + 1] = chunk.positions[v * 3 + 1];
            positions[offset + v * 3 + 2] = chunk.positions[v * 3 + 2] - originZ;
            normals[offset + v * 3] = chunk.normals[v * 3];
            normals[offset + v * 3 + 1] = chunk.normals[v * 3 + 1];
            normals[offset + v * 3 + 2] = chunk.normals[v * 3 + 2];
          }
          offset += chunk.count * 3;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, bucket.material);
        mesh.position.set(originX, 0, originZ);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = true;
        mesh.userData.sceneryMerge = true;
        mesh.userData.scenerySector = key;
        scene.add(mesh);
        if (so) so.trees.push(mesh);
        window.sceneryMergedDraws = (window.sceneryMergedDraws || 0) + 1;
      });
      for (let i = 0; i < taken.length; i++) {
        scene.remove(taken[i]);
        disposeSceneryObject(taken[i]);
      }
      needsRender = true;
    }

    function mergeSceneryMeshes() {
      const so = window.sceneryObjects;
      if (!so) return 0;
      const roots = so.trees.concat(so.mountains, so.clouds, so.extras);
      const sectors = new Map();
      const kept = [];
      for (let r = 0; r < roots.length; r++) {
        const root = roots[r];
        if (!root) continue;
        if (!sceneryRootMergeable(root)) {
          kept.push(root);
          continue;
        }
        root.updateWorldMatrix(true, true);
        const sx = Math.floor(root.position.x / SCENERY_SECTOR);
        const sz = Math.floor(root.position.z / SCENERY_SECTOR);
        const key = sx + ',' + sz;
        let list = sectors.get(key);
        if (!list) {
          list = [];
          sectors.set(key, list);
        }
        list.push(root);
      }
      so.trees = [];
      so.mountains = [];
      so.clouds = [];
      so.extras = kept;
      window.sceneryMergedDraws = 0;
      sectors.forEach((list, key) => {
        queueScenery(() => mergeScenerySector(list, key));
      });
      return sectors.size;
    }
    
    // ==================== FOREST THEME ====================
    function createForestTheme(center, baseplateSize) {
      const minDist = 80; // Minimum distance from center for any object
      
      // Solid sky. The old gradient ended in white, and a low camera looked
      // straight at that band above the horizon.
      scene.background = new THREE.Color(0x7ec8e8);
      // Fog matches the sky and ends before the ground plane, so the horizon
      // is fog rather than a cut where the mesh stops.
      scene.fog = new THREE.Fog(0x7ec8e8, 480, 2200);
      if (renderer) renderer.setClearColor(0x7ec8e8, 1);
      
      // Mid green. A red 1×1 has to read against the studs, and the plate
      // has to read against the sky. Near-black 0x1a6424 failed that.
      updateGroundColor(0x36a844);
      
      // Sun
      createSun(center, 300, 200, 0xfffacd, 1.2);
      
      // Layered mountains - FAR away
      createMountainRange(center, [
        { distance: 500, count: 8, height: 120, color: 0x2d5a27, opacity: 0.9 },
        { distance: 650, count: 6, height: 180, color: 0x1a4020, opacity: 0.7 },
        { distance: 800, count: 5, height: 250, color: 0x0d2810, opacity: 0.5 }
      ]);
      
      // Mixed forest - pines and deciduous - OUTSIDE workspace
      createForest(center, [
        { type: 'pine', count: 30, minDist: minDist + 40, maxDist: minDist + 180, minScale: 0.8, maxScale: 1.4 },
        { type: 'oak', count: 20, minDist: minDist + 30, maxDist: minDist + 150, minScale: 0.7, maxScale: 1.2 },
        { type: 'birch', count: 12, minDist: minDist + 50, maxDist: minDist + 170, minScale: 0.9, maxScale: 1.3 }
      ]);
      
      // Fluffy clouds
      createClouds(center, 12, 150, 250, 0xffffff, 0.8);
      
      // Ground details - rocks and bushes
      queueScenery(() => createGroundDetails(center, 'forest'));
      
      // Ambient particles - floating pollen/dust
      queueScenery(() => createAmbientParticles(center, 'dust', 500, 0xffffee, 0.3));
      
      // Neutral brick light. Sky-blue ambient turned yellow olive and dark red maroon.
      const phoneLight = isMobileGfx();
      updateLighting(0xfff6ee, phoneLight ? 1.06 : 1.15, 0xffffff, phoneLight ? 0.72 : 0.8);
    }
    
    // ==================== DESERT THEME ====================
    function createDesertTheme(center, baseplateSize) {
      const minDist = 80;
      
      // Hot sky gradient
      scene.background = createSkyGradient(0x87CEEB, 0xffeebb, 0xffcc88);
      scene.fog = new THREE.Fog(0xffeedd, 200, 800);
      
      // Sandy ground - warm sand tan
      updateGroundColor(0xe8c89a);
      
      // Blazing sun
      createSun(center, 250, 280, 0xffdd44, 1.5);
      
      // Desert mountains/mesas - FAR away
      createMountainRange(center, [
        { distance: 500, count: 5, height: 80, color: 0xc19a6b, opacity: 0.9, style: 'mesa' },
        { distance: 650, count: 4, height: 120, color: 0xa0826d, opacity: 0.7, style: 'mesa' },
        { distance: 800, count: 3, height: 160, color: 0x8b7355, opacity: 0.5, style: 'mesa' }
      ]);
      
      // Cacti and desert plants - OUTSIDE workspace
      createDesertVegetation(center, [
        { type: 'saguaro', count: 15, minDist: minDist + 40, maxDist: minDist + 200 },
        { type: 'barrel', count: 25, minDist: minDist + 30, maxDist: minDist + 180 },
        { type: 'joshua', count: 8, minDist: minDist + 60, maxDist: minDist + 250 }
      ]);
      
      // Sand dunes - far away
      createSandDunes(center, 8, 300, 600);
      
      // Heat haze particles
      createAmbientParticles(center, 'heat', 300, 0xffffcc, 0.15);
      
      // Hot lighting
      updateLighting(0xffeedd, 1.3, 0xffcc99, 0.4);
    }
    
    // ==================== WINTER THEME ====================
    function createWinterTheme(center, baseplateSize) {
      const minDist = 80;
      
      // Cold sky
      scene.background = createSkyGradient(0xc8d8e8, 0xe8f0f8, 0xffffff);
      scene.fog = new THREE.Fog(0xddeeff, 150, 600);
      
      // Snow ground - white/icy
      updateGroundColor(0xe8f0f8);
      
      // Pale winter sun
      createSun(center, 280, 120, 0xffffff, 0.9);
      
      // Snowy mountains - far away
      createMountainRange(center, [
        { distance: 450, count: 6, height: 150, color: 0xe8e8f0, opacity: 0.95, snow: true },
        { distance: 600, count: 5, height: 220, color: 0xd0d8e0, opacity: 0.8, snow: true },
        { distance: 750, count: 4, height: 300, color: 0xb8c8d8, opacity: 0.6, snow: true }
      ]);
      
      // Snowy pines - use regular pine type which works
      createForest(center, [
        { type: 'pine', count: 35, minDist: minDist + 30, maxDist: minDist + 200, minScale: 0.7, maxScale: 1.3 }
      ]);
      
      // Frozen lake - far from workspace
      createFrozenLake(center, 200, -120);
      
      // Falling snow
      createAmbientParticles(center, 'snow', 2000, 0xffffff, 0.9);
      
      // Cold but visible lighting
      updateLighting(0xe8f0ff, 1.0, 0xaaccff, 0.6);
    }
    
    // ==================== BEACH THEME ====================
    function createBeachTheme(center, baseplateSize) {
      const minDist = 80;
      
      // Tropical sky
      scene.background = createSkyGradient(0x1e90ff, 0x87CEEB, 0xb0e0e6, true);
      scene.fog = new THREE.Fog(0x87CEEB, 300, 1000);
      
      // Sandy beach ground
      updateGroundColor(0xf5deb3);
      
      // Bright tropical sun
      createSun(center, 380, 280, 0xfffacd, 1.4);
      
      // Simple ocean plane
      const oceanGeo = new THREE.PlaneGeometry(2000, 2000);
      const oceanMat = new THREE.MeshStandardMaterial({
        color: 0x0077be,
        roughness: 0.2,
        metalness: 0.3,
        transparent: true,
        opacity: 0.9
      });
      const ocean = new THREE.Mesh(oceanGeo, oceanMat);
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.set(center, -0.5, center);
      scene.add(ocean);
      window.sceneryObjects.water = ocean;
      
      // Palm trees around edges
      createForest(center, [
        { type: 'palm', count: 20, minDist: minDist + 20, maxDist: minDist + 80, minScale: 0.7, maxScale: 1.1 }
      ]);
      
      // Fluffy tropical clouds
      createClouds(center, 12, 200, 300, 0xffffff, 0.85);
      
      // Seagulls
      createAmbientParticles(center, 'birds', 10, 0xffffff, 1.0);
      
      // Warm tropical lighting
      updateLighting(0xfffaf0, 1.2, 0x87CEEB, 0.5);
    }
    
    // ==================== MOUNTAIN THEME ====================
    function createMountainTheme(center, baseplateSize) {
      const minDist = 80;
      
      // Clear mountain sky
      scene.background = createSkyGradient(0x5588bb, 0x88bbdd, 0xaaccee);
      scene.fog = new THREE.Fog(0x99bbdd, 200, 800);
      
      // Alpine meadow - green
      updateGroundColor(0x5a8a4a);
      
      // Bright sun
      createSun(center, 320, 220, 0xfffacd, 1.1);
      
      // Epic mountain range - FAR away
      createMountainRange(center, [
        { distance: 400, count: 4, height: 100, color: 0x4a7a4a, opacity: 1.0 },
        { distance: 550, count: 5, height: 180, color: 0x6a8a6a, opacity: 0.9 },
        { distance: 700, count: 6, height: 280, color: 0x8899aa, opacity: 0.8, snow: true },
        { distance: 900, count: 4, height: 400, color: 0xaabbcc, opacity: 0.6, snow: true }
      ]);
      
      // Alpine trees - outside workspace
      createForest(center, [
        { type: 'pine', count: 30, minDist: minDist + 30, maxDist: minDist + 150, minScale: 0.6, maxScale: 1.0 }
      ]);
      
      // Mountain lake - far from workspace
      createMountainLake(center, 180, 150);
      
      // Wildflowers
      createGroundDetails(center, 'alpine');
      
      // Light clouds
      createClouds(center, 6, 180, 280, 0xffffff, 0.6);
      
      // Crisp lighting
      updateLighting(0xffffff, 1.0, 0x88aacc, 0.5);
    }
    
    // ==================== NIGHT THEME ====================
    function createNightTheme(center, baseplateSize) {
      const minDist = 80;
      
      // Night sky - lighter so you can still see
      scene.background = createSkyGradient(0x152035, 0x203050, 0x304060);
      scene.fog = new THREE.Fog(0x182838, 300, 900);
      
      // Ground - visible dark green
      updateGroundColor(0x2a3a2a);
      
      // Bright moon - key light source
      createMoon(center, 300, 180);
      
      // Stars - lots of them
      createStarfield(center, 800);
      
      // Mountains - visible silhouettes against sky
      createMountainRange(center, [
        { distance: 450, count: 6, height: 120, color: 0x253545, opacity: 0.95 },
        { distance: 600, count: 5, height: 180, color: 0x1f2f3f, opacity: 0.8 }
      ]);
      
      // Trees - far from workspace
      createForest(center, [
        { type: 'pine', count: 30, minDist: minDist + 40, maxDist: minDist + 200, minScale: 0.8, maxScale: 1.4 }
      ]);
      
      // Fireflies - bright yellow
      createAmbientParticles(center, 'fireflies', 150, 0xffff44, 1.0);
      
      // Glowing mushrooms around perimeter
      createGroundDetails(center, 'night');
      
      // BRIGHT moonlight - you need to see your bricks!
      updateLighting(0x7799dd, 1.0, 0x445577, 1.0);
    }
    
    // ==================== SUNSET THEME ====================
    function createSunsetTheme(center, baseplateSize) {
      const minDist = 80;
      
      // Use shader sky for dramatic sunset with realistic horizon glow
      const shaderSky = createShaderSky(0x1a1a40, 0xff6b35, 0xffd700);
      scene.add(shaderSky);
      window.sceneryObjects.sky = shaderSky;
      scene.background = null; // Let shader sky show
      
      // Warm atmospheric fog
      scene.fog = new THREE.FogExp2(0xff8866, 0.0015);
      
      // Warm ground - brownish green
      updateGroundColor(0x4a5a3a);
      
      // Setting sun - large and low
      createSun(center, 400, 40, 0xff4500, 2.0);
      
      // Dramatic clouds lit by sunset
      createClouds(center, 15, 100, 300, 0xff6644, 0.9);
      
      // Silhouette mountains - far away
      createMountainRange(center, [
        { distance: 450, count: 7, height: 100, color: 0x2a1a10, opacity: 1.0 },
        { distance: 600, count: 5, height: 160, color: 0x1a1008, opacity: 0.9 }
      ]);
      
      // Tree silhouettes - outside workspace
      createForest(center, [
        { type: 'oak', count: 25, minDist: minDist + 40, maxDist: minDist + 200, minScale: 0.8, maxScale: 1.3 }
      ]);
      
      // Birds flying home
      createAmbientParticles(center, 'birds', 20, 0x222222, 1.0);
      
      // Golden hour lighting - warm sun, warm ambient
      updateLighting(0xffaa66, 1.2, 0xff8855, 0.5);
    }
    
    // ==================== SPACE THEME ====================
    function createSpaceTheme(center, baseplateSize) {
      const minDist = 100;
      
      // Black space
      scene.background = new THREE.Color(0x050510);
      scene.fog = new THREE.Fog(0x050510, 300, 1000);
      
      // Lunar surface - gray
      updateGroundColor(0x666666);
      
      // Earth in sky - bright and visible
      createEarth(center, 350, 180);
      
      // Dense starfield
      createStarfield(center, 2000);
      
      // Distant nebula
      createNebula(center);
      
      // Craters - FAR from workspace
      createMountainRange(center, [
        { distance: 400, count: 6, height: 20, color: 0x555555, opacity: 0.9, style: 'crater' },
        { distance: 600, count: 4, height: 40, color: 0x444444, opacity: 0.7, style: 'crater' }
      ]);
      
      // Floating dust
      createAmbientParticles(center, 'spaceDust', 200, 0xaaaaaa, 0.5);
      
      // Brighter space lighting (Earth glow + ambient)
      updateLighting(0x4488ff, 0.8, 0x223355, 0.9);
    }
    
    // ==================== CLASSROOM THEME ====================
    function createClassroomTheme(center, baseplateSize) {
      // Classroom ceiling color (off-white)
      scene.background = new THREE.Color(0xf5f5f0);
      scene.fog = new THREE.Fog(0xf5f5f0, 200, 600);
      
      // Classroom floor
      updateGroundColor(0x8b7355);
      
      // Create the classroom environment
      createClassroomEnvironment(center, baseplateSize);
      
      // Bright indoor fluorescent lighting
      updateLighting(0xffffff, 1.0, 0xf0f0ff, 0.7);
    }
    
    function createClassroomEnvironment(center, baseplateSize) {
      const roomSize = 400;
      const wallHeight = 120;
      
      // === FLOOR ===
      // Checkered linoleum floor
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const floorCtx = floorCanvas.getContext('2d');
      const tileSize = 64;
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          floorCtx.fillStyle = (x + y) % 2 === 0 ? '#c9b896' : '#b8a780';
          floorCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(10, 10);
      
      const floorGeo = new THREE.PlaneGeometry(roomSize * 2, roomSize * 2);
      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(center, -15, center);
      scene.add(floor);
      window.sceneryObjects.extras.push(floor);
      
      // === WALLS ===
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xfff8dc, roughness: 0.9 }); // Cream walls
      
      // Back wall (with chalkboard)
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, wallHeight), wallMat);
      backWall.position.set(center, wallHeight / 2 - 15, center - roomSize / 2);
      scene.add(backWall);
      window.sceneryObjects.extras.push(backWall);
      
      // Front wall
      const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, wallHeight), wallMat);
      frontWall.position.set(center, wallHeight / 2 - 15, center + roomSize / 2);
      frontWall.rotation.y = Math.PI;
      scene.add(frontWall);
      window.sceneryObjects.extras.push(frontWall);
      
      // Left wall
      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, wallHeight), wallMat);
      leftWall.position.set(center - roomSize / 2, wallHeight / 2 - 15, center);
      leftWall.rotation.y = Math.PI / 2;
      scene.add(leftWall);
      window.sceneryObjects.extras.push(leftWall);
      
      // Right wall
      const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, wallHeight), wallMat);
      rightWall.position.set(center + roomSize / 2, wallHeight / 2 - 15, center);
      rightWall.rotation.y = -Math.PI / 2;
      scene.add(rightWall);
      window.sceneryObjects.extras.push(rightWall);
      
      // === CHALKBOARD ===
      const chalkboardGroup = new THREE.Group();
      
      // Board frame (wood)
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6 });
      const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(82, 42, 2), frameMat);
      chalkboardGroup.add(boardFrame);
      
      // Green chalkboard surface
      const chalkMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.95 });
      const chalkSurface = new THREE.Mesh(new THREE.BoxGeometry(78, 38, 1), chalkMat);
      chalkSurface.position.z = 1;
      chalkboardGroup.add(chalkSurface);
      
      // Chalk tray
      const trayMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.7 });
      const tray = new THREE.Mesh(new THREE.BoxGeometry(78, 3, 4), trayMat);
      tray.position.set(0, -20, 3);
      chalkboardGroup.add(tray);
      
      // Chalk pieces
      const chalkColors = [0xffffff, 0xffffff, 0xffff88, 0xff8888, 0x88ff88];
      chalkColors.forEach((color, i) => {
        const chalk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.4, 4, 8),
          new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 })
        );
        chalk.rotation.z = Math.PI / 2;
        chalk.position.set(-30 + i * 8, -20, 4);
        chalkboardGroup.add(chalk);
      });
      
      chalkboardGroup.position.set(center, 45, center - roomSize / 2 + 3);
      scene.add(chalkboardGroup);
      window.sceneryObjects.extras.push(chalkboardGroup);
      
      // === ABC LETTERS above chalkboard ===
      const letterColors = [0xe64980, 0xffa94d, 0xffd93d, 0x69db7c, 0x4dabf7, 0x9775fa];
      for (let i = 0; i < 13; i++) {
        const letterCard = createLetterCard(letterColors[i % letterColors.length]);
        letterCard.position.set(center - 75 + i * 12, 75, center - roomSize / 2 + 2);
        scene.add(letterCard);
        window.sceneryObjects.extras.push(letterCard);
      }
      
      // === WINDOWS on right wall ===
      for (let i = 0; i < 3; i++) {
        const windowGroup = createClassroomWindow();
        windowGroup.position.set(center + roomSize / 2 - 2, 40, center - 60 + i * 60);
        windowGroup.rotation.y = -Math.PI / 2;
        scene.add(windowGroup);
        window.sceneryObjects.extras.push(windowGroup);
      }
      
      // === CLOCK === (on front wall, above door area)
      const clock = createClassroomClock();
      clock.position.set(center - 80, 70, center + roomSize / 2 - 2);
      clock.rotation.y = Math.PI;
      scene.add(clock);
      window.sceneryObjects.extras.push(clock);
      
      // === TEACHER'S DESK ===
      const teacherDesk = createTeacherDesk();
      teacherDesk.position.set(center - 70, -15, center - 80);
      scene.add(teacherDesk);
      window.sceneryObjects.extras.push(teacherDesk);
      
      // === OTHER STUDENT DESKS ===
      const deskPositions = [
        { x: -80, z: 60 }, { x: -80, z: 120 },
        { x: 80, z: 60 }, { x: 80, z: 120 },
        { x: 0, z: 150 }
      ];
      deskPositions.forEach(pos => {
        const desk = createStudentDesk();
        desk.position.set(center + pos.x, -15, center + pos.z);
        scene.add(desk);
        window.sceneryObjects.extras.push(desk);
      });
      
      // === BOOKSHELF ===
      const bookshelf = createBookshelf();
      bookshelf.position.set(center - roomSize / 2 + 20, -15, center + 60);
      bookshelf.rotation.y = Math.PI / 2;
      scene.add(bookshelf);
      window.sceneryObjects.extras.push(bookshelf);
      
      // === GLOBE === (on a small stand near teacher's desk)
      const globe = createGlobe();
      globe.position.set(center - roomSize / 2 + 30, -15, center - 60);
      scene.add(globe);
      window.sceneryObjects.extras.push(globe);
      
      // === BULLETIN BOARD === (on left wall, facing into room)
      const bulletin = createBulletinBoard();
      bulletin.position.set(center - roomSize / 2 + 3, 45, center - 20);
      // No rotation needed - board already faces +X which is into the room from left wall
      scene.add(bulletin);
      window.sceneryObjects.extras.push(bulletin);
      
      // === CEILING LIGHTS ===
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          const light = createCeilingLight();
          light.position.set(center + x * 80, wallHeight - 20, center + z * 80);
          scene.add(light);
          window.sceneryObjects.extras.push(light);
        }
      }
      
      // === BACKPACKS by door ===
      const backpackColors = [0xe64980, 0x4dabf7, 0x69db7c, 0x9775fa];
      backpackColors.forEach((color, i) => {
        const backpack = createBackpack(color);
        backpack.position.set(center + roomSize / 2 - 20, -15, center + 120 + i * 12);
        backpack.rotation.y = Math.random() * 0.5 - 0.25;
        scene.add(backpack);
        window.sceneryObjects.extras.push(backpack);
      });
      
      // === DOOR on front wall ===
      const door = createClassroomDoor();
      door.position.set(center + 60, -15, center + roomSize / 2 - 1);
      door.rotation.y = Math.PI;
      scene.add(door);
      window.sceneryObjects.extras.push(door);
    }
    
    function createLetterCard(color) {
      const group = new THREE.Group();
      const cardGeo = new THREE.BoxGeometry(10, 12, 0.5);
      const cardMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
      const card = new THREE.Mesh(cardGeo, cardMat);
      group.add(card);
      const innerGeo = new THREE.BoxGeometry(8, 10, 0.3);
      const innerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
      const inner = new THREE.Mesh(innerGeo, innerMat);
      inner.position.z = 0.2;
      group.add(inner);
      return group;
    }
    
    function createClassroomWindow() {
      const group = new THREE.Group();
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2, 50, 35), frameMat);
      group.add(frame);
      const glassMat = new THREE.MeshStandardMaterial({ 
        color: 0x87ceeb, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.1
      });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1, 46, 32), glassMat);
      glass.position.x = 0.5;
      group.add(glass);
      const dividerV = new THREE.Mesh(new THREE.BoxGeometry(2.5, 46, 1.5), frameMat);
      group.add(dividerV);
      const dividerH = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 32), frameMat);
      group.add(dividerH);
      const sunlight = new THREE.PointLight(0xfffaf0, 0.5, 100);
      sunlight.position.set(10, 0, 0);
      group.add(sunlight);
      return group;
    }
    
    function createClassroomClock() {
      const group = new THREE.Group();
      const bodyGeo = new THREE.CylinderGeometry(8, 8, 2, 32);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);
      const faceGeo = new THREE.CircleGeometry(7, 32);
      const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.z = 1.1;
      group.add(face);
      const hourGeo = new THREE.BoxGeometry(0.5, 4, 0.3);
      const handMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const hour = new THREE.Mesh(hourGeo, handMat);
      hour.position.set(0, 1.5, 1.2);
      hour.rotation.z = -0.5;
      group.add(hour);
      const minGeo = new THREE.BoxGeometry(0.3, 5.5, 0.3);
      const minute = new THREE.Mesh(minGeo, handMat);
      minute.position.set(0, 2, 1.3);
      minute.rotation.z = 0.8;
      group.add(minute);
      return group;
    }
    
    function createTeacherDesk() {
      const group = new THREE.Group();
      const deskMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6 });
      const top = new THREE.Mesh(new THREE.BoxGeometry(50, 3, 25), deskMat);
      top.position.y = 28; // Raised from 22
      group.add(top);
      const legGeo = new THREE.BoxGeometry(3, 28, 3); // Taller legs (from 22)
      [[-22, -10], [-22, 10], [22, -10], [22, 10]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, deskMat);
        leg.position.set(x, 14, z); // Adjusted position
        group.add(leg);
      });
      // Apple on desk
      const apple = new THREE.Mesh(
        new THREE.SphereGeometry(2, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.4 })
      );
      apple.position.set(-15, 32, 5); // Raised
      group.add(apple);
      // Apple stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x4a3728 })
      );
      stem.position.set(-15, 34.5, 5); // Raised
      group.add(stem);
      // Pencil holder
      const holder = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 2.5, 6, 16),
        new THREE.MeshStandardMaterial({ color: 0x4dabf7, roughness: 0.5 })
      );
      holder.position.set(15, 32, -5); // Raised
      group.add(holder);
      // Pencils
      for (let i = 0; i < 5; i++) {
        const pencil = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xffd93d })
        );
        pencil.position.set(15 + (Math.random() - 0.5) * 2, 36, -5 + (Math.random() - 0.5) * 2); // Raised
        pencil.rotation.x = (Math.random() - 0.5) * 0.3;
        pencil.rotation.z = (Math.random() - 0.5) * 0.3;
        group.add(pencil);
      }
      // Teacher's chair
      const chair = createClassroomChair(0x1a1a1a);
      chair.position.set(0, 0, -20);
      chair.rotation.y = Math.PI; // Face the desk
      group.add(chair);
      return group;
    }
    
    function createStudentDesk() {
      const group = new THREE.Group();
      const deskMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.7 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.3, metalness: 0.5 });
      const top = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 20), deskMat);
      top.position.y = 26; // Raised from 20
      group.add(top);
      const legGeo = new THREE.BoxGeometry(1.5, 26, 1.5); // Taller legs (from 20)
      [[-12, -7], [-12, 7], [12, -7], [12, 7]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, metalMat);
        leg.position.set(x, 13, z); // Adjusted position
        group.add(leg);
      });
      const chair = createClassroomChair(0x4dabf7);
      chair.position.set(0, 0, -18);
      chair.rotation.y = Math.PI; // Face the desk
      chair.scale.set(0.85, 0.85, 0.85); // Slightly larger scale
      group.add(chair);
      return group;
    }
    
    function createClassroomChair(seatColor) {
      const group = new THREE.Group();
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.3, metalness: 0.5 });
      const seatMat = new THREE.MeshStandardMaterial({ color: seatColor, roughness: 0.6 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 14), seatMat);
      seat.position.y = 22; // Raised from 16
      group.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 2), seatMat);
      back.position.set(0, 31, 7); // Raised from 25
      group.add(back);
      const legGeo = new THREE.CylinderGeometry(0.6, 0.6, 22, 8); // Taller legs (from 16)
      [[-5, -5], [-5, 5], [5, -5], [5, 5]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, metalMat);
        leg.position.set(x, 11, z); // Adjusted position
        group.add(leg);
      });
      return group;
    }
    
    function createBookshelf() {
      const group = new THREE.Group();
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 });
      // Back panel
      const back = new THREE.Mesh(new THREE.BoxGeometry(60, 80, 2), woodMat);
      back.position.set(0, 40, -7);
      group.add(back);
      // Shelves (bottom to top)
      for (let i = 0; i < 4; i++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(58, 2, 15), woodMat);
        shelf.position.set(0, 2 + i * 22, 0);
        group.add(shelf);
      }
      // Top
      const topShelf = new THREE.Mesh(new THREE.BoxGeometry(60, 2, 15), woodMat);
      topShelf.position.set(0, 80, 0);
      group.add(topShelf);
      // Sides
      const sideGeo = new THREE.BoxGeometry(2, 80, 15);
      [-29, 29].forEach(x => {
        const side = new THREE.Mesh(sideGeo, woodMat);
        side.position.set(x, 40, 0);
        group.add(side);
      });
      // Books on shelves (starting from bottom shelf)
      const bookColors = [0xe64980, 0x4dabf7, 0x69db7c, 0xffd93d, 0x9775fa, 0xffa94d, 0x333333, 0x1a5fb4];
      for (let shelf = 0; shelf < 3; shelf++) {
        let xPos = -25;
        const shelfY = 3 + shelf * 22; // Just above each shelf
        for (let i = 0; i < 8; i++) {
          const width = 2 + Math.random() * 3;
          const height = 10 + Math.random() * 8;
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, 10),
            new THREE.MeshStandardMaterial({ color: bookColors[Math.floor(Math.random() * bookColors.length)], roughness: 0.8 })
          );
          book.position.set(xPos + width / 2, shelfY + height / 2, 0);
          book.rotation.z = (Math.random() - 0.5) * 0.1;
          group.add(book);
          xPos += width + 0.5;
          if (xPos > 23) break;
        }
      }
      return group;
    }
    
    function createGlobe() {
      const group = new THREE.Group();
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.5 });
      // Small table/stand for the globe
      const tableMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6 });
      const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 2, 16), tableMat);
      tableTop.position.y = 20;
      group.add(tableTop);
      const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 20, 8), tableMat);
      tableLeg.position.y = 10;
      group.add(tableLeg);
      // Globe base on table
      const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 2, 16), baseMat);
      base.position.y = 22;
      group.add(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 12, 8), baseMat);
      pole.position.y = 29;
      group.add(pole);
      const globeMat = new THREE.MeshStandardMaterial({ color: 0x4dabf7, roughness: 0.6 });
      const globeSphere = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 24), globeMat);
      globeSphere.position.y = 38;
      group.add(globeSphere);
      const landMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.7 });
      for (let i = 0; i < 5; i++) {
        const land = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random() * 1.5, 8, 8), landMat);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        land.position.set(
          6.1 * Math.sin(phi) * Math.cos(theta),
          38 + 6.1 * Math.cos(phi),
          6.1 * Math.sin(phi) * Math.sin(theta)
        );
        land.scale.set(1, 0.5, 1);
        group.add(land);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.3, 8, 32), baseMat);
      ring.position.y = 38;
      ring.rotation.x = Math.PI / 6;
      group.add(ring);
      return group;
    }
    
    function createBulletinBoard() {
      const group = new THREE.Group();
      const boardMat = new THREE.MeshStandardMaterial({ color: 0xc4a35a, roughness: 0.95 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(3, 50, 70), boardMat);
      group.add(board);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.6 });
      const frameGeo = new THREE.BoxGeometry(4, 3, 72);
      const topFrame = new THREE.Mesh(frameGeo, frameMat);
      topFrame.position.y = 25;
      group.add(topFrame);
      const bottomFrame = new THREE.Mesh(frameGeo, frameMat);
      bottomFrame.position.y = -25;
      group.add(bottomFrame);
      // Pinned papers
      const paperColors = [0xffffff, 0xffff88, 0x88ff88, 0xff88ff, 0x88ffff];
      for (let i = 0; i < 8; i++) {
        const paper = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 12, 10),
          new THREE.MeshStandardMaterial({ color: paperColors[Math.floor(Math.random() * paperColors.length)] })
        );
        paper.position.set(2, (Math.random() - 0.5) * 35, (Math.random() - 0.5) * 55);
        paper.rotation.x = (Math.random() - 0.5) * 0.2;
        group.add(paper);
        const pin = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 8, 8),
          new THREE.MeshStandardMaterial({ color: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00][Math.floor(Math.random() * 4)] })
        );
        pin.position.set(3, paper.position.y + 4, paper.position.z);
        group.add(pin);
      }
      return group;
    }
    
    function createCeilingLight() {
      const group = new THREE.Group();
      const fixtureMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(40, 4, 15), fixtureMat);
      group.add(fixture);
      const lightMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 0.5, roughness: 0.2
      });
      const lightPanel = new THREE.Mesh(new THREE.BoxGeometry(38, 1, 13), lightMat);
      lightPanel.position.y = -2;
      group.add(lightPanel);
      const pointLight = new THREE.PointLight(0xfffff0, 0.3, 150);
      pointLight.position.y = -5;
      group.add(pointLight);
      return group;
    }
    
    function createBackpack(color) {
      const group = new THREE.Group();
      const bagMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 6), bagMat);
      body.position.y = 7;
      group.add(body);
      const pocket = new THREE.Mesh(
        new THREE.BoxGeometry(8, 8, 2),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 })
      );
      pocket.position.set(0, 4, 4);
      group.add(pocket);
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
      [-3, 3].forEach(x => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 12, 1), strapMat);
        strap.position.set(x, 7, -3.5);
        group.add(strap);
      });
      const zipper = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5 })
      );
      zipper.position.set(0, 12, 3);
      group.add(zipper);
      return group;
    }
    
    function createClassroomDoor() {
      const group = new THREE.Group();
      // Door frame
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6 });
      // Left frame
      const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(4, 75, 6), frameMat);
      leftFrame.position.set(-17, 37.5, 0);
      group.add(leftFrame);
      // Right frame
      const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(4, 75, 6), frameMat);
      rightFrame.position.set(17, 37.5, 0);
      group.add(rightFrame);
      // Top frame
      const topFrame = new THREE.Mesh(new THREE.BoxGeometry(38, 4, 6), frameMat);
      topFrame.position.set(0, 77, 0);
      group.add(topFrame);
      // Door panel
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.7 });
      const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(30, 70, 3), doorMat);
      doorPanel.position.set(0, 35, 0);
      group.add(doorPanel);
      // Door window
      const glassMat = new THREE.MeshStandardMaterial({ 
        color: 0x87ceeb, transparent: true, opacity: 0.4, roughness: 0.1
      });
      const doorWindow = new THREE.Mesh(new THREE.BoxGeometry(20, 25, 1), glassMat);
      doorWindow.position.set(0, 50, 2);
      group.add(doorWindow);
      // Window frame grid
      const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 });
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 1.5), windowFrameMat);
      hBar.position.set(0, 50, 2.5);
      group.add(hBar);
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(1, 25, 1.5), windowFrameMat);
      vBar.position.set(0, 50, 2.5);
      group.add(vBar);
      // Door handle
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.7, roughness: 0.3 });
      const handlePlate = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 1), handleMat);
      handlePlate.position.set(11, 35, 2);
      group.add(handlePlate);
      const handleLever = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 1.5), handleMat);
      handleLever.position.set(11, 35, 3);
      group.add(handleLever);
      // "EXIT" sign above door
      const signMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3, roughness: 0.5 
      });
      const exitSign = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 1), signMat);
      exitSign.position.set(0, 88, 0);
      group.add(exitSign);
      return group;
    }
    
    // ==================== HELPER FUNCTIONS ====================
    
    function createSkyGradient(topColor, midColor, bottomColor, horizonGlow = false) {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      const gradient = ctx.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0, '#' + topColor.toString(16).padStart(6, '0'));
      gradient.addColorStop(0.4, '#' + midColor.toString(16).padStart(6, '0'));
      
      if (horizonGlow) {
        // Add warm horizon glow for more realistic look
        gradient.addColorStop(0.7, '#' + midColor.toString(16).padStart(6, '0'));
        gradient.addColorStop(0.85, '#' + bottomColor.toString(16).padStart(6, '0'));
        gradient.addColorStop(0.95, '#fffaf0'); // Warm horizon glow
        gradient.addColorStop(1, '#' + bottomColor.toString(16).padStart(6, '0'));
      } else {
        gradient.addColorStop(1, '#' + bottomColor.toString(16).padStart(6, '0'));
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 2, 512);
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.LinearFilter;
      return texture;
    }
    
    // Create shader-based sky with realistic horizon glow (for premium themes)
    function createShaderSky(topColor, horizonColor, glowColor) {
      const skyGeo = new THREE.SphereGeometry(900, 32, 32);
      const skyMat = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 glowColor;
          varying vec3 vWorldPosition;
          void main() {
            vec3 dir = normalize(vWorldPosition);
            float t = dir.y * 0.5 + 0.5; // 0 at bottom, 1 at top
            
            // Main sky gradient
            vec3 skyColor = mix(horizonColor, topColor, pow(t, 0.7));
            
            // Horizon glow effect
            float horizonFactor = pow(1.0 - abs(dir.y), 4.0);
            vec3 finalColor = mix(skyColor, glowColor, horizonFactor * 0.6);
            
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `,
        uniforms: {
          topColor: { value: new THREE.Color(topColor) },
          horizonColor: { value: new THREE.Color(horizonColor) },
          glowColor: { value: new THREE.Color(glowColor) }
        },
        side: THREE.BackSide
      });
      
      const sky = new THREE.Mesh(skyGeo, skyMat);
      return sky;
    }
    
    function updateGroundColor(color) {
      const baseColor = new THREE.Color(color);
      const hsl = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(hsl);
      // Keep a mid green. The old cap at lightness 0.32 turned the plate
      // near-black. Sands and snow (lightness above 0.55) stay as asked.
      const plateL = hsl.l > 0.55 ? hsl.l : Math.min(Math.max(hsl.l, 0.34), 0.44);
      const plateS = hsl.l > 0.55 ? hsl.s : Math.max(hsl.s, 0.42);
      const plate = new THREE.Color().setHSL(hsl.h, Math.min(0.62, plateS), plateL);

      // Studs a step lighter than the gaps so the grid reads. Not white.
      const studColor = plate.clone();
      studColor.offsetHSL(0, -0.06, 0.03);
      
      // Grid color is darker
      const gridColor = plate.clone();
      gridColor.offsetHSL(0, 0, -0.12);
      
      // Update grass plane (extends to horizon)
      if (window.grassPlane && window.grassPlane.material) {
        window.grassPlane.material.color.copy(plate);
      }
      
      // Update baseplate
      if (window.baseplateRef && window.baseplateRef.material) {
        window.baseplateRef.material.color.copy(plate);
      }
      // Update ground studs
      if (window.groundStudsRef && window.groundStudsRef.material) {
        window.groundStudsRef.material.color.copy(studColor);
      }
      
      // Update grid helper
      if (window.gridHelper && window.gridHelper.material) {
        window.gridHelper.material.color.copy(gridColor);
      }
    }
    
    function createSun(center, x, y, color, size) {
      const sunGeo = new THREE.SphereGeometry(20 * size, 32, 32);
      const sunMat = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.95
      });
      const sun = new THREE.Mesh(sunGeo, sunMat);
      sun.position.set(center + x, y, center - 400);
      scene.add(sun);
      window.sceneryObjects.sun = sun;
      
      // Sun glow
      const glowGeo = new THREE.SphereGeometry(35 * size, 32, 32);
      const glowMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(sun.position);
      scene.add(glow);
      window.sceneryObjects.extras.push(glow);
      
      // Light rays
      const rayGeo = new THREE.SphereGeometry(60 * size, 32, 32);
      const rayMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.1
      });
      const rays = new THREE.Mesh(rayGeo, rayMat);
      rays.position.copy(sun.position);
      scene.add(rays);
      window.sceneryObjects.extras.push(rays);
    }
    
    function createMoon(center, x, y) {
      // Large bright moon
      const moonGeo = new THREE.SphereGeometry(35, 32, 32);
      const moonMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
      const moon = new THREE.Mesh(moonGeo, moonMat);
      moon.position.set(center + x, y, center - 400);
      scene.add(moon);
      window.sceneryObjects.moon = moon;
      
      // Moon glow - larger and brighter
      const glowGeo = new THREE.SphereGeometry(60, 32, 32);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x8888ff,
        transparent: true,
        opacity: 0.25
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(moon.position);
      scene.add(glow);
      window.sceneryObjects.extras.push(glow);
      
      // Outer glow
      const outerGlowGeo = new THREE.SphereGeometry(90, 32, 32);
      const outerGlowMat = new THREE.MeshBasicMaterial({
        color: 0x6666aa,
        transparent: true,
        opacity: 0.1
      });
      const outerGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat);
      outerGlow.position.copy(moon.position);
      scene.add(outerGlow);
      window.sceneryObjects.extras.push(outerGlow);
    }
    
    function createEarth(center, x, y) {
      const earthGeo = new THREE.SphereGeometry(50, 32, 32);
      
      // Create Earth texture procedurally
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      
      // Ocean base
      ctx.fillStyle = '#1a4a8a';
      ctx.fillRect(0, 0, 256, 128);
      
      // Continents (simplified)
      ctx.fillStyle = '#2a6a2a';
      // Americas
      ctx.beginPath();
      ctx.ellipse(60, 50, 25, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      // Europe/Africa
      ctx.beginPath();
      ctx.ellipse(140, 55, 20, 45, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Asia
      ctx.beginPath();
      ctx.ellipse(200, 40, 35, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * 256, Math.random() * 128, 15 + Math.random() * 20, 8, Math.random(), 0, Math.PI * 2);
        ctx.fill();
      }
      
      const earthTexture = new THREE.CanvasTexture(canvas);
      const earthMat = new THREE.MeshBasicMaterial({ map: earthTexture });
      const earth = new THREE.Mesh(earthGeo, earthMat);
      earth.position.set(center + x, y, center - 500);
      scene.add(earth);
      window.sceneryObjects.extras.push(earth);
      
      // Atmosphere glow
      const atmosGeo = new THREE.SphereGeometry(55, 32, 32);
      const atmosMat = new THREE.MeshBasicMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
      });
      const atmos = new THREE.Mesh(atmosGeo, atmosMat);
      atmos.position.copy(earth.position);
      scene.add(atmos);
      window.sceneryObjects.extras.push(atmos);
    }
    
    function createStarfield(center, count) {
      const starGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 500 + Math.random() * 200;
        
        positions[i * 3] = center + r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 50; // Keep above horizon
        positions[i * 3 + 2] = center + r * Math.sin(phi) * Math.sin(theta);
        sizes[i] = 0.5 + Math.random() * 2;
      }
      
      starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      
      const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9
      });
      
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);
      window.sceneryObjects.extras.push(stars);
    }
    
    function createNebula(center) {
      // Colorful nebula clouds
      const nebulaColors = [0xff4488, 0x4488ff, 0x88ff44];
      
      nebulaColors.forEach((color, i) => {
        const nebulaGeo = new THREE.SphereGeometry(100 + i * 30, 16, 16);
        const nebulaMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide
        });
        const nebula = new THREE.Mesh(nebulaGeo, nebulaMat);
        nebula.position.set(
          center - 300 + i * 100,
          200 + i * 50,
          center - 600
        );
        nebula.scale.set(2, 1, 1);
        scene.add(nebula);
        window.sceneryObjects.extras.push(nebula);
      });
    }
    
    function createMountainRange(center, layers) {
      layers.forEach(layer => {
        for (let i = 0; i < layer.count; i++) {
          const layerRef = layer;
          const index = i;
          queueScenery(() => {
          const angle = (index / layerRef.count) * Math.PI + Math.PI * 0.5 + (Math.random() - 0.5) * 0.3;
          const dist = layerRef.distance + (Math.random() - 0.5) * 50;
          
          let mountain;
          if (layerRef.style === 'mesa') {
            mountain = createMesa(layerRef.height * (0.7 + Math.random() * 0.6), layerRef.color);
          } else if (layerRef.style === 'island') {
            mountain = createIsland(layerRef.height * (0.8 + Math.random() * 0.4), layerRef.color);
          } else if (layerRef.style === 'crater') {
            mountain = createCrater(layerRef.height * (0.8 + Math.random() * 0.4), layerRef.color);
          } else {
            mountain = createMountain(layerRef.height * (0.7 + Math.random() * 0.6), layerRef.color, layerRef.snow);
          }
          
          mountain.position.set(
            center + Math.cos(angle) * dist,
            0,
            center + Math.sin(angle) * dist - 200
          );
          
          if (layerRef.opacity < 1) {
            mountain.traverse(obj => {
              if (obj.isMesh) {
                obj.material.transparent = true;
                obj.material.opacity = layerRef.opacity;
              }
            });
          }
          
          scene.add(mountain);
          window.sceneryObjects.mountains.push(mountain);
          });
        }
      });
    }
    
    function createMountain(height, color, hasSnow = false) {
      const group = new THREE.Group();
      
      // Main peak
      const peakGeo = new THREE.ConeGeometry(height * 0.8, height, 8);
      const peakMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9, flatShading: true });
      const peak = new THREE.Mesh(peakGeo, peakMat);
      peak.position.y = height / 2;
      peak.rotation.y = Math.random() * Math.PI;
      group.add(peak);
      
      // Snow cap
      if (hasSnow) {
        const snowGeo = new THREE.ConeGeometry(height * 0.3, height * 0.3, 8);
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
        const snow = new THREE.Mesh(snowGeo, snowMat);
        snow.position.y = height * 0.85;
        group.add(snow);
      }
      
      // Secondary peaks
      for (let i = 0; i < 2; i++) {
        const subHeight = height * (0.4 + Math.random() * 0.3);
        const subGeo = new THREE.ConeGeometry(subHeight * 0.7, subHeight, 6);
        const sub = new THREE.Mesh(subGeo, peakMat);
        sub.position.set(
          (Math.random() - 0.5) * height * 0.8,
          subHeight / 2,
          (Math.random() - 0.5) * height * 0.5
        );
        group.add(sub);
      }
      
      return group;
    }
    
    function createMesa(height, color) {
      const group = new THREE.Group();
      
      // Flat-topped mesa
      const baseGeo = new THREE.CylinderGeometry(height * 0.6, height * 0.8, height, 8);
      const baseMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.95, flatShading: true });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = height / 2;
      group.add(base);
      
      // Eroded layers
      for (let i = 0; i < 3; i++) {
        const layerH = height * 0.15;
        const layerGeo = new THREE.CylinderGeometry(
          height * (0.5 - i * 0.05),
          height * (0.55 - i * 0.05),
          layerH, 8
        );
        const layer = new THREE.Mesh(layerGeo, baseMat);
        layer.position.y = height * 0.3 + i * layerH;
        group.add(layer);
      }
      
      return group;
    }
    
    function createIsland(height, color) {
      const group = new THREE.Group();
      
      // Island base
      const baseGeo = new THREE.SphereGeometry(height, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      const baseMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.scale.set(2, 0.5, 1.5);
      group.add(base);
      
      // Palm tree on island
      const trunkGeo = new THREE.CylinderGeometry(1, 1.5, 20, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 10;
      group.add(trunk);
      
      // Palm fronds
      const frondMat = new THREE.MeshStandardMaterial({ color: 0x228b22, side: THREE.DoubleSide });
      for (let i = 0; i < 6; i++) {
        const frondGeo = new THREE.PlaneGeometry(15, 4);
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.set(0, 22, 0);
        frond.rotation.y = (i / 6) * Math.PI * 2;
        frond.rotation.x = -0.5;
        group.add(frond);
      }
      
      return group;
    }
    
    function createCrater(size, color) {
      const group = new THREE.Group();
      
      // Crater rim
      const rimGeo = new THREE.TorusGeometry(size, size * 0.3, 8, 16);
      const rimMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.95, flatShading: true });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = size * 0.2;
      group.add(rim);
      
      // Crater floor (dark)
      const floorGeo = new THREE.CircleGeometry(size * 0.8, 16);
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.1;
      group.add(floor);
      
      return group;
    }
    
    function createForest(center, configs) {
      configs.forEach(config => {
        for (let i = 0; i < config.count; i++) {
          const spec = config;
          queueScenery(() => {
            let angle, dist;
            if (spec.beachSide) {
              angle = Math.random() * Math.PI - Math.PI / 2;
              dist = spec.minDist + Math.random() * (spec.maxDist - spec.minDist);
            } else {
              angle = Math.random() * Math.PI * 2;
              dist = spec.minDist + Math.random() * (spec.maxDist - spec.minDist);
            }
            const scale = spec.minScale + Math.random() * (spec.maxScale - spec.minScale);
            const tree = createTree(spec.type, scale);
            tree.position.set(
              center + Math.cos(angle) * dist,
              0,
              center + Math.sin(angle) * dist
            );
            tree.rotation.y = Math.random() * Math.PI * 2;
            scene.add(tree);
            window.sceneryObjects.trees.push(tree);
          });
        }
      });
    }
    
    function createTree(type, scale) {
      const group = new THREE.Group();
      
      switch(type) {
        case 'pine':
        case 'snowPine': {
          const isSnowy = type === 'snowPine';
          // Trunk
          const trunkGeo = new THREE.CylinderGeometry(0.8, 1.2, 10, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 5;
          group.add(trunk);
          
          // Foliage layers
          const foliageColor = isSnowy ? 0x2a4a3a : 0x2e5a1c;
          for (let i = 0; i < 4; i++) {
            const layerGeo = new THREE.ConeGeometry(6 - i * 1.2, 8 - i, 8);
            const layerMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.8 });
            const layer = new THREE.Mesh(layerGeo, layerMat);
            layer.position.y = 10 + i * 4;
            group.add(layer);
            
            // Snow on branches
            if (isSnowy) {
              const snowGeo = new THREE.ConeGeometry(5.5 - i * 1.1, 2, 8);
              const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
              const snow = new THREE.Mesh(snowGeo, snowMat);
              snow.position.y = 11 + i * 4;
              group.add(snow);
            }
          }
          break;
        }
        
        case 'oak':
        case 'oakSilhouette': {
          const isSilhouette = type === 'oakSilhouette';
          const color = isSilhouette ? 0x1a1008 : 0x228b22;
          
          // Trunk
          const trunkGeo = new THREE.CylinderGeometry(1.5, 2, 12, 8);
          const trunkMat = new THREE.MeshStandardMaterial({ color: isSilhouette ? 0x1a1008 : 0x5d4037 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 6;
          group.add(trunk);
          
          // Round canopy
          const canopyGeo = new THREE.SphereGeometry(10, 8, 8);
          const canopyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
          const canopy = new THREE.Mesh(canopyGeo, canopyMat);
          canopy.position.y = 18;
          canopy.scale.set(1, 0.8, 1);
          group.add(canopy);
          break;
        }
        
        case 'birch': {
          // White trunk with marks
          const trunkGeo = new THREE.CylinderGeometry(0.6, 0.8, 15, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.7 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 7.5;
          group.add(trunk);
          
          // Light foliage
          const canopyGeo = new THREE.SphereGeometry(6, 8, 8);
          const canopyMat = new THREE.MeshStandardMaterial({ color: 0x90EE90, roughness: 0.8 });
          const canopy = new THREE.Mesh(canopyGeo, canopyMat);
          canopy.position.y = 17;
          canopy.scale.set(1, 1.2, 1);
          group.add(canopy);
          break;
        }
        
        case 'palm': {
          // Curved trunk
          const trunkGeo = new THREE.CylinderGeometry(1, 1.5, 18, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 9;
          trunk.rotation.z = 0.1;
          group.add(trunk);
          
          // Palm fronds
          const frondMat = new THREE.MeshStandardMaterial({ color: 0x228b22, side: THREE.DoubleSide });
          for (let i = 0; i < 8; i++) {
            const frondGeo = new THREE.PlaneGeometry(12, 3);
            const frond = new THREE.Mesh(frondGeo, frondMat);
            frond.position.set(0, 19, 0);
            frond.rotation.y = (i / 8) * Math.PI * 2;
            frond.rotation.x = -0.6 + Math.random() * 0.2;
            group.add(frond);
          }
          
          // Coconuts
          const cocoGeo = new THREE.SphereGeometry(0.8, 8, 8);
          const cocoMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
          for (let i = 0; i < 3; i++) {
            const coco = new THREE.Mesh(cocoGeo, cocoMat);
            coco.position.set(Math.cos(i * 2) * 1.5, 17, Math.sin(i * 2) * 1.5);
            group.add(coco);
          }
          break;
        }
        
        case 'spruce': {
          // Trunk
          const trunkGeo = new THREE.CylinderGeometry(0.6, 1, 8, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 4;
          group.add(trunk);
          
          // Narrow conical shape
          const foliageGeo = new THREE.ConeGeometry(4, 20, 8);
          const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.85 });
          const foliage = new THREE.Mesh(foliageGeo, foliageMat);
          foliage.position.y = 15;
          group.add(foliage);
          break;
        }
        
        case 'deadTree': {
          // Bare trunk
          const trunkGeo = new THREE.CylinderGeometry(0.8, 1.2, 12, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.95 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 6;
          group.add(trunk);
          
          // Bare branches
          for (let i = 0; i < 4; i++) {
            const branchGeo = new THREE.CylinderGeometry(0.2, 0.4, 6, 4);
            const branch = new THREE.Mesh(branchGeo, trunkMat);
            branch.position.set(0, 8 + i * 2, 0);
            branch.rotation.z = 0.5 + Math.random() * 0.5;
            branch.rotation.y = i * Math.PI / 2;
            group.add(branch);
          }
          break;
        }
        
        case 'pineSilhouette': {
          // Dark silhouette
          const trunkGeo = new THREE.CylinderGeometry(0.8, 1.2, 10, 6);
          const darkMat = new THREE.MeshBasicMaterial({ color: 0x0a0a15 });
          const trunk = new THREE.Mesh(trunkGeo, darkMat);
          trunk.position.y = 5;
          group.add(trunk);
          
          for (let i = 0; i < 4; i++) {
            const layerGeo = new THREE.ConeGeometry(6 - i * 1.2, 8 - i, 8);
            const layer = new THREE.Mesh(layerGeo, darkMat);
            layer.position.y = 10 + i * 4;
            group.add(layer);
          }
          break;
        }
        
        default:
          break;
      }
      
      group.scale.setScalar(scale);
      return group;
    }
    
    function createDesertVegetation(center, configs) {
      configs.forEach(config => {
        for (let i = 0; i < config.count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = config.minDist + Math.random() * (config.maxDist - config.minDist);
          const cactus = createCactus(config.type);
          
          cactus.position.set(
            center + Math.cos(angle) * dist,
            0,
            center + Math.sin(angle) * dist
          );
          cactus.rotation.y = Math.random() * Math.PI * 2;
          
          scene.add(cactus);
          window.sceneryObjects.trees.push(cactus);
        }
      });
    }
    
    function createCactus(type) {
      const group = new THREE.Group();
      const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });
      
      switch(type) {
        case 'saguaro': {
          // Main trunk
          const trunkGeo = new THREE.CylinderGeometry(2, 2.5, 25, 8);
          const trunk = new THREE.Mesh(trunkGeo, cactusMat);
          trunk.position.y = 12.5;
          group.add(trunk);
          
          // Arms
          for (let i = 0; i < 2; i++) {
            const armGeo = new THREE.CylinderGeometry(1.2, 1.5, 12, 6);
            const arm = new THREE.Mesh(armGeo, cactusMat);
            arm.position.set(i === 0 ? -3 : 3, 15, 0);
            arm.rotation.z = i === 0 ? 0.5 : -0.5;
            group.add(arm);
            
            // Upward part
            const upGeo = new THREE.CylinderGeometry(1, 1.2, 8, 6);
            const up = new THREE.Mesh(upGeo, cactusMat);
            up.position.set(i === 0 ? -5 : 5, 20, 0);
            group.add(up);
          }
          break;
        }
        
        case 'barrel': {
          const barrelGeo = new THREE.SphereGeometry(3, 12, 8);
          const barrel = new THREE.Mesh(barrelGeo, cactusMat);
          barrel.position.y = 2.5;
          barrel.scale.set(1, 0.8, 1);
          group.add(barrel);
          
          // Flower on top
          const flowerGeo = new THREE.ConeGeometry(1, 1.5, 6);
          const flowerMat = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
          const flower = new THREE.Mesh(flowerGeo, flowerMat);
          flower.position.y = 4.5;
          flower.rotation.x = Math.PI;
          group.add(flower);
          break;
        }
        
        case 'joshua': {
          // Trunk
          const trunkGeo = new THREE.CylinderGeometry(1.5, 2, 15, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 0.95 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 7.5;
          group.add(trunk);
          
          // Spiky top clusters
          const spikeMat = new THREE.MeshStandardMaterial({ color: 0x556b2f });
          for (let i = 0; i < 5; i++) {
            const spikeGeo = new THREE.ConeGeometry(3, 5, 8);
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.position.set(
              (Math.random() - 0.5) * 6,
              15 + Math.random() * 3,
              (Math.random() - 0.5) * 6
            );
            spike.rotation.x = (Math.random() - 0.5) * 0.5;
            spike.rotation.z = (Math.random() - 0.5) * 0.5;
            group.add(spike);
          }
          break;
        }
      }
      
      return group;
    }
    
    function createSandDunes(center, count, minDist, maxDist) {
      const duneMat = new THREE.MeshStandardMaterial({ color: 0xe0c8a8, roughness: 0.95 });
      
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = minDist + Math.random() * (maxDist - minDist);
        
        const duneGeo = new THREE.SphereGeometry(30 + Math.random() * 40, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const dune = new THREE.Mesh(duneGeo, duneMat);
        dune.position.set(
          center + Math.cos(angle) * dist,
          -5,
          center + Math.sin(angle) * dist
        );
        dune.scale.set(2 + Math.random(), 0.3, 1 + Math.random() * 0.5);
        dune.rotation.y = angle;
        
        scene.add(dune);
        window.sceneryObjects.extras.push(dune);
      }
    }
    
    function createOcean(center, baseplateSize) {
      const minDist = 150; // Ocean starts far from workspace
      
      const oceanGeo = new THREE.PlaneGeometry(2000, 1000);
      const oceanMat = new THREE.MeshStandardMaterial({
        color: 0x006994,
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.9
      });
      const ocean = new THREE.Mesh(oceanGeo, oceanMat);
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.set(center, -0.5, center + 600); // Far away
      scene.add(ocean);
      window.sceneryObjects.water = ocean;
      
      // Waves (simple animated rings) - positioned at water edge, far from workspace
      const waveGroup = new THREE.Group();
      const waveMat = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.4
      });
      
      for (let i = 0; i < 8; i++) {
        const waveGeo = new THREE.TorusGeometry(15 + i * 12, 0.8, 8, 32, Math.PI);
        const wave = new THREE.Mesh(waveGeo, waveMat);
        wave.rotation.x = Math.PI / 2;
        wave.rotation.z = Math.PI;
        // Position waves at the beach edge, far from workspace
        wave.position.set(center + (Math.random() - 0.5) * 150, 0.1, center + minDist + 30 + i * 25);
        waveGroup.add(wave);
      }
      scene.add(waveGroup);
      window.sceneryObjects.extras.push(waveGroup);
    }
    
    // Island ocean - surrounds the island on all sides
    function createIslandOcean(center, baseplateSize) {
      // Large ocean plane surrounding the island
      const oceanGeo = new THREE.PlaneGeometry(3000, 3000);
      const oceanMat = new THREE.MeshStandardMaterial({
        color: 0x0077aa,
        roughness: 0.1,
        metalness: 0.4,
        transparent: true,
        opacity: 0.92
      });
      const ocean = new THREE.Mesh(oceanGeo, oceanMat);
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.set(center, -0.3, center); // Centered, slightly below ground
      scene.add(ocean);
      window.sceneryObjects.water = ocean;
      
      // Beach/shore ring around the island (sand meets water)
      const shoreGeo = new THREE.RingGeometry(55, 90, 32);
      const shoreMat = new THREE.MeshStandardMaterial({
        color: 0x66ccff,
        roughness: 0.2,
        metalness: 0.3,
        transparent: true,
        opacity: 0.6
      });
      const shore = new THREE.Mesh(shoreGeo, shoreMat);
      shore.rotation.x = -Math.PI / 2;
      shore.position.set(center, -0.1, center);
      scene.add(shore);
      window.sceneryObjects.extras.push(shore);
      
      // Gentle waves around the island
      const waveGroup = new THREE.Group();
      const waveMat = new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        transparent: true,
        opacity: 0.5
      });
      
      // Create wave rings at different distances
      for (let ring = 0; ring < 3; ring++) {
        const radius = 70 + ring * 30;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + ring * 0.3;
          const waveGeo = new THREE.TorusGeometry(8, 1, 6, 16, Math.PI * 0.6);
          const wave = new THREE.Mesh(waveGeo, waveMat.clone());
          wave.rotation.x = Math.PI / 2;
          wave.rotation.z = angle + Math.PI / 2;
          wave.position.set(
            center + Math.cos(angle) * radius,
            0.05,
            center + Math.sin(angle) * radius
          );
          waveGroup.add(wave);
        }
      }
      scene.add(waveGroup);
      window.sceneryObjects.extras.push(waveGroup);
    }
    
    function createFrozenLake(center, x, z) {
      const lakeGeo = new THREE.CircleGeometry(60, 32);
      const lakeMat = new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        roughness: 0.05,
        metalness: 0.8,
        transparent: true,
        opacity: 0.9
      });
      const lake = new THREE.Mesh(lakeGeo, lakeMat);
      lake.rotation.x = -Math.PI / 2;
      lake.position.set(center + x, 0.1, center + z);
      scene.add(lake);
      window.sceneryObjects.water = lake;
      
      // Ice cracks
      const crackMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      for (let i = 0; i < 8; i++) {
        const points = [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40)
        ];
        const crackGeo = new THREE.BufferGeometry().setFromPoints(points);
        const crack = new THREE.Line(crackGeo, crackMat);
        crack.position.set(center + x, 0.15, center + z);
        scene.add(crack);
        window.sceneryObjects.extras.push(crack);
      }
    }
    
    function createMountainLake(center, x, z) {
      const lakeGeo = new THREE.CircleGeometry(50, 32);
      const lakeMat = new THREE.MeshStandardMaterial({
        color: 0x4488aa,
        roughness: 0.1,
        metalness: 0.5,
        transparent: true,
        opacity: 0.85
      });
      const lake = new THREE.Mesh(lakeGeo, lakeMat);
      lake.rotation.x = -Math.PI / 2;
      lake.position.set(center + x, 0.05, center + z);
      scene.add(lake);
      window.sceneryObjects.water = lake;
    }
    
    function createClouds(center, count, minHeight, maxHeight, color, opacity) {
      for (let i = 0; i < count; i++) {
        queueScenery(() => {
        const cloudMat = new THREE.MeshStandardMaterial({
          color: color,
          transparent: true,
          opacity: opacity,
          roughness: 1
        });
        const cloudGroup = new THREE.Group();
        const numPuffs = 3 + Math.floor(Math.random() * 4);
        
        for (let j = 0; j < numPuffs; j++) {
          const puffGeo = new THREE.SphereGeometry(15 + Math.random() * 20, 8, 8);
          const puff = new THREE.Mesh(puffGeo, cloudMat);
          puff.position.set(j * 20 - numPuffs * 10, Math.random() * 10, Math.random() * 10);
          puff.scale.set(1, 0.6, 1);
          cloudGroup.add(puff);
        }
        
        cloudGroup.position.set(
          center + (Math.random() - 0.5) * 600,
          minHeight + Math.random() * (maxHeight - minHeight),
          center + (Math.random() - 0.5) * 600
        );
        
        scene.add(cloudGroup);
        window.sceneryObjects.clouds.push(cloudGroup);
        });
      }
    }
    
    function createGroundDetails(center, theme) {
      const details = [];
      const baseplateSize = window.baseplateSize || 76.8;
      // Buffer zone - items must be at least this far from baseplate edge
      const bufferZone = 20;
      const minDistFromCenter = (baseplateSize / 2) + bufferZone; // ~58 units from center
      
      // Helper to get position outside workspace
      function getOutsidePosition(minDist, maxDist) {
        const angle = Math.random() * Math.PI * 2;
        const dist = minDist + Math.random() * (maxDist - minDist);
        return {
          x: center + Math.cos(angle) * dist,
          z: center + Math.sin(angle) * dist
        };
      }
      
      if (theme === 'forest') {
        // One rock or bush per turn. Building all 45 in the pump was a
        // single task over the simulated 50ms line.
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.9 });
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });
        for (let i = 0; i < 25; i++) {
          queueScenery(() => {
            const pos = getOutsidePosition(minDistFromCenter, minDistFromCenter + 80);
            const rockGeo = new THREE.DodecahedronGeometry(1 + Math.random() * 2, 0);
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(pos.x, 0.5, pos.z);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            scene.add(rock);
            window.sceneryObjects.extras.push(rock);
          });
        }
        for (let i = 0; i < 20; i++) {
          queueScenery(() => {
            const pos = getOutsidePosition(minDistFromCenter, minDistFromCenter + 100);
            const bushGeo = new THREE.SphereGeometry(2 + Math.random() * 2, 8, 8);
            const bush = new THREE.Mesh(bushGeo, bushMat);
            bush.position.set(pos.x, 1, pos.z);
            bush.scale.y = 0.7;
            scene.add(bush);
            window.sceneryObjects.extras.push(bush);
          });
        }
        return;
      }
      
      if (theme === 'beach') {
        // Shells - on beach area (one side only, away from building)
        const shellMat = new THREE.MeshStandardMaterial({ color: 0xffeedd, roughness: 0.6 });
        for (let i = 0; i < 30; i++) {
          // Place shells on the beach side (positive Z, toward water)
          const angle = Math.random() * Math.PI * 0.8 + Math.PI * 0.1; // Front arc only
          const dist = minDistFromCenter + Math.random() * 60;
          const shellGeo = new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 6, 4, 0, Math.PI);
          const shell = new THREE.Mesh(shellGeo, shellMat);
          shell.position.set(
            center + Math.cos(angle) * dist,
            0.1,
            center + Math.sin(angle) * dist
          );
          shell.rotation.x = -Math.PI / 2;
          shell.rotation.z = Math.random() * Math.PI * 2;
          scene.add(shell);
          details.push(shell);
        }
        
        // Driftwood - on beach perimeter
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.95 });
        for (let i = 0; i < 8; i++) {
          const pos = getOutsidePosition(minDistFromCenter, minDistFromCenter + 50);
          const woodGeo = new THREE.CylinderGeometry(0.5, 0.3, 8 + Math.random() * 5, 6);
          const wood = new THREE.Mesh(woodGeo, woodMat);
          wood.position.set(pos.x, 0.3, pos.z);
          wood.rotation.z = Math.PI / 2;
          wood.rotation.y = Math.random() * Math.PI;
          scene.add(wood);
          details.push(wood);
        }
      }
      
      if (theme === 'alpine') {
        // Wildflowers - around the perimeter meadow
        const flowerColors = [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xc77dff];
        for (let i = 0; i < 60; i++) {
          const pos = getOutsidePosition(minDistFromCenter, minDistFromCenter + 80);
          const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
          const flowerGeo = new THREE.SphereGeometry(0.3, 6, 6);
          const flowerMat = new THREE.MeshStandardMaterial({ color: color });
          const flower = new THREE.Mesh(flowerGeo, flowerMat);
          flower.position.set(pos.x, 0.5, pos.z);
          scene.add(flower);
          details.push(flower);
        }
      }
      
      if (theme === 'night') {
        // Glowing mushrooms - around the dark forest perimeter
        const glowColors = [0x00ff88, 0x00ffff, 0xff00ff];
        for (let i = 0; i < 25; i++) {
          const pos = getOutsidePosition(minDistFromCenter, minDistFromCenter + 100);
          const color = glowColors[Math.floor(Math.random() * glowColors.length)];
          const mushGroup = new THREE.Group();
          
          // Stem
          const stemGeo = new THREE.CylinderGeometry(0.2, 0.3, 1, 6);
          const stemMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
          const stem = new THREE.Mesh(stemGeo, stemMat);
          stem.position.y = 0.5;
          mushGroup.add(stem);
          
          // Glowing cap
          const capGeo = new THREE.SphereGeometry(0.6, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
          const capMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 });
          const cap = new THREE.Mesh(capGeo, capMat);
          cap.position.y = 1;
          cap.rotation.x = Math.PI;
          mushGroup.add(cap);
          
          mushGroup.position.set(pos.x, 0, pos.z);
          mushGroup.scale.setScalar(0.5 + Math.random() * 0.5);
          
          scene.add(mushGroup);
          details.push(mushGroup);
        }
      }
      
      window.sceneryObjects.extras.push(...details);
    }
    
    function createAmbientParticles(center, type, count, color, opacity) {
      const particleGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const velocities = [];
      
      for (let i = 0; i < count; i++) {
        positions[i * 3] = center + (Math.random() - 0.5) * 300;
        positions[i * 3 + 1] = Math.random() * 100;
        positions[i * 3 + 2] = center + (Math.random() - 0.5) * 300;
        
        velocities.push({
          x: (Math.random() - 0.5) * 0.1,
          y: type === 'snow' ? -0.2 - Math.random() * 0.3 : (Math.random() - 0.5) * 0.05,
          z: (Math.random() - 0.5) * 0.1
        });
      }
      
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      let size = 1;
      if (type === 'snow') size = 1.5;
      if (type === 'fireflies') size = 2;
      if (type === 'birds') size = 3;
      
      const particleMat = new THREE.PointsMaterial({
        color: color,
        size: size,
        transparent: true,
        opacity: opacity,
        sizeAttenuation: true
      });
      
      const particles = new THREE.Points(particleGeo, particleMat);
      particles.userData.velocities = velocities;
      particles.userData.type = type;
      particles.userData.center = center;
      
      scene.add(particles);
      window.sceneryObjects.particles = particles;
    }
    
    function updateLighting(sunColor, sunIntensity, ambientColor, ambientIntensity) {
      // Find and update directional light
      scene.traverse(obj => {
        if (obj.isDirectionalLight) {
          obj.color.setHex(sunColor);
          obj.intensity = sunIntensity;
        }
        if (obj.isAmbientLight) {
          obj.color.setHex(ambientColor);
          obj.intensity = ambientIntensity;
        }
      });
    }
    
    // Animation for particles (throttled)
    let _particleFrame = 0;
    function animateParticles() {
      if (!window.sceneryObjects || !window.sceneryObjects.particles) return;
      
      // Throttle to every other frame
      _particleFrame++;
      if (_particleFrame < 2) return;
      _particleFrame = 0;
      
      const particles = window.sceneryObjects.particles;
      const positions = particles.geometry.attributes.position.array;
      const velocities = particles.userData.velocities;
      const type = particles.userData.type;
      const center = particles.userData.center;
      const count = velocities.length;
      
      if (type === 'birds') {
        const now = Date.now() * 0.0001;
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const angle = now + i;
          const radius = 100 + i * 10;
          positions[i3] = center + Math.cos(angle) * radius;
          positions[i3 + 1] = 50 + Math.sin(angle * 2) * 10;
          positions[i3 + 2] = center + Math.sin(angle) * radius;
        }
      } else if (type === 'snow') {
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const vel = velocities[i];
          positions[i3] += vel.x;
          positions[i3 + 1] += vel.y;
          positions[i3 + 2] += vel.z;
          
          if (positions[i3 + 1] < 0) {
            positions[i3 + 1] = 100;
            positions[i3] = center + (Math.random() - 0.5) * 300;
            positions[i3 + 2] = center + (Math.random() - 0.5) * 300;
          }
        }
      } else if (type === 'fireflies') {
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const vel = velocities[i];
          
          positions[i3] += vel.x;
          positions[i3 + 1] += vel.y;
          positions[i3 + 2] += vel.z;
          
          // Gentle floating motion
          vel.x += (Math.random() - 0.5) * 0.02;
          vel.y += (Math.random() - 0.5) * 0.02;
          vel.z += (Math.random() - 0.5) * 0.02;
          // Clamp velocities
          vel.x = Math.max(-0.1, Math.min(0.1, vel.x));
          vel.y = Math.max(-0.05, Math.min(0.05, vel.y));
          vel.z = Math.max(-0.1, Math.min(0.1, vel.z));
          
          // Keep in bounds
          if (positions[i3 + 1] < 1) positions[i3 + 1] = 1;
          if (positions[i3 + 1] > 20) positions[i3 + 1] = 20;
        }
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Add to animation loop
    window.animateParticles = animateParticles;
    
    // Simplified ground update - no more dynamic stud regeneration
    function updateGroundStuds() {
      // No-op - studs are now static on the baseplate
    }
    
    // Throttled ground update - now just a stub
    let lastGroundUpdate = 0;
    let lastCameraPos = new THREE.Vector3();
    function maybeUpdateGround() {
      // No longer needed for studs - they're static
      // Could be used for LOD or other dynamic elements later
    }
    
    // ==================== INSTANCED RENDERING SYSTEM ====================
    // For massive performance gains with many bricks
    
    const instancedSystem = {
      // Map: "type_rot_color_transparent" -> { mesh: InstancedMesh, instances: Map<brickId, index>, count: number }
      meshes: new Map(),
      // Map: brickId -> { key, mesh } for fast lookup during deletion
      brickLookup: new Map(),
      // Geometry cache: "type_rot" -> BufferGeometry
      geometryCache: new Map(),
      // Material cache: "color_transparent" -> MeshStandardMaterial
      materialCache: new Map(),
      // Unique ID counter
      nextId: 1,
      // Max instances per mesh (will grow if needed)
      maxInstances: 1000,
      // Dummy object for matrix calculations
      dummy: new THREE.Object3D()
    };
    instancedReady = true;
    
    // Top cap only. The underside sits inside the brick and never shows.
    function makeStudGeometry(segments) {
      const segs = segments || STUD_SEG_FAR;
      const side = new THREE.CylinderGeometry(STUD_R, STUD_R * 0.95, STUD_H, segs, 1, true);
      const cap = new THREE.CircleGeometry(STUD_R, segs);
      cap.rotateX(-Math.PI / 2);
      cap.translate(0, STUD_H / 2, 0);
      const merged = mergeBufferGeometries([side, cap]);
      side.dispose();
      cap.dispose();
      return merged;
    }

    function studSegmentsAt(pos) {
      if (!camera || !pos) return STUD_SEG_NEAR;
      const dx = camera.position.x - pos.x;
      const dy = camera.position.y - pos.y;
      const dz = camera.position.z - pos.z;
      return (dx * dx + dy * dy + dz * dz) <= STUD_NEAR_DIST * STUD_NEAR_DIST ? STUD_SEG_NEAR : STUD_SEG_FAR;
    }

    // Swatch hex is sRGB. Three stores instance colors in linear from that hex.
    // Do not rewrite yellow in linear RGB; that was the mustard cast.
    function brickDisplayColor(color) {
      return new THREE.Color(color);
    }

    // Create merged geometry for a brick type (body + studs combined)
    function createBrickGeometry(type, rot, segments) {
      const studSeg = segments || STUD_SEG_NEAR;
      const t = types[type];
      if (!t) return null;
      
      const isRotated = (rot === 90 || rot === 270);
      const w = isRotated ? t.d : t.w;
      const d = isRotated ? t.w : t.d;
      const width = w * STUD;
      const depth = d * STUD;
      const h = t.h === 'b' ? BRICK_H : PLATE_H;
      
      const geometries = [];
      
      if (t.slope) {
        const slopeGeo = createSlopeGeometry(t.w * STUD, t.d * STUD, h, rot);
        slopeGeo.translate(0, h / 2, 0);
        geometries.push(slopeGeo);
      } else if (t.cornerSlope || t.invCornerSlope) {
        const cornerGeo = createCornerSlopeGeometry(t.w * STUD, t.d * STUD, h, rot, !!t.invCornerSlope);
        cornerGeo.translate(0, h / 2, 0);
        geometries.push(cornerGeo);
      } else if (t.round) {
        const r = Math.min(width, depth) / 2 - 0.02;
        const bodyGeo = new THREE.CylinderGeometry(r, r, h, 16);
        bodyGeo.translate(0, h / 2, 0);
        geometries.push(bodyGeo);
      } else {
        const bodyGeo = new THREE.BoxGeometry(width - 0.02, h, depth - 0.02);
        bodyGeo.translate(0, h / 2, 0);
        geometries.push(bodyGeo);
      }
      
      // Stud geometries
      if (!t.noStuds && !t.slope && !t.cornerSlope && !t.invCornerSlope) {
        const studGeo = makeStudGeometry(studSeg);
        
        for (let sx = 0; sx < w; sx++) {
          for (let sz = 0; sz < d; sz++) {
            const px = (sx - (w - 1) / 2) * STUD;
            const pz = (sz - (d - 1) / 2) * STUD;
            
            if (t.round) {
              const maxR = Math.min(w, d) * STUD / 2 - STUD_R;
              if (Math.sqrt(px*px + pz*pz) > maxR) continue;
            }
            
            const stud = studGeo.clone();
            stud.translate(px, h + STUD_H / 2, pz);
            geometries.push(stud);
          }
        }
        studGeo.dispose();
      }
      
      if (t.cornerSlope) {
        const peakStud = makeStudGeometry(studSeg);
        const cornerOffset = (t.w * STUD / 2) - STUD / 2;
        const normalizedRot = ((Math.round(rot / 90) * 90) % 360 + 360) % 360;
        let px = -cornerOffset, pz = -cornerOffset;
        if (normalizedRot === 90) { px = cornerOffset; pz = -cornerOffset; }
        else if (normalizedRot === 180) { px = cornerOffset; pz = cornerOffset; }
        else if (normalizedRot === 270) { px = -cornerOffset; pz = cornerOffset; }
        peakStud.translate(px, h + STUD_H / 2, pz);
        geometries.push(peakStud);
      }
      
      if (t.sideStuds && t.sideStuds.length) {
        const sideStudGeo = makeStudGeometry(studSeg);
        const rotatedSides = t.sideStuds.map(side => rotateSideName(side, rot));
        const studY = h / 2;
        for (const side of rotatedSides) {
          if (side === 'front') {
            for (let sx = 0; sx < w; sx++) {
              const stud = sideStudGeo.clone();
              stud.rotateX(Math.PI / 2);
              stud.translate((sx - (w - 1) / 2) * STUD, studY, -depth / 2 - STUD_H / 2);
              geometries.push(stud);
            }
          } else if (side === 'back') {
            for (let sx = 0; sx < w; sx++) {
              const stud = sideStudGeo.clone();
              stud.rotateX(-Math.PI / 2);
              stud.translate((sx - (w - 1) / 2) * STUD, studY, depth / 2 + STUD_H / 2);
              geometries.push(stud);
            }
          } else if (side === 'left') {
            for (let sz = 0; sz < d; sz++) {
              const stud = sideStudGeo.clone();
              stud.rotateZ(-Math.PI / 2);
              stud.translate(-width / 2 - STUD_H / 2, studY, (sz - (d - 1) / 2) * STUD);
              geometries.push(stud);
            }
          } else if (side === 'right') {
            for (let sz = 0; sz < d; sz++) {
              const stud = sideStudGeo.clone();
              stud.rotateZ(Math.PI / 2);
              stud.translate(width / 2 + STUD_H / 2, studY, (sz - (d - 1) / 2) * STUD);
              geometries.push(stud);
            }
          }
        }
        sideStudGeo.dispose();
      }
      
      const mergedGeo = mergeBufferGeometries(geometries);
      geometries.forEach(g => g.dispose());
      return mergedGeo;
    }
    
    function rotateSideName(side, rot) {
      const r = ((rot % 360) + 360) % 360;
      if (r === 0) return side;
      const order = ['front', 'right', 'back', 'left'];
      const i = order.indexOf(side);
      if (i < 0) return side;
      const steps = r === 90 ? 1 : r === 180 ? 2 : r === 270 ? 3 : 0;
      return order[(i + steps) % 4];
    }
    
    // Simple geometry merge function
    function mergeBufferGeometries(geometries) {
      if (geometries.length === 0) return null;
      if (geometries.length === 1) return geometries[0].clone();
      
      let totalVertices = 0;
      let totalIndices = 0;
      
      geometries.forEach(geo => {
        totalVertices += geo.attributes.position.count;
        if (geo.index) totalIndices += geo.index.count;
        else totalIndices += geo.attributes.position.count;
      });
      
      const positions = new Float32Array(totalVertices * 3);
      const normals = new Float32Array(totalVertices * 3);
      const indices = new Uint32Array(totalIndices);
      
      let vertexOffset = 0;
      let indexOffset = 0;
      let indexVertexOffset = 0;
      
      geometries.forEach(geo => {
        const pos = geo.attributes.position.array;
        const norm = geo.attributes.normal ? geo.attributes.normal.array : null;
        const vertCount = geo.attributes.position.count;
        
        for (let i = 0; i < pos.length; i++) {
          positions[vertexOffset * 3 + i] = pos[i];
        }
        
        if (norm) {
          for (let i = 0; i < norm.length; i++) {
            normals[vertexOffset * 3 + i] = norm[i];
          }
        }
        
        if (geo.index) {
          const idx = geo.index.array;
          for (let i = 0; i < idx.length; i++) {
            indices[indexOffset + i] = idx[i] + indexVertexOffset;
          }
          indexOffset += idx.length;
        } else {
          for (let i = 0; i < vertCount; i++) {
            indices[indexOffset + i] = i + indexVertexOffset;
          }
          indexOffset += vertCount;
        }
        
        indexVertexOffset += vertCount;
        vertexOffset += vertCount;
      });
      
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      merged.setIndex(new THREE.BufferAttribute(indices, 1));
      merged.computeVertexNormals();
      
      return merged;
    }
    
    function instancedGeoRot(type, rot) {
      const t = types[type];
      const normRot = ((rot % 360) + 360) % 360;
      if (t && (t.slope || t.cornerSlope || t.invCornerSlope || t.sideStuds)) return normRot;
      return (normRot === 90 || normRot === 270) ? 90 : 0;
    }
    
    // Get or create geometry for a brick type
    function getInstancedGeometry(type, rot, segs) {
      const geoRot = instancedGeoRot(type, rot);
      const segments = segs || STUD_SEG_NEAR;
      const key = `${type}_${geoRot}_s${segments}`;
      
      if (!instancedSystem.geometryCache.has(key)) {
        const geo = createBrickGeometry(type, geoRot, segments);
        if (geo) instancedSystem.geometryCache.set(key, geo);
      }
      return instancedSystem.geometryCache.get(key);
    }
    
    function usePerfLambert(transparent, isLight) {
      // Phone boots on performance. Lambert skips the standard BRDF that kept
      // a full plate of bricks under 165 FPS. Balanced and high stay standard
      // so the desktop swatch match does not move.
      return qualityPreset === 'performance' && !transparent && !isLight;
    }

    function makeAbsMaterial(color, transparent, isLight) {
      let mat;
      if (usePerfLambert(transparent, isLight)) {
        mat = new THREE.MeshLambertMaterial({ color: color });
      } else {
        // Standard, not Physical+clearcoat. The clearcoat shader was the fill-rate
        // cost that pulled 520 bricks under the desktop and phone FPS bars.
        mat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: transparent ? 0.12 : 0.28,
          metalness: 0.0,
          envMap: envMap,
          envMapIntensity: transparent ? 0.35 : 0.04,
          transparent: !!transparent,
          opacity: transparent ? 0.5 : 1,
          side: transparent ? THREE.DoubleSide : THREE.FrontSide,
          emissive: isLight ? color : 0x000000,
          emissiveIntensity: isLight ? 0.85 : 0
        });
      }
      // Window-space depth bias so coplanar tops do not flicker on the plate.
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -1;
      mat.polygonOffsetUnits = -2;
      return mat;
    }
    
    // Get or create material for a color/transparency combo
    function getInstancedMaterial(color, transparent, isLight = false) {
      const key = `${color}_${transparent}_${isLight ? 'L' : 'P'}_${usePerfLambert(transparent, isLight) ? 'lb' : 'st'}`;
      
      if (!instancedSystem.materialCache.has(key)) {
        instancedSystem.materialCache.set(key, makeAbsMaterial(color, transparent, isLight));
      }
      return instancedSystem.materialCache.get(key);
    }

    function refreshInstancedMaterials() {
      if (!instancedReady) return;
      const old = new Set();
      instancedSystem.meshes.forEach((data) => {
        if (data.mesh && data.mesh.material) old.add(data.mesh.material);
      });
      instancedSystem.materialCache.clear();
      instancedSystem.meshes.forEach((data) => {
        if (data.mesh) data.mesh.receiveShadow = qualityPreset !== 'performance';
        const args = data.mesh && data.mesh.userData && data.mesh.userData.matArgs;
        if (!args) return;
        data.mesh.material = args.tex
          ? getTexturedInstancedMaterial(args.tex)
          : getInstancedMaterial(args.color, args.transparent, args.isLight);
      });
      old.forEach((mat) => {
        let used = false;
        instancedSystem.meshes.forEach((data) => {
          if (data.mesh && data.mesh.material === mat) used = true;
        });
        if (!used && mat.dispose) mat.dispose();
      });
    }
    
    const ghostMatCache = new Map();
    function getGhostMaterial(color) {
      const key = String(color);
      if (!ghostMatCache.has(key)) {
        ghostMatCache.set(key, new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.9,
          metalness: 0,
          transparent: true,
          opacity: 0.45,
          depthWrite: false
        }));
      }
      return ghostMatCache.get(key);
    }

    const _ghostTint = new THREE.Color();
    const _ghostWhite = new THREE.Color(0xffffff);
    let _ghostTintHex = 0;
    let _ghostTintSrc = -1;
    function softGhostColor(valid) {
      if (!valid) return 0xff4444;
      if (_ghostTintSrc !== selectedColor) {
        _ghostTint.copy(brickDisplayColor(selectedColor));
        _ghostTint.lerp(_ghostWhite, 0.45);
        _ghostTintHex = _ghostTint.getHex();
        _ghostTintSrc = selectedColor;
      }
      return _ghostTintHex;
    }
    
    function getTexturedInstancedMaterial(tex) {
      const key = 'texmat_' + tex.uuid;
      if (!instancedSystem.materialCache.has(key)) {
        instancedSystem.materialCache.set(key, new THREE.MeshStandardMaterial({
          map: tex,
          color: 0xffffff,
          roughness: 0.45,
          metalness: 0,
          envMap: envMap,
          envMapIntensity: 0.25
        }));
      }
      return instancedSystem.materialCache.get(key);
    }

    // Get or create InstancedMesh for a specific combination
    function getInstancedMesh(type, rot, color, transparent, extra = {}, studSeg) {
      const normRot = ((rot % 360) + 360) % 360;
      const isLight = !!(types[type] && types[type].light);
      const tex = extra.texture || null;
      const segs = studSeg || STUD_SEG_FAR;
      // Solid bricks share one mesh per geometry. Color is per instance, so a large build stays one draw.
      // Near and far studs are separate batches. One extra batch per photo texture.
      const key = tex
        ? `${type}_${normRot}_tex_${tex.uuid}_s${segs}`
        : (isLight
          ? `${type}_${normRot}_${color}_${transparent}_L_s${segs}`
          : `${type}_${normRot}_${transparent ? 1 : 0}_s${segs}`);
      
      if (!instancedSystem.meshes.has(key)) {
        const geo = getInstancedGeometry(type, rot, segs);
        const mat = tex
          ? getTexturedInstancedMaterial(tex)
          : getInstancedMaterial(isLight ? color : 0xffffff, transparent, isLight);
        
        if (!geo || !mat) return null;
        
        const mesh = new THREE.InstancedMesh(geo, mat, instancedSystem.maxInstances);
        mesh.count = 0;
        mesh.userData.matArgs = {
          color: isLight ? color : 0xffffff,
          transparent: !!transparent,
          isLight: isLight,
          tex: tex
        };
        mesh.castShadow = true;
        // Performance skips the per-pixel shadow lookup on the brick itself.
        // The brick still casts onto the plate. That lookup was the gap
        // between a 166 FPS single brick and a 161 FPS full plate.
        mesh.receiveShadow = qualityPreset !== 'performance';
        mesh.frustumCulled = false; // Important for large scenes
        scene.add(mesh);
        
        instancedSystem.meshes.set(key, {
          mesh: mesh,
          instances: new Map(), // brickId -> index
          reverseMap: new Map(), // index -> brickId
          key: key
        });
      }
      return instancedSystem.meshes.get(key);
    }
    
    const _axisY = new THREE.Vector3(0, 1, 0);
    const _qYaw = new THREE.Quaternion();
    const _qPivot = new THREE.Quaternion();
    const _brickEuler = new THREE.Euler();

    function writeBrickInstance(dummy, lookup, lift, scaleY) {
      const normRot = ((lookup.rot % 360) + 360) % 360;
      const geoRot = instancedGeoRot(lookup.type, lookup.rot);
      const instanceRot = (normRot - geoRot) * Math.PI / 180;
      dummy.position.set(lookup.pos.x, lookup.pos.y + (lift || 0) + (lookup.topBias || 0), lookup.pos.z);
      dummy.scale.set(1, scaleY == null ? 1 : scaleY, 1);
      _qYaw.setFromAxisAngle(_axisY, instanceRot);
      _brickEuler.set(
        THREE.MathUtils.degToRad(lookup.pitch || 0),
        0,
        THREE.MathUtils.degToRad(lookup.roll || 0),
        'XYZ'
      );
      _qPivot.setFromEuler(_brickEuler);
      dummy.quaternion.copy(_qPivot).multiply(_qYaw);
      dummy.updateMatrix();
    }

    // Add a brick using instanced rendering
    function addInstancedBrick(type, color, pos, rot, transparent, gridData, extra = {}) {
      const data = getInstancedMesh(type, rot, color, transparent, extra, studSegmentsAt(pos));
      if (!data) return null;
      
      const brickId = instancedSystem.nextId++;
      const index = data.mesh.count;
      
      // Grow the mesh if needed
      if (index >= data.mesh.instanceMatrix.count) {
        growInstancedMesh(data);
      }
      
      const lookup = {
        key: data.key,
        gridData: gridData,
        type,
        color,
        rot,
        transparent,
        pos: pos.clone(),
        pitch: extra.pitch || 0,
        roll: extra.roll || 0,
        // Stable vertical bias so two tops that share a height do not z-fight.
        topBias: (brickId % 5) * 0.0016
      };
      const dummy = instancedSystem.dummy;
      writeBrickInstance(dummy, lookup, 0, 1);
      data.mesh.setMatrixAt(index, dummy.matrix);
      data.mesh.instanceMatrix.needsUpdate = true;
      const tint = extra.texture ? 0xffffff : color;
      if (!(types[type] && types[type].light)) {
        data.mesh.setColorAt(index, brickDisplayColor(tint));
        data.mesh.instanceColor.needsUpdate = true;
      }
      data.mesh.count++;
      data.mesh.visible = true;
      needsRender = true;

      // Store mappings
      data.instances.set(brickId, index);
      data.reverseMap.set(index, brickId);
      instancedSystem.brickLookup.set(brickId, lookup);
      
      const tdef = types[type];
      if (tdef && tdef.light) {
        registerLampBrick(brickId, color, tdef.lightIntensity || 15, tdef.lightDistance || 25, pos);
      }
      updateShadowFrustum();
      
      return brickId;
    }
    
    // Remove a brick from instanced rendering
    function removeInstancedBrick(brickId) {
      const lookup = instancedSystem.brickLookup.get(brickId);
      if (!lookup) return false;
      
      const data = instancedSystem.meshes.get(lookup.key);
      if (!data) return false;
      
      const index = data.instances.get(brickId);
      if (index === undefined) return false;
      
      const lastIndex = data.mesh.count - 1;
      
      // If not the last instance, swap with last
      if (index !== lastIndex) {
        const matrix = new THREE.Matrix4();
        data.mesh.getMatrixAt(lastIndex, matrix);
        data.mesh.setMatrixAt(index, matrix);
        
        // Update the swapped brick's index
        const swappedBrickId = data.reverseMap.get(lastIndex);
        if (swappedBrickId !== undefined) {
          data.instances.set(swappedBrickId, index);
          data.reverseMap.set(index, swappedBrickId);
        }
        if (data.mesh.instanceColor) {
          const swappedColor = new THREE.Color();
          data.mesh.getColorAt(lastIndex, swappedColor);
          data.mesh.setColorAt(index, swappedColor);
          data.mesh.instanceColor.needsUpdate = true;
        }
      }
      
      // Remove from maps
      data.instances.delete(brickId);
      data.reverseMap.delete(lastIndex);
      instancedSystem.brickLookup.delete(brickId);
      
      // Decrement count
      data.mesh.count--;
      data.mesh.instanceMatrix.needsUpdate = true;
      markShadowDirty();
      unregisterLampBrick(brickId);
      removePanelsForBrick(brickId);
      needsRender = true;

      freeFootprint(lookup.gridData);
      
      return true;
    }

    const panelBatch = {
      mesh: null,
      byId: new Map(),
      next: 1
    };
    const _panelEuler = new THREE.Euler();
    const _qFace = new THREE.Quaternion();
    const _qBrick = new THREE.Quaternion();
    const _panelDummy = new THREE.Object3D();
    const _panelLocal = new THREE.Vector3();

    function ensurePanelMesh() {
      if (panelBatch.mesh) return panelBatch.mesh;
      const mesh = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide }),
        2048
      );
      mesh.count = 0;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.userData.isPanelBatch = true;
      scene.add(mesh);
      panelBatch.mesh = mesh;
      return mesh;
    }

    function panelFaceFrame(face, width, depth, height) {
      const o = 0.02;
      if (face === 'right') return { p: [width / 2 + o, height / 2, 0], e: [0, Math.PI / 2, 0], s: [depth - 0.04, height - 0.04] };
      if (face === 'left') return { p: [-width / 2 - o, height / 2, 0], e: [0, -Math.PI / 2, 0], s: [depth - 0.04, height - 0.04] };
      if (face === 'front') return { p: [0, height / 2, depth / 2 + o], e: [0, 0, 0], s: [width - 0.04, height - 0.04] };
      if (face === 'back') return { p: [0, height / 2, -depth / 2 - o], e: [0, Math.PI, 0], s: [width - 0.04, height - 0.04] };
      return null;
    }

    function brickQuaternion(lookup) {
      const normRot = ((lookup.rot % 360) + 360) % 360;
      const geoRot = instancedGeoRot(lookup.type, lookup.rot);
      _qYaw.setFromAxisAngle(_axisY, (normRot - geoRot) * Math.PI / 180);
      _brickEuler.set(THREE.MathUtils.degToRad(lookup.pitch || 0), 0, THREE.MathUtils.degToRad(lookup.roll || 0), 'XYZ');
      _qPivot.setFromEuler(_brickEuler);
      _qBrick.copy(_qPivot).multiply(_qYaw);
      return _qBrick;
    }

    function writePanelInstance(id) {
      const rec = panelBatch.byId.get(id);
      if (!rec || !panelBatch.mesh) return;
      const lookup = instancedSystem.brickLookup.get(rec.brickId);
      const g = lookup && lookup.gridData;
      const frame = g && panelFaceFrame(rec.face, g.w * STUD, g.d * STUD, g.hp * PLATE_H);
      if (!lookup || !frame) return;
      const q = brickQuaternion(lookup);
      _panelLocal.set(frame.p[0], frame.p[1], frame.p[2]).applyQuaternion(q);
      _panelEuler.set(frame.e[0], frame.e[1], frame.e[2], 'XYZ');
      _qFace.setFromEuler(_panelEuler);
      _panelDummy.position.copy(lookup.pos).add(_panelLocal);
      _panelDummy.quaternion.copy(q).multiply(_qFace);
      _panelDummy.scale.set(frame.s[0], frame.s[1], 1);
      _panelDummy.updateMatrix();
      panelBatch.mesh.setMatrixAt(rec.index, _panelDummy.matrix);
      panelBatch.mesh.setColorAt(rec.index, new THREE.Color(rec.color));
      panelBatch.mesh.instanceMatrix.needsUpdate = true;
      if (panelBatch.mesh.instanceColor) panelBatch.mesh.instanceColor.needsUpdate = true;
    }

    function addPanelInstance(brick, face, color) {
      const lookup = instancedSystem.brickLookup.get(brick.instanceId);
      if (!lookup) return null;
      const mesh = ensurePanelMesh();
      const id = panelBatch.next++;
      const index = mesh.count;
      if (index >= mesh.instanceMatrix.count) return null;
      const rec = { id, index, brickId: brick.instanceId, face, color };
      panelBatch.byId.set(id, rec);
      mesh.count++;
      writePanelInstance(id);
      if (!brick.userData.facePanels) brick.userData.facePanels = {};
      brick.userData.facePanels[face] = { color, face, panelId: id };
      needsRender = true;
      return id;
    }

    function removePanelInstance(id) {
      const rec = panelBatch.byId.get(id);
      const mesh = panelBatch.mesh;
      if (!rec || !mesh) return;
      const index = rec.index;
      const last = mesh.count - 1;
      if (index !== last) {
        const matrix = new THREE.Matrix4();
        mesh.getMatrixAt(last, matrix);
        mesh.setMatrixAt(index, matrix);
        if (mesh.instanceColor) {
          const c = new THREE.Color();
          mesh.getColorAt(last, c);
          mesh.setColorAt(index, c);
          mesh.instanceColor.needsUpdate = true;
        }
        for (const other of panelBatch.byId.values()) {
          if (other.index === last) other.index = index;
        }
      }
      panelBatch.byId.delete(id);
      mesh.count--;
      mesh.instanceMatrix.needsUpdate = true;
      needsRender = true;
    }

    function removePanelsForBrick(brickId) {
      const ids = [];
      panelBatch.byId.forEach((rec, id) => { if (rec.brickId === brickId) ids.push(id); });
      ids.forEach(removePanelInstance);
      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        if (b.isInstancedBrick && b.instanceId === brickId) b.userData.facePanels = {};
      }
    }

    function attachInstancedPanels(brick, facePanels) {
      if (!brick || !brick.isInstancedBrick || !facePanels) return;
      Object.keys(facePanels).forEach((face) => {
        const color = facePanels[face] && facePanels[face].color != null ? facePanels[face].color : facePanels[face];
        if (color == null) return;
        addPanelInstance(brick, face, color);
      });
    }

    function disposePanelBatch() {
      if (!panelBatch.mesh) return;
      scene.remove(panelBatch.mesh);
      panelBatch.mesh.geometry.dispose();
      panelBatch.mesh.material.dispose();
      panelBatch.mesh = null;
      panelBatch.byId.clear();
    }
    
    // Grow an instanced mesh when it's full
    function growInstancedMesh(data) {
      const oldMesh = data.mesh;
      const newMax = oldMesh.instanceMatrix.count * 2;
      
      const newMesh = new THREE.InstancedMesh(oldMesh.geometry, oldMesh.material, newMax);
      newMesh.count = oldMesh.count;
      newMesh.castShadow = true;
      newMesh.receiveShadow = true;
      newMesh.frustumCulled = false;
      
      // Copy existing matrices
      for (let i = 0; i < oldMesh.count; i++) {
        const matrix = new THREE.Matrix4();
        oldMesh.getMatrixAt(i, matrix);
        newMesh.setMatrixAt(i, matrix);
        if (oldMesh.instanceColor) {
          const c = new THREE.Color();
          oldMesh.getColorAt(i, c);
          newMesh.setColorAt(i, c);
        }
      }
      newMesh.instanceMatrix.needsUpdate = true;
      if (newMesh.instanceColor) newMesh.instanceColor.needsUpdate = true;
      
      // Replace in scene
      scene.remove(oldMesh);
      scene.add(newMesh);
      data.mesh = newMesh;
      
      oldMesh.dispose();
    }
    
    // Clear all instanced bricks (for new/load)
    function clearInstancedBricks() {
      instancedSystem.meshes.forEach((data, key) => {
        scene.remove(data.mesh);
        data.mesh.dispose();
      });
      instancedSystem.meshes.clear();
      instancedSystem.brickLookup.clear();
      instancedSystem.nextId = 1;
      disposePanelBatch();
      lightSources.clear();
      updateBrickLights(true);
      updateShadowFrustum();
    }
    
    // Placed bricks go through InstancedMesh, including tilt, photo tiles, and face panels.
    function shouldUseInstancing(type) {
      return !!types[type];
    }
    
    function stampFootprint(g, brick) {
      for (let dx = 0; dx < g.w; dx++) {
        for (let dz = 0; dz < g.d; dz++) {
          const key = `${g.gx + dx},${g.gz + dz}`;
          if (!grid.has(key)) grid.set(key, new Set());
          const levels = grid.get(key);
          for (let h = 0; h < g.hp; h++) {
            levels.add(g.gy + h);
            if (brick) cellBrick.set(`${g.gx + dx},${g.gz + dz},${g.gy + h}`, brick);
          }
        }
      }
    }

    function freeFootprint(g) {
      if (!g) return;
      for (let dx = 0; dx < g.w; dx++) {
        for (let dz = 0; dz < g.d; dz++) {
          const key = `${g.gx + dx},${g.gz + dz}`;
          const levels = grid.get(key);
          if (!levels) continue;
          for (let h = 0; h < g.hp; h++) {
            levels.delete(g.gy + h);
            cellBrick.delete(`${g.gx + dx},${g.gz + dz},${g.gy + h}`);
          }
          if (levels.size === 0) grid.delete(key);
        }
      }
    }

    function fillGridFromData(g, brick) {
      stampFootprint(g, brick);
    }
    
    function makeVirtualBrick(brickId, type, color, pos, rot, transparent, gridData, extra = {}) {
      return {
        isInstancedBrick: true,
        instanceId: brickId,
        userData: {
          isBrick: true,
          grid: gridData,
          brickType: type,
          type: type,
          color: color,
          rot: rot,
          transparent: transparent,
          pitch: extra.pitch || 0,
          roll: extra.roll || 0,
          hasLight: !!(types[type] && types[type].light)
        },
        position: pos.clone ? pos.clone() : pos
      };
    }
    
    function cachePickMeshes(obj) {
      if (!obj || obj.isInstancedBrick || !obj.traverse) return;
      const pick = [];
      obj.traverse(o => { if (o.isMesh) pick.push(o); });
      obj.userData.pickMeshes = pick;
    }
    
    function commitPlacedBrick(type, color, pos, rot, options = {}, gridData) {
      const transparent = options.transparent || false;
      if (shouldUseInstancing(type)) {
        const brickId = addInstancedBrick(type, color, pos, rot, transparent, gridData, options);
        if (!brickId) return null;
        const virtual = makeVirtualBrick(brickId, type, color, pos, rot, transparent, gridData, options);
        if (options.texture) virtual.userData.textureIndex = options.textureIndex;
        bricks.push(virtual);
        fillGridFromData(gridData, virtual);
        if (options.facePanels && typeof options.facePanels === 'object') {
          attachInstancedPanels(virtual, options.facePanels);
        }
        needsRender = true;
        updateStats();
        hideStarterBar();
        return virtual;
      }
      const brick = createBrick(type, color, pos, rot, false, options);
      if (!brick) return null;
      addToGrid(gridData.gx, gridData.gz, gridData.w, gridData.d, gridData.gy, gridData.hp, brick);
      cachePickMeshes(brick);
      scene.add(brick);
      markShadowDirty();
      bricks.push(brick);
      if (types[type] && types[type].light) {
        registerLampBrick('g' + bricks.length + '_' + Date.now(), color, types[type].lightIntensity || 15, types[type].lightDistance || 25, pos);
      }
      needsRender = true;
      updateStats();
      hideStarterBar();
      return brick;
    }

    // Helper to collect raycastable meshes from all bricks (regular + instanced)
    function collectBrickMeshes(includeInstanced = true) {
      const meshes = [];
      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        if (b.isInstancedBrick) continue;
        const cached = b.userData && b.userData.pickMeshes;
        if (cached) {
          for (let j = 0; j < cached.length; j++) meshes.push(cached[j]);
        } else if (b.traverse) {
          b.traverse(o => { if (o.isMesh) meshes.push(o); });
        }
      }
      if (includeInstanced) {
        instancedSystem.meshes.forEach(data => {
          if (data.mesh.count > 0) meshes.push(data.mesh);
        });
      }
      return meshes;
    }

    // ==================== BRICK CREATION ====================
    await new Promise((resolve) => setTimeout(resolve, 0));

    function createBrick(type, color, pos, rot, isGhost = false, options = {}) {
      const t = types[type];
      if (!t) return null;
      
      const transparent = options.transparent || false;
      const pitch = options.pitch || 0;
      const roll = options.roll || 0;
      const texture = options.texture || null; // Photo texture for tiles
      
      if (isGhost && !pitch && !roll && !texture) {
        const geo = getInstancedGeometry(type, rot);
        if (geo) {
          const mesh = new THREE.Mesh(geo, getGhostMaterial(color));
          const normRot = ((rot % 360) + 360) % 360;
          const geoRot = instancedGeoRot(type, rot);
          mesh.position.copy(pos);
          mesh.rotation.y = (normRot - geoRot) * Math.PI / 180;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          mesh.userData = { type, color, rot, pitch: 0, roll: 0, transparent: true, isBrick: false, isGhost: true };
          return mesh;
        }
      }
      
      const group = new THREE.Group();
      
      // All bricks swap dimensions when rotated 90 or 270 degrees (only for Y rotation)
      const isRotated = (rot === 90 || rot === 270);
      const w = isRotated ? t.d : t.w;
      const d = isRotated ? t.w : t.d;
      
      const width = w * STUD;
      const depth = d * STUD;
      const h = t.h === 'b' ? BRICK_H : PLATE_H;
      
      // Enhanced PBR material for classic plastic brick look
      const opacity = isGhost ? 0.65 : (transparent ? 0.5 : 1);
      let mat;
      
      // If this is a tile with a texture, use textured material
      if (texture && t.noStuds && !isGhost) {
        mat = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.3,
          metalness: 0.0,
          envMap: envMap,
          envMapIntensity: 0.3
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: isGhost ? 0.9 : (transparent ? 0.1 : 0.28),
          metalness: 0.0,
          envMap: isGhost ? null : envMap,
          envMapIntensity: transparent ? 0.8 : 0.4,
          transparent: isGhost || transparent,
          opacity: opacity,
          side: transparent ? THREE.DoubleSide : THREE.FrontSide
        });
      }
      
      let body;
      if (t.round) {
        const r = Math.min(width, depth) / 2 - 0.02;
        body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), mat);
      } else if (t.slope) {
        // For slopes, always use original type dimensions, rotation handles orientation
        const slopeW = t.w * STUD;
        const slopeD = t.d * STUD;
        body = createSlopeBody(slopeW, slopeD, h, mat, rot);
      } else if (t.cornerSlope) {
        // Outside corner slope (for roof corners)
        const cornerW = t.w * STUD;
        const cornerD = t.d * STUD;
        body = createCornerSlopeBody(cornerW, cornerD, h, mat, rot, false);
      } else if (t.invCornerSlope) {
        // Inside corner slope (for roof inside corners)
        const cornerW = t.w * STUD;
        const cornerD = t.d * STUD;
        body = createCornerSlopeBody(cornerW, cornerD, h, mat, rot, true);
      } else {
        // Simple box geometry - reliable and works correctly
        body = new THREE.Mesh(new THREE.BoxGeometry(width - 0.02, h, depth - 0.02), mat);
      }
      
      body.position.y = h / 2;
      body.castShadow = !isGhost;
      body.receiveShadow = !isGhost;
      group.add(body);
      
      // Add studs on top of brick - OPTIMIZED: Use merged geometry for all studs
      if (!t.noStuds && !t.slope && !t.cornerSlope && !t.invCornerSlope) {
        const studGeo = makeStudGeometry(STUD_SEG_NEAR);
        const studMat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: isGhost ? 0.9 : (transparent ? 0.1 : 0.2),
          metalness: 0.0,
          envMap: isGhost ? null : envMap,
          envMapIntensity: transparent ? 0.8 : 0.5,
          transparent: isGhost || transparent,
          opacity: opacity,
          side: transparent ? THREE.DoubleSide : THREE.FrontSide
        });
        
        // Count valid studs first
        const studPositions = [];
        for (let sx = 0; sx < w; sx++) {
          for (let sz = 0; sz < d; sz++) {
            const px = (sx - (w - 1) / 2) * STUD;
            const pz = (sz - (d - 1) / 2) * STUD;
            
            if (t.round) {
              const maxR = Math.min(w, d) * STUD / 2 - STUD_R;
              if (Math.sqrt(px*px + pz*pz) > maxR) continue;
            }
            studPositions.push({x: px, z: pz});
          }
        }
        
        // Use InstancedMesh for studs if more than 1
        if (studPositions.length > 1 && !isGhost) {
          const studInstances = new THREE.InstancedMesh(studGeo, studMat, studPositions.length);
          const dummy = new THREE.Object3D();
          studPositions.forEach((pos, i) => {
            dummy.position.set(pos.x, h + STUD_H/2, pos.z);
            dummy.updateMatrix();
            studInstances.setMatrixAt(i, dummy.matrix);
          });
          studInstances.instanceMatrix.needsUpdate = true;
          studInstances.castShadow = true;
          group.add(studInstances);
        } else {
          // Single stud or ghost - use regular mesh
          studPositions.forEach(pos => {
            const stud = new THREE.Mesh(studGeo, studMat);
            stud.position.set(pos.x, h + STUD_H/2, pos.z);
            stud.castShadow = !isGhost;
            group.add(stud);
          });
        }
      }
      
      // Add single stud at peak corner for outside corner slopes
      if (t.cornerSlope && !isGhost) {
        const peakStudGeo = makeStudGeometry(STUD_SEG_NEAR);
        const peakStudMat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: transparent ? 0.1 : 0.2,
          metalness: 0.0,
          envMap: envMap,
          envMapIntensity: transparent ? 0.8 : 0.5,
          transparent: transparent,
          opacity: opacity
        });
        
        const peakStud = new THREE.Mesh(peakStudGeo, peakStudMat);
        // Position stud at the peak corner based on rotation
        const cornerOffset = (t.w * STUD / 2) - STUD / 2;
        const normalizedRot = Math.round(rot / 90) * 90 % 360;
        
        if (normalizedRot === 0) {
          peakStud.position.set(-cornerOffset, h + STUD_H/2, -cornerOffset);
        } else if (normalizedRot === 90) {
          peakStud.position.set(cornerOffset, h + STUD_H/2, -cornerOffset);
        } else if (normalizedRot === 180) {
          peakStud.position.set(cornerOffset, h + STUD_H/2, cornerOffset);
        } else {
          peakStud.position.set(-cornerOffset, h + STUD_H/2, cornerOffset);
        }
        peakStud.castShadow = true;
        group.add(peakStud);
      }
      
      // Add side studs for SNOT bricks - OPTIMIZED
      if (t.sideStuds && t.sideStuds.length > 0) {
        const sideStudGeo = makeStudGeometry(STUD_SEG_NEAR);
        const sideStudMat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: isGhost ? 0.9 : (transparent ? 0.1 : 0.2),
          metalness: 0.0,
          envMap: isGhost ? null : envMap,
          envMapIntensity: transparent ? 0.8 : 0.5,
          transparent: isGhost || transparent,
          opacity: opacity,
          side: transparent ? THREE.DoubleSide : THREE.FrontSide
        });
        
        // Calculate stud positions based on which sides have studs
        // Account for Y rotation
        const rotatedSides = t.sideStuds.map(side => {
          if (rot === 0) return side;
          if (rot === 90) {
            if (side === 'front') return 'right';
            if (side === 'right') return 'back';
            if (side === 'back') return 'left';
            if (side === 'left') return 'front';
          }
          if (rot === 180) {
            if (side === 'front') return 'back';
            if (side === 'back') return 'front';
            if (side === 'left') return 'right';
            if (side === 'right') return 'left';
          }
          if (rot === 270) {
            if (side === 'front') return 'left';
            if (side === 'left') return 'back';
            if (side === 'back') return 'right';
            if (side === 'right') return 'front';
          }
          return side;
        });
        
        // Side stud vertical position (middle of brick height)
        const studY = h / 2;
        
        // Collect all side stud positions with their rotations
        const sideStudData = [];
        
        for (const side of rotatedSides) {
          if (side === 'front') {
            for (let sx = 0; sx < w; sx++) {
              sideStudData.push({
                x: (sx - (w - 1) / 2) * STUD,
                y: studY,
                z: -depth / 2 - STUD_H / 2,
                rx: Math.PI / 2, ry: 0, rz: 0
              });
            }
          }
          if (side === 'back') {
            for (let sx = 0; sx < w; sx++) {
              sideStudData.push({
                x: (sx - (w - 1) / 2) * STUD,
                y: studY,
                z: depth / 2 + STUD_H / 2,
                rx: -Math.PI / 2, ry: 0, rz: 0
              });
            }
          }
          if (side === 'left') {
            for (let sz = 0; sz < d; sz++) {
              sideStudData.push({
                x: -width / 2 - STUD_H / 2,
                y: studY,
                z: (sz - (d - 1) / 2) * STUD,
                rx: 0, ry: 0, rz: -Math.PI / 2
              });
            }
          }
          if (side === 'right') {
            for (let sz = 0; sz < d; sz++) {
              sideStudData.push({
                x: width / 2 + STUD_H / 2,
                y: studY,
                z: (sz - (d - 1) / 2) * STUD,
                rx: 0, ry: 0, rz: Math.PI / 2
              });
            }
          }
        }
        
        // Use InstancedMesh for side studs if more than 1
        if (sideStudData.length > 1 && !isGhost) {
          const sideStudInstances = new THREE.InstancedMesh(sideStudGeo, sideStudMat, sideStudData.length);
          const dummy = new THREE.Object3D();
          sideStudData.forEach((data, i) => {
            dummy.position.set(data.x, data.y, data.z);
            dummy.rotation.set(data.rx, data.ry, data.rz);
            dummy.updateMatrix();
            sideStudInstances.setMatrixAt(i, dummy.matrix);
          });
          sideStudInstances.instanceMatrix.needsUpdate = true;
          sideStudInstances.castShadow = true;
          group.add(sideStudInstances);
        } else {
          // Single stud or ghost
          sideStudData.forEach(data => {
            const stud = new THREE.Mesh(sideStudGeo, sideStudMat);
            stud.position.set(data.x, data.y, data.z);
            stud.rotation.set(data.rx, data.ry, data.rz);
            stud.castShadow = !isGhost;
            group.add(stud);
          });
        }
      }
      
      // Position the group at the calculated position
      // calcWorldY returns the BOTTOM of the brick (BASE_Y + gy * PLATE_H)
      // body.position.y = h/2 centers the body above the group origin
      group.position.copy(pos);
      
      // Lamp bricks: emissive only. Real PointLights come from the capped pool.
      if (t.light && !isGhost) {
        if (body.material) {
          body.material.emissive = new THREE.Color(color);
          body.material.emissiveIntensity = 0.85;
        }
        group.userData.hasLight = true;
        group.userData.lightIntensity = t.lightIntensity || 15;
        group.userData.lightDistance = t.lightDistance || 25;
      }
      
      // Apply multi-axis rotation (pitch and roll)
      if (pitch !== 0 || roll !== 0) {
        // Create a pivot point at the bottom center of the brick
        const pivot = new THREE.Group();
        pivot.position.copy(pos);
        
        // Move group to origin relative to pivot
        group.position.set(0, 0, 0);
        pivot.add(group);
        
        // Apply rotations
        pivot.rotation.x = THREE.MathUtils.degToRad(pitch);
        pivot.rotation.z = THREE.MathUtils.degToRad(roll);
        
        // Preserve light properties if they exist
        pivot.userData = {
          type, color, rot, pitch, roll, transparent, isBrick: true,
          hasLight: group.userData.hasLight || false
        };
        cachePickMeshes(pivot);
        return pivot;
      }
      
      const hasLight = group.userData.hasLight || false;
      group.userData = {type, color, rot, pitch: 0, roll: 0, transparent, isBrick: true, hasLight};
      cachePickMeshes(group);
      return group;
    }
    
    function createSlopeGeometry(origW, origD, h, rot = 0) {
      const normalizedRot = ((Math.round(rot / 90) * 90) % 360 + 360) % 360;
      const isRotated90 = (normalizedRot === 90 || normalizedRot === 270);
      const w = isRotated90 ? origD : origW;
      const d = isRotated90 ? origW : origD;
      const hw = (w - 0.02) / 2;
      const hd = (d - 0.02) / 2;
      const hh = h / 2;
      const lowH = h * 0.25;
      const geo = new THREE.BoxGeometry(w - 0.02, h, d - 0.02);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y > 0) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          let newY = hh;
          if (normalizedRot === 0) {
            const t = (z + hd) / (2 * hd);
            newY = hh - t * (hh - (-hh + lowH));
          } else if (normalizedRot === 180) {
            const t = (-z + hd) / (2 * hd);
            newY = hh - t * (hh - (-hh + lowH));
          } else if (normalizedRot === 90) {
            const t = (x + hw) / (2 * hw);
            newY = hh - t * (hh - (-hh + lowH));
          } else {
            const t = (-x + hw) / (2 * hw);
            newY = hh - t * (hh - (-hh + lowH));
          }
          pos.setY(i, newY);
        }
      }
      geo.computeVertexNormals();
      return geo;
    }
    
    function createSlopeBody(origW, origD, h, mat, rot = 0) {
      return new THREE.Mesh(createSlopeGeometry(origW, origD, h, rot), mat);
    }
    
    function createCornerSlopeGeometry(origW, origD, h, rot = 0, isInside = false) {
      const normalizedRot = ((Math.round(rot / 90) * 90) % 360 + 360) % 360;
      
      const size = origW - 0.02;
      const hs = size / 2;
      const hh = h / 2;
      const lowH = -hh + h * 0.25; // Low edge height
      
      // For outside corners: one corner is HIGH (peak), three are LOW
      // For inside corners: one corner is LOW (valley), three are HIGH
      
      const geo = new THREE.BufferGeometry();
      const vertices = [];
      const indices = [];
      
      // Determine which corner is the special one based on rotation
      // Corner indices: 0=back-left(-X,-Z), 1=back-right(+X,-Z), 2=front-right(+X,+Z), 3=front-left(-X,+Z)
      let specialCorner = 0; // default: back-left
      if (normalizedRot === 90) specialCorner = 1;  // back-right
      else if (normalizedRot === 180) specialCorner = 2;  // front-right
      else if (normalizedRot === 270) specialCorner = 3;  // front-left
      
      // Corner positions (X, Z)
      const corners = [
        [-hs, -hs], // 0: back-left
        [ hs, -hs], // 1: back-right
        [ hs,  hs], // 2: front-right
        [-hs,  hs]  // 3: front-left
      ];
      
      // Calculate top Y for each corner
      const topY = corners.map((_, i) => {
        if (isInside) {
          // Inside corner: special corner is LOW, others are HIGH
          return (i === specialCorner) ? lowH : hh;
        } else {
          // Outside corner: special corner is HIGH (peak), others are LOW
          return (i === specialCorner) ? hh : lowH;
        }
      });
      
      // Build vertices: 4 bottom corners + 4 top corners
      // Bottom corners (0-3)
      for (let i = 0; i < 4; i++) {
        vertices.push(corners[i][0], -hh, corners[i][1]);
      }
      // Top corners (4-7)
      for (let i = 0; i < 4; i++) {
        vertices.push(corners[i][0], topY[i], corners[i][1]);
      }
      
      // Build faces using triangles
      // Bottom face (looking from below, CCW)
      indices.push(0, 2, 1, 0, 3, 2);
      
      // Top face - split into triangles from the special corner
      // This ensures proper rendering for non-planar quads
      const s = specialCorner + 4; // special corner vertex index (top)
      const next1 = 4 + ((specialCorner + 1) % 4);
      const next2 = 4 + ((specialCorner + 2) % 4);
      const next3 = 4 + ((specialCorner + 3) % 4);
      indices.push(s, next1, next2, s, next2, next3);
      
      // Side faces (4 quads, each split into 2 triangles)
      for (let i = 0; i < 4; i++) {
        const b1 = i;           // bottom corner
        const b2 = (i + 1) % 4; // next bottom corner
        const t1 = i + 4;       // top corner above b1
        const t2 = ((i + 1) % 4) + 4; // top corner above b2
        indices.push(b1, b2, t2, b1, t2, t1);
      }
      
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    }
    
    function createCornerSlopeBody(origW, origD, h, mat, rot = 0, isInside = false) {
      return new THREE.Mesh(createCornerSlopeGeometry(origW, origD, h, rot, isInside), mat);
    }
    
    // ==================== GRID LOGIC ====================
    function getEffectiveDims(type, rot) {
      const t = types[type];
      if (!t) return {w: 1, d: 1};
      const isRotated = (rot === 90 || rot === 270);
      // All brick types (including slopes) swap dimensions when rotated 90 or 270
      return {
        w: isRotated ? t.d : t.w,
        d: isRotated ? t.w : t.d
      };
    }
    
    function getHP(type) {
      const t = types[type];
      return t && t.h === 'p' ? 1 : 3;
    }
    
    function getBrickHeight(type) {
      const t = types[type];
      return t && t.h === 'p' ? PLATE_H : BRICK_H;
    }
    
    function worldToGrid(wx, wz) {
      // Convert world coordinates to grid stud indices
      return {
        x: Math.floor(wx / STUD),
        z: Math.floor(wz / STUD)
      };
    }
    
    function calcWorldY(gy, brickHeight) {
      // Returns the Y position for the GROUP origin (bottom of brick)
      // The body inside the group is offset by h/2 to center it
      return BASE_Y + (gy * PLATE_H);
    }
    
    function canPlace(gx, gz, w, d, gy, hp, requireSupport = true) {
      // Check for collisions
      for (let dx = 0; dx < w; dx++) {
        for (let dz = 0; dz < d; dz++) {
          const key = `${gx+dx},${gz+dz}`;
          if (grid.has(key)) {
            const levels = grid.get(key);
            for (let h = 0; h < hp; h++) {
              if (levels.has(gy + h)) return false;
            }
          }
        }
      }
      
      // Check for support if required
      if (requireSupport && gy > 0) {
        if (!hasSupport(gx, gz, w, d, gy)) return false;
      }
      
      return true;
    }
    
    // Check if there's support below the brick footprint
    function hasSupport(gx, gz, w, d, gy) {
      if (gy === 0) return true; // Ground level always supported
      
      // Check for support below (brick underneath)
      for (let dx = 0; dx < w; dx++) {
        for (let dz = 0; dz < d; dz++) {
          const key = `${gx+dx},${gz+dz}`;
          if (grid.has(key)) {
            const levels = grid.get(key);
            if (levels.has(gy - 1)) return true; // Something below
          }
        }
      }
      
      // Check for adjacent connection (brick next to us at same level or overlapping)
      // This allows building arms/overhangs that connect to existing structures
      for (let dx = -1; dx <= w; dx++) {
        for (let dz = -1; dz <= d; dz++) {
          // Skip interior cells (we want adjacent, not overlapping)
          if (dx >= 0 && dx < w && dz >= 0 && dz < d) continue;
          
          const key = `${gx+dx},${gz+dz}`;
          if (grid.has(key)) {
            const levels = grid.get(key);
            // Check if adjacent brick overlaps our height range
            for (let h = 0; h < 3; h++) { // Check a few levels
              if (levels.has(gy + h) || levels.has(gy - h)) return true;
            }
          }
        }
      }
      
      return false;
    }
    
    function findY(gx, gz, w, d, hp) {
      let maxBelow = -1;
      for (let dx = 0; dx < w; dx++) {
        for (let dz = 0; dz < d; dz++) {
          const key = `${gx+dx},${gz+dz}`;
          if (grid.has(key)) {
            const levels = grid.get(key);
            if (levels.size > 0) maxBelow = Math.max(maxBelow, Math.max(...levels));
          }
        }
      }
      const y = maxBelow + 1;
      // Bypass support check - findY places on top of existing bricks by definition
      return canPlace(gx, gz, w, d, y, hp, false) ? y : 0;
    }
    
    function addToGrid(gx, gz, w, d, gy, hp, mesh) {
      const g = {gx, gz, gy, w, d, hp};
      stampFootprint(g, mesh);
      mesh.userData.grid = g;
    }
    
    function removeFromGrid(mesh) {
      freeFootprint(mesh.userData.grid);
    }
    

    function pickBuild(ray, collect) {
      const dir = ray.direction;
      const orig = ray.origin;
      const maxDist = collect && collect.maxDist ? collect.maxDist : 900;
      let groundT = Infinity;
      if (dir.y !== 0) {
        const gt = -orig.y / dir.y;
        if (gt > 0) groundT = gt;
      }
      const stepX = dir.x < 0 ? -1 : 1;
      const stepY = dir.y < 0 ? -1 : 1;
      const stepZ = dir.z < 0 ? -1 : 1;
      const tDeltaX = dir.x === 0 ? Infinity : Math.abs(STUD / dir.x);
      const tDeltaY = dir.y === 0 ? Infinity : Math.abs(PLATE_H / dir.y);
      const tDeltaZ = dir.z === 0 ? Infinity : Math.abs(STUD / dir.z);
      const nextT = (origin, size, step, dirComp) => {
        if (dirComp === 0) return Infinity;
        const cell = Math.floor(origin / size);
        const edge = step > 0 ? (cell + 1) * size : cell * size;
        return (edge - origin) / dirComp;
      };
      let x = Math.floor(orig.x / STUD);
      let y = Math.floor(orig.y / PLATE_H);
      let z = Math.floor(orig.z / STUD);
      let tMaxX = nextT(orig.x, STUD, stepX, dir.x);
      let tMaxY = nextT(orig.y, PLATE_H, stepY, dir.y);
      let tMaxZ = nextT(orig.z, STUD, stepZ, dir.z);
      let t = 0;
      const normal = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < 512; i++) {
        if (t > groundT || t > maxDist) break;
        if (t > 0.015 && y >= 0 && y < 480 && x > -2000 && x < 4000 && z > -2000 && z < 4000) {
          const brick = cellBrick.get(x + ',' + z + ',' + y);
          if (brick) {
            const hit = {
              point: orig.clone().addScaledVector(dir, t),
              distance: t,
              brick,
              normal: normal.clone()
            };
            if (collect) {
              if (!collect.seen.has(brick)) {
                collect.seen.add(brick);
                collect.hits.push(hit);
              }
              if (collect.hits.length >= (collect.limit || 64)) break;
            } else {
              return hit;
            }
          }
        }
        if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
          x += stepX;
          t = tMaxX;
          tMaxX += tDeltaX;
          normal.set(-stepX, 0, 0);
        } else if (tMaxY <= tMaxZ) {
          y += stepY;
          t = tMaxY;
          tMaxY += tDeltaY;
          normal.set(0, -stepY, 0);
        } else {
          z += stepZ;
          t = tMaxZ;
          tMaxZ += tDeltaZ;
          normal.set(0, 0, -stepZ);
        }
      }
      if (collect) return null;
      if (groundT < maxDist) {
        return {
          point: orig.clone().addScaledVector(dir, groundT),
          distance: groundT,
          brick: null,
          normal: new THREE.Vector3(0, 1, 0)
        };
      }
      return null;
    }

    function pickBuildHits(ray, maxDist) {
      const collect = { seen: new Set(), hits: [], limit: 64, maxDist: maxDist || 900 };
      pickBuild(ray, collect);
      return collect.hits;
    }

        function pickPoint() {
      raycaster.setFromCamera(mouse, camera);
      return pickBuild(raycaster.ray);
    }

    // ==================== GHOST PREVIEW ====================

    let wallModeGhost = null; // Single brick ghost for wall mode before dragging
    let orbitHidingGhost = false;
    let cameraCoasting = false;

    function pointerOnPlate(point) {
      if (!point) return false;
      const size = (typeof window.baseplateSize === 'number' && window.baseplateSize > 0) ? window.baseplateSize : 96 * STUD;
      return point.x >= -0.05 && point.z >= -0.05 && point.x <= size + 0.05 && point.z <= size + 0.05;
    }
    
    function updateGhost(opts) {
      const hudDel = document.getElementById('hudDeleteBtn');
      if (hudDel) hudDel.classList.toggle('delete-active', deleteMode);
      const forPlace = !!(opts && opts.forPlace);
      // Don't update regular ghost in walk mode - use fpGhost instead
      if (firstPersonMode) {
        removeGhost();
        removeWallModeGhost();
        return;
      }
      if (!forPlace && (orbitHidingGhost || cameraCoasting || document.body.classList.contains('phone-tray-open'))) {
        removeGhost();
        removeWallModeGhost();
        needsRender = true;
        return;
      }
      
      // Handle wall mode ghost (before dragging starts)
      if (wallMode && !wallDragStart) {
        removeGhost();
        updateWallModeGhost();
        return;
      }
      
      if (deleteMode || dropperMode || paintMode || facePaintMode || floorMode || wallMode) {
        removeGhost();
        removeWallModeGhost();
        return;
      }
      
      removeGhost();
      removeWallModeGhost();
      
      raycaster.setFromCamera(mouse, camera);
      const picked = pickBuild(raycaster.ray);
      const hit = picked ? { point: picked.point, distance: picked.distance } : null;
      const hitBrick = picked ? picked.brick : null;
      const hitNormal = picked ? picked.normal : null;

      if (!hit) return;
      // Ground hits used to cover the whole grass plane. The ghost stays on the plate.
      if (!hitBrick && !pointerOnPlate(hit.point)) return;
      
      // If prefab mode is active, show prefab ghost preview
      if (selectedPrefab && prefabs[selectedPrefab]) {
        const gPos = worldToGrid(hit.point.x, hit.point.z);
        createPrefabGhosts(gPos.x, gPos.z);
        return;
      }
      
      const dims = getEffectiveDims(selectedBrick, currentRotation);
      const hp = getHP(selectedBrick);
      const brickH = getBrickHeight(selectedBrick);
      
      let gx, gz, gy;
      
      if (hitBrick && hitBrick.userData.grid && hitNormal) {
        const hitGrid = hitBrick.userData.grid;
        
        // Determine which face was hit based on normal
        const isTopFace = hitNormal.y > 0.5;      // More than 30 degrees up = top
        const isBottomFace = hitNormal.y < -0.5;   // More than 30 degrees down = bottom
        const isSideFace = !isTopFace && !isBottomFace;  // Everything else = side
        
        if (isTopFace) {
          // TOP FACE: Stack on top of the brick we clicked
          // IMPORTANT: Use the hit brick's grid position, not hit.point
          // This prevents edge-clicking from picking adjacent wall positions
          
          // Start with the hit brick's position for accurate stacking
          gx = hitGrid.gx;
          gz = hitGrid.gz;
          
          // Default: place on top of what we hit
          gy = hitGrid.gy + hitGrid.hp;
          
          // Adjust gx/gz for brick centering if our brick is smaller than hit brick
          if (dims.w < hitGrid.w) {
            const gPos = worldToGrid(hit.point.x, hit.point.z);
            gx = gPos.x - Math.floor((dims.w - 1) / 2);
          }
          if (dims.d < hitGrid.d) {
            const gPos = worldToGrid(hit.point.x, hit.point.z);
            gz = gPos.z - Math.floor((dims.d - 1) / 2);
          }
          
          // Check if default position works - if so, use it (simple stacking)
          if (canPlace(gx, gz, dims.w, dims.d, gy, hp, false)) {
            // Position is valid, keep it
          } else {
            // Default blocked - try alternative positions
            let foundPosition = false;
            
            // FIRST: Try scanning upward from hit brick (for column stacking)
            // This handles the case where clicking on a brick in a gap should stack above it
            for (let testY = gy; testY < gy + 30; testY += hp) {
              if (canPlace(gx, gz, dims.w, dims.d, testY, hp, false)) {
                gy = testY;
                foundPosition = true;
                break;
              }
            }
            
            // SECOND: If upward scan failed, try gap-filling (scanning downward)
            if (!foundPosition) {
              const rayOrigin = raycaster.ray.origin.clone();
              const rayDir = raycaster.ray.direction.clone();
              
              // GAP FILLING: When looking downward through a gap (like a doorway),
              // find where the ray would intersect lower Y levels and check for gaps there
              if (rayDir.y < -0.1) {
                // Scan from ground up, checking where the ray intersects each Y level
                for (let testY = 0; testY < hitGrid.gy; testY++) {
                  // Calculate where the ray intersects this Y level
                  const gapWorldY = calcWorldY(testY, brickH) + brickH / 2;
                  const t = (gapWorldY - rayOrigin.y) / rayDir.y;
                  
                  if (t > 0) {
                    const intersectX = rayOrigin.x + t * rayDir.x;
                    const intersectZ = rayOrigin.z + t * rayDir.z;
                    const intersectGPos = worldToGrid(intersectX, intersectZ);
                    const intersectGx = intersectGPos.x - Math.floor((dims.w - 1) / 2);
                    const intersectGz = intersectGPos.z - Math.floor((dims.d - 1) / 2);
                    
                    // Check if we can place at this intersection point
                    if (canPlace(intersectGx, intersectGz, dims.w, dims.d, testY, hp, false)) {
                      // Found a gap! Use this position instead of the roof
                      gx = intersectGx;
                      gz = intersectGz;
                      gy = testY;
                      foundPosition = true;
                      break;
                    }
                  }
                }
              }
            }
          }
          
        } else if (isBottomFace) {
          // BOTTOM FACE: Place below the brick we clicked
          const gPos = worldToGrid(hit.point.x, hit.point.z);
          gx = gPos.x - Math.floor((dims.w - 1) / 2);
          gz = gPos.z - Math.floor((dims.d - 1) / 2);
          gy = hitGrid.gy - hp;
          if (gy < 0) gy = 0;
          
        } else if (isSideFace) {
          // SIDE FACE: Place adjacent to the brick
          // Nudge the hit point outward along the normal to get adjacent position
          const nudgedX = hit.point.x + hitNormal.x * STUD * 0.6;
          const nudgedZ = hit.point.z + hitNormal.z * STUD * 0.6;
          const gPos = worldToGrid(nudgedX, nudgedZ);
          gx = gPos.x - Math.floor((dims.w - 1) / 2);
          gz = gPos.z - Math.floor((dims.d - 1) / 2);
          
          // Use Y position where user clicked, converted to grid
          // This allows both gap filling (click low) and stacking (click high)
          const clickedGy = Math.round((hit.point.y - BASE_Y) / PLATE_H);
          
          // Align to brick boundaries (multiples of hp for bricks)
          // Then scan for nearest valid Y level
          const alignedGy = Math.floor(clickedGy / hp) * hp;
          
          // First try the aligned position
          if (canPlace(gx, gz, dims.w, dims.d, alignedGy, hp, false)) {
            gy = alignedGy;
          } else {
            // Scan nearby Y levels to find a valid position
            // Check both up and down from the clicked level
            gy = alignedGy;
            for (let offset = 0; offset <= 12; offset += hp) {
              // Try below first (gap filling)
              const tryDown = alignedGy - offset;
              if (tryDown >= 0 && canPlace(gx, gz, dims.w, dims.d, tryDown, hp, false)) {
                gy = tryDown;
                break;
              }
              // Then try above (stacking)
              const tryUp = alignedGy + offset;
              if (canPlace(gx, gz, dims.w, dims.d, tryUp, hp, false)) {
                gy = tryUp;
                break;
              }
            }
          }
          
        } else {
          // Angled face - use hit point and findY
          const gPos = worldToGrid(hit.point.x, hit.point.z);
          gx = gPos.x - Math.floor((dims.w - 1) / 2);
          gz = gPos.z - Math.floor((dims.d - 1) / 2);
          gy = findY(gx, gz, dims.w, dims.d, hp);
        }
      } else {
        // Ground/baseplate hit - place at GROUND LEVEL, not findY (which finds top of column).
        // The mesh center sits brickH/2 above the footprint. A ground-plane hit puts
        // that center off the cursor ray. Aim the stud snap at the visual center
        // (body plus studs) so the ghost, the placed brick, and a later delete
        // all land on the pointer. Even widths sit on a grid line, so floor(wx/STUD)
        // would walk the center one stud positive; floor(wx/STUD - (w-1)/2) maps
        // the center back to the same cell.
        const onBase = hitBrick && hitBrick.userData.grid;
        const baseGy = onBase ? hitBrick.userData.grid.gy + hitBrick.userData.grid.hp : 0;
        const studExtra = (types[selectedBrick] && types[selectedBrick].noStuds) ? 0 : STUD_H;
        const yCenter = calcWorldY(baseGy, brickH) + (brickH + studExtra) / 2;
        let placeX = hit.point.x;
        let placeZ = hit.point.z;
        const aimRay = raycaster.ray;
        if (aimRay.direction.y < -0.05) {
          const tAim = (yCenter - aimRay.origin.y) / aimRay.direction.y;
          if (tAim > 0) {
            const cx = aimRay.origin.x + tAim * aimRay.direction.x;
            const cz = aimRay.origin.z + tAim * aimRay.direction.z;
            if (pointerOnPlate({ x: cx, z: cz })) {
              placeX = cx;
              placeZ = cz;
            }
          }
        }
        gx = Math.floor(placeX / STUD - (dims.w - 1) / 2);
        gz = Math.floor(placeZ / STUD - (dims.d - 1) / 2);
        
        // Check if hitting a baseplate brick (has grid data) vs infinite ground plane
        if (hitBrick && hitBrick.userData.grid) {
          // Clicked on actual baseplate brick - place on top of it
          gy = hitBrick.userData.grid.gy + hitBrick.userData.grid.hp;
        } else {
          // Clicked on infinite ground plane - place at ground level
          // Only use findY if there's NO collision at Y=0
          if (canPlace(gx, gz, dims.w, dims.d, 0, hp, false)) {
            gy = 0;
          } else {
            // Something at ground level - scan upward for first available gap
            // This handles doorways where the brick footprint might partially overlap walls
            gy = 0;
            for (let testY = 0; testY < 100; testY++) {
              if (canPlace(gx, gz, dims.w, dims.d, testY, hp, false)) {
                gy = testY;
                break;
              }
            }
          }
        }
      }
      
      // Check if we can place here (collision only, no support check)
      let canPlaceHere = canPlace(gx, gz, dims.w, dims.d, gy, hp, false);
      
      // FALLBACK SEARCH: If can't place at calculated position, search nearby
      // This handles edge cases where click position drifts by 1 stud due to raycasting precision
      if (!canPlaceHere) {
        const originalGx = gx, originalGz = gz, originalGy = gy;
        let foundAlternative = false;
        
        // Search pattern: try nearby positions (prioritize same X/Z, different Y first)
        // Then try adjacent X/Z positions at various Y levels
        const searchOffsets = [
          // Stack in the same column only. Adjacent XZ jumps felt like the ghost teleporting.
          {dx: 0, dz: 0, dyStart: 0, dyEnd: 30, dyStep: hp}
        ];
        
        for (const offset of searchOffsets) {
          for (let testY = offset.dyStart; testY <= offset.dyEnd; testY += offset.dyStep) {
            const testGx = originalGx + offset.dx;
            const testGz = originalGz + offset.dz;
            if (canPlace(testGx, testGz, dims.w, dims.d, testY, hp, false)) {
              gx = testGx;
              gz = testGz;
              gy = testY;
              canPlaceHere = true;
              foundAlternative = true;
              break;
            }
          }
          if (foundAlternative) break;
        }
      }
      
      const pos = new THREE.Vector3(
        gx * STUD + (dims.w * STUD) / 2,
        calcWorldY(gy, brickH),
        gz * STUD + (dims.d * STUD) / 2
      );
      
      ghost = createBrick(selectedBrick, softGhostColor(canPlaceHere), pos, currentRotation, true, {pitch: currentPitch, roll: currentRoll});
      if (ghost) {
        ghost.userData.ghostData = {gx, gz, gy, w: dims.w, d: dims.d, hp, canPlace: canPlaceHere, pitch: currentPitch, roll: currentRoll};
        scene.add(ghost);
      }
      
      // Create mirror ghost previews if mirror mode is on
      if (mirrorOn && ghost) {
        createMirrorGhosts(gx, gz, gy, dims, hp, brickH);
      }
    }
    
    function createPrefabGhosts(baseGx, baseGz) {
      const prefab = prefabs[selectedPrefab];
      if (!prefab) return;
      
      let allCanPlace = true;
      let allMirrorCanPlace = true;
      
      // Find base Y position - but check for gaps first!
      let baseGy = findY(baseGx, baseGz, 1, 1, 1);
      
      // GAP FILLING FOR PREFABS: When looking downward through a gap (like a doorway),
      // check if there's a lower position where the prefab can be placed
      const rayDir = raycaster.ray.direction.clone();
      const rayOrigin = raycaster.ray.origin.clone();
      
      if (rayDir.y < -0.1 && baseGy > 0) {
        // Calculate prefab footprint to check if entire prefab fits in gap
        let prefabMinDy = 0, prefabMaxDy = 0;
        let prefabMaxHp = 3; // Default brick height
        for (const item of prefab) {
          const dy = item.dy || 0;
          const hp = getHP(item.type) || 3;
          prefabMinDy = Math.min(prefabMinDy, dy);
          prefabMaxDy = Math.max(prefabMaxDy, dy + hp);
        }
        const prefabTotalHeight = prefabMaxDy - prefabMinDy;
        
        // Scan from ground up to find the lowest Y where prefab could fit
        for (let testY = 0; testY < baseGy; testY++) {
          // Check if we can place the base of the prefab here
          // and if there's room for the full prefab height
          let canFitHere = true;
          
          // Quick check: is there empty space at this Y for a reasonable footprint?
          if (canPlace(baseGx, baseGz, 2, 2, testY, 3, false)) {
            // Found a potential gap - verify the ray actually passes through here
            const gapWorldY = calcWorldY(testY, BRICK_HEIGHT) + BRICK_HEIGHT / 2;
            const t = (gapWorldY - rayOrigin.y) / rayDir.y;
            
            if (t > 0) {
              const intersectX = rayOrigin.x + t * rayDir.x;
              const intersectZ = rayOrigin.z + t * rayDir.z;
              const intersectGPos = worldToGrid(intersectX, intersectZ);
              
              // Check if intersection is near our target position
              const dx = Math.abs(intersectGPos.x - baseGx);
              const dz = Math.abs(intersectGPos.z - baseGz);
              
              if (dx <= 4 && dz <= 4) {
                // Use this lower gap position!
                baseGy = testY;
                break;
              }
            }
          }
        }
      }
      
      // Calculate the bounding box of the prefab to mirror correctly
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      
      // First pass: create main prefab ghosts and calculate bounds
      const prefabBricks = [];
      
      for (const item of prefab) {
        // Apply current rotation to the prefab offsets
        let dx = item.dx || 0;
        let dz = item.dz || 0;
        let itemRot = item.rot || 0;
        
        // Rotate dx/dz based on currentRotation
        if (currentRotation === 90) {
          [dx, dz] = [-dz, dx];
          itemRot = (itemRot + 90) % 360;
        } else if (currentRotation === 180) {
          [dx, dz] = [-dx, -dz];
          itemRot = (itemRot + 180) % 360;
        } else if (currentRotation === 270) {
          [dx, dz] = [dz, -dx];
          itemRot = (itemRot + 270) % 360;
        }
        
        const gx = baseGx + dx;
        const gz = baseGz + dz;
        const gy = baseGy + (item.dy || 0);
        const color = item.color || selectedColor;
        const itemTransparent = item.transparent || false;
        
        const t = types[item.type];
        if (!t) continue;
        
        const dims = getEffectiveDims(item.type, itemRot);
        const hp = getHP(item.type);
        const brickH = getBrickHeight(item.type);
        
        // Track bounds for mirroring
        minX = Math.min(minX, gx);
        maxX = Math.max(maxX, gx + dims.w);
        minZ = Math.min(minZ, gz);
        maxZ = Math.max(maxZ, gz + dims.d);
        
        // Check if we can place here
        // Prefabs bypass support check - they're designed as connected structures
        const canPlaceHere = canPlace(gx, gz, dims.w, dims.d, gy, hp, false);
        if (!canPlaceHere) allCanPlace = false;
        
        const pos = new THREE.Vector3(
          gx * STUD + (dims.w * STUD) / 2,
          calcWorldY(gy, brickH),
          gz * STUD + (dims.d * STUD) / 2
        );
        
        // Use cyan for valid prefab ghosts, red for invalid
        const ghostColor = softGhostColor(canPlaceHere);
        const prefabGhost = createBrick(item.type, ghostColor, pos, itemRot, true);
        if (prefabGhost) {
          prefabGhost.userData.prefabData = {gx, gz, gy, w: dims.w, d: dims.d, hp, rot: itemRot, type: item.type, color, transparent: itemTransparent, canPlace: canPlaceHere};
          scene.add(prefabGhost);
          prefabGhosts.push(prefabGhost);
        }
        
        // Store brick data for mirroring
        prefabBricks.push({gx, gz, gy, dims, hp, brickH, itemRot, type: item.type, color, transparent: itemTransparent});
      }
      
      // Store overall placement info on first ghost for click handler
      if (prefabGhosts.length > 0) {
        prefabGhosts[0].userData.prefabPlacement = {
          baseGx, baseGz, baseGy,
          canPlace: allCanPlace,
          prefabName: selectedPrefab
        };
      }
      
      // Create mirrored prefab ghosts if mirror mode is on
      if (mirrorOn && prefabBricks.length > 0) {
        const prefabW = maxX - minX;
        const prefabD = maxZ - minZ;
        
        // Get mirror positions for the prefab's base position
        const mirrorBasePositions = getMirrorPositions(baseGx, baseGz, prefabW, prefabD);
        
        for (const mirrorBase of mirrorBasePositions) {
          let mirrorSetCanPlace = true;
          const mirrorBricksData = [];
          
          for (const brick of prefabBricks) {
            // Calculate offset from original base
            const offsetX = brick.gx - baseGx;
            const offsetZ = brick.gz - baseGz;
            
            // Mirror the offsets based on axis
            let mirrorOffsetX = offsetX;
            let mirrorOffsetZ = offsetZ;
            let mirrorRot = brick.itemRot;
            
            // Determine which mirror this is
            const isMirrorX = (mirrorBase.gx !== baseGx);
            const isMirrorZ = (mirrorBase.gz !== baseGz);
            
            if (isMirrorX && !isMirrorZ) {
              // Mirror across X - flip X offset, keep Z
              mirrorOffsetX = prefabW - offsetX - brick.dims.w;
              mirrorRot = getMirroredRotation(brick.itemRot, 'x');
            } else if (!isMirrorX && isMirrorZ) {
              // Mirror across Z - flip Z offset, keep X
              mirrorOffsetZ = prefabD - offsetZ - brick.dims.d;
              mirrorRot = getMirroredRotation(brick.itemRot, 'z');
            } else if (isMirrorX && isMirrorZ) {
              // Mirror across both
              mirrorOffsetX = prefabW - offsetX - brick.dims.w;
              mirrorOffsetZ = prefabD - offsetZ - brick.dims.d;
              mirrorRot = getMirroredRotation(brick.itemRot, 'both');
            }
            
            const mgx = mirrorBase.gx + mirrorOffsetX;
            const mgz = mirrorBase.gz + mirrorOffsetZ;
            const mgy = brick.gy;
            
            const canPlaceHere = canPlace(mgx, mgz, brick.dims.w, brick.dims.d, mgy, brick.hp, false);
            if (!canPlaceHere) mirrorSetCanPlace = false;
            
            const pos = new THREE.Vector3(
              mgx * STUD + (brick.dims.w * STUD) / 2,
              calcWorldY(mgy, brick.brickH),
              mgz * STUD + (brick.dims.d * STUD) / 2
            );
            
            // Purple color for mirror ghosts
            const ghostColor = softGhostColor(canPlaceHere);
            const mirrorGhost = createBrick(brick.type, ghostColor, pos, mirrorRot, true);
            if (mirrorGhost) {
              mirrorGhost.userData.prefabData = {
                gx: mgx, gz: mgz, gy: mgy, 
                w: brick.dims.w, d: brick.dims.d, hp: brick.hp, 
                rot: mirrorRot, type: brick.type, 
                color: brick.color, transparent: brick.transparent,
                canPlace: canPlaceHere,
                isMirror: true
              };
              scene.add(mirrorGhost);
              mirrorGhosts.push(mirrorGhost);
              mirrorBricksData.push(mirrorGhost.userData.prefabData);
            }
          }
          
          // Store mirror placement info
          if (mirrorGhosts.length > 0 && mirrorBricksData.length > 0) {
            if (!mirrorGhosts[0].userData.mirrorPlacements) {
              mirrorGhosts[0].userData.mirrorPlacements = [];
            }
            mirrorGhosts[0].userData.mirrorPlacements.push({
              canPlace: mirrorSetCanPlace,
              bricks: mirrorBricksData
            });
          }
          
          if (!mirrorSetCanPlace) allMirrorCanPlace = false;
        }
      }
    }
    
    function createMirrorGhosts(gx, gz, gy, dims, hp, brickH) {
      const mirrorPositions = getMirrorPositions(gx, gz, dims.w, dims.d);
      
      for (const mp of mirrorPositions) {
        const mirrorGy = findY(mp.gx, mp.gz, dims.w, dims.d, hp);
        // Mirror bypasses support check - mirrors copy main placement
        const canPlaceMirror = canPlace(mp.gx, mp.gz, dims.w, dims.d, mirrorGy, hp, false);
        
        const mirrorPos = new THREE.Vector3(
          mp.gx * STUD + (dims.w * STUD) / 2,
          calcWorldY(mirrorGy, brickH),
          mp.gz * STUD + (dims.d * STUD) / 2
        );
        
        // Use a different color for mirror ghosts (purple tint)
        const mirrorGhost = createBrick(selectedBrick, softGhostColor(canPlaceMirror), mirrorPos, mp.rot, true);
        if (mirrorGhost) {
          mirrorGhost.userData.ghostData = {gx: mp.gx, gz: mp.gz, gy: mirrorGy, w: dims.w, d: dims.d, hp, canPlace: canPlaceMirror, rot: mp.rot};
          scene.add(mirrorGhost);
          mirrorGhosts.push(mirrorGhost);
        }
      }
    }
    
    function getMirrorPositions(gx, gz, w, d) {
      const positions = [];
      
      // Mirror line position (in grid coordinates)
      // The mirror line passes through mirrorOffset on the selected axis
      const mirrorLine = mirrorOffset;
      
      if (mirrorAxis === 'x' || mirrorAxis === 'both') {
        // Mirror across a vertical line parallel to Z axis (reflects X positions)
        // The brick's center X is at gx + w/2
        // Mirror formula: newX = 2*mirrorLine - oldX - w
        const mirrorGx = 2 * mirrorLine - gx - w;
        const mirrorGz = gz;
        const mirrorRot = getMirroredRotation(currentRotation, 'x');
        positions.push({gx: mirrorGx, gz: mirrorGz, rot: mirrorRot});
      }
      
      if (mirrorAxis === 'z' || mirrorAxis === 'both') {
        // Mirror across a horizontal line parallel to X axis (reflects Z positions)
        // The brick's center Z is at gz + d/2
        // Mirror formula: newZ = 2*mirrorLine - oldZ - d
        const mirrorGx = gx;
        const mirrorGz = 2 * mirrorLine - gz - d;
        const mirrorRot = getMirroredRotation(currentRotation, 'z');
        positions.push({gx: mirrorGx, gz: mirrorGz, rot: mirrorRot});
      }
      
      if (mirrorAxis === 'both') {
        // Mirror across both axes (point reflection through intersection)
        const mirrorGx = 2 * mirrorLine - gx - w;
        const mirrorGz = 2 * mirrorLine - gz - d;
        const mirrorRot = getMirroredRotation(currentRotation, 'both');
        positions.push({gx: mirrorGx, gz: mirrorGz, rot: mirrorRot});
      }
      
      return positions;
    }
    
    function getMirroredRotation(rot, axis) {
      // For regular bricks, rotation doesn't change visually when mirrored
      // For slopes, we need to flip the rotation to maintain the slope direction
      const isSlope = selectedBrick && selectedBrick.includes('slope');
      
      if (!isSlope) {
        // For non-slopes, mirroring across X flips 90<->270, across Z flips 0<->180
        if (axis === 'x') {
          if (rot === 90) return 270;
          if (rot === 270) return 90;
        } else if (axis === 'z') {
          if (rot === 0) return 180;
          if (rot === 180) return 0;
        } else if (axis === 'both') {
          if (rot === 0) return 180;
          if (rot === 180) return 0;
          if (rot === 90) return 270;
          if (rot === 270) return 90;
        }
      } else {
        // For slopes, mirror the slope direction
        if (axis === 'x') {
          if (rot === 90) return 270;
          if (rot === 270) return 90;
        } else if (axis === 'z') {
          if (rot === 0) return 180;
          if (rot === 180) return 0;
        } else if (axis === 'both') {
          if (rot === 0) return 180;
          if (rot === 180) return 0;
          if (rot === 90) return 270;
          if (rot === 270) return 90;
        }
      }
      return rot;
    }
    
    function updateMirrorLines() {
      // Remove existing lines
      for (const line of mirrorLines) {
        scene.remove(line);
      }
      mirrorLines = [];
      
      if (!mirrorOn) return;
      
      const lineLength = 100; // Long enough to be visible
      const lineHeight = 0.1; // Just above ground
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xff00ff, 
        linewidth: 2,
        transparent: true,
        opacity: 0.7
      });
      
      const mirrorPos = mirrorOffset * STUD;
      
      if (mirrorAxis === 'x' || mirrorAxis === 'both') {
        // Vertical line at X = mirrorOffset (parallel to Z axis)
        const points = [
          new THREE.Vector3(mirrorPos, lineHeight, -lineLength),
          new THREE.Vector3(mirrorPos, lineHeight, lineLength)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        scene.add(line);
        mirrorLines.push(line);
      }
      
      if (mirrorAxis === 'z' || mirrorAxis === 'both') {
        // Horizontal line at Z = mirrorOffset (parallel to X axis)
        const points = [
          new THREE.Vector3(-lineLength, lineHeight, mirrorPos),
          new THREE.Vector3(lineLength, lineHeight, mirrorPos)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        scene.add(line);
        mirrorLines.push(line);
      }
    }
    
    function removeGhost() {
      if (ghost) {
        scene.remove(ghost);
        ghost = null;
      }
      // Remove mirror ghosts
      for (const mg of mirrorGhosts) {
        scene.remove(mg);
      }
      mirrorGhosts = [];
      // Remove prefab ghosts
      for (const pg of prefabGhosts) {
        scene.remove(pg);
      }
      prefabGhosts = [];
      // Remove floor ghosts
      for (const fg of floorGhosts) {
        scene.remove(fg);
      }
      floorGhosts = [];
      // Remove wall ghosts
      for (const wg of wallGhosts) {
        scene.remove(wg);
      }
      wallGhosts = [];
    }

    function hideHoverGhost() {
      if (floorDragStart || wallDragStart) return;
      removeGhost();
      removeWallModeGhost();
      needsRender = true;
    }
    
    function removeWallModeGhost() {
      if (wallModeGhost) {
        scene.remove(wallModeGhost);
        wallModeGhost = null;
      }
    }
    
    function updateWallModeGhost() {
      removeWallModeGhost();
      if (orbitHidingGhost || cameraCoasting) return;
      const hit = pickPoint();
      if (!hit) return;
      if (!hit.brick && !pointerOnPlate(hit.point)) return;
      const worldPos = hit.point;
      const gPos = worldToGrid(worldPos.x, worldPos.z);
      
      // Wall builder uses 2x4 bricks
      const wallBrickType = '2x4';
      const t = types[wallBrickType];
      if (!t) return;
      
      // Wall direction based on rotation
      const isXWall = (currentRotation === 90 || currentRotation === 270);
      const wallRot = isXWall ? 90 : 0;
      
      const dims = getEffectiveDims(wallBrickType, wallRot);
      const hp = getHP(wallBrickType);
      
      // NO centering - brick corner is at grid position
      // This matches where the wall will actually start
      const gx = gPos.x;
      const gz = gPos.z;
      
      const gy = findY(gx, gz, dims.w, dims.d, hp);
      const brickH = getBrickHeight(wallBrickType);
      
      // Wall mode bypasses support check - walls are connected structures
      const canPlaceHere = canPlace(gx, gz, dims.w, dims.d, gy, hp, false);
      
      // Position brick with its corner at the grid position
      const pos = new THREE.Vector3(
        gx * STUD + (dims.w * STUD) / 2,
        calcWorldY(gy, brickH),
        gz * STUD + (dims.d * STUD) / 2
      );
      
      const ghostColor = softGhostColor(canPlaceHere);
      wallModeGhost = createBrick(wallBrickType, ghostColor, pos, wallRot, true);
      
      if (wallModeGhost) {
        // Store grid position for wall drag
        wallModeGhost.userData.gridPos = {x: gx, z: gz};
        
        wallModeGhost.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.opacity = 0.7;
          }
        });
        scene.add(wallModeGhost);
      }
    }
    
    // ==================== PLACE FEEDBACK, STARTERS, SHARE LINK ====================
    const placeBounces = [];
    const _bounceDummy = new THREE.Object3D();
    let dustPool = null;

    function showStarterBar() {
      if (bricks.length) return;
      const bar = document.getElementById('starterBar');
      if (bar) bar.classList.remove('hidden');
      document.querySelectorAll('.drawer-starters').forEach((el) => el.classList.remove('hidden'));
    }

    function hideStarterBar() {
      const bar = document.getElementById('starterBar');
      if (bar) bar.classList.add('hidden');
      document.querySelectorAll('.drawer-starters').forEach((el) => el.classList.add('hidden'));
      const daily = document.getElementById('dailyPrompt');
      if (daily) daily.hidden = true;
      const t = document.getElementById('toast');
      if (t && /Plate is ready|Tap a starter|ghost is your/i.test(t.textContent || '')) {
        t.classList.remove('show');
        t.style.transition = 'none';
        t.textContent = '';
      }
    }

    function bouncePlaced(brick) {
      if (!brick) return;
      placeBounces.push({ brick: brick, t0: performance.now(), dur: 170 });
      needsRender = true;
    }

    function applyBounce(brick, scaleY, lift) {
      if (brick.isInstancedBrick) {
        const lookup = instancedSystem.brickLookup.get(brick.instanceId);
        if (!lookup) return;
        const data = instancedSystem.meshes.get(lookup.key);
        if (!data) return;
        const index = data.instances.get(brick.instanceId);
        if (index === undefined) return;
        writeBrickInstance(_bounceDummy, lookup, lift, scaleY);
        data.mesh.setMatrixAt(index, _bounceDummy.matrix);
        data.mesh.instanceMatrix.needsUpdate = true;
        markShadowDirty();
      } else if (brick.position && brick.scale) {
        if (brick.userData._bounceBaseY === undefined) brick.userData._bounceBaseY = brick.position.y;
        brick.scale.set(1, scaleY, 1);
        brick.position.y = brick.userData._bounceBaseY + lift;
        markShadowDirty();
      }
    }

    function tickBounces() {
      if (!placeBounces.length) return;
      const now = performance.now();
      for (let i = placeBounces.length - 1; i >= 0; i--) {
        const item = placeBounces[i];
        const u = Math.min(1, (now - item.t0) / item.dur);
        const scaleY = u < 0.55
          ? 0.86 + (1.08 - 0.86) * (u / 0.55)
          : 1.08 + (1 - 1.08) * ((u - 0.55) / 0.45);
        applyBounce(item.brick, scaleY, (1 - u) * 0.08);
        if (u >= 1) {
          applyBounce(item.brick, 1, 0);
          placeBounces.splice(i, 1);
        }
      }
      needsRender = true;
    }

    function ensureDust() {
      if (dustPool) return dustPool;
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grd.addColorStop(0, 'rgba(230, 220, 200, 0.9)');
      grd.addColorStop(1, 'rgba(230, 220, 200, 0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(canvas);
      dustPool = [];
      for (let i = 0; i < 16; i++) {
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
        const spr = new THREE.Sprite(mat);
        spr.visible = false;
        spr.frustumCulled = false;
        scene.add(spr);
        dustPool.push({ spr: spr, t0: 0, life: 1, vx: 0, vz: 0, base: new THREE.Vector3() });
      }
      return dustPool;
    }

    function puffAt(position) {
      if (!position) return;
      const pool = ensureDust();
      const now = performance.now();
      for (let n = 0; n < 4; n++) {
        let slot = null;
        for (let i = 0; i < pool.length; i++) {
          if (!pool[i].spr.visible) { slot = pool[i]; break; }
        }
        if (!slot) slot = pool[n];
        slot.base.set(
          position.x + (Math.random() - 0.5) * 0.45,
          position.y + 0.04,
          position.z + (Math.random() - 0.5) * 0.45
        );
        slot.vx = (Math.random() - 0.5) * 0.7;
        slot.vz = (Math.random() - 0.5) * 0.7;
        slot.t0 = now;
        slot.life = 360 + Math.random() * 90;
        slot.spr.visible = true;
        slot.spr.position.copy(slot.base);
        slot.spr.material.opacity = 0.75;
        slot.spr.scale.set(0.22, 0.22, 0.22);
      }
      needsRender = true;
    }

    function tickDust() {
      if (!dustPool) return;
      const now = performance.now();
      let alive = false;
      for (let i = 0; i < dustPool.length; i++) {
        const slot = dustPool[i];
        if (!slot.spr.visible) continue;
        alive = true;
        const u = (now - slot.t0) / slot.life;
        if (u >= 1) {
          slot.spr.visible = false;
          slot.spr.material.opacity = 0;
          continue;
        }
        slot.spr.position.set(slot.base.x + slot.vx * u, slot.base.y + u * 0.38, slot.base.z + slot.vz * u);
        slot.spr.material.opacity = 0.75 * (1 - u);
        const sc = 0.22 + u * 0.65;
        slot.spr.scale.set(sc, sc, sc);
      }
      if (alive) needsRender = true;
    }

    function dropStarterBrick(type, color, gx, gz, gy, rot) {
      rot = rot || 0;
      const hp = getHP(type);
      const dims = getEffectiveDims(type, rot);
      if (!canPlace(gx, gz, dims.w, dims.d, gy, hp, true)) return null;
      const pos = new THREE.Vector3(
        gx * STUD + (dims.w * STUD) / 2,
        calcWorldY(gy, getBrickHeight(type)),
        gz * STUD + (dims.d * STUD) / 2
      );
      return commitPlacedBrick(type, color, pos, rot, {}, {
        gx: gx, gz: gz, w: dims.w, d: dims.d, gy: gy, hp: hp
      });
    }

    function placeStarter(kind) {
      const el = document.getElementById('starterSpecs');
      const specs = el ? JSON.parse(el.textContent) : null;
      const list = specs && specs[kind];
      if (!list) return 0;
      saveUndo();
      const placed = [];
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const brick = dropStarterBrick(s[0], s[1], s[2], s[3], s[4], 0);
        if (brick) placed.push(brick);
      }
      if (!placed.length) {
        toast('That spot is already built. Clear the plate and try again.', 'info');
        return 0;
      }
      for (let i = 0; i < placed.length; i++) bouncePlaced(placed[i]);
      puffAt(placed[0].position);
      SoundSystem.playPlace();
      hideStarterBar();
      const modal = document.getElementById('tutorialModal');
      if (modal) modal.classList.remove('visible');
      if (controls && placed[0].position) {
        controls.target.set(placed[0].position.x, 1.1, placed[0].position.z);
      }
      hasUnsavedChanges = true;
      updateStats();
      updateGhost();
      const names = { cottage: 'Cottage started', tower: 'Tower started', buggy: 'Buggy started' };
      toast(names[kind] || 'Starter placed', 'success');
      return placed.length;
    }

    const DAILY_PROMPTS = [
      'Build a tiny house with a door.',
      'Stack a tower taller than ten bricks.',
      'Make a buggy with four wheels.',
      'Lay a bridge across the plate.',
      'Light a small lighthouse.',
      'Wall in a tiny garden.',
      'Build a staircase to a platform.',
      'Shape a boat on the plate.',
      'Raise a castle corner.',
      'Stack a rainbow of bricks.',
      'Leave a doorway you can walk through.',
      'Build something that looks like a pet.'
    ];

    function dailyKey() {
      const d = new Date();
      return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }

    function phoneTutorialPending() {
      if (window.innerWidth > 768) return false;
      if (shareTokenFromLocation()) return false;
      try {
        if (localStorage.getItem('brickBuilderTutorialDismissed') === 'true') return false;
      } catch (e) {}
      const card = document.getElementById('phoneTutorial');
      if (card && card.dataset.closed === '1') return false;
      return true;
    }

    function dailyTipWillShow() {
      if (window.innerWidth <= 768 || bricks.length || shareTokenFromLocation()) return false;
      let dismissed = '';
      try { dismissed = localStorage.getItem('brixDailyDismissed') || ''; } catch (e) {}
      return dismissed !== dailyKey();
    }

    function initDailyPrompt() {
      const el = document.getElementById('dailyPrompt');
      if (!el) return;
      // On a phone the tip, the plate toast, and the starter chips used to
      // stack on the first screen. The tip stays a desktop empty-plate hint.
      if (window.innerWidth <= 768 || bricks.length || shareTokenFromLocation()) {
        el.hidden = true;
        return;
      }
      const key = dailyKey();
      let dismissed = '';
      try { dismissed = localStorage.getItem('brixDailyDismissed') || ''; } catch (e) {}
      if (dismissed === key) {
        el.hidden = true;
        return;
      }
      const start = new Date(new Date().getFullYear(), 0, 0);
      const doy = Math.floor((Date.now() - start.getTime()) / 86400000);
      const text = DAILY_PROMPTS[((doy % DAILY_PROMPTS.length) + DAILY_PROMPTS.length) % DAILY_PROMPTS.length];
      const label = el.querySelector('[data-daily-text]');
      if (label) label.textContent = 'Today: ' + text;
      el.hidden = false;
      const dismiss = el.querySelector('[data-daily-dismiss]');
      if (dismiss && !dismiss.dataset.bound) {
        dismiss.dataset.bound = '1';
        dismiss.addEventListener('click', () => {
          try { localStorage.setItem('brixDailyDismissed', key); } catch (e) {}
          el.hidden = true;
        });
      }
    }

    function buildShareRecords() {
      return bricks.map(b => ({
        t: b.userData.brickType || b.userData.type,
        c: b.userData.color,
        g: [b.userData.grid.gx, b.userData.grid.gz, b.userData.grid.gy],
        r: b.userData.rot || b.userData.rotation || 0
      }));
    }

    function bytesToBase64Url(bytes) {
      let bin = '';
      const step = 0x8000;
      for (let i = 0; i < bytes.length; i += step) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + step, bytes.length)));
      }
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    function base64UrlToBytes(text) {
      let s = String(text).replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      const bin = atob(s);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }

    async function encodeShareToken(records) {
      const json = JSON.stringify(records);
      const bytes = new TextEncoder().encode(json);
      if (typeof CompressionStream !== 'undefined') {
        try {
          const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
          const buf = new Uint8Array(await new Response(stream).arrayBuffer());
          return 'z' + bytesToBase64Url(buf);
        } catch (e) {}
      }
      return 'b' + bytesToBase64Url(bytes);
    }

    async function decodeShareToken(token) {
      const raw = String(token || '').trim();
      if (!raw) throw new Error('empty');
      const kind = raw.charAt(0);
      const payload = raw.slice(1);
      if (kind === 'z') {
        const bytes = base64UrlToBytes(payload);
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
        const text = await new Response(stream).text();
        return JSON.parse(text);
      }
      if (kind === 'b') {
        return JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
      }
      return JSON.parse(atob(raw));
    }

    function clearBuildForLoad() {
      bricks.forEach(b => { if (!b.isInstancedBrick) scene.remove(b); });
      bricks.length = 0;
      grid.clear();
      cellBrick.clear();
      clearInstancedBricks();
    }

    function applyCodeBricks(brickData) {
      if (!Array.isArray(brickData)) throw new Error('Invalid format');
      saveUndo();
      clearBuildForLoad();
      let placed = 0;
      brickData.forEach(b => {
        if (!b || !types[b.t] || !b.g) return;
        const hp = getHP(b.t);
        const dims = getEffectiveDims(b.t, b.r || 0);
        const pos = new THREE.Vector3(
          b.g[0] * STUD + (dims.w * STUD) / 2,
          calcWorldY(b.g[2], getBrickHeight(b.t)),
          b.g[1] * STUD + (dims.d * STUD) / 2
        );
        const brick = commitPlacedBrick(b.t, b.c, pos, b.r || 0, {}, {
          gx: b.g[0], gz: b.g[1], w: dims.w, d: dims.d, gy: b.g[2], hp: hp
        });
        if (brick) placed++;
      });
      updateStats();
      needsRender = true;
      hasUnsavedChanges = false;
      if (placed) hideStarterBar();
      return placed;
    }

    async function fillShareBox() {
      const records = buildShareRecords();
      if (!records.length) return;
      const token = await encodeShareToken(records);
      const url = location.origin + location.pathname + '#b=' + token;
      if (url.length > 32000) return;
      const box = document.getElementById('shareBuildCode');
      if (box) box.value = url;
    }

    async function copyShareLink() {
      const records = buildShareRecords();
      if (!records.length) {
        toast('Place a brick before sharing.', 'info');
        return;
      }
      const token = await encodeShareToken(records);
      const url = location.origin + location.pathname + '#b=' + token;
      if (url.length > 32000) {
        toast('This build is too big for a link. Use the build code.', 'info');
        return;
      }
      const box = document.getElementById('shareBuildCode');
      if (box) box.value = url;
      try {
        await navigator.clipboard.writeText(url);
        SoundSystem.playSuccess();
        toast('Share link copied', 'success');
      } catch (e) {
        SoundSystem.playClick();
        toast('Link is in the box. Copy it from there.', 'info');
      }
    }

    function shareTokenFromLocation() {
      const hash = location.hash || '';
      const hashMatch = hash.match(/(?:^#|[?&#])b=([^&]+)/);
      if (hashMatch) return decodeURIComponent(hashMatch[1]);
      try {
        const q = new URLSearchParams(location.search).get('b');
        if (q) return q;
      } catch (e) {}
      return '';
    }

    async function tryLoadShareFromLocation() {
      const token = shareTokenFromLocation();
      if (!token || bricks.length) return;
      try {
        const brickData = await decodeShareToken(token);
        if (!Array.isArray(brickData) || !brickData.length) return;
        const n = applyCodeBricks(brickData);
        frameCameraOnBuild();
        hideStarterBar();
        toast('Shared build loaded (' + n + ' bricks)', 'success');
      } catch (e) {
        toast('Could not read that share link', 'error');
      }
    }

    // ==================== BRICK ACTIONS ====================
    function placeBrick() {
      // Check if we're placing a prefab
      if (selectedPrefab && prefabGhosts.length > 0) {
        const placement = prefabGhosts[0].userData.prefabPlacement;
        if (placement && placement.canPlace) {
          placePrefabFromGhosts();
        }
        return;
      }
      
      if (!ghost || !ghost.userData.ghostData || !ghost.userData.ghostData.canPlace) return;
      
      saveUndo();
      
      const g = ghost.userData.ghostData;
      
      // Get texture if a photo is selected and this is a tile
      const t = types[selectedBrick];
      const useTexture = (selectedTexture !== null && t && t.noStuds) ? 
        uploadedTextures[selectedTexture]?.texture : null;
      
      const options = {
        transparent: isTransparent,
        pitch: currentPitch,
        roll: currentRoll,
        texture: useTexture
      };
      
      // Determine which color to use - light color for light bricks, regular color otherwise
      const placeColor = (t && t.light) ? selectedLightColor : selectedColor;
      
      const gridData = {gx: g.gx, gz: g.gz, w: g.w, d: g.d, gy: g.gy, hp: g.hp};
      const brick = commitPlacedBrick(selectedBrick, placeColor, ghost.position.clone(), currentRotation, options, gridData);
      if (brick) {
        if (useTexture) brick.userData.textureIndex = selectedTexture;
        if (isRecordingPrefab && !brick.isInstancedBrick) toggleBrickForPrefab(brick);
        hasUnsavedChanges = true;
      }
      
      // Place mirrored bricks
      if (mirrorOn) {
        for (const mg of mirrorGhosts) {
          const mgData = mg.userData.ghostData;
          if (mgData && mgData.canPlace) {
            const brickH = getBrickHeight(selectedBrick);
            const mirrorPos = new THREE.Vector3(
              mgData.gx * STUD + (mgData.w * STUD) / 2,
              calcWorldY(mgData.gy, brickH),
              mgData.gz * STUD + (mgData.d * STUD) / 2
            );
            
            commitPlacedBrick(selectedBrick, placeColor, mirrorPos, mgData.rot, {
              transparent: isTransparent,
              texture: useTexture
            }, {gx: mgData.gx, gz: mgData.gz, w: mgData.w, d: mgData.d, gy: mgData.gy, hp: mgData.hp});
          }
        }
      }
      
      if (brick) {
        bouncePlaced(brick);
        puffAt(brick.position);
        hideStarterBar();
      }
      updateStats();
      updateGhost();
      SoundSystem.playPlace();
    }
    
    function deleteBrick() {
      raycaster.setFromCamera(mouse, camera);
      const picked = pickBuild(raycaster.ray);
      let closestHit = null;
      let isInstancedHit = false;
      if (picked && picked.brick) {
        if (picked.brick.isInstancedBrick) {
          const lookup = instancedSystem.brickLookup.get(picked.brick.instanceId);
          const data = lookup && instancedSystem.meshes.get(lookup.key);
          const index = data && data.instances.get(picked.brick.instanceId);
          if (data && index !== undefined) {
            closestHit = { object: data.mesh, instanceId: index };
            isInstancedHit = true;
          }
        } else {
          closestHit = { object: picked.brick };
        }
      }
      if (!closestHit) return;
      
      if (isInstancedHit) {
        // Handle instanced brick deletion
        const mesh = closestHit.object;
        const instanceId = closestHit.instanceId;
        
        // Find which data object owns this mesh
        let foundData = null;
        let foundBrickId = null;
        instancedSystem.meshes.forEach(data => {
          if (data.mesh === mesh) {
            foundBrickId = data.reverseMap.get(instanceId);
            foundData = data;
          }
        });
        
        if (foundBrickId !== undefined) {
          saveUndo();
          
          // Find and remove from bricks array
          const brickIndex = bricks.findIndex(b => b.isInstancedBrick && b.instanceId === foundBrickId);
          if (brickIndex >= 0) {
            bricks.splice(brickIndex, 1);
          }
          
          // Remove from instanced system (also removes from grid)
          removeInstancedBrick(foundBrickId);
          
          if (gravityOn) applyGravity();
          updateStats();
          toast('🗑️ Deleted');
          SoundSystem.playDelete();
        }
      } else {
        // Handle regular brick deletion
        let obj = closestHit.object;
        while (obj && !obj.userData.isBrick) obj = obj.parent;
        
        if (obj && obj.userData.isBrick) {
          saveUndo();
          
          // If in prefab selection mode, deselect this brick
          if (isRecordingPrefab && selectedForPrefab.has(obj)) {
            toggleBrickForPrefab(obj);
          }
          
          removeFromGrid(obj);
          scene.remove(obj);
          markShadowDirty();
          bricks.splice(bricks.indexOf(obj), 1);
          if (gravityOn) applyGravity();
          updateStats();
          toast('🗑️ Deleted');
          SoundSystem.playDelete();
        }
      }
    }

    function deleteNewestBrick() {
      if (!bricks.length) return false;
      const brick = bricks[bricks.length - 1];
      saveUndo();
      if (brick.isInstancedBrick) {
        const id = brick.instanceId;
        const idx = bricks.lastIndexOf(brick);
        if (idx >= 0) bricks.splice(idx, 1);
        removeInstancedBrick(id);
      } else {
        removeFromGrid(brick);
        scene.remove(brick);
        const idx = bricks.indexOf(brick);
        if (idx >= 0) bricks.splice(idx, 1);
      }
      markShadowDirty();
      updateStats();
      needsRender = true;
      return true;
    }

    function setDeleteMode(on) {
      deleteMode = !!on;
      dropperMode = false;
      paintMode = false;
      facePaintMode = false;
      const deleteTool = document.getElementById('deleteBtn');
      const hudDel = document.getElementById('hudDeleteBtn');
      if (deleteTool) deleteTool.classList.toggle('delete-active', deleteMode);
      if (hudDel) hudDel.classList.toggle('delete-active', deleteMode);
      const dropperBtn = document.getElementById('dropperBtn');
      const paintBtn = document.getElementById('paintBtn');
      if (dropperBtn) dropperBtn.classList.remove('dropper-active');
      if (paintBtn) paintBtn.classList.remove('paint-active');
      document.body.classList.toggle('delete-mode', deleteMode);
      document.body.classList.remove('dropper-mode', 'paint-mode', 'facepaint-mode');
      const delBanner = document.getElementById('deleteModeBanner');
      if (delBanner) delBanner.classList.toggle('visible', deleteMode);
      updateGhost();
    }
    
    function pickColor() {
      const picked = pickPoint();
      const brick = picked && picked.brick;
      if (!brick || !brick.userData || brick.userData.color === undefined) return;
      const color = brick.userData.color;
      selectedColor = color;
      const hex = '#' + color.toString(16).padStart(6, '0');
      const picker = document.getElementById('colorPicker');
      if (picker) picker.value = hex;
      document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('selected'));
      toast('🎨 Color picked!', 'success');
      dropperMode = false;
      const dropperBtn = document.getElementById('dropperBtn');
      if (dropperBtn) dropperBtn.classList.remove('dropper-active');
      document.body.classList.remove('dropper-mode');
      updateGhost();
      const swatch = document.getElementById('hudColorSwatch');
      if (swatch) swatch.style.background = hex;
    }

        function paintBrick() {
      const picked = pickPoint();
      const brick = picked && picked.brick;
      if (!brick || !brick.userData || !brick.userData.isBrick) return;
      const ud = brick.userData;
      if (ud.color === selectedColor) {
        toast('Already this color');
        return;
      }
      if (brick.isInstancedBrick) {
        const foundBrickId = brick.instanceId;
        const brickIndex = bricks.findIndex(b => b.isInstancedBrick && b.instanceId === foundBrickId);
        if (brickIndex === -1) return;
        saveUndo();
        const virtualBrick = bricks[brickIndex];
        removeInstancedBrick(foundBrickId);
        bricks.splice(brickIndex, 1);
        const newBrickId = addInstancedBrick(
          ud.brickType,
          selectedColor,
          virtualBrick.position.clone(),
          ud.rot,
          ud.transparent,
          {
            gx: ud.grid.gx,
            gz: ud.grid.gz,
            w: ud.grid.w,
            d: ud.grid.d,
            gy: ud.grid.gy,
            hp: ud.grid.hp
          }
        );
        bricks.push({
          isInstancedBrick: true,
          instanceId: newBrickId,
          userData: {
            isBrick: true,
            grid: { gx: ud.grid.gx, gz: ud.grid.gz, w: ud.grid.w, d: ud.grid.d, gy: ud.grid.gy, hp: ud.grid.hp },
            brickType: ud.brickType,
            color: selectedColor,
            rot: ud.rot,
            transparent: ud.transparent
          },
          position: virtualBrick.position.clone()
        });
        toast('🎨 Painted!', 'success');
        updateStats();
        return;
      }
      saveUndo();
      brick.userData.color = selectedColor;
      if (brick.traverse) {
        brick.traverse(child => {
          if (child.isMesh && child.material && child.material.color) child.material.color.setHex(selectedColor);
        });
      }
      toast('🎨 Painted!', 'success');
      updateStats();
    }

    // Face paint - paint individual sides of bricks    // Face paint - paint individual sides of bricks
    function faceFromHit(brick, hit) {
      const lookup = instancedSystem.brickLookup.get(brick.instanceId);
      const g = brick.userData.grid;
      if (!lookup || !g) return null;
      const q = brickQuaternion(lookup).clone();
      const center = lookup.pos.clone();
      center.y += (g.hp * PLATE_H) / 2;
      const local = hit.point.clone().sub(center).applyQuaternion(q.invert());
      const ax = Math.abs(local.x);
      const ay = Math.abs(local.y);
      const az = Math.abs(local.z);
      if (ay >= ax && ay >= az) return null;
      if (ax >= az) return local.x >= 0 ? 'right' : 'left';
      return local.z >= 0 ? 'front' : 'back';
    }

    function tryPaintInstancedFace() {
      const meshes = [];
      instancedSystem.meshes.forEach((data) => { if (data.mesh.count > 0) meshes.push(data.mesh); });
      if (panelBatch.mesh && panelBatch.mesh.count > 0) meshes.push(panelBatch.mesh);
      if (!meshes.length) return false;
      const hits = raycaster.intersectObjects(meshes, false);
      if (!hits.length) return false;
      const hit = hits[0];
      if (panelBatch.mesh && hit.object === panelBatch.mesh) {
        let rec = null;
        panelBatch.byId.forEach((item) => { if (item.index === hit.instanceId) rec = item; });
        if (!rec) return false;
        const brick = bricks.find((b) => b.isInstancedBrick && b.instanceId === rec.brickId);
        if (rec.color === selectedColor) {
          removePanelInstance(rec.id);
          if (brick && brick.userData.facePanels) delete brick.userData.facePanels[rec.face];
          toast('Panel removed');
        } else {
          rec.color = selectedColor;
          if (brick && brick.userData.facePanels && brick.userData.facePanels[rec.face]) {
            brick.userData.facePanels[rec.face].color = selectedColor;
          }
          writePanelInstance(rec.id);
          toast(rec.face + ' face repainted!', 'success');
        }
        return true;
      }
      let brickId = null;
      instancedSystem.meshes.forEach((data) => {
        if (data.mesh === hit.object) brickId = data.reverseMap.get(hit.instanceId);
      });
      const brick = bricks.find((b) => b.isInstancedBrick && b.instanceId === brickId);
      if (!brick) return false;
      const face = faceFromHit(brick, hit);
      if (!face) {
        toast('Cannot paint top/bottom faces');
        return true;
      }
      if (!brick.userData.facePanels) brick.userData.facePanels = {};
      const existing = brick.userData.facePanels[face];
      if (existing && existing.color === selectedColor) {
        removePanelInstance(existing.panelId);
        delete brick.userData.facePanels[face];
        toast('Panel removed');
        return true;
      }
      if (existing) removePanelInstance(existing.panelId);
      saveUndo();
      addPanelInstance(brick, face, selectedColor);
      toast(face + ' face painted!', 'success');
      return true;
    }

    function facePaintBrick() {
      raycaster.setFromCamera(mouse, camera);
      if (tryPaintInstancedFace()) return;
      
      // First, check if we clicked on an existing face panel
      // Face painting only works on regular bricks (not instanced)
      const allMeshes = collectBrickMeshes(false); // Don't include instanced
      
      const allHits = raycaster.intersectObjects(allMeshes, false);
      for (const hit of allHits) {
        if (hit.object.userData.isFacePanel) {
          // Clicked on existing face panel - find parent brick
          let obj = hit.object.parent;
          while (obj && !obj.userData.isBrick) obj = obj.parent;
          
          if (obj && obj.userData.isBrick && obj.userData.facePanels) {
            const face = hit.object.userData.face;
            const existingPanel = obj.userData.facePanels[face];
            
            if (existingPanel) {
              if (existingPanel.color === selectedColor) {
                // Same color - remove panel
                saveUndo();
                obj.remove(existingPanel.mesh);
                delete obj.userData.facePanels[face];
                toast('🖌️ Panel removed');
              } else {
                // Different color - update panel color
                saveUndo();
                existingPanel.mesh.material.color.setHex(selectedColor);
                existingPanel.color = selectedColor;
                toast(`🖌️ ${face} face repainted!`, 'success');
              }
              return;
            }
          }
        }
      }
      
      const meshes = collectBrickMeshes(false).filter(m => !m.userData.isFacePanel);
      
      const hits = raycaster.intersectObjects(meshes, false);
      for (const hit of hits) {
        let obj = hit.object;
        while (obj && !obj.userData.isBrick) obj = obj.parent;
        
        if (obj && obj.userData.isBrick) {
          const g = obj.userData.grid;
          if (!g) return;
          
          // Get the face normal in world space, then convert to local
          const worldNormal = hit.face.normal.clone();
          worldNormal.transformDirection(hit.object.matrixWorld);
          
          // Convert to brick's local space
          const localNormal = worldNormal.clone();
          const invMatrix = new THREE.Matrix4().copy(obj.matrixWorld).invert();
          localNormal.transformDirection(invMatrix);
          
          // Determine which face based on local normal
          let face = null;
          const absX = Math.abs(localNormal.x);
          const absY = Math.abs(localNormal.y);
          const absZ = Math.abs(localNormal.z);
          
          if (absX > absY && absX > absZ) {
            face = localNormal.x > 0 ? 'right' : 'left';
          } else if (absZ > absY) {
            face = localNormal.z > 0 ? 'front' : 'back';
          } else {
            // Top or bottom - skip for now
            toast('Cannot paint top/bottom faces');
            return;
          }
          
          // Calculate brick dimensions
          const width = g.w * STUD;
          const depth = g.d * STUD;
          const height = g.hp * PLATE_H;
          
          // Check if there's already a panel on this face
          if (!obj.userData.facePanels) obj.userData.facePanels = {};
          
          const existingPanel = obj.userData.facePanels[face];
          if (existingPanel) {
            // Remove existing panel if same color (toggle off)
            if (existingPanel.color === selectedColor) {
              obj.remove(existingPanel.mesh);
              delete obj.userData.facePanels[face];
              toast('🖌️ Panel removed');
              return;
            }
            // Replace with new color
            obj.remove(existingPanel.mesh);
          }
          
          saveUndo();
          
          // Create panel geometry
          let panelWidth, panelHeight, position, rotation;
          const offset = 0.01; // Slight offset to prevent z-fighting
          
          switch(face) {
            case 'right':
              panelWidth = depth;
              panelHeight = height;
              position = new THREE.Vector3(width/2 + offset, height/2, depth/2);
              rotation = new THREE.Euler(0, Math.PI/2, 0);
              break;
            case 'left':
              panelWidth = depth;
              panelHeight = height;
              position = new THREE.Vector3(-offset, height/2, depth/2);
              rotation = new THREE.Euler(0, -Math.PI/2, 0);
              break;
            case 'front':
              panelWidth = width;
              panelHeight = height;
              position = new THREE.Vector3(width/2, height/2, depth + offset);
              rotation = new THREE.Euler(0, 0, 0);
              break;
            case 'back':
              panelWidth = width;
              panelHeight = height;
              position = new THREE.Vector3(width/2, height/2, -offset);
              rotation = new THREE.Euler(0, Math.PI, 0);
              break;
          }
          
          // Create the panel mesh
          const panelGeo = new THREE.PlaneGeometry(panelWidth - 0.02, panelHeight - 0.02);
          const panelMat = new THREE.MeshStandardMaterial({
            color: selectedColor,
            side: THREE.DoubleSide,
            roughness: 0.7,
            metalness: 0.1
          });
          const panel = new THREE.Mesh(panelGeo, panelMat);
          panel.userData.isFacePanel = true;
          panel.userData.face = face;
          
          // Position relative to brick's local origin (corner)
          panel.position.copy(position);
          panel.rotation.copy(rotation);
          
          // Add to brick
          obj.add(panel);
          
          // Store panel data
          obj.userData.facePanels[face] = {
            mesh: panel,
            color: selectedColor,
            face: face
          };
          
          toast(`🖌️ ${face} face painted!`, 'success');
          break;
        }
      }
    }
    
    // ==================== PREFABS ====================
    function selectPrefab(prefabName) {
      const apply = () => {
        if (selectedPrefab === prefabName) {
          selectedPrefab = null;
          document.querySelectorAll('.prefab-btn').forEach(b => b.classList.remove('selected'));
          toast('Prefab deselected');
        } else {
          selectedPrefab = prefabName;
          document.querySelectorAll('.prefab-btn').forEach(b => b.classList.remove('selected'));
          document.querySelector(`.prefab-btn[data-prefab="${prefabName}"]`)?.classList.add('selected');
          toast(`📦 ${prefabName} selected - click to place`);
        }
        updateGhost();
      };
      if (selectedPrefab === prefabName || prefabs[prefabName]) apply();
      else ensurePrefabs().then(apply);
    }
    
    function placePrefabFromGhosts() {
      if (!prefabGhosts.length) return;
      
      const placement = prefabGhosts[0].userData.prefabPlacement;
      if (!placement || !placement.canPlace) {
        toast('❌ Cannot place here', 'error');
        return;
      }
      
      saveUndo();
      
      let placedCount = 0;
      
      // Place main prefab bricks
      for (const pg of prefabGhosts) {
        const data = pg.userData.prefabData;
        if (!data || !data.canPlace) continue;
        
        const brickH = getBrickHeight(data.type);
        const pos = new THREE.Vector3(
          data.gx * STUD + (data.w * STUD) / 2,
          calcWorldY(data.gy, brickH),
          data.gz * STUD + (data.d * STUD) / 2
        );
        
        const useTransparent = data.transparent || isTransparent;
        if (commitPlacedBrick(data.type, data.color, pos, data.rot, {transparent: useTransparent}, {
          gx: data.gx, gz: data.gz, w: data.w, d: data.d, gy: data.gy, hp: data.hp
        })) placedCount++;
      }
      
      // Place mirrored prefab bricks
      if (mirrorOn && mirrorGhosts.length > 0) {
        for (const mg of mirrorGhosts) {
          const data = mg.userData.prefabData;
          if (!data || !data.canPlace) continue;
          
          const brickH = getBrickHeight(data.type);
          const pos = new THREE.Vector3(
            data.gx * STUD + (data.w * STUD) / 2,
            calcWorldY(data.gy, brickH),
            data.gz * STUD + (data.d * STUD) / 2
          );
          
          const useTransparent = data.transparent || isTransparent;
          if (commitPlacedBrick(data.type, data.color, pos, data.rot, {transparent: useTransparent}, {
            gx: data.gx, gz: data.gz, w: data.w, d: data.d, gy: data.gy, hp: data.hp
          })) placedCount++;
        }
      }
      
      updateStats();
      updateGhost();
      toast(`📦 Placed ${placement.prefabName} (${placedCount} bricks)`, 'success');
    }
    
    // Legacy function for compatibility
    function placePrefab(prefabName) {
      selectPrefab(prefabName);
    }
    
    // ==================== CUSTOM PREFAB SELECTION ====================
    function startPrefabSelection() {
      isRecordingPrefab = true;
      selectedForPrefab.clear();
      prefabSelectionHighlights.clear();
      
      // Update UI
      document.getElementById('startPrefabBtn').style.display = 'none';
      document.getElementById('stopPrefabBtn').style.display = 'block';
      document.getElementById('cancelPrefabBtn').style.display = 'block';
      document.getElementById('prefabRecordingInfo').style.display = 'block';
      document.getElementById('prefabBrickCount').textContent = '0';
      
      toast('🔵 Click bricks to select them for prefab');
    }
    
    function toggleBrickForPrefab(brick) {
      if (!brick || !brick.userData.grid) return;
      
      // Instanced bricks can't be selected for prefabs (can't highlight individually)
      if (brick.isInstancedBrick) {
        toast('⚠️ Instanced bricks cannot be selected for prefabs', 'error');
        return;
      }
      
      if (selectedForPrefab.has(brick)) {
        // Deselect - restore original color
        selectedForPrefab.delete(brick);
        const origColors = prefabSelectionHighlights.get(brick);
        if (origColors) {
          brick.traverse(child => {
            if (child.isMesh && child.material && origColors.has(child)) {
              child.material.color.setHex(origColors.get(child));
            }
          });
          prefabSelectionHighlights.delete(brick);
        }
      } else {
        // Select - highlight with blue tint
        selectedForPrefab.add(brick);
        const origColors = new Map();
        brick.traverse(child => {
          if (child.isMesh && child.material) {
            origColors.set(child, child.material.color.getHex());
            // Mix with blue to show selection
            const r = (child.material.color.r * 0.5 + 0.2);
            const g = (child.material.color.g * 0.5 + 0.4);
            const b = (child.material.color.b * 0.5 + 1.0);
            child.material.color.setRGB(Math.min(r, 1), Math.min(g, 1), Math.min(b, 1));
          }
        });
        prefabSelectionHighlights.set(brick, origColors);
      }
      
      document.getElementById('prefabBrickCount').textContent = selectedForPrefab.size;
    }
    
    function stopPrefabSelection() {
      if (selectedForPrefab.size === 0) {
        toast('❌ No bricks selected!', 'error');
        cancelPrefabSelection();
        return;
      }
      
      isRecordingPrefab = false;
      
      // Show name input
      document.getElementById('stopPrefabBtn').style.display = 'none';
      document.getElementById('cancelPrefabBtn').style.display = 'none';
      document.getElementById('prefabRecordingInfo').style.display = 'none';
      document.getElementById('prefabNameInput').style.display = 'flex';
      document.getElementById('customPrefabName').value = '';
      document.getElementById('customPrefabName').focus();
      
      toast(`✅ Selected ${selectedForPrefab.size} bricks - enter a name`);
    }
    
    function cancelPrefabSelection() {
      // Restore all brick colors (only for regular bricks with traverse)
      for (const [brick, origColors] of prefabSelectionHighlights) {
        if (brick.traverse) {
          brick.traverse(child => {
            if (child.isMesh && child.material && origColors.has(child)) {
              child.material.color.setHex(origColors.get(child));
            }
          });
        }
      }
      
      isRecordingPrefab = false;
      selectedForPrefab.clear();
      prefabSelectionHighlights.clear();
      
      // Reset UI
      document.getElementById('startPrefabBtn').style.display = 'block';
      document.getElementById('stopPrefabBtn').style.display = 'none';
      document.getElementById('cancelPrefabBtn').style.display = 'none';
      document.getElementById('prefabRecordingInfo').style.display = 'none';
      document.getElementById('prefabNameInput').style.display = 'none';
      
      toast('Prefab selection cancelled');
    }
    
    async function saveCustomPrefab() {
      const nameInput = document.getElementById('customPrefabName');
      let name = nameInput.value.trim();
      
      if (!name) {
        toast('❌ Please enter a name', 'error');
        return;
      }
      
      if (selectedForPrefab.size === 0) {
        toast('❌ No bricks selected!', 'error');
        return;
      }
      
      // Sanitize name for use as key
      const key = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Check if name already exists
      if (customPrefabs[key] || prefabs[key]) {
        const overwrite = await confirmLoad('Prefab "' + name + '" already exists. Overwrite?', { mode: 'delete' });
        if (!overwrite) return;
      }
      
      // Convert selected bricks to prefab data
      const brickArray = Array.from(selectedForPrefab);
      
      // Find base position (first brick's position)
      const firstBrick = brickArray[0];
      const basePos = firstBrick.userData.grid;
      
      // Build prefab data with relative positions
      const prefabData = brickArray.map(brick => {
        const g = brick.userData.grid;
        const brickType = brick.userData.type || brick.userData.brickType;
        return {
          type: brickType,
          dx: g.gx - basePos.gx,
          dy: g.gy - basePos.gy,
          dz: g.gz - basePos.gz,
          rot: brick.userData.rot || 0,
          color: brick.userData.color
        };
      });
      
      // Restore brick colors before saving (only for regular bricks with traverse)
      for (const [brick, origColors] of prefabSelectionHighlights) {
        if (brick.traverse) {
          brick.traverse(child => {
            if (child.isMesh && child.material && origColors.has(child)) {
              child.material.color.setHex(origColors.get(child));
            }
          });
        }
      }
      
      // Store the prefab
      customPrefabs[key] = prefabData;
      prefabs[key] = customPrefabs[key];
      
      // Add to UI
      addCustomPrefabToUI(key, name);
      
      // Reset state
      selectedForPrefab.clear();
      prefabSelectionHighlights.clear();
      
      // Reset UI
      document.getElementById('startPrefabBtn').style.display = 'block';
      document.getElementById('prefabNameInput').style.display = 'none';
      
      // Save to localStorage
      saveCustomPrefabsToStorage();
      
      toast(`✨ Prefab "${name}" saved! (${prefabData.length} bricks)`, 'success');
    }
    
    function addCustomPrefabToUI(key, displayName) {
      const list = document.getElementById('customPrefabsList');
      
      // Check if already exists
      if (document.querySelector(`.prefab-btn[data-prefab="${key}"]`)) {
        return;
      }
      
      const item = document.createElement('div');
      item.className = 'custom-prefab-item';
      item.innerHTML = `
        <button class="prefab-btn custom" data-prefab="${key}">🎨 ${escHtml(displayName)}</button>
        <button class="delete-prefab-btn" data-prefab="${key}">🗑️</button>
      `;
      
      // Add click listener for prefab button
      item.querySelector('.prefab-btn').addEventListener('click', () => {
        selectPrefab(key);
      });
      
      // Add click listener for delete button
      item.querySelector('.delete-prefab-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCustomPrefab(key, displayName);
      });
      
      list.appendChild(item);
    }
    
    async function deleteCustomPrefab(key, displayName) {
      if (!(await confirmLoad('Delete prefab "' + displayName + '"?', { mode: 'delete' }))) return;
      
      // Remove from data
      delete customPrefabs[key];
      delete prefabs[key];
      
      // Remove from UI
      const item = document.querySelector(`.custom-prefab-item .prefab-btn[data-prefab="${key}"]`)?.parentElement;
      if (item) item.remove();
      
      // Deselect if this was selected
      if (selectedPrefab === key) {
        selectedPrefab = null;
        updateGhost();
      }
      
      // Save to localStorage
      saveCustomPrefabsToStorage();
      
      toast(`Prefab "${displayName}" deleted`, 'success');
    }
    
    function saveCustomPrefabsToStorage() {
      try {
        const data = {};
        for (const key in customPrefabs) {
          // Extract display name from key
          const displayName = key.replace('custom_', '').replace(/_/g, ' ');
          data[key] = {
            name: displayName,
            bricks: customPrefabs[key]
          };
        }
        localStorage.setItem('brickBuilderCustomPrefabs', JSON.stringify(data));
      } catch (e) {
        console.warn('Could not save custom prefabs to localStorage', e);
      }
    }
    
    function loadCustomPrefabsFromStorage() {
      try {
        const stored = localStorage.getItem('brickBuilderCustomPrefabs');
        if (stored) {
          const data = JSON.parse(stored);
          for (const key in data) {
            const prefabData = data[key];
            customPrefabs[key] = prefabData.bricks;
            prefabs[key] = prefabData.bricks;
            addCustomPrefabToUI(key, prefabData.name);
          }
        }
      } catch (e) {
        console.warn('Could not load custom prefabs from localStorage', e);
      }
    }
    
    // ==================== FLOOR TOOL ====================
    function updateFloorGhost() {
      // Clear existing floor ghosts
      for (const fg of floorGhosts) {
        scene.remove(fg);
      }
      floorGhosts = [];
      
      if (!floorDragStart || !floorDragEnd) return;
      
      // Calculate the rectangle bounds
      const minX = Math.min(floorDragStart.x, floorDragEnd.x);
      const maxX = Math.max(floorDragStart.x, floorDragEnd.x);
      const minZ = Math.min(floorDragStart.z, floorDragEnd.z);
      const maxZ = Math.max(floorDragStart.z, floorDragEnd.z);
      
      const width = maxX - minX + 1;
      const depth = maxZ - minZ + 1;
      
      // Update info display
      const infoEl = document.getElementById('floorPreviewInfo');
      infoEl.textContent = `Floor: ${width}×${depth} studs (${width * depth} studs total)`;
      infoEl.classList.add('visible');
      
      // Find the Y level (use the start position's level)
      const baseGy = findY(minX, minZ, 1, 1, 1);
      
      // Create ghost bricks to fill the area using optimal plate sizes
      const placements = calculateFloorPlacements(minX, minZ, width, depth, baseGy);
      
      for (const p of placements) {
        const brickH = getBrickHeight(p.type);
        const dims = getEffectiveDims(p.type, 0);
        const pos = new THREE.Vector3(
          p.gx * STUD + (dims.w * STUD) / 2,
          calcWorldY(p.gy, brickH),
          p.gz * STUD + (dims.d * STUD) / 2
        );
        
        const canPlaceHere = canPlace(p.gx, p.gz, dims.w, dims.d, p.gy, p.hp, false);
        const ghostColor = softGhostColor(canPlaceHere);
        const floorGhost = createBrick(p.type, ghostColor, pos, 0, true);
        
        if (floorGhost) {
          floorGhost.userData.floorData = {...p, canPlace: canPlaceHere};
          scene.add(floorGhost);
          floorGhosts.push(floorGhost);
        }
      }
    }
    
    function calculateFloorPlacements(startX, startZ, width, depth, baseGy) {
      const placements = [];
      const filled = new Set();
      
      // Get the brick type based on floorType
      const getSuffix = () => {
        switch(floorType) {
          case 'tile': return 't';
          case 'brick': return '';
          default: return 'p';
        }
      };
      const suffix = getSuffix();
      const hp = floorType === 'brick' ? 3 : 1;
      
      // Try to use larger plates first for efficiency
      const plateSizes = [
        {w: 8, d: 8}, {w: 6, d: 6}, {w: 4, d: 6}, {w: 4, d: 4},
        {w: 2, d: 8}, {w: 2, d: 6}, {w: 2, d: 4}, {w: 2, d: 3}, {w: 2, d: 2},
        {w: 1, d: 6}, {w: 1, d: 4}, {w: 1, d: 3}, {w: 1, d: 2}, {w: 1, d: 1}
      ];
      
      // Fill the area with plates
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          const gx = startX + x;
          const gz = startZ + z;
          const key = `${gx},${gz}`;
          
          if (filled.has(key)) continue;
          
          // Find the largest plate that fits
          let placed = false;
          for (const size of plateSizes) {
            // Check if this plate fits in remaining space
            if (x + size.w > width || z + size.d > depth) continue;
            
            // Check if all cells are unfilled
            let canFit = true;
            for (let dx = 0; dx < size.w && canFit; dx++) {
              for (let dz = 0; dz < size.d && canFit; dz++) {
                if (filled.has(`${startX + x + dx},${startZ + z + dz}`)) {
                  canFit = false;
                }
              }
            }
            
            if (canFit) {
              // Check if this plate type exists
              const typeName = `${size.w}x${size.d}${suffix}`;
              if (!types[typeName]) {
                // Create the type if it doesn't exist
                types[typeName] = {
                  w: size.w, 
                  d: size.d, 
                  h: floorType === 'brick' ? 'b' : 'p',
                  noStuds: floorType === 'tile'
                };
              }
              
              // Mark cells as filled
              for (let dx = 0; dx < size.w; dx++) {
                for (let dz = 0; dz < size.d; dz++) {
                  filled.add(`${startX + x + dx},${startZ + z + dz}`);
                }
              }
              
              placements.push({
                type: typeName,
                gx: gx,
                gz: gz,
                gy: baseGy,
                hp: hp
              });
              
              placed = true;
              break;
            }
          }
          
          // Fallback to 1x1 if nothing else fits
          if (!placed && !filled.has(key)) {
            const typeName = `1x1${suffix}`;
            filled.add(key);
            placements.push({
              type: typeName,
              gx: gx,
              gz: gz,
              gy: baseGy,
              hp: hp
            });
          }
        }
      }
      
      return placements;
    }
    
    function placeFloor() {
      if (floorGhosts.length === 0) return;
      
      saveUndo();
      
      let placedCount = 0;
      
      for (const fg of floorGhosts) {
        const data = fg.userData.floorData;
        if (!data || !data.canPlace) continue;
        
        const brickH = getBrickHeight(data.type);
        const dims = getEffectiveDims(data.type, 0);
        const pos = new THREE.Vector3(
          data.gx * STUD + (dims.w * STUD) / 2,
          calcWorldY(data.gy, brickH),
          data.gz * STUD + (dims.d * STUD) / 2
        );
        
        if (commitPlacedBrick(data.type, selectedColor, pos, 0, {transparent: isTransparent}, {
          gx: data.gx, gz: data.gz, w: dims.w, d: dims.d, gy: data.gy, hp: data.hp
        })) placedCount++;
      }
      
      // Clear floor drag state
      floorDragStart = null;
      floorDragEnd = null;
      
      // Clear ghosts
      for (const fg of floorGhosts) {
        scene.remove(fg);
      }
      floorGhosts = [];
      
      // Hide info
      document.getElementById('floorPreviewInfo').classList.remove('visible');
      
      updateStats();
      toast(`⬜ Placed floor (${placedCount} plates)`, 'success');
      SoundSystem.playPlace();
    }
    
    function cancelFloorDrag() {
      floorDragStart = null;
      floorDragEnd = null;
      
      for (const fg of floorGhosts) {
        scene.remove(fg);
      }
      floorGhosts = [];
      
      document.getElementById('floorPreviewInfo').classList.remove('visible');
      
      // Re-enable orbit controls
      if (controls) controls.enabled = true;
    }
    
    // ==================== WALL TOOL ====================
    function updateWallGhost() {
      // Clear existing wall ghosts
      for (const wg of wallGhosts) {
        scene.remove(wg);
      }
      wallGhosts = [];
      
      if (!wallDragStart || !wallDragEnd) return;
      
      // Determine if this is an X-wall or Z-wall
      const isXWall = (currentRotation === 90 || currentRotation === 270);
      
      // For the starting position, we need to adjust based on drag direction
      // If dragging negative direction, the wall starts from the FAR edge of the starting brick
      // This ensures the starting click position is always included in the result
      
      let adjustedStartX = wallDragStart.x;
      let adjustedStartZ = wallDragStart.z;
      
      // Ghost brick dimensions depend on rotation shown
      const ghostIsXWall = (currentRotation === 90 || currentRotation === 270);
      const ghostBrickLenX = ghostIsXWall ? 4 : 2; // 2x4 at 90° = 4 wide, at 0° = 2 wide
      const ghostBrickLenZ = ghostIsXWall ? 2 : 4; // 2x4 at 90° = 2 deep, at 0° = 4 deep
      
      if (wallBoxMode) {
        // BOX MODE: Adjust both axes based on drag direction
        // So the box always includes the starting ghost brick position
        if (wallDragDirection.x < 0) {
          adjustedStartX = wallDragStart.x + ghostBrickLenX - 1;
        }
        if (wallDragDirection.z < 0) {
          adjustedStartZ = wallDragStart.z + ghostBrickLenZ - 1;
        }
      } else {
        // LINE MODE: Only adjust the axis we're building along
        if (ghostIsXWall && wallDragDirection.x < 0) {
          adjustedStartX = wallDragStart.x + ghostBrickLenX - 1;
        } else if (!ghostIsXWall && wallDragDirection.z < 0) {
          adjustedStartZ = wallDragStart.z + ghostBrickLenZ - 1;
        }
      }
      
      const startX = Math.min(adjustedStartX, wallDragEnd.x);
      const endX = Math.max(adjustedStartX, wallDragEnd.x);
      const startZ = Math.min(adjustedStartZ, wallDragEnd.z);
      const endZ = Math.max(adjustedStartZ, wallDragEnd.z);
      
      const deltaX = endX - startX;
      const deltaZ = endZ - startZ;
      
      let placements = [];
      
      if (wallBoxMode) {
        // BOX MODE: Create 4 walls forming a closed rectangle
        // Front/back X-walls extend full width INCLUDING corners
        // Left/right Z-walls fill the gap BETWEEN front and back (no overlap)
        
        const wd = wallDepth; // Wall thickness (2 studs for 2x4)
        
        // Front wall (along X at Z=startZ) - extends full width + corners
        // Must go from startX to (endX + wd - 1) to include right corner
        const frontPlacements = calculateWallPlacements(startX, startZ, endX + wd - 1, startZ, true);
        
        // Back wall (along X at Z=endZ) - same extension for corners
        const backPlacements = calculateWallPlacements(startX, endZ, endX + wd - 1, endZ, true);
        
        // Left wall (along Z at X=startX) - between front and back only
        const leftZStart = startZ + wd;
        const leftZEnd = endZ - 1;
        if (leftZEnd >= leftZStart) {
          const leftPlacements = calculateWallPlacements(startX, leftZStart, startX, leftZEnd, false);
          placements.push(...leftPlacements);
        }
        
        // Right wall (along Z at X=endX) - between front and back only
        const rightZStart = startZ + wd;
        const rightZEnd = endZ - 1;
        if (rightZEnd >= rightZStart) {
          const rightPlacements = calculateWallPlacements(endX, rightZStart, endX, rightZEnd, false);
          placements.push(...rightPlacements);
        }
        
        placements.push(...frontPlacements, ...backPlacements);
      } else {
        // LINE MODE: Single wall based on currentRotation
        // 0° or 180° = wall along Z axis, 90° or 270° = wall along X axis
        let isXWall = (currentRotation === 90 || currentRotation === 270);
        placements = calculateWallPlacements(startX, startZ, endX, endZ, isXWall);
      }
      
      // Calculate mirrored placements if mirror mode is on
      let mirrorPlacements = [];
      if (mirrorOn && !wallBoxMode) {
        // Mirror only works in line mode for simplicity
        const isXWall = (currentRotation === 90 || currentRotation === 270);
        const mirrorPoints = (sx, sz, ex, ez) => {
          const results = [];
          if (mirrorAxis === 'x' || mirrorAxis === 'both') {
            const msx = 2 * mirrorOffset - ex - 1;
            const mex = 2 * mirrorOffset - sx - 1;
            if (msx !== sx || mex !== ex) {
              results.push({startX: msx, startZ: sz, endX: mex, endZ: ez, isXWall});
            }
          }
          if (mirrorAxis === 'z' || mirrorAxis === 'both') {
            const msz = 2 * mirrorOffset - ez - 1;
            const mez = 2 * mirrorOffset - sz - 1;
            if (msz !== sz || mez !== ez) {
              results.push({startX: sx, startZ: msz, endX: ex, endZ: mez, isXWall});
            }
          }
          if (mirrorAxis === 'both') {
            const msx = 2 * mirrorOffset - ex - 1;
            const mex = 2 * mirrorOffset - sx - 1;
            const msz = 2 * mirrorOffset - ez - 1;
            const mez = 2 * mirrorOffset - sz - 1;
            results.push({startX: msx, startZ: msz, endX: mex, endZ: mez, isXWall});
          }
          return results;
        };
        
        const mirrorConfigs = mirrorPoints(startX, startZ, endX, endZ);
        for (const cfg of mirrorConfigs) {
          const mStart = Math.min(cfg.startX, cfg.endX);
          const mEnd = Math.max(cfg.startX, cfg.endX);
          const mStartZ = Math.min(cfg.startZ, cfg.endZ);
          const mEndZ = Math.max(cfg.startZ, cfg.endZ);
          const mp = calculateWallPlacements(mStart, mStartZ, mEnd, mEndZ, cfg.isXWall);
          mirrorPlacements = mirrorPlacements.concat(mp.map(p => ({...p, isMirror: true})));
        }
      }
      
      // Update info display
      const info = document.getElementById('wallPreviewInfo');
      const depthText = wallDepth > 1 ? ` × ${wallDepth} deep` : '';
      const modeText = wallBoxMode ? 'Box' : 'Wall';
      
      // Calculate actual wall dimensions
      const wallLengthStuds = Math.max(deltaX, deltaZ) + 1;
      
      // Calculate total pieces
      const bricksPerLayer = placements.length + mirrorPlacements.length;
      const totalPieces = bricksPerLayer * wallHeight;
      
      const sizeText = wallBoxMode 
        ? `${deltaX + 1}×${deltaZ + 1} studs` 
        : `${wallLengthStuds} studs long`;
      const mirrorText = mirrorOn && !wallBoxMode ? ' (mirrored)' : '';
      info.textContent = `${modeText}: ${sizeText} × ${wallHeight} high${depthText} (~${totalPieces} bricks)${mirrorText}`;
      info.classList.add('visible');
      
      // Helper to create wall ghost bricks - stacks brick layers
      const createWallGhosts = (placementList, isMirror = false) => {
        for (const p of placementList) {
          // Stack bricks vertically
          for (let layer = 0; layer < wallHeight; layer++) {
            const currentGy = p.baseGy + (layer * 3); // Each brick is 3 height units
            const dims = getEffectiveDims(p.type, p.rot);
            const hp = getHP(p.type);
            const brickH = getBrickHeight(p.type);
            
            // Wall builder bypasses support check - walls are connected by design
            // Only check collision, not support (layer 0 has ground, upper layers connect to lower)
            const canPlaceHere = canPlace(p.gx, p.gz, dims.w, dims.d, currentGy, hp, false);
            
            const pos = new THREE.Vector3(
              p.gx * STUD + (dims.w * STUD) / 2,
              calcWorldY(currentGy, brickH),
              p.gz * STUD + (dims.d * STUD) / 2
            );
            
            // Different colors: orange for main, cyan for mirror, red for invalid
            let ghostColor;
            if (!canPlaceHere) {
              ghostColor = 0xff4444;
            } else if (isMirror) {
              ghostColor = 0x22cccc;
            } else {
              ghostColor = 0xf97316;
            }
            
            const wallGhost = createBrick(p.type, ghostColor, pos, p.rot, true);
            if (wallGhost) {
              wallGhost.userData.wallData = {
                gx: p.gx, gz: p.gz, gy: currentGy,
                w: dims.w, d: dims.d, hp: hp,
                rot: p.rot, type: p.type,
                canPlace: canPlaceHere,
                isMirror: isMirror
              };
              scene.add(wallGhost);
              wallGhosts.push(wallGhost);
            }
          }
        }
      };
      
      // Create main wall ghosts
      createWallGhosts(placements, false);
      
      // Create mirrored wall ghosts
      if (mirrorOn && mirrorPlacements.length > 0) {
        createWallGhosts(mirrorPlacements, true);
      }
    }
    
    function calculateWallPlacements(startX, startZ, endX, endZ, isXWall) {
      const placements = [];
      
      // Base Y is ground or top of existing bricks at start position
      const baseGy = findY(startX, startZ, 1, 1, 1);
      
      if (isXWall) {
        // Wall runs along X axis - bricks rotated 90° so length is along X
        const wallLength = endX - startX + 1; // Length in studs
        
        // For depth, we need to cover wallDepth studs in Z direction
        const depthRows = Math.ceil(wallDepth / 2);
        
        for (let row = 0; row < depthRows; row++) {
          const zOffset = row * 2;
          if (zOffset >= wallDepth) continue;
          
          // Determine if this is a partial depth row (last row when wallDepth is odd)
          const isPartialDepth = (zOffset + 2 > wallDepth);
          
          // Fill along X axis with 2x4 bricks (4 studs each when rotated)
          let x = startX;
          while (x < startX + wallLength) {
            const remaining = (startX + wallLength) - x;
            
            let useType, useLen, useRot;
            
            if (remaining >= 4) {
              useType = isPartialDepth ? '1x4' : '2x4';
              useLen = 4;
              useRot = 90;
            } else if (remaining >= 3) {
              useType = isPartialDepth ? '1x3' : '2x3';
              useLen = 3;
              useRot = 90;
            } else if (remaining >= 2) {
              useType = isPartialDepth ? '1x2' : '2x2';
              useLen = 2;
              useRot = 90; // Keep 90° rotation for X-walls
            } else {
              // Single stud gap - place 1x1 for each depth position
              for (let d = 0; d < Math.min(wallDepth - zOffset, 2); d++) {
                if (!isPartialDepth || d === 0) {
                  placements.push({
                    type: '1x1',
                    gx: x,
                    gz: startZ + zOffset + d,
                    rot: 0,
                    baseGy: baseGy
                  });
                }
              }
              x += 1;
              continue;
            }
            
            placements.push({
              type: useType,
              gx: x,
              gz: startZ + zOffset,
              rot: useRot,
              baseGy: baseGy
            });
            
            x += useLen;
          }
        }
      } else {
        // Wall runs along Z axis - bricks at 0° so length (4) is along Z
        const wallLength = endZ - startZ + 1; // Length in studs
        
        // For depth, we need to cover wallDepth studs in X direction
        const depthRows = Math.ceil(wallDepth / 2);
        
        for (let row = 0; row < depthRows; row++) {
          const xOffset = row * 2;
          if (xOffset >= wallDepth) continue;
          
          // Determine if this is a partial depth row
          const isPartialDepth = (xOffset + 2 > wallDepth);
          
          // Fill along Z axis with 2x4 bricks (4 studs each)
          let z = startZ;
          while (z < startZ + wallLength) {
            const remaining = (startZ + wallLength) - z;
            
            let useType, useLen, useRot;
            
            if (remaining >= 4) {
              useType = isPartialDepth ? '1x4' : '2x4';
              useLen = 4;
              useRot = 0;
            } else if (remaining >= 3) {
              useType = isPartialDepth ? '1x3' : '2x3';
              useLen = 3;
              useRot = 0;
            } else if (remaining >= 2) {
              useType = isPartialDepth ? '1x2' : '2x2';
              useLen = 2;
              useRot = 0;
            } else {
              // Single stud gap - place 1x1 for each depth position
              for (let d = 0; d < Math.min(wallDepth - xOffset, 2); d++) {
                if (!isPartialDepth || d === 0) {
                  placements.push({
                    type: '1x1',
                    gx: startX + xOffset + d,
                    gz: z,
                    rot: 0,
                    baseGy: baseGy
                  });
                }
              }
              z += 1;
              continue;
            }
            
            placements.push({
              type: useType,
              gx: startX + xOffset,
              gz: z,
              rot: useRot,
              baseGy: baseGy
            });
            
            z += useLen;
          }
        }
      }
      
      return placements;
    }
    
    function placeWall() {
      if (wallGhosts.length === 0) return;
      
      saveUndo();
      
      let placedCount = 0;
      
      for (const wg of wallGhosts) {
        const data = wg.userData.wallData;
        if (!data || !data.canPlace) continue;
        
        const brickH = getBrickHeight(data.type);
        const pos = new THREE.Vector3(
          data.gx * STUD + (data.w * STUD) / 2,
          calcWorldY(data.gy, brickH),
          data.gz * STUD + (data.d * STUD) / 2
        );
        
        if (commitPlacedBrick(data.type, selectedColor, pos, data.rot, {transparent: isTransparent}, {
          gx: data.gx, gz: data.gz, w: data.w, d: data.d, gy: data.gy, hp: data.hp
        })) placedCount++;
      }
      
      // Clear wall state
      wallDragStart = null;
      wallDragEnd = null;
      
      // Clear ghosts
      for (const wg of wallGhosts) {
        scene.remove(wg);
      }
      wallGhosts = [];
      
      // Hide info
      document.getElementById('wallPreviewInfo').classList.remove('visible');
      
      updateStats();
      toast(`🧱 Placed wall (${placedCount} bricks)`, 'success');
      SoundSystem.playPlace();
    }
    
    function cancelWallDrag() {
      wallDragStart = null;
      wallDragEnd = null;
      
      for (const wg of wallGhosts) {
        scene.remove(wg);
      }
      wallGhosts = [];
      
      document.getElementById('wallPreviewInfo').classList.remove('visible');
      
      // Re-enable orbit controls
      if (controls) controls.enabled = true;
    }
    
    function applyGravity() {
      if (!gravityOn) return;
      let changed = true, iter = 0;
      while (changed && iter++ < 50) {
        changed = false;
        for (const brick of bricks) {
          const g = brick.userData.grid;
          if (!g || g.gy === 0) continue;
          
          // Gravity bypasses support check - it's finding where bricks land
          if (canPlace(g.gx, g.gz, g.w, g.d, g.gy - 1, g.hp, false)) {
            // Handle instanced vs regular bricks differently
            if (brick.isInstancedBrick) {
              // For instanced bricks, we need to remove and re-add with new position
              const brickType = brick.userData.brickType;
              const brickH = getBrickHeight(brickType);
              
              // Remove from grid (uses g.gx, g.gz, etc.)
              for (let dx = 0; dx < g.w; dx++) {
                for (let dz = 0; dz < g.d; dz++) {
                  const key = `${g.gx+dx},${g.gz+dz}`;
                  if (grid.has(key)) {
                    const levels = grid.get(key);
                    for (let h = 0; h < g.hp; h++) levels.delete(g.gy + h);
                    if (levels.size === 0) grid.delete(key);
                  }
                }
              }
              
              // Update grid Y
              g.gy = g.gy - 1;
              
              // Re-add to grid at new position
              for (let dx = 0; dx < g.w; dx++) {
                for (let dz = 0; dz < g.d; dz++) {
                  const key = `${g.gx+dx},${g.gz+dz}`;
                  if (!grid.has(key)) grid.set(key, new Set());
                  for (let h = 0; h < g.hp; h++) grid.get(key).add(g.gy + h);
                }
              }
              
              // Update the instance matrix
              const lookup = instancedSystem.brickLookup.get(brick.instanceId);
              if (lookup) {
                const data = instancedSystem.meshes.get(lookup.key);
                if (data) {
                  const index = data.instances.get(brick.instanceId);
                  if (index !== undefined) {
                    const newY = calcWorldY(g.gy, brickH);
                    brick.position.y = newY;
                    
                    const dummy = instancedSystem.dummy;
                    dummy.position.set(brick.position.x, newY, brick.position.z);
                    dummy.rotation.set(0, brick.userData.rot * Math.PI / 180, 0);
                    dummy.scale.set(1, 1, 1);
                    dummy.updateMatrix();
                    data.mesh.setMatrixAt(index, dummy.matrix);
                    data.mesh.instanceMatrix.needsUpdate = true;
                    markShadowDirty();
                  }
                }
              }
              changed = true;
            } else {
              // Regular mesh brick
              removeFromGrid(brick);
              g.gy = g.gy - 1;
              addToGrid(g.gx, g.gz, g.w, g.d, g.gy, g.hp, brick);
              const brickH = getBrickHeight(brick.userData.type);
              brick.position.y = calcWorldY(g.gy, brickH);
              markShadowDirty();
              changed = true;
            }
          }
        }
      }
    }
    
    // ==================== UI ====================
    function toast(msg, type = '', persist = false) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast show ' + type;
      clearTimeout(t.tid);
      // The first hint stays until a brick is placed. An 1.8s fade was a
      // late visual change and stretched the simulated Speed Index.
      if (!persist) t.tid = setTimeout(() => t.classList.remove('show'), 1800);
    }
    
    function updateStats() {
      document.getElementById('brickCount').textContent = bricks.length;
      let maxH = 0;
      const colors = new Set();
      bricks.forEach(b => {
        const g = b.userData.grid;
        if (g) maxH = Math.max(maxH, g.gy + g.hp);
        colors.add(b.userData.color);
      });
      // gy/hp are plate units (3 per brick). Show whole layers, rounded up,
      // so a 5-unit cottage is 2 and a single brick is 1.
      const layers = maxH <= 0 ? 0 : Math.ceil(maxH / 3);
      document.getElementById('heightStat').textContent = String(layers);
      applyShadowLod();
      document.getElementById('colorCount').textContent = colors.size;
      const hudCount = document.getElementById('hudBrickCount');
      if (hudCount) hudCount.textContent = String(bricks.length);
      const hudWord = document.getElementById('hudBrickWord');
      if (hudWord) hudWord.textContent = bricks.length === 1 ? 'brick' : 'bricks';
    }
    
    function updateUI() {
      const t = types[selectedBrick];
      let name = selectedBrick.toUpperCase();
      if (selectedBrick.includes('p')) name = selectedBrick.replace('p', '') + ' Plate';
      else if (selectedBrick.includes('t')) name = selectedBrick.replace('t', '') + ' Tile';
      else if (selectedBrick.startsWith('r')) name = 'Round ' + selectedBrick.replace('r', '');
      else if (selectedBrick.startsWith('slope')) name = 'Slope ' + selectedBrick.replace('slope', '');
      else name = selectedBrick + ' Brick';
      name = name.replace('x', '×');
      
      document.getElementById('previewName').textContent = name + (isTransparent ? ' 🔮' : '');
      const hudType = document.getElementById('hudBrickType');
      if (hudType) hudType.textContent = selectedBrick.replace(/x/g, '×');
      let rotText = currentRotation + '°';
      if (currentPitch !== 0 || currentRoll !== 0) {
        rotText += ` (P:${currentPitch}° R:${currentRoll}°)`;
      }
      document.getElementById('previewRot').textContent = rotText;
      document.getElementById('rotArrow').style.transform = `rotate(${currentRotation}deg)`;
      document.getElementById('rotDeg').textContent = currentRotation + '°';
    }
    
    function rotate(amount) {
      currentRotation = (currentRotation + amount + 360) % 360;
      updateUI();
      updateGhost();
      toast(`🔄 ${currentRotation}°`);
      SoundSystem.playRotate();
      const hudRot = document.getElementById('hudRotLabel');
      if (hudRot) hudRot.textContent = currentRotation + '°';
    }
    
    function resetRotation() {
      currentRotation = 0;
      currentPitch = 0;
      currentRoll = 0;
      updateUI();
      updateGhost();
    }
    
    // ==================== UNDO/REDO ====================
    function saveUndo() {
      hasUnsavedChanges = true; // Mark as having unsaved changes
      const state = bricks.map(b => {
        // Handle both regular bricks (userData.type) and instanced bricks (userData.brickType)
        const brickType = b.userData.type || b.userData.brickType;
        const brickState = {
          type: brickType, 
          color: b.userData.color, 
          rot: b.userData.rot,
          pitch: b.userData.pitch || 0, 
          roll: b.userData.roll || 0,
          transparent: b.userData.transparent || false, 
          grid: {...b.userData.grid}  // This has gx, gz, gy, w, d, hp
        };
        // Save face panels
        if (b.userData.facePanels && Object.keys(b.userData.facePanels).length > 0) {
          brickState.facePanels = {};
          for (const [face, panel] of Object.entries(b.userData.facePanels)) {
            brickState.facePanels[face] = panel.color;
          }
        }
        return brickState;
      });
      undoStack.push(state);
      if (undoStack.length > 50) undoStack.shift();
      redoStack = [];
    }
    
    function undo() {
      if (!undoStack.length) { toast('Nothing to undo'); return; }
      
      // Save current state for redo
      const currentState = bricks.map(b => {
        const brickType = b.userData.type || b.userData.brickType;
        const brickState = {
          type: brickType, 
          color: b.userData.color, 
          rot: b.userData.rot,
          pitch: b.userData.pitch || 0, 
          roll: b.userData.roll || 0,
          transparent: b.userData.transparent || false, 
          grid: {...b.userData.grid}
        };
        if (b.userData.facePanels && Object.keys(b.userData.facePanels).length > 0) {
          brickState.facePanels = {};
          for (const [face, panel] of Object.entries(b.userData.facePanels)) {
            brickState.facePanels[face] = panel.color;
          }
        }
        return brickState;
      });
      redoStack.push(currentState);
      
      // Restore previous state
      restore(undoStack.pop());
      toast('↶ Undone', 'success');
    }
    
    function redo() {
      if (!redoStack.length) { toast('Nothing to redo'); return; }
      
      // Save current state for undo
      const currentState = bricks.map(b => {
        const brickType = b.userData.type || b.userData.brickType;
        const brickState = {
          type: brickType, 
          color: b.userData.color, 
          rot: b.userData.rot,
          pitch: b.userData.pitch || 0, 
          roll: b.userData.roll || 0,
          transparent: b.userData.transparent || false, 
          grid: {...b.userData.grid}
        };
        if (b.userData.facePanels && Object.keys(b.userData.facePanels).length > 0) {
          brickState.facePanels = {};
          for (const [face, panel] of Object.entries(b.userData.facePanels)) {
            brickState.facePanels[face] = panel.color;
          }
        }
        return brickState;
      });
      undoStack.push(currentState);
      
      // Restore redo state
      restore(redoStack.pop());
      toast('↷ Redone', 'success');
    }
    
    function restore(state) {
      // Clear current scene
      bricks.forEach(b => { 
        if (!b.isInstancedBrick) {
          removeFromGrid(b); 
          scene.remove(b); 
        }
      });
      bricks = [];
      grid.clear(); cellBrick.clear();
      clearInstancedBricks(); // Clear all instanced meshes
      
      // Rebuild from state
      state.forEach(d => {
        // Support both formats: {gx, gz, gy} (from addToGrid) and {x, z, y} (legacy)
        const gx = d.grid.gx !== undefined ? d.grid.gx : d.grid.x;
        const gz = d.grid.gz !== undefined ? d.grid.gz : d.grid.z;
        const gy = d.grid.gy !== undefined ? d.grid.gy : d.grid.y;
        
        const dims = getEffectiveDims(d.type, d.rot);
        const hp = getHP(d.type);
        const brickH = getBrickHeight(d.type);
        
        const pos = new THREE.Vector3(
          gx * STUD + (dims.w * STUD) / 2,
          calcWorldY(gy, brickH),
          gz * STUD + (dims.d * STUD) / 2
        );
        
        const options = {
          transparent: d.transparent || false,
          pitch: d.pitch || 0,
          roll: d.roll || 0
        };
        
        options.facePanels = d.facePanels;
        const brick = commitPlacedBrick(d.type, d.color, pos, d.rot, options, {
          gx: gx, gz: gz, w: dims.w, d: dims.d, gy: gy, hp: hp
        });
        if (brick && d.facePanels && !brick.isInstancedBrick) {
          restoreFacePanelsFromData(brick, { w: dims.w, d: dims.d, hp: hp }, d.facePanels);
        }
      });
      updateStats();
    }
    
    // ==================== SAVE/LOAD ====================
    function save() {
      const data = {v: 4, bricks: bricks.map(b => {
        // Handle both regular bricks (userData.type) and instanced bricks (userData.brickType)
        const brickType = b.userData.type || b.userData.brickType;
        const brickData = {
          type: brickType, 
          color: b.userData.color, 
          rot: b.userData.rot,
          pitch: b.userData.pitch || 0,
          roll: b.userData.roll || 0,
          transparent: b.userData.transparent || false,
          grid: b.userData.grid
        };
        // Save face panels if any (only regular bricks have these)
        if (b.userData.facePanels && Object.keys(b.userData.facePanels).length > 0) {
          brickData.facePanels = {};
          for (const [face, panel] of Object.entries(b.userData.facePanels)) {
            brickData.facePanels[face] = panel.color;
          }
        }
        return brickData;
      })};
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `brick-creation-${Date.now()}.json`;
      a.click();
      hasUnsavedChanges = false; // Mark as saved
      toast('💾 Saved!', 'success');
    }
    
    function load() { document.getElementById('fileInput').click(); }
    
    function handleLoad(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          loadProjectData(data);
          toast('📁 Loaded!', 'success');
        } catch(err) { 
          console.error(err);
          toast('Load failed', 'error'); 
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
    
    async function clearAll() {
      if (!bricks.length) { toast('Nothing to clear'); return; }
      if (!(await confirmLoad('Clear all bricks?', { mode: 'delete' }))) return;
      saveUndo(); // Use full state save for clear all
      bricks.forEach(b => { 
        if (!b.isInstancedBrick) {
          removeFromGrid(b); 
          scene.remove(b); 
        }
      });
      bricks = [];
      grid.clear(); cellBrick.clear();
      clearInstancedBricks(); // Clear all instanced meshes
      updateStats();
      toast('🧹 Cleared', 'success');
    }
    
    // ==================== PROJECT MANAGEMENT ====================
    function getProjectData() {
      return {
        v: 4,
        name: document.getElementById('projectName').value || 'Untitled',
        savedAt: new Date().toISOString(),
        bricks: bricks.map(b => {
          if (b.isInstancedBrick) {
            // Instanced brick - extract data from virtual brick object
            return {
              type: b.userData.brickType,
              color: b.userData.color,
              rot: b.userData.rot || 0,
              transparent: b.userData.transparent || false,
              grid: b.userData.grid
            };
          } else {
            // Regular mesh brick
            const brickData = {
              type: b.userData.type,
              color: b.userData.color,
              rot: b.userData.rot,
              pitch: b.userData.pitch || 0,
              roll: b.userData.roll || 0,
              transparent: b.userData.transparent || false,
              grid: b.userData.grid
            };
            // Save face panels if any
            if (b.userData.facePanels && Object.keys(b.userData.facePanels).length > 0) {
              brickData.facePanels = {};
              for (const [face, panel] of Object.entries(b.userData.facePanels)) {
                brickData.facePanels[face] = panel.color;
              }
            }
            return brickData;
          }
        })
      };
    }
    
    function loadProjectData(data) {
      // Clear current scene
      bricks.forEach(b => { 
        if (!b.isInstancedBrick) {
          removeFromGrid(b); 
          scene.remove(b); 
        }
      });
      bricks = [];
      grid.clear(); cellBrick.clear();
      clearInstancedBricks(); // Clear all instanced meshes
      
      // Load bricks
      if (data.bricks) {
        data.bricks.forEach(d => {
          if (d.grid) {
            const brickH = getBrickHeight(d.type);
            const pos = new THREE.Vector3(
              d.grid.gx * STUD + (d.grid.w * STUD) / 2,
              calcWorldY(d.grid.gy, brickH),
              d.grid.gz * STUD + (d.grid.d * STUD) / 2
            );
            
            const options = {
              transparent: d.transparent || false,
              pitch: d.pitch || 0,
              roll: d.roll || 0,
              facePanels: d.facePanels
            };
            const brick = commitPlacedBrick(d.type, d.color, pos, d.rot, options, {
              gx: d.grid.gx, gz: d.grid.gz, w: d.grid.w, d: d.grid.d, gy: d.grid.gy, hp: d.grid.hp
            });
            if (brick && d.facePanels && !brick.isInstancedBrick) {
              restoreFacePanelsFromData(brick, d.grid, d.facePanels);
            }
          }
        });
      }
      
      updateStats();
      hasUnsavedChanges = false;
      if (bricks.length) hideStarterBar();
    }
    
    // Helper function to restore face panels from saved data
    function restoreFacePanelsFromData(brick, gridData, facePanelsData) {
      const width = gridData.w * STUD;
      const depth = gridData.d * STUD;
      const height = gridData.hp * PLATE_H;
      const offset = 0.01;
      
      brick.userData.facePanels = {};
      
      for (const [face, color] of Object.entries(facePanelsData)) {
        let panelWidth, panelHeight, position, rotation;
        
        switch(face) {
          case 'right':
            panelWidth = depth; panelHeight = height;
            position = new THREE.Vector3(width/2 + offset, height/2, depth/2);
            rotation = new THREE.Euler(0, Math.PI/2, 0);
            break;
          case 'left':
            panelWidth = depth; panelHeight = height;
            position = new THREE.Vector3(-offset, height/2, depth/2);
            rotation = new THREE.Euler(0, -Math.PI/2, 0);
            break;
          case 'front':
            panelWidth = width; panelHeight = height;
            position = new THREE.Vector3(width/2, height/2, depth + offset);
            rotation = new THREE.Euler(0, 0, 0);
            break;
          case 'back':
            panelWidth = width; panelHeight = height;
            position = new THREE.Vector3(width/2, height/2, -offset);
            rotation = new THREE.Euler(0, Math.PI, 0);
            break;
          default:
            continue;
        }
        
        const panelGeo = new THREE.PlaneGeometry(panelWidth - 0.02, panelHeight - 0.02);
        const panelMat = new THREE.MeshStandardMaterial({
          color: color,
          side: THREE.DoubleSide,
          roughness: 0.7,
          metalness: 0.1
        });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.userData.isFacePanel = true;
        panel.userData.face = face;
        panel.position.copy(position);
        panel.rotation.copy(rotation);
        
        brick.add(panel);
        brick.userData.facePanels[face] = {
          mesh: panel,
          color: color,
          face: face
        };
      }
    }
    
    async function newProject() {
      if (bricks.length > 0) {
        const ok = await confirmLoad('The bricks on the plate will be cleared. Save first if you want to keep them.', { mode: 'new' });
        if (!ok) return;
      }
      bricks.forEach(b => { 
        if (!b.isInstancedBrick) {
          removeFromGrid(b); 
          scene.remove(b); 
        }
      });
      bricks = [];
      grid.clear(); cellBrick.clear();
      clearInstancedBricks(); // Clear all instanced meshes
      document.getElementById('projectName').value = '';
      updateStats();
      toast('📄 New project started');
    }
    
    function saveProject() {
      const field = document.getElementById('projectName');
      const typed = (field && field.value.trim()) || '';
      const name = typed || 'Untitled';
      const write = () => {
        try {
          const clean = saveNamedBuild(name);
          toast(`💾 Project "${clean}" saved!`, 'success');
        } catch (e) {
          console.error('Save failed:', e);
          toast('❌ Save failed - storage may be full', 'error');
        }
      };
      // A blank name on an empty plate is the accidental Save. A name the
      // player typed is the project they asked to store, so it writes now.
      if (!bricks.length && !typed) {
        confirmLoad('This plate has no bricks. Add a brick first.', { mode: 'empty' }).then((ok) => {
          if (ok) write();
        });
        return;
      }
      let storedName = '';
      try {
        const raw = localStorage.getItem(projectStorageKey(name));
        if (raw) storedName = JSON.parse(raw).name || '';
      } catch (e) { /* a bad entry must not block the save */ }
      if (storedName) {
        confirmLoad('Saving will replace the saved project "' + storedName + '".', { mode: 'replace' }).then((ok) => {
          if (ok) write();
        });
        return;
      }
      write();
    }
    
    function confirmLoad(message, opts) {
      return new Promise((resolve) => {
        const root = document.getElementById('loadConfirm');
        const body = document.getElementById('loadConfirmBody');
        const title = document.getElementById('loadConfirmTitle');
        const ok = document.getElementById('loadConfirmOk');
        const cancel = document.getElementById('loadConfirmCancel');
        if (!root || !body || !ok || !cancel) {
          resolve(false);
          return;
        }
        const mode = opts && opts.mode;
        const fresh = mode === 'new';
        const deleting = mode === 'delete';
        const empty = mode === 'empty';
        const replace = mode === 'replace';
        if (title) title.textContent = fresh ? 'Start a new project?' : deleting ? 'Delete this?' : empty ? 'Save an empty project?' : replace ? 'Replace that project?' : 'Load this build?';
        ok.textContent = fresh ? 'New project' : deleting ? 'Delete' : empty ? 'Save anyway' : replace ? 'Replace' : 'Load';
        body.textContent = message;
        root.style.display = 'flex';
        const finish = (yes) => {
          root.style.display = 'none';
          ok.removeEventListener('click', onOk);
          cancel.removeEventListener('click', onCancel);
          root.removeEventListener('click', onBackdrop);
          document.removeEventListener('keydown', onKey);
          resolve(yes);
        };
        const onOk = () => finish(true);
        const onCancel = () => finish(false);
        const onBackdrop = () => {};
        const onKey = (event) => {
          if (event.key === 'Escape') finish(false);
          else if (event.key === 'Enter') finish(true);
        };
        ok.addEventListener('click', onOk);
        cancel.addEventListener('click', onCancel);
        root.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey);
        ok.focus();
      });
    }

    async function loadProject(key) {
      try {
        const stored = localStorage.getItem(key);
        if (!stored) return;
        const data = JSON.parse(stored);
        const name = data.name || 'Untitled';
        const count = Array.isArray(data.bricks) ? data.bricks.length : 0;
        const ok = await confirmLoad('Load "' + name + '" (' + count + ' bricks)? This will replace your current build.');
        if (!ok) return;
        loadProjectData(data);
        document.getElementById('projectName').value = name;
        hasUnsavedChanges = false;
        toast('📂 Project "' + name + '" loaded!', 'success');
      } catch (e) {
        console.error('Load failed:', e);
        toast('❌ Load failed', 'error');
      }
    }
    
    async function deleteProject(key) {
      if (!(await confirmLoad('Delete this project?', { mode: 'delete' }))) return;
      try {
        localStorage.removeItem(key);
        try {
          const saved = localStorage.getItem('brickBuilderGallery');
          galleryBuilds = saved ? JSON.parse(saved) : [];
        } catch (e) {
          galleryBuilds = [];
        }
        if (!Array.isArray(galleryBuilds)) galleryBuilds = [];
        galleryBuilds = galleryBuilds.filter((b) => b && projectStorageKey(b.name) !== key);
        saveGalleryBuilds();
        refreshProjectList();
        toast('🗑️ Project deleted');
      } catch (e) {
        console.error('Delete failed:', e);
      }
    }
    
    function toggleProjectList() {
      const list = document.getElementById('savedProjectsList');
      refreshProjectList();
      if (list) list.style.display = 'block';
    }
    
    function refreshProjectList() {
      const list = document.getElementById('savedProjectsList');
      if (!list) return;
      list.innerHTML = '';
      mergeSavedBuilds();
      
      // Find all project keys
      const projects = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('brickProject_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            projects.push({
              key,
              name: data.name || 'Untitled',
              savedAt: data.savedAt,
              brickCount: data.bricks ? data.bricks.length : 0
            });
          } catch (e) {}
        }
      }
      
      list.style.display = 'block';
      if (projects.length === 0) {
        list.innerHTML = '<div style="padding:8px;color:rgba(255,255,255,0.5);font-size:13px;">No saved projects</div>';
        return;
      }
      
      // Sort by date (newest first)
      projects.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      
      projects.forEach(p => {
        const date = p.savedAt ? new Date(p.savedAt).toLocaleDateString() : '';
        const item = document.createElement('div');
        item.className = 'saved-project-item';
        item.innerHTML = `
          <span class="saved-project-name" title="Click to load">${escHtml(p.name)}</span>
          <span class="saved-project-date">${p.brickCount === 1 ? '1 brick' : p.brickCount + ' bricks'} • ${date}</span>
          <button class="saved-project-delete" title="Delete">🗑️</button>
        `;
        item.querySelector('.saved-project-name').onclick = () => loadProject(p.key);
        item.querySelector('.saved-project-delete').onclick = (e) => { e.stopPropagation(); deleteProject(p.key); };
        list.appendChild(item);
      });
    }
    
    function screenshot() {
      removeGhost();
      removeWallModeGhost();
      renderer.render(scene, camera);
      renderer.domElement.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `brick-screenshot-${Date.now()}.png`;
        a.click();
        toast('📸 Screenshot saved!', 'success');
      }, 'image/png');
    }
    
    // HOME_OX / HOME_OY / HOME_OZ live with the other camera constants.
    // Distance changes; the ray does not.

    function homeDistance() {
      // Desktop stays on the 2×2 fit. Phone uses PHONE_HOME_DIST so the
      // plate edge and the horizon are in the portrait frame.
      const span = 2 * STUD;
      return liveFitDistance(span, BRICK_H, span);
    }

    function fitDistanceForBox(spanX, spanY, spanZ, fill) {
      const aspect = Math.max(camera.aspect || 1, 0.3);
      const halfTan = Math.tan((camera.fov * Math.PI / 180) / 2);
      // The home ray is oblique, so the view includes the top and the front.
      const fit = Math.max(spanX / aspect, spanZ / aspect, spanY * 1.35, spanX, spanZ);
      return (fit / fill) / (2 * halfTan);
    }

    function liveFitDistance(spanX, spanY, spanZ) {
      const raw = fitDistanceForBox(spanX, spanY, spanZ, 0.55);
      const minD = isMobileGfx() ? 16 : 7.4;
      const maxD = isMobileGfx() ? 64 : 36;
      return Math.min(maxD, Math.max(minD, raw));
    }

    // Bounding sphere of the build, then the distance that leaves 10% padding
    // on the limiting FOV. The home ray is only the view direction.
    function sphereFitDistance(box) {
      const radius = 0.5 * Math.hypot(box.spanX, box.spanY, box.spanZ);
      const aspect = Math.max(camera.aspect || 1, 0.3);
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      const limit = Math.min(vFov, hFov);
      const alpha = Math.atan(Math.tan(limit / 2) * 0.8);
      const dist = radius / Math.max(0.05, Math.sin(alpha));
      return Math.max(dist, radius + 0.45);
    }

    // The gallery image is this canvas, not a second render after OrbitControls
    // damping moves the camera. A spread that measured 0.62 fill was saved as specks.
    let captureFrame = null;


    function placeCaptureCamera(box) {
      // One 3/4 overhead for every save. Elevation stays fixed so the sky
      // band does not change with the brick count. Only the distance fits.
      const savedFov = camera.fov;
      const savedPolar = controls.maxPolarAngle;
      controls.maxPolarAngle = Math.PI / 2.02;
      controls.minDistance = 0.3;
      controls.maxDistance = 400;
      const pitch = 22 * Math.PI / 180;
      const yaw = Math.PI / 4;
      camera.fov = 68;
      camera.updateProjectionMatrix();
      const dirX = Math.cos(pitch) * Math.cos(yaw);
      const dirY = Math.sin(pitch);
      const dirZ = Math.cos(pitch) * Math.sin(yaw);
      const aim = new THREE.Vector3(box.aimX, box.aimY, box.aimZ);
      const corners = [];
      for (let bi = 0; bi < bricks.length; bi++) {
        const b = bricks[bi];
        const p = b.position;
        if (!p) continue;
        const g = b.userData && b.userData.grid;
        const bx = g ? g.w * STUD * 0.5 : 0.4;
        const bz = g ? g.d * STUD * 0.5 : 0.4;
        const top = p.y + (g && g.hp >= 3 ? BRICK_H : PLATE_H);
        for (const x of [-bx, bx]) {
          for (const z of [-bz, bz]) corners.push(new THREE.Vector3(p.x + x, top, p.z + z));
        }
      }
      if (corners.length < 4) {
        const hx = box.spanX * 0.5;
        const hy = box.spanY * 0.5;
        const hz = box.spanZ * 0.5;
        for (const x of [-hx, hx]) {
          for (const z of [-hz, hz]) corners.push(new THREE.Vector3(aim.x + x, aim.y + hy, aim.z + z));
        }
      }
      const v = new THREE.Vector3();
      const toCorner = new THREE.Vector3();
      const toAim = new THREE.Vector3();
      let dist = 12;
      const applyPose = () => {
        camera.position.set(
          aim.x + dirX * dist,
          Math.max(0.55, aim.y + dirY * dist),
          aim.z + dirZ * dist
        );
        camera.up.set(0, 1, 0);
        camera.lookAt(aim);
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();
        controls.target.copy(aim);
      };
      const projectedExtent = () => {
        applyPose();
        toAim.set(aim.x - camera.position.x, aim.y - camera.position.y, aim.z - camera.position.z);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, kept = 0;
        for (let i = 0; i < corners.length; i++) {
          toCorner.copy(corners[i]).sub(camera.position);
          if (toCorner.dot(toAim) <= 0) continue;
          v.copy(corners[i]).project(camera);
          if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) continue;
          if (Math.abs(v.x) > 2.5 || Math.abs(v.y) > 2.5) continue;
          kept++;
          if (v.x < minX) minX = v.x;
          if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.y > maxY) maxY = v.y;
        }
        if (kept < 3) return 0;
        return Math.max((maxX - minX) / 2, (maxY - minY) / 2);
      };
      let lo = 1.4;
      let hi = 160;
      for (let n = 0; n < 16; n++) {
        dist = (lo + hi) * 0.5;
        if (projectedExtent() > 0.56) lo = dist;
        else hi = dist;
      }
      dist = hi;
      const scratch = document.createElement('canvas');
      scratch.width = 200;
      scratch.height = 150;
      const skyOf = (data) => {
        let n = 0;
        let sky = 0;
        const y1 = Math.floor(150 * 0.92);
        for (let y = 0; y < y1; y += 2) {
          for (let x = 0; x < 200; x += 2) {
            const i = (y * 200 + x) * 4;
            n++;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (b > 150 && b > g + 15 && b > r + 10) sky++;
          }
        }
        return n ? sky / n : 0;
      };
      const sample = () => {
        applyPose();
        const m = renderSceneToCanvas(scratch) || { n: 0, extent: 0, margin: 0 };
        const data = scratch.getContext('2d').getImageData(0, 0, 200, 150).data;
        return { m, share: largestRedShare(data, 200, 150), sky: skyOf(data) };
      };
      let shot = sample();
      const framed = (s) => s.m.n >= 8 && s.share >= 0.12 && s.m.extent >= 0.4 && s.m.extent <= 0.75 && s.sky >= 0.09 && s.sky <= 0.32;
      if (shot.m.n >= 8 && (shot.share < 0.12 || shot.m.extent < 0.4)) {
        for (let i = 0; i < 6; i++) {
          const nextDist = dist * 0.84;
          const prev = dist;
          dist = nextDist;
          const next = sample();
          // Stop before a nearer brick crosses the frame. The 2× cover
          // grows red by about one pixel, so the scratch keeps extra pad.
          if (next.m.extent > 0.74 || next.sky < 0.09 || next.m.bottom < 0.05) {
            dist = prev;
            break;
          }
          shot = next;
          if (framed(shot) && shot.m.bottom >= 0.05 && shot.m.margin >= 0.03) break;
        }
      }
      // Perspective puts the near brick on the bottom edge while the far
      // side still has room. Slide the aim toward the camera so that brick
      // moves up, and keep the size inside the thumb bars.
      const fl = Math.hypot(dirX, dirZ) || 1;
      const gx = dirX / fl;
      const gz = dirZ / fl;
      for (let i = 0; i < 8; i++) {
        if (shot.m.n >= 8 && shot.m.bottom >= 0.05 && shot.m.margin >= 0.03) break;
        const prev = { x: aim.x, z: aim.z, dist, shot };
        const deficit = Math.max(0.02, 0.06 - (shot.m.bottom || 0));
        const step = Math.min(2.2, Math.max(0.4, deficit * dist * 0.5));
        aim.x += gx * step;
        aim.z += gz * step;
        let next = sample();
        if (!framed(next)) {
          aim.x = prev.x + gx * step * 0.45;
          aim.z = prev.z + gz * step * 0.45;
          next = sample();
        }
        if (!framed(next)) {
          aim.x = prev.x;
          aim.z = prev.z;
          dist = prev.dist;
          shot = prev.shot;
          break;
        }
        shot = next;
      }
      applyPose();
      scratch.width = 400;
      scratch.height = 300;
      renderSceneToCanvas(scratch);
      const coverPx = scratch.getContext('2d').getImageData(0, 0, 400, 300).data;
      const kept = document.createElement('canvas');
      kept.width = 200;
      kept.height = 150;
      const out = kept.getContext('2d').createImageData(200, 150);
      for (let y = 0; y < 150; y++) {
        for (let x = 0; x < 200; x++) {
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 255;
          let brickHit = false;
          for (let yy = y * 2; yy < y * 2 + 2 && !brickHit; yy++) {
            for (let xx = x * 2; xx < x * 2 + 2; xx++) {
              const i = (yy * 400 + xx) * 4;
              const rr = coverPx[i];
              const gg = coverPx[i + 1];
              const bb = coverPx[i + 2];
              if (rr > 140 && rr > gg + 28 && rr > bb + 28) {
                r = rr;
                g = gg;
                b = bb;
                a = coverPx[i + 3];
                brickHit = true;
                break;
              }
              if (rr + gg + bb > r + g + b) {
                r = rr;
                g = gg;
                b = bb;
                a = coverPx[i + 3];
              }
            }
          }
          const o = (y * 200 + x) * 4;
          out.data[o] = r;
          out.data[o + 1] = g;
          out.data[o + 2] = b;
          out.data[o + 3] = a;
        }
      }
      kept.getContext('2d').putImageData(out, 0, 0);
      captureFrame = kept;
      camera.fov = savedFov;
      camera.updateProjectionMatrix();
      controls.maxPolarAngle = savedPolar;
      needsRender = true;
    }

    let plateFrameCam = null;
    let plateFrameCache = '';
    let plateFrameValue = 0;
    function plateFrameDistance(pad, rayX, rayY, rayZ, aimX, aimZ) {
      if (!camera) return isMobileGfx() ? 48 : 40;
      const mobile = isMobileGfx();
      const aspect = camera.aspect || 1;
      const useRay = rayX != null;
      const portrait = mobile && aspect < 1.2;
      const ox = useRay ? rayX : (portrait ? PHONE_OX : HOME_OX);
      const oy = useRay ? rayY : (portrait ? PHONE_OY : HOME_OY);
      const oz = useRay ? rayZ : (portrait ? PHONE_OZ : HOME_OZ);
      const tx = aimX != null ? aimX : 38.4;
      const tz = aimZ != null ? aimZ : 38.4;
      const key = (mobile ? 'm' : 'd') + pad.toFixed(3) + ':' + aspect.toFixed(3) + ':' + camera.fov + ':' + ox + ',' + oy + ',' + oz + '@' + tx + ',' + tz;
      if (key === plateFrameCache) return plateFrameValue;
      const len = Math.hypot(ox, oy, oz) || 1;
      const dir = new THREE.Vector3(ox / len, oy / len, oz / len);
      const target = new THREE.Vector3(tx, 0.35, tz);
      if (!plateFrameCam) plateFrameCam = new THREE.PerspectiveCamera(60, 1, 0.1, 2800);
      const cam = plateFrameCam;
      cam.fov = camera.fov;
      cam.aspect = aspect;
      cam.near = 0.1;
      cam.far = 2800;
      const size = 96 * STUD;
      const rim = mobile ? 0 : STUD * 1.25;
      const list = [
        new THREE.Vector3(-rim, 0.02, -rim),
        new THREE.Vector3(size + rim, 0.02, -rim),
        new THREE.Vector3(-rim, 0.02, size + rim),
        new THREE.Vector3(size + rim, 0.02, size + rim)
      ];
      if (!mobile) {
        list.push(new THREE.Vector3(size * 0.5, 0.02, -rim));
        list.push(new THREE.Vector3(size * 0.5, 0.02, size + rim));
        list.push(new THREE.Vector3(-rim, 0.02, size * 0.5));
        list.push(new THREE.Vector3(size + rim, 0.02, size * 0.5));
      }
      const v = new THREE.Vector3();
      const fits = (dist) => {
        cam.position.copy(target).addScaledVector(dir, dist);
        cam.up.set(0, 1, 0);
        cam.lookAt(target);
        cam.updateMatrixWorld(true);
        cam.updateProjectionMatrix();
        for (let i = 0; i < list.length; i++) {
          v.copy(list[i]).project(cam);
          if (v.z < -1 || v.z > 1) return false;
          if (v.x < -1 + pad || v.x > 1 - pad || v.y < -1 + pad || v.y > 1 - pad) return false;
        }
        return true;
      };
      let lo = 8;
      let hi = 340;
      let chosen = hi;
      for (let n = 0; n < 18; n++) {
        const dist = (lo + hi) * 0.5;
        if (fits(dist)) { chosen = dist; hi = dist; }
        else lo = dist;
      }
      plateFrameCache = key;
      plateFrameValue = chosen;
      return chosen;
    }

    function placeCameraOnHomeRay(aimX, aimY, aimZ, dist) {
      const aspect = (camera && camera.aspect) || (innerWidth / Math.max(1, innerHeight));
      const portrait = isMobileGfx() && aspect < 1.2;
      const wideMobile = isMobileGfx() && !portrait;
      const ox = portrait ? PHONE_OX : wideMobile ? WIDE_OX : DESK_OX;
      const oy = portrait ? PHONE_OY : wideMobile ? WIDE_OY : DESK_OY;
      const oz = portrait ? PHONE_OZ : wideMobile ? WIDE_OZ : DESK_OZ;
      const len = Math.hypot(ox, oy, oz) || 1;
      controls.target.set(aimX, aimY, aimZ);
      camera.position.set(
        aimX + (ox / len) * dist,
        aimY + (oy / len) * dist,
        aimZ + (oz / len) * dist
      );
      controls.update();
      needsRender = true;
    }

    function updateZoomLimits() {
      if (!controls || !camera) return;
      const mobile = isMobileGfx();
      const box = buildBounds();
      const plate = 96 * STUD;
      const spanX = Math.min(plate, Math.max(box.spanX * 2.4, 12 * STUD));
      const spanZ = Math.min(plate, Math.max(box.spanZ * 2.4, 12 * STUD));
      const cap = fitDistanceForBox(spanX, Math.max(box.spanY, BRICK_H), spanZ, 0.7);
      const framed = plateFrameDistance(mobile ? 0.02 : 0.05);
      // Min distance keeps one zoom step from ending inside a tower.
      controls.minDistance = mobile ? 5 : 6;
      const home = defaultHomeDistance();
      controls.maxDistance = Math.max(framed, cap, home) + 4;
    }

    function defaultHomeDistance() {
      const aspect = (camera && camera.aspect) || (innerWidth / Math.max(1, innerHeight));
      if (isMobileGfx() && aspect < 1.2) return PHONE_HOME_DIST;
      if (isMobileGfx()) return WIDE_HOME_DIST;
      return plateFrameDistance(0.05, DESK_OX, DESK_OY, DESK_OZ, DESK_AIM, DESK_AIM);
    }

    function frameHomeCamera() {
      updateZoomLimits();
      const aspect = (camera && camera.aspect) || (innerWidth / Math.max(1, innerHeight));
      const portrait = isMobileGfx() && aspect < 1.2;
      const wideMobile = isMobileGfx() && !portrait;
      // Portrait keeps its own aim. Desktop looks toward the near corner
      // so the studs under the cursor are large enough to read.
      const aimX = wideMobile || portrait ? 38.4 : DESK_AIM;
      const aimZ = portrait ? 40.2 : wideMobile ? 38.4 : DESK_AIM;
      placeCameraOnHomeRay(aimX, 0.35, aimZ, defaultHomeDistance());
    }

    function resetView() {
      frameHomeCamera();
      toast('🎯 View reset', 'success');
    }
    
    // ==================== WALK MODE HELPERS ====================
    // Update the FPS brick info display
    function updateFpBrickInfo() {
      const el = document.getElementById('fpsBrickInfo');
      if (el) {
        const name = selectedPrefab ? getBrickName(selectedPrefab) : getBrickName(selectedBrick);
        el.textContent = `${name} • ${currentRotation}°`;
      }
    }
    
    // Helper to get readable brick name
    function getBrickName(type) {
      const names = {
        '1x1': '1×1 Brick', '1x2': '1×2 Brick', '1x3': '1×3 Brick', '1x4': '1×4 Brick',
        '2x2': '2×2 Brick', '2x3': '2×3 Brick', '2x4': '2×4 Brick', '2x6': '2×6 Brick', '2x8': '2×8 Brick',
        '1x1p': '1×1 Plate', '1x2p': '1×2 Plate', '1x4p': '1×4 Plate', '2x2p': '2×2 Plate', '2x4p': '2×4 Plate',
        '1x1t': '1×1 Tile', '2x2t': '2×2 Tile', '1x2t': '1×2 Tile', '1x4t': '1×4 Tile', '2x4t': '2×4 Tile',
        'slope2': '2×2 Slope', 'slope4': '2×4 Slope', 'slope1x2': '1×2 Slope', 'slope1x3': '1×3 Slope', 'slope1x4': '1×4 Slope',
        'cslope2': '⌐ 2×2 Corner', 'cslope3': '⌐ 3×3 Corner', 'icslope2': '⌙ 2×2 Inside', 'icslope3': '⌙ 3×3 Inside',
        'r1x1': '●1×1 Round', 'r2x2': '●2×2 Round', 'r1x1p': '●1×1 Round Plate', 'r2x2p': '●2×2 Round Plate',
        // Prefabs
        'stairs': '🪜 Stairs', 'pillar': '🏛️ Pillar', 'wall4': '🧱 Wall 4', 'wall8': '🧱 Wall 8',
        'corner': '📐 Corner', 'arch': '🚪 Arch', 'window': '🪟 Window', 'door': '🚪 Door',
        'fence': '🚧 Fence', 'tree': '🌳 Tree', 'pine': '🌲 Pine', 'palm': '🌴 Palm', 'oak': '🌳 Oak',
        'car': '🚗 Car', 'truck': '🚚 Truck', 'boat': '⛵ Boat'
      };
      return names[type] || type;
    }
    
    let hoverRaf = 0;
    function pointerToMouse(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Browser zoom changes devicePixelRatio. The rect is CSS pixels.
      // A buffer-sized box would miss the cursor by that ratio.
      const cssW = rect.width || (renderer.domElement.width / dpr) || innerWidth;
      const cssH = rect.height || (renderer.domElement.height / dpr) || innerHeight;
      mouse.x = ((clientX - rect.left) / cssW) * 2 - 1;
      mouse.y = -((clientY - rect.top) / cssH) * 2 + 1;
    }
    function scheduleHover() {
      pointerDirty = true;
      if (hoverRaf) return;
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        if (!pointerDirty) return;
        pointerDirty = false;
        flushPointerHover();
      });
    }

    function flushPointerHover() {
      if (floorMode && floorDragStart) {
        const hit = pickPoint();
        if (hit) {
          const gPos = worldToGrid(hit.point.x, hit.point.z);
          floorDragEnd = {x: gPos.x, z: gPos.z};
          updateFloorGhost();
        }
      } else if (wallMode && wallDragStart) {
        const hit = pickPoint();
        if (hit) {
          const gPos = worldToGrid(hit.point.x, hit.point.z);
          if (wallBoxMode) {
            wallDragEnd = {x: gPos.x, z: gPos.z};
          } else {
            const isXWall = (currentRotation === 90 || currentRotation === 270);
            if (isXWall) wallDragEnd = {x: gPos.x, z: wallDragStart.z};
            else wallDragEnd = {x: wallDragStart.x, z: gPos.z};
          }
          wallDragDirection = {
            x: wallDragEnd.x >= wallDragStart.x ? 1 : -1,
            z: wallDragEnd.z >= wallDragStart.z ? 1 : -1
          };
          updateWallGhost();
        }
      } else {
        updateGhost();
        needsRender = true;
        if (moveMode && selectedGroup.length > 0 && moveGhosts.length > 0) {
          const hit = pickPoint();
          if (hit) {
            const gPos = worldToGrid(hit.point.x, hit.point.z);
            updateMoveGhosts(gPos.x, gPos.z);
          }
        }
      }
    }

    // ==================== EVENTS ====================
    await new Promise((resolve) => setTimeout(resolve, 0));

    let suppressClickUntil = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerDownSeen = false;
    let orbitPointerX = 0;
    let orbitPointerY = 0;
    let orbitPointerDown = false;
    function selectFpQuickSlot(index) {
      if (index < 0 || index >= fpQuickSlots.length) return;
      
      fpQuickSlotIndex = index;
      const slot = fpQuickSlots[index];
      
      if (slot.type === 'brick') {
        selectedBrick = slot.id;
        selectedPrefab = null;
      } else if (slot.type === 'prefab') {
        selectedPrefab = slot.id;
      }
      
      // Update hotbar UI
      document.querySelectorAll('.fps-slot').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
      });
      
      // Clear all ghosts to refresh
      if (fpGhost) {
        scene.remove(fpGhost);
        fpGhost = null;
      }
      fpPrefabGhosts.forEach(g => scene.remove(g));
      fpPrefabGhosts = [];
      
      updateFpBrickInfo();
    }
    function toggleFpRadialMenu() {
      if (fpRadialMenuOpen) {
        closeFpRadialMenu();
      } else {
        openFpRadialMenu();
      }
    }
    function openFpRadialMenu() {
      fpRadialMenuOpen = true;
      
      // Exit pointer lock temporarily
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      
      const menu = document.getElementById('fpsRadialMenu');
      const ring = document.getElementById('fpsRadialRing');
      
      // Build radial menu items
      const categories = [
        { icon: '🧱', name: 'Bricks', items: ['2x4', '2x2', '1x2', '1x4', '2x3'] },
        { icon: '📦', name: 'Plates', items: ['2x4p', '2x2p', '1x2p', '1x4p'] },
        { icon: '📐', name: 'Slopes', items: ['slope2', 'slope4', 'slope1x2', 'cslope2', 'cslope3', 'icslope2'] },
        { icon: '🪜', name: 'Prefabs', items: ['stairs', 'pillar', 'corner', 'arch'] },
        { icon: '🚪', name: 'Openings', items: ['door', 'window'] },
        { icon: '🔵', name: 'Round', items: ['r2x2', 'r1x1', 'r2x2p', 'r1x1p'] },
        { icon: '🎨', name: 'Tiles', items: ['2x2t', '1x2t', '2x4t', '1x4t'] },
        { icon: '🏗️', name: 'Fence', items: ['fence'] }
      ];
      
      ring.innerHTML = '';
      const radius = 110;
      
      categories.forEach((cat, i) => {
        const angle = (i / categories.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius + 150 - 35;
        const y = Math.sin(angle) * radius + 150 - 35;
        
        const item = document.createElement('div');
        item.className = 'fps-radial-item';
        item.style.left = x + 'px';
        item.style.top = y + 'px';
        item.innerHTML = `<span class="item-icon">${cat.icon}</span><span class="item-name">${cat.name}</span>`;
        item.dataset.category = i;
        
        item.addEventListener('click', () => {
          showRadialSubMenu(cat);
        });
        
        ring.appendChild(item);
      });
      
      menu.classList.add('visible');
    }
    function showRadialSubMenu(category) {
      const ring = document.getElementById('fpsRadialRing');
      const center = document.querySelector('.fps-radial-center');
      
      center.textContent = category.name;
      ring.innerHTML = '';
      
      const radius = 110;
      const items = category.items;
      
      items.forEach((itemId, i) => {
        const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius + 150 - 35;
        const y = Math.sin(angle) * radius + 150 - 35;
        
        const item = document.createElement('div');
        item.className = 'fps-radial-item';
        if ((selectedBrick === itemId && !selectedPrefab) || selectedPrefab === itemId) {
          item.classList.add('selected');
        }
        item.style.left = x + 'px';
        item.style.top = y + 'px';
        
        const isPrefab = prefabs[itemId] !== undefined;
        const name = getBrickName(itemId);
        item.innerHTML = `<span class="item-icon">${isPrefab ? '📦' : '🧱'}</span><span class="item-name">${name}</span>`;
        
        item.addEventListener('click', () => {
          if (isPrefab) {
            selectedPrefab = itemId;
            selectedBrick = '2x2';
          } else {
            selectedBrick = itemId;
            selectedPrefab = null;
          }
          
          // Update quick slot to match
          const slotIndex = fpQuickSlots.findIndex(s => s.id === itemId);
          if (slotIndex >= 0) {
            fpQuickSlotIndex = slotIndex;
            document.querySelectorAll('.fps-slot').forEach((el, i) => {
              el.classList.toggle('selected', i === slotIndex);
            });
          }
          
          closeFpRadialMenu();
          
          // Clear ghost to refresh
          if (fpGhost) {
            scene.remove(fpGhost);
            fpGhost = null;
          }
          
          updateFpBrickInfo();
        });
        
        ring.appendChild(item);
      });
      
      // Add back button
      const backBtn = document.createElement('div');
      backBtn.className = 'fps-radial-item';
      backBtn.style.left = '115px';
      backBtn.style.top = '230px';
      backBtn.innerHTML = '<span class="item-icon">⬅️</span><span class="item-name">Back</span>';
      backBtn.addEventListener('click', openFpRadialMenu);
      ring.appendChild(backBtn);
    }
    function closeFpRadialMenu() {
      fpRadialMenuOpen = false;
      document.getElementById('fpsRadialMenu').classList.remove('visible');
      
      // Re-lock pointer
      if (firstPersonMode) {
        renderer.domElement.requestPointerLock();
      }
    }
    function initFpHotbar() {
      document.querySelectorAll('.fps-slot').forEach(slot => {
        slot.addEventListener('click', () => {
          const index = parseInt(slot.dataset.slot);
          selectFpQuickSlot(index);
        });
      });
    }
    function handleMoveClick(shiftKey = false) {
      const picked = pickPoint();
      if (picked && picked.brick && selectedGroup.length === 0) {
        if (picked.brick.userData && picked.brick.userData.isBrick) {
          selectBrickGroup(picked.brick, shiftKey);
        }
      } else if (selectedGroup.length > 0) {
        if (moveGhosts.canPlace && (moveGhosts.targetGx !== undefined)) {
          placeMoveGroup(moveGhosts.targetGx, moveGhosts.targetGz);
          SoundSystem.playPlace();
        } else if (picked) {
          const gPos = worldToGrid(picked.point.x, picked.point.z);
          placeMoveGroup(gPos.x, gPos.z);
        }
      }
    }
    let touchStartTime = 0;
    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;
    const keysPressed = new Set();
    function panCamera(dx, dz) {
      // Get camera's forward direction (but on the horizontal plane)
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      
      // Get right direction
      const right = new THREE.Vector3();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      
      // Calculate movement
      const panSpeed = 0.5;
      const movement = new THREE.Vector3();
      movement.addScaledVector(right, dx * panSpeed);
      movement.addScaledVector(forward, dz * panSpeed);
      needsRender = true;
      
      // Apply to both camera and target
      camera.position.add(movement);
      controls.target.add(movement);
    }
    function zoomCamera(delta, clientX, clientY) {
      const distance = camera.position.distanceTo(controls.target);
      if (distance < 0.001) return;
      // A phone brick is about 30 px. Eighteen percent of that is a 4 px
      // step, which a 1 px measurement swing hides. Narrow views may take
      // a larger step. The wheel still sends a smaller delta, and desktop
      // buttons stay on the 0.18 cap.
      const narrow = window.innerWidth <= 768;
      const limit = Math.max(2.5, distance * (narrow ? 0.42 : 0.18));
      const signed = Math.sign(delta) * Math.min(Math.abs(delta), limit);
      // Buttons have no cursor, so they stay on the target. A run of those
      // steps used to reach minDistance and walk a build out of the frame.
      // The wheel still follows the cursor down to minDistance.
      const aimed = clientX != null && clientY != null;
      // A wheel aims at the cursor and may come in close enough to inspect
      // one brick. Buttons stay outside the build.
      const closeFloor = aimed
        ? 2.2
        : Math.max(controls.minDistance, (defaultHomeDistance() || 20) * 0.42);
      const newDistance = Math.max(closeFloor, Math.min(controls.maxDistance, distance + signed));
      if (Math.abs(newDistance - distance) < 1e-4) return;
      // Button zoom keeps the home target. A stack left of center then slides
      // under the sidebar. Ease the target onto the bricks as the view closes.
      // On a phone that lerp spends the step recentering, so the brick barely
      // grows. A narrow view dollies along the ray it already has.
      if (!aimed && bricks.length && window.innerWidth > 768) {
        const box = buildBounds();
        controls.target.lerp(new THREE.Vector3(box.aimX, box.aimY, box.aimZ), 0.75);
      }
      const scale = newDistance / distance;
      let pivot = null;
      if (clientX != null && clientY != null) {
        pointerToMouse(clientX, clientY);
        raycaster.setFromCamera(mouse, camera);
        const origin = raycaster.ray.origin;
        const dir = raycaster.ray.direction;
        if (Math.abs(dir.y) > 1e-5) {
          const t = -origin.y / dir.y;
          if (t > 0) pivot = origin.clone().addScaledVector(dir, t);
        }
      }
      if (pivot) {
        const newCam = pivot.clone().add(camera.position.clone().sub(pivot).multiplyScalar(scale));
        if (newCam.y < 0.5) return;
        const newTarget = pivot.clone().add(controls.target.clone().sub(pivot).multiplyScalar(scale));
        camera.position.copy(newCam);
        controls.target.copy(newTarget);
        controls.update();
        needsRender = true;
        return;
      }
      const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
      const newPos = controls.target.clone().addScaledVector(direction, newDistance);
      if (newPos.y >= 0.5) {
        camera.position.copy(newPos);
        controls.update();
        needsRender = true;
      }
    }
    // A phone tap is a touch plus a click that lands just after 400ms.
    // The second click was turning Floor, Wall, and Mirror straight back off.
    const recentClick = new Map();
    function repeatClick(key) {
      const now = performance.now();
      const prev = recentClick.get(key);
      if (prev != null && now - prev < 700) return true;
      recentClick.set(key, now);
      return false;
    }
    function isTextField(el) {
      if (!el || !el.tagName) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return !!el.isContentEditable;
    }
    function typingInField(e) {
      if (isTextField(e.target) || isTextField(document.activeElement)) return true;
      if (e.composedPath) {
        const path = e.composedPath();
        for (let i = 0; i < path.length && i < 5; i++) {
          if (isTextField(path[i])) return true;
        }
      }
      return false;
    }
    function focusFieldNow(el) {
      if (!isTextField(el) || el.disabled) return;
      if (document.activeElement === el) return;
      try { el.focus({ preventScroll: true }); }
      catch (err) { el.focus(); }
    }
    function clearToolMode(id, className) {
      const el = document.getElementById(id);
      if (el && className) el.classList.remove(className);
    }
    function returnToPlaceMode() {
      if (fpRadialMenuOpen) {
        fpRadialMenuOpen = false;
        const menu = document.getElementById('fpsRadialMenu');
        if (menu) menu.classList.remove('visible');
      }
      if (firstPersonMode) exitFirstPersonMode();
      deleteMode = false;
      dropperMode = false;
      paintMode = false;
      facePaintMode = false;
      floorMode = false;
      wallMode = false;
      moveMode = false;
      clearToolMode('deleteBtn', 'delete-active');
      clearToolMode('hudDeleteBtn', 'delete-active');
      clearToolMode('dropperBtn', 'dropper-active');
      clearToolMode('paintBtn', 'paint-active');
      clearToolMode('facePaintBtn', 'facepaint-active');
      clearToolMode('floorBtn', 'floor-active');
      clearToolMode('wallBtn', 'wall-active');
      clearToolMode('moveBtn', 'move-active');
      const moveInd = document.getElementById('moveModeIndicator');
      if (moveInd) moveInd.classList.remove('visible');
      const delBanner = document.getElementById('deleteModeBanner');
      if (delBanner) delBanner.classList.remove('visible');
      document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode', 'facepaint-mode');
      if (floorDragStart) cancelFloorDrag();
      if (wallDragStart) cancelWallDrag();
      clearMoveSelection();
      updateBuildToolPopup();
      removeGhost();
      removeWallModeGhost();
      needsRender = true;
    }
    let lastEscapeTime = 0;
    let zoomInterval = null;
    let sidebarCollapsed = false;
    let trayDownX = 0;
    let trayDownY = 0;
    let trayDownSeen = false;
    function filterPrefabs(query) {
      query = query.toLowerCase().trim();
      
      // Get the prefabs section (parent of the search input)
      const prefabsSection = document.getElementById('prefabSearch').closest('.section-content');
      if (!prefabsSection) return;
      
      // Get all prefab buttons in the prefabs section
      prefabsSection.querySelectorAll('.prefab-btn').forEach(btn => {
        const name = btn.textContent.toLowerCase();
        const prefabId = btn.dataset.prefab?.toLowerCase() || '';
        const matches = query === '' || name.includes(query) || prefabId.includes(query);
        btn.style.display = matches ? '' : 'none';
      });
      
      // Show/hide subsections based on whether they have visible buttons
      prefabsSection.querySelectorAll('.subsection').forEach(subsection => {
        const hasVisible = Array.from(subsection.querySelectorAll('.prefab-btn')).some(btn => btn.style.display !== 'none');
        
        if (query !== '') {
          // When searching, expand subsections with matches and hide empty ones
          subsection.style.display = hasVisible ? '' : 'none';
          if (hasVisible) {
            subsection.classList.remove('collapsed');
          }
        } else {
          // When search cleared, show all subsections
          subsection.style.display = '';
        }
      });
    }
    function updateMirrorPreviewText() {
      let text = '';
      if (mirrorAxis === 'x') text = `Mirror left ↔ right at X=${mirrorOffset}`;
      else if (mirrorAxis === 'z') text = `Mirror front ↔ back at Z=${mirrorOffset}`;
      else text = `Mirror all 4 ways at (${mirrorOffset}, ${mirrorOffset})`;
      document.getElementById('mirrorPreviewText').textContent = text;
      document.getElementById('mirrorPopupInfo').textContent = text;
    }
    function makeDraggable(popup, handle) {
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;
      
      handle.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return; // Don't drag if clicking a button
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = popup.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        handle.style.cursor = 'grabbing';
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        popup.style.left = (initialLeft + dx) + 'px';
        popup.style.top = (initialTop + dy) + 'px';
      });
      
      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          handle.style.cursor = 'grab';
        }
      });
    }
    function showFloating(el) {
      if (!el) return;
      const nodes = [el];
      if (el.querySelectorAll) {
        const kids = el.querySelectorAll('.brix-park, .brix-cold');
        for (let i = 0; i < kids.length; i++) nodes.push(kids[i]);
      }
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].classList.remove('brix-park');
        nodes[i].classList.remove('brix-cold');
      }
    }
    function updateBuildToolPopup() {
      const buildToolPopup = document.getElementById('buildToolPopup');
      if (!buildToolPopup) return;
      const isFloor = floorMode;
      const isWall = wallMode;
      
      buildToolPopup.classList.toggle('visible', isFloor || isWall);
      if (isFloor || isWall) showFloating(buildToolPopup);
      buildToolPopup.classList.toggle('floor-mode', isFloor);
      
      document.getElementById('buildModeFloor').classList.toggle('active', isFloor);
      document.getElementById('buildModeWall').classList.toggle('active', isWall);
      
      document.getElementById('buildToolTitle').textContent = isFloor ? '🟫 Floor Tool' : '🧱 Wall Tool';
      
      // Show/hide relevant controls
      document.getElementById('buildTypeRow').style.display = isFloor ? 'flex' : 'none';
      document.getElementById('buildShapeRow').style.display = isWall ? 'flex' : 'none';
      document.getElementById('buildHeightRow').style.display = isWall ? 'flex' : 'none';
      document.getElementById('buildDepthRow').style.display = isWall ? 'flex' : 'none';
      
      // Update shape buttons to match current mode
      document.getElementById('buildShapeLine').classList.toggle('active', !wallBoxMode);
      document.getElementById('buildShapeBox').classList.toggle('active', wallBoxMode);
      
      const wallInfoText = wallBoxMode ? 'Click & drag to draw 4-sided box' : 'Click & drag to draw wall line';
      document.getElementById('buildToolInfo').textContent = isFloor 
        ? 'Click & drag to draw floor area' 
        : wallInfoText;
        
      // Update values
      document.getElementById('buildHeightValue').textContent = wallHeight;
      document.getElementById('buildDepthValue').textContent = wallDepth;
    }
    function updatePhotoGrid() {
      const container = document.getElementById('uploadedPhotos');
      if (uploadedTextures.length === 0) {
        container.innerHTML = '<div class="no-photos-hint">No photos uploaded yet</div>';
        return;
      }
      
      container.innerHTML = '';
      uploadedTextures.forEach((photo, index) => {
        const img = document.createElement('img');
        img.className = 'photo-thumb';
        img.src = photo.dataUrl;
        img.title = photo.name;
        img.dataset.index = index;
        if (selectedTexture === index) img.classList.add('selected');
        
        img.addEventListener('click', () => {
          if (selectedTexture === index) {
            selectedTexture = null;
            img.classList.remove('selected');
            toast('Photo deselected');
          } else {
            document.querySelectorAll('.photo-thumb').forEach(t => t.classList.remove('selected'));
            selectedTexture = index;
            img.classList.add('selected');
            toast(`📷 Photo selected: ${photo.name}`);
          }
          updateGhost();
        });
        
        container.appendChild(img);
      });
    }
    function clearMoveSelection() {
      // Reset any highlighted bricks
      for (const brick of selectedGroup) {
        if (brick.traverse) {
          brick.traverse(obj => {
            if (obj.isMesh && obj.material && obj.userData.originalColor !== undefined) {
              obj.material.color.setHex(obj.userData.originalColor);
              obj.material.emissive.setHex(0x000000);
            }
          });
        }
      }
      selectedGroup = [];
      
      // Remove move ghosts
      for (const mg of moveGhosts) {
        scene.remove(mg);
      }
      moveGhosts = [];
      moveOffset = {x: 0, y: 0, z: 0};
      
      const moveLabel = document.getElementById('moveModeLabel');
      if (moveLabel) moveLabel.textContent = '✋ MOVE MODE - Click brick to select group';
    }
    function createMoveGhosts() {
      // Clear existing ghosts
      for (const mg of moveGhosts) {
        scene.remove(mg);
      }
      moveGhosts = [];
      
      // Create a semi-transparent ghost for each selected brick
      for (const brick of selectedGroup) {
        const brickType = brick.userData.type || brick.userData.brickType;
        const color = brick.userData.color;
        const rot = brick.userData.rotation || 0;
        
        // Clone the brick as a ghost
        const ghostMat = new THREE.MeshStandardMaterial({
          color: softGhostColor(true),
          transparent: true,
          opacity: 0.45,
          depthWrite: false
        });
        
        const ghost = brick.clone();
        ghost.traverse(obj => {
          if (obj.isMesh) {
            obj.material = ghostMat.clone();
          }
        });
        
        ghost.userData.isMoveGhost = true;
        ghost.userData.originalBrick = brick;
        ghost.userData.originalGrid = {...brick.userData.grid};
        
        scene.add(ghost);
        moveGhosts.push(ghost);
      }
    }
    function updateMoveGhosts(targetGx, targetGz) {
      if (selectedGroup.length === 0 || moveGhosts.length === 0) return;
      
      // Calculate offset from first brick
      const firstBrick = selectedGroup[0];
      const firstGrid = firstBrick.userData.grid;
      if (!firstGrid) return;
      
      const offsetX = targetGx - firstGrid.gx;
      const offsetZ = targetGz - firstGrid.gz;
      
      // Check if all bricks can be placed at new positions
      let canPlaceAll = true;
      const tempRemovals = [];
      
      // Temporarily remove all selected bricks from grid
      for (const brick of selectedGroup) {
        removeFromGrid(brick);
        tempRemovals.push(brick);
      }
      
      // Check each position
      for (let i = 0; i < selectedGroup.length; i++) {
        const brick = selectedGroup[i];
        const ghost = moveGhosts[i];
        const g = brick.userData.grid;
        
        const newGx = g.gx + offsetX;
        const newGz = g.gz + offsetZ;
        
        // Update ghost position
        const pos = new THREE.Vector3(
          newGx * STUD + (g.w * STUD) / 2,
          brick.position.y,
          newGz * STUD + (g.d * STUD) / 2
        );
        ghost.position.copy(pos);
        
        // Check if this position is valid
        const canPlaceHere = canPlace(newGx, newGz, g.w, g.d, g.gy, g.hp, false);
        if (!canPlaceHere) canPlaceAll = false;
      }
      
      // Restore all selected bricks to grid
      for (const brick of tempRemovals) {
        const g = brick.userData.grid;
        addToGrid(g.gx, g.gz, g.w, g.d, g.gy, g.hp, brick);
      }
      
      // Update ghost colors based on validity
      const ghostColor = canPlaceAll ? 0x00ff00 : 0xff0000;
      for (const ghost of moveGhosts) {
        ghost.traverse(obj => {
          if (obj.isMesh && obj.material) {
            obj.material.color.setHex(ghostColor);
          }
        });
      }
      
      // Store for placement check
      moveGhosts.canPlace = canPlaceAll;
      moveGhosts.targetGx = targetGx;
      moveGhosts.targetGz = targetGz;
    }
    function findConnectedBricks(startBrick) {
      // BFS to find all connected bricks
      const connected = new Set();
      const queue = [startBrick];
      connected.add(startBrick);
      
      while (queue.length > 0) {
        const current = queue.shift();
        const currentGrid = current.userData.grid;
        if (!currentGrid) continue;
        
        // Check all adjacent positions for connected bricks
        for (const brick of bricks) {
          if (connected.has(brick)) continue;
          const brickGrid = brick.userData.grid;
          if (!brickGrid) continue;
          
          // Check if bricks are adjacent (sharing a face or edge)
          const touching = areBricksTouching(currentGrid, brickGrid);
          if (touching) {
            connected.add(brick);
            queue.push(brick);
          }
        }
      }
      
      return Array.from(connected);
    }
    function areBricksTouching(g1, g2) {
      // Check if two brick grid positions are adjacent
      // g1 and g2 have: gx, gz, w, d, gy, hp
      
      // Check vertical adjacency (stacked)
      const g1Top = g1.gy + g1.hp;
      const g2Top = g2.gy + g2.hp;
      
      // Check if they overlap in X and Z
      const overlapX = !(g1.gx + g1.w <= g2.gx || g2.gx + g2.w <= g1.gx);
      const overlapZ = !(g1.gz + g1.d <= g2.gz || g2.gz + g2.d <= g1.gz);
      
      if (overlapX && overlapZ) {
        // They overlap horizontally, check if vertically adjacent
        if (g1Top === g2.gy || g2Top === g1.gy) {
          return true;
        }
      }
      
      // Check side adjacency (same height level)
      if (g1.gy < g2Top && g2.gy < g1Top) { // Overlapping in Y
        // Adjacent in X?
        if ((g1.gx + g1.w === g2.gx || g2.gx + g2.w === g1.gx) && overlapZ) {
          return true;
        }
        // Adjacent in Z?
        if ((g1.gz + g1.d === g2.gz || g2.gz + g2.d === g1.gz) && overlapX) {
          return true;
        }
      }
      
      return false;
    }
    function selectBrickGroup(clickedBrick, singleBrickOnly = false) {
      // Can't move instanced bricks (would need to recreate them)
      if (clickedBrick.isInstancedBrick) {
        toast('⚠️ Cannot move instanced bricks - use delete and recreate', 'error');
        return;
      }
      
      clearMoveSelection();
      
      if (singleBrickOnly) {
        // Select just this one brick
        selectedGroup = [clickedBrick];
      } else {
        // Find all connected bricks (excluding instanced ones)
        selectedGroup = findConnectedBricks(clickedBrick).filter(b => !b.isInstancedBrick);
      }
      
      if (selectedGroup.length === 0) {
        toast('No moveable bricks found');
        return;
      }
      
      // Highlight selected bricks
      for (const brick of selectedGroup) {
        if (brick.traverse) {
          brick.traverse(obj => {
            if (obj.isMesh && obj.material) {
              obj.userData.originalColor = obj.material.color.getHex();
              obj.material.emissive.setHex(0x00ffff);
              obj.material.emissiveIntensity = 0.3;
            }
          });
        }
      }
      
      // Create ghost previews
      createMoveGhosts();
      
      const modeText = singleBrickOnly ? '1 brick' : `${selectedGroup.length} bricks`;
      const moveLabel = document.getElementById('moveModeLabel');
      if (moveLabel) moveLabel.textContent = `✋ ${modeText} selected - Click to place, ESC to cancel`;
      
      toast(`Selected ${modeText}${singleBrickOnly ? '' : ' (hold Shift for single brick)'}`);
    }
    function placeMoveGroup(targetGx, targetGz) {
      if (selectedGroup.length === 0) return;
      
      // Calculate offset from first brick
      const firstBrick = selectedGroup[0];
      const firstGrid = firstBrick.userData.grid;
      if (!firstGrid) return;
      
      const offsetX = targetGx - firstGrid.gx;
      const offsetZ = targetGz - firstGrid.gz;
      
      // Check if all bricks can be placed at new positions
      let canPlaceAll = true;
      const newPositions = [];
      
      for (const brick of selectedGroup) {
        const g = brick.userData.grid;
        const newGx = g.gx + offsetX;
        const newGz = g.gz + offsetZ;
        
        // Temporarily remove from grid to check placement
        removeFromGrid(brick);
        
        const canPlaceHere = canPlace(newGx, newGz, g.w, g.d, g.gy, g.hp, false);
        if (!canPlaceHere) canPlaceAll = false;
        
        newPositions.push({brick, newGx, newGz, oldGx: g.gx, oldGz: g.gz, g});
      }
      
      if (canPlaceAll && (offsetX !== 0 || offsetZ !== 0)) {
        // Save move action with old and new positions
        const moveData = newPositions.map(np => ({
          type: np.brick.userData.type || np.brick.userData.brickType,
          color: np.brick.userData.color,
          rot: np.brick.userData.rot,
          pitch: np.brick.userData.pitch || 0,
          roll: np.brick.userData.roll || 0,
          transparent: np.brick.userData.transparent || false,
          oldGrid: { x: np.oldGx, z: np.oldGz, y: np.g.gy },
          newGrid: { x: np.newGx, z: np.newGz, y: np.g.gy }
        }));
        
        // For move, we'll use fullState since move is complex
        saveUndo();
        
        // Move all bricks
        for (const np of newPositions) {
          const pos = new THREE.Vector3(
            np.newGx * STUD + (np.g.w * STUD) / 2,
            np.brick.position.y,
            np.newGz * STUD + (np.g.d * STUD) / 2
          );
          np.brick.position.x = pos.x;
          np.brick.position.z = pos.z;
          np.g.gx = np.newGx;
          np.g.gz = np.newGz;
          addToGrid(np.newGx, np.newGz, np.g.w, np.g.d, np.g.gy, np.g.hp, np.brick);
        }
        
        toast(`✅ Moved ${selectedGroup.length} bricks`, 'success');
        clearMoveSelection();
      } else {
        // Restore original positions in grid
        for (const np of newPositions) {
          addToGrid(np.oldGx, np.oldGz, np.g.w, np.g.d, np.g.gy, np.g.hp, np.brick);
        }
        
        if (offsetX === 0 && offsetZ === 0) {
          clearMoveSelection();
        } else {
          toast('⚠️ Cannot place here - space occupied', 'error');
        }
      }
    }
    let hudDeleteAt = 0;
    function onHudDelete(event) {
      if (event.button != null && event.button > 0) return;
      const now = performance.now();
      if (now - hudDeleteAt < 400) return;
      hudDeleteAt = now;
      const turningOn = !deleteMode;
      setDeleteMode(turningOn);
      if (!turningOn) {
        toast('Delete OFF');
        return;
      }
      // Arming is only the mode. A brick leaves on a later plate click.
      toast('🗑️ Delete ON');
    }
    function onSavePress(event) {
      if (event && event.button != null && event.button > 0) return;
      // Click only. A pointerdown save plus a 400ms guard ate the next
      // Save when the second brick landed inside that window, so a real
      // overwrite never asked.
      saveProject();
    }
    let mobileTrayUserExpanded = false;
    function isPhoneChrome() { return window.innerWidth <= 768; }
    function applyMobileTray() {
      const mobileControlsPanel = document.getElementById('controls');
      const panelToggle = document.getElementById('panelToggle');
      if (!mobileControlsPanel) return;
      if (!isPhoneChrome()) {
        mobileControlsPanel.classList.remove('collapsed-mobile', 'tray-open');
        document.body.classList.remove('phone-tray-open');
        mobileTrayUserExpanded = false;
        return;
      }
      mobileControlsPanel.style.maxHeight = '';
      if (window.innerWidth <= 430) {
        mobileControlsPanel.classList.remove('collapsed-mobile');
        mobileControlsPanel.classList.toggle('tray-open', mobileTrayUserExpanded);
      } else {
        mobileControlsPanel.classList.remove('tray-open');
        mobileControlsPanel.classList.toggle('collapsed-mobile', !mobileTrayUserExpanded);
      }
      document.body.classList.toggle('phone-tray-open', window.innerWidth <= 430 && mobileTrayUserExpanded);
      const savedList = document.getElementById('savedProjectsList');
      if (savedList) {
        const trayOpen = document.body.classList.contains('phone-tray-open');
        if (!trayOpen) savedList.style.pointerEvents = '';
        else {
          // Rows stay inert until the sheet has landed, so a tap aimed at
          // the name field cannot load a build that is sliding through.
          savedList.style.pointerEvents = 'none';
          const panel = document.getElementById('controls');
          let settled = false;
          const unlock = () => {
            if (settled) return;
            settled = true;
            savedList.style.pointerEvents = '';
          };
          if (panel) panel.addEventListener('transitionend', unlock, { once: true });
          requestAnimationFrame(() => requestAnimationFrame(unlock));
        }
      }
      if (document.body.classList.contains('phone-tray-open')) {
        removeGhost();
        removeWallModeGhost();
        needsRender = true;
      }
      if (panelToggle) panelToggle.textContent = mobileTrayUserExpanded ? '▼ Hide tools' : '▲ Bricks & tools';
    }
    function bindInputEvents1() {
      // Mouse events. Hover work runs once per frame from animate(), not on every event.
      renderer.domElement.addEventListener('mousemove', e => {
        lastPointerMs = performance.now();
        pointerToMouse(e.clientX, e.clientY);
        scheduleHover();
      });

      renderer.domElement.addEventListener('pointerleave', () => {
        pointerDirty = false;
        hideHoverGhost();
      });
      const hideGhostOn = (id) => {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        if (!el) return;
        el.addEventListener('pointerenter', () => {
          pointerDirty = false;
          hideHoverGhost();
        });
      };
      hideGhostOn('controls');
      hideGhostOn('buildHud');
      hideGhostOn('quickBar');
      hideGhostOn('qualityBar');
      hideGhostOn(document.querySelector('.zoom-controls'));
      
      renderer.domElement.addEventListener('mousedown', e => {
        if (e.button === 0 && floorMode) {
          // Disable orbit controls during floor drag
          controls.enabled = false;
          
          // Start floor drag
          const hit = pickPoint();
          
          if (hit) {
            const gPos = worldToGrid(hit.point.x, hit.point.z);
            floorDragStart = {x: gPos.x, z: gPos.z};
            floorDragEnd = {x: gPos.x, z: gPos.z};
            updateFloorGhost();
          }
        } else if (e.button === 0 && wallMode) {
          // Disable orbit controls during wall drag
          controls.enabled = false;
          
          // Start wall drag at exact grid position
          const hit2 = pickPoint();
          
          if (hit2) {
            const gPos = worldToGrid(hit2.point.x, hit2.point.z);
            wallDragStart = {x: gPos.x, z: gPos.z};
            wallDragEnd = {x: gPos.x, z: gPos.z};
            updateWallGhost();
          }
        }
      });
      
      renderer.domElement.addEventListener('mouseup', e => {
        if (e.button === 0) {
          if (floorMode && floorDragStart) {
            // Place the floor
            placeFloor();
          }
          if (wallMode && wallDragStart) {
            // Place the wall
            placeWall();
          }
          // Re-enable orbit controls
          if (floorMode || wallMode) {
            controls.enabled = true;
          }
        }
      });
      
      renderer.domElement.addEventListener('pointerdown', (e) => {
        if (overlayBlocksPlay()) return;
        orbitPointerX = e.clientX;
        orbitPointerY = e.clientY;
        orbitPointerDown = true;
      });
      renderer.domElement.addEventListener('pointermove', (e) => {
        if (!orbitPointerDown) return;
        if (Math.hypot(e.clientX - orbitPointerX, e.clientY - orbitPointerY) > 6) {
          orbitHidingGhost = true;
          hideHoverGhost();
        }
      });
      const endOrbitPointer = () => {
        orbitPointerDown = false;
        orbitHidingGhost = false;
      };
      renderer.domElement.addEventListener('pointerup', endOrbitPointer);
      renderer.domElement.addEventListener('pointercancel', endOrbitPointer);
      renderer.domElement.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointerDownX = e.clientX;
        pointerDownY = e.clientY;
        pointerDownSeen = true;
      });
      renderer.domElement.addEventListener('click', e => {
        // A tap already placed from touchend. Chrome still synthesizes a click.
        if (performance.now() < suppressClickUntil) return;
        // Orbit uses the left button. A drag must not place.
        if (pointerDownSeen && Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) > 6) return;
        // If in walk mode menu mode, re-lock the pointer
        if (firstPersonMode && fpMenuMode && !document.pointerLockElement) {
          fpMenuMode = false;
          renderer.domElement.requestPointerLock();
          return;
        }
        
        // Walk mode building now uses mousedown/mouseup - skip click handler
        if (firstPersonMode && fpBuildMode && document.pointerLockElement) {
          return;
        }
        
        if (e.button === 0 && !floorMode && !wallMode) {
          pointerToMouse(e.clientX, e.clientY);
          pointerDirty = false;
          updateGhost({ forPlace: true });
          // When in prefab selection mode, clicking on bricks toggles selection
          // But if we have a valid ghost for placement, prioritize placement
          if (isRecordingPrefab) {
            // If ghost exists and can place, prioritize placing the new brick
            if (ghost && ghost.userData.ghostData && ghost.userData.ghostData.canPlace) {
              // Fall through to placeBrick
            } else {
              // No valid placement - check if we're clicking on an existing brick to toggle
              const pickedPrefab = pickPoint();
              if (pickedPrefab && pickedPrefab.brick && bricks.includes(pickedPrefab.brick)) {
                if (pickedPrefab.brick.isInstancedBrick) {
                  toast('⚠️ Instanced bricks cannot be selected for prefabs', 'error');
                  return;
                }
                toggleBrickForPrefab(pickedPrefab.brick);
                return;
              }
              return;
            }
          }
          
          if (deleteMode) {
            const picked = pickPoint();
            if (picked && picked.brick) deleteBrick();
            else {
              setDeleteMode(false);
              placeBrick();
            }
          }
          else if (dropperMode) pickColor();
          else if (paintMode) paintBrick();
          else if (facePaintMode) facePaintBrick();
          else if (moveMode) {
            // Handle move mode clicks (Shift + click for single brick)
            handleMoveClick(e.shiftKey);
          }
          else placeBrick();
        }
      });
    }
    function bindInputEvents2() {
      
      // Right-click to delete in walk mode - use mousedown for reliability in pointer lock
      // Left-click starts showing ghost, release places brick
      renderer.domElement.addEventListener('mousedown', e => {
        if (firstPersonMode && fpBuildMode && document.pointerLockElement) {
          if (e.button === 0 && !fpRadialMenuOpen) {
            // Left-click: start showing ghost preview
            e.preventDefault();
            fpClickHeld = true;
            // Force immediate ghost update
            fpUpdateCounter = 99;
            updateFpGhost();
          } else if (e.button === 2) {
            // Right-click: delete brick
            e.preventDefault();
            deleteBrickInWalkMode();
          } else if (e.button === 1) {
            // Middle-click: pick up brick type (like Minecraft)
            e.preventDefault();
            pickBrickTypeInWalkMode();
          }
        }
      });
      
      // Left mouse release places brick in walk mode
      renderer.domElement.addEventListener('mouseup', e => {
        if (firstPersonMode && fpBuildMode && document.pointerLockElement) {
          if (e.button === 0 && fpClickHeld) {
            // Place the brick at current ghost position
            placeBrickInWalkMode();
            fpClickHeld = false;
            
            // Hide the ghost
            if (fpGhost) {
              scene.remove(fpGhost);
              fpGhost = null;
            }
            fpPrefabGhosts.forEach(g => scene.remove(g));
            fpPrefabGhosts = [];
          }
        }
      });
      
      // Global mouseup to handle edge case where user releases outside canvas
      document.addEventListener('mouseup', e => {
        if (e.button === 0 && fpClickHeld) {
          fpClickHeld = false;
          // Hide any visible ghosts
          if (fpGhost) {
            scene.remove(fpGhost);
            fpGhost = null;
          }
          fpPrefabGhosts.forEach(g => scene.remove(g));
          fpPrefabGhosts = [];
        }
      });
      
      // Prevent context menu in walk mode
      renderer.domElement.addEventListener('contextmenu', e => {
        if (firstPersonMode) {
          e.preventDefault();
        }
      });
      
      // Capture the wheel before OrbitControls. One notch used to scale
      // distance by the full delta and land inside the build.
      renderer.domElement.addEventListener('wheel', e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (overlayBlocksPlay()) return;
        if (firstPersonMode) {
          // Rotate 90 degrees per scroll
          if (e.deltaY > 0) {
            currentRotation = (currentRotation + 90) % 360;
          } else {
            currentRotation = (currentRotation - 90 + 360) % 360;
          }
          const hudRot = document.getElementById('hudRotLabel');
          if (hudRot) hudRot.textContent = currentRotation + '°';
          // Update ghost immediately
          if (fpGhost) {
            scene.remove(fpGhost);
            fpGhost = null;
          }
          fpPrefabGhosts.forEach(g => scene.remove(g));
          fpPrefabGhosts = [];
          updateFpBrickInfo();
          return;
        }
        let ticks = e.deltaY;
        if (e.deltaMode === 1) ticks = e.deltaY * 16;
        else if (e.deltaMode === 2) ticks = e.deltaY * 80;
        ticks = Math.max(-1, Math.min(1, ticks / 100));
        if (!ticks) return;
        const dist = camera.position.distanceTo(controls.target);
        const step = Math.max(0.8, dist * 0.1);
        zoomCamera(Math.sign(ticks) * step * Math.min(1, Math.abs(ticks)), e.clientX, e.clientY);
      }, { passive: false, capture: true });
      
      // Select a quick slot
      
      // Toggle radial menu
      
      // Open radial menu
      
      // Show submenu for a category
      
      // Close radial menu
      
      // Initialize hotbar click handlers
      
      
      renderer.domElement.addEventListener('contextmenu', e => { 
        e.preventDefault(); 
        deleteBrick(); 
      });
      
      // Touch events
      
      renderer.domElement.addEventListener('touchstart', e => {
        touchStartTime = Date.now();
        touchMoved = false;
        
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
          pointerToMouse(touch.clientX, touch.clientY);
          pointerDirty = false;
          flushPointerHover();
          
          // Show touch indicator
          const indicator = document.getElementById('touchIndicator');
          indicator.style.left = touch.clientX + 'px';
          indicator.style.top = touch.clientY + 'px';
          indicator.classList.add('active');
        }
      }, {passive: true});
      
      renderer.domElement.addEventListener('touchmove', e => {
        if (e.touches.length === 1) {
          const moved = e.touches[0];
          if (Math.hypot(moved.clientX - touchStartX, moved.clientY - touchStartY) > 6) touchMoved = true;
        } else {
          touchMoved = true;
        }
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          pointerToMouse(touch.clientX, touch.clientY);
          scheduleHover();
        }
        document.getElementById('touchIndicator').classList.remove('active');
      }, {passive: true});
      
    }
    function overlayBlocksPlay() {
      const marked = (id) => {
        const el = document.getElementById(id);
        return !!(el && el.classList.contains('visible'));
      };
      const flexed = (id) => {
        const el = document.getElementById(id);
        return !!(el && el.style.display === 'flex');
      };
      if (marked('tutorialModal') || marked('keybindModal')) return true;
      if (flexed('galleryModal') || flexed('loadConfirm') || flexed('namePrompt')) return true;
      const phone = document.getElementById('phoneTutorial');
      if (phone && !phone.hidden) return true;
      return false;
    }
    function isHotkeyTarget(el) {
      if (!el || !el.tagName) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
      if (el.isContentEditable) return true;
      if (el.closest && el.closest('button, input, textarea, select, [contenteditable="true"]')) return true;
      return false;
    }
    function anyModalOpen() {
      if (overlayBlocksPlay()) return true;
      const nodes = document.querySelectorAll('.modal-overlay, [role="dialog"]');
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        if (el.classList && el.classList.contains('visible')) return true;
        if (el.style && (el.style.display === 'flex' || el.style.display === 'block')) return true;
      }
      return false;
    }
    // One guard for every build hotkey. Escape still closes modals.
    // Field and confirm listeners are separate, so a typed character and Enter still land.
    function hotkeyBlocked(e) {
      if (!e || e.key === 'Escape') return false;
      if (isHotkeyTarget(e.target) || isHotkeyTarget(document.activeElement)) return true;
      if (e.composedPath) {
        const path = e.composedPath();
        for (let i = 0; i < path.length && i < 6; i++) {
          if (isHotkeyTarget(path[i])) return true;
        }
      }
      if (anyModalOpen()) return true;
      return false;
    }
    function onBuilderKeyDown(e) {
      if (e.__brixHotkey) return;
      e.__brixHotkey = true;
      if (hotkeyBlocked(e)) return;
      if (e.key === 'Escape') {
        const mirrorPop = document.getElementById('mirrorPopup');
        const mirrorOpen = mirrorOn || (mirrorPop && mirrorPop.classList.contains('visible'));
        if (mirrorOpen) {
          mirrorOn = false;
          const mirrorBtn = document.getElementById('mirrorBtn');
          const mirrorSettings = document.getElementById('mirrorSettings');
          if (mirrorBtn) mirrorBtn.classList.remove('active');
          if (mirrorSettings) mirrorSettings.classList.remove('visible');
          if (mirrorPop) mirrorPop.classList.remove('visible');
          updateMirrorLines();
          updateGhost();
          if (typingInField(e)) return;
        }
      }
      if (typingInField(e)) return;

      if (e.key === 'Escape') {
        const loadConfirm = document.getElementById('loadConfirm');
        const namePrompt = document.getElementById('namePrompt');
        const confirmUp = (loadConfirm && loadConfirm.style.display === 'flex')
          || (namePrompt && namePrompt.style.display === 'flex');
        if (confirmUp) return;
        const tutorial = document.getElementById('tutorialModal');
        if (tutorial && tutorial.classList.contains('visible')) tutorial.classList.remove('visible');
        const keybind = document.getElementById('keybindModal');
        if (keybind && keybind.classList.contains('visible')) keybind.classList.remove('visible');
        const phoneTut = document.getElementById('phoneTutorial');
        if (phoneTut && !phoneTut.hidden) {
          phoneTut.hidden = true;
          const box = document.getElementById('phoneTutorialDontShow');
          if (box && box.checked) {
            try { localStorage.setItem('brickBuilderTutorialDismissed', 'true'); } catch (err) {}
          }
        }
        const gallery = document.getElementById('galleryModal');
        if (gallery && gallery.style.display === 'flex') {
          closeGallery();
          return;
        }
        returnToPlaceMode();
        return;
      }
      
      // F11 for fullscreen (check before toLowerCase)
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreenMode();
        return;
      }
      
      const key = e.key.toLowerCase();
      keysPressed.add(key);
      
      // First-person mode controls
      if (firstPersonMode) {
        switch(key) {
          case 'w': fpKeys.forward = true; break;
          case 's': fpKeys.backward = true; break;
          case 'a': fpKeys.left = true; break;
          case 'd': fpKeys.right = true; break;
          case 'c': toggleCrouch(); break;
          case 'control': fpCrouching = true; document.getElementById('crouchBtn').classList.add('active'); break;
          case 'tab': 
            e.preventDefault();
            // Release mouse to access sidebar menu
            if (document.pointerLockElement) {
              fpMenuMode = true;
              document.exitPointerLock();
              toast('🖱️ Mouse released - click canvas to resume', 'info');
            }
            break;
          case 'q':
            // Previous brick in quick slots
            fpQuickSlotIndex = (fpQuickSlotIndex - 1 + fpQuickSlots.length) % fpQuickSlots.length;
            selectFpQuickSlot(fpQuickSlotIndex);
            break;
          case 'e':
            // Next brick in quick slots
            fpQuickSlotIndex = (fpQuickSlotIndex + 1) % fpQuickSlots.length;
            selectFpQuickSlot(fpQuickSlotIndex);
            break;
          case 'r':
            // Rotate brick with R key
            currentRotation = (currentRotation + 90) % 360;
            { const hudRot = document.getElementById('hudRotLabel'); if (hudRot) hudRot.textContent = currentRotation + '°'; }
            if (fpGhost) { scene.remove(fpGhost); fpGhost = null; }
            updateFpBrickInfo();
            break;
          case 'enter':
            // Enter key to place brick
            e.preventDefault();
            if (fpBuildMode) {
              placeBrickInWalkMode();
            }
            break;
        }
        
        // Arrow keys to nudge ghost position
        switch(e.key) {
          case 'ArrowUp':
            e.preventDefault();
            fpGhostOffset.z -= 1;
            if (fpGhost) { scene.remove(fpGhost); fpGhost = null; }
            break;
          case 'ArrowDown':
            e.preventDefault();
            fpGhostOffset.z += 1;
            if (fpGhost) { scene.remove(fpGhost); fpGhost = null; }
            break;
          case 'ArrowLeft':
            e.preventDefault();
            fpGhostOffset.x -= 1;
            if (fpGhost) { scene.remove(fpGhost); fpGhost = null; }
            break;
          case 'ArrowRight':
            e.preventDefault();
            fpGhostOffset.x += 1;
            if (fpGhost) { scene.remove(fpGhost); fpGhost = null; }
            break;
          case 'PageUp':
            e.preventDefault();
            fpGhostOffset.y += 1; // Move up 1 plate
            if (fpGhost) { scene.remove(fpGhost); fpGhost = null; }
            break;
          case 'PageDown':
            e.preventDefault();
            fpGhostOffset.y -= 1; // Move down 1 plate
            if (fpGhost) { scene.remove(fpGhost); fpGhost = null; }
            break;
        }
        
        // Number keys 1-9 for quick brick selection (or custom keybinds)
        const slotIndex = typeof getSlotByKey === 'function' ? getSlotByKey(key) : (key >= '1' && key <= '9' ? parseInt(key) - 1 : -1);
        if (slotIndex >= 0 && slotIndex < fpQuickSlots.length) {
          selectFpQuickSlot(slotIndex);
        }
        // Space bar for jump (check code since key might vary)
        if (e.code === 'Space' || e.key === ' ') {
          fpKeys.jump = true;
          e.preventDefault();
        }
        if (e.key === 'Escape') {
          if (fpRadialMenuOpen) {
            closeFpRadialMenu();
          } else if (fpMenuMode) {
            // If already in menu mode and pressing escape again, just exit completely
            // (The double-tap handler will catch this too, but this is clearer)
            fpMenuMode = false;
            exitFirstPersonMode();
          } else {
            exitFirstPersonMode();
          }
        }
        return;
      }
      
      // Handle arrow keys for panning
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          panCamera(0, 1);
          return;
        case 'ArrowDown':
          e.preventDefault();
          panCamera(0, -1);
          return;
        case 'ArrowLeft':
          e.preventDefault();
          panCamera(-1, 0);
          return;
        case 'ArrowRight':
          e.preventDefault();
          panCamera(1, 0);
          return;
      }
      
      switch(key) {
        // WASD for panning
        case 'w':
          panCamera(0, 1);
          break;
        case 's':
          panCamera(0, -1);
          break;
        case 'a':
          panCamera(-1, 0);
          break;
        case 'd':
          panCamera(1, 0);
          break;
        case 'r':
          rotate(e.shiftKey ? 45 : 90);
          break;
        case 'x': // Delete mode
          setDeleteMode(!deleteMode);
          toast(deleteMode ? '🗑️ Delete ON' : 'Delete OFF');
          break;
        case 'c':
          dropperMode = !dropperMode; deleteMode = false; paintMode = false;
          document.getElementById('dropperBtn').classList.toggle('dropper-active', dropperMode);
          document.getElementById('deleteBtn').classList.remove('delete-active');
          document.getElementById('paintBtn').classList.remove('paint-active');
          document.body.classList.toggle('dropper-mode', dropperMode);
          document.body.classList.remove('delete-mode', 'paint-mode');
          updateGhost();
          toast(dropperMode ? '💧 Dropper ON' : 'Dropper OFF');
          break;
        case 'p':
          if (e.shiftKey) {
            // Shift+P = Face Paint mode
            facePaintMode = !facePaintMode; paintMode = false; deleteMode = false; dropperMode = false; floorMode = false;
            document.getElementById('facePaintBtn').classList.toggle('facepaint-active', facePaintMode);
            document.getElementById('paintBtn').classList.remove('paint-active');
            document.getElementById('deleteBtn').classList.remove('delete-active');
            document.getElementById('dropperBtn').classList.remove('dropper-active');
            document.getElementById('floorBtn').classList.remove('floor-active');
            document.body.classList.toggle('facepaint-mode', facePaintMode);
            document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode');
            updateGhost();
            toast(facePaintMode ? '🖌️ Face Paint ON - click brick sides' : 'Face Paint OFF');
          } else {
            // P = Regular Paint mode
            paintMode = !paintMode; facePaintMode = false; deleteMode = false; dropperMode = false; floorMode = false;
            document.getElementById('paintBtn').classList.toggle('paint-active', paintMode);
            document.getElementById('facePaintBtn').classList.remove('facepaint-active');
            document.getElementById('deleteBtn').classList.remove('delete-active');
            document.getElementById('dropperBtn').classList.remove('dropper-active');
            document.getElementById('floorBtn').classList.remove('floor-active');
            document.body.classList.toggle('paint-mode', paintMode);
            document.body.classList.remove('delete-mode', 'dropper-mode', 'facepaint-mode');
            if (paintMode) updateBuildToolPopup(); // Close build popup if open
            updateGhost();
            toast(paintMode ? '🎨 Paint ON' : 'Paint OFF');
          }
          break;
        case 'f':
          floorMode = !floorMode; deleteMode = false; dropperMode = false; paintMode = false; facePaintMode = false; wallMode = false;
          document.getElementById('floorBtn').classList.toggle('floor-active', floorMode);
          document.getElementById('wallBtn').classList.remove('wall-active');
          document.getElementById('deleteBtn').classList.remove('delete-active');
          document.getElementById('dropperBtn').classList.remove('dropper-active');
          document.getElementById('paintBtn').classList.remove('paint-active');
          document.getElementById('facePaintBtn').classList.remove('facepaint-active');
          document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode', 'facepaint-mode');
          if (!floorMode) cancelFloorDrag();
          updateGhost();
          updateBuildToolPopup();
          toast(floorMode ? '⬜ Floor mode ON - drag to draw' : 'Floor mode OFF');
          break;
        case 'b':
          wallMode = !wallMode; deleteMode = false; dropperMode = false; paintMode = false; facePaintMode = false; floorMode = false;
          document.getElementById('wallBtn').classList.toggle('wall-active', wallMode);
          document.getElementById('floorBtn').classList.remove('floor-active');
          document.getElementById('deleteBtn').classList.remove('delete-active');
          document.getElementById('dropperBtn').classList.remove('dropper-active');
          document.getElementById('paintBtn').classList.remove('paint-active');
          document.getElementById('facePaintBtn').classList.remove('facepaint-active');
          document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode', 'facepaint-mode');
          if (!wallMode) cancelWallDrag();
          updateGhost();
          updateBuildToolPopup();
          toast(wallMode ? '🧱 Wall mode ON - drag to draw' : 'Wall mode OFF');
          break;
        case 'g':
          gravityOn = !gravityOn;
          document.getElementById('gravityBtn').classList.toggle('active', gravityOn);
          if (gravityOn) applyGravity();
          toast(gravityOn ? '🌍 Gravity ON' : 'Gravity OFF');
          break;
        case 't': // Pitch rotation
          currentPitch = (currentPitch + 90) % 360;
          updateGhost();
          toast(`↕️ Pitch: ${currentPitch}°`);
          break;
        case 'y': // Roll rotation OR Ctrl+Y for redo
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            redo();
          } else {
            currentRoll = (currentRoll + 90) % 360;
            updateGhost();
            toast(`↔️ Roll: ${currentRoll}°`);
          }
          break;
        case 'm':
          mirrorOn = !mirrorOn;
          document.getElementById('mirrorBtn').classList.toggle('active', mirrorOn);
          document.getElementById('mirrorSettings').classList.toggle('visible', mirrorOn);
          document.getElementById('mirrorPopup').classList.toggle('visible', mirrorOn);
          if (mirrorOn) showFloating(document.getElementById('mirrorPopup'));
          updateMirrorLines();
          updateGhost();
          toast(mirrorOn ? '🔀 Mirror ON' : 'Mirror OFF');
          break;
        case 'n':
          moveMode = !moveMode;
          deleteMode = dropperMode = paintMode = floorMode = wallMode = false;
          document.getElementById('moveBtn').classList.toggle('move-active', moveMode);
          document.getElementById('moveModeIndicator').classList.toggle('visible', moveMode);
          document.getElementById('deleteBtn').classList.remove('delete-active');
          document.getElementById('dropperBtn').classList.remove('dropper-active');
          document.getElementById('paintBtn').classList.remove('paint-active');
          document.getElementById('floorBtn').classList.remove('floor-active');
          document.getElementById('wallBtn').classList.remove('wall-active');
          document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode');
          if (!moveMode) clearMoveSelection();
          updateGhost();
          toast(moveMode ? '✋ Move mode ON' : 'Move mode OFF');
          break;
        case 'q': // Zoom in
          zoomCamera(-3);
          break;
        case 'e': // Zoom out
          zoomCamera(3);
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); saveProject(); }
          break;
        case 'tab':
          e.preventDefault();
          window.toggleSidebar();
          break;
        case 'v':
          // Toggle walk mode
          toggleFirstPersonMode();
          break;
        case 'escape':
          // Exit fullscreen mode first
          if (fullscreenMode) {
            exitFullscreenMode();
            return;
          }
          deleteMode = dropperMode = paintMode = false;
          document.getElementById('deleteBtn').classList.remove('delete-active');
          document.getElementById('dropperBtn').classList.remove('dropper-active');
          document.getElementById('paintBtn').classList.remove('paint-active');
          document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode');
          // Close mirror popup if open
          if (mirrorOn) {
            mirrorOn = false;
            document.getElementById('mirrorBtn').classList.remove('active');
            document.getElementById('mirrorSettings').classList.remove('visible');
            document.getElementById('mirrorPopup').classList.remove('visible');
            updateMirrorLines();
          }
          // Cancel move mode selection
          if (moveMode && selectedGroup.length > 0) {
            clearMoveSelection();
            toast('Move selection cancelled');
          } else if (moveMode) {
            moveMode = false;
            document.getElementById('moveBtn').classList.remove('move-active');
            document.getElementById('moveModeIndicator').classList.remove('visible');
            toast('Move mode OFF');
          }
          // Cancel floor drag if in progress
          if (floorMode && floorDragStart) {
            cancelFloorDrag();
            toast('Floor drag cancelled');
          }
          updateGhost();
          break;
      }
    }

    function bindInputEvents3() {
      renderer.domElement.addEventListener('touchend', e => {
        document.getElementById('touchIndicator').classList.remove('active');
        
        const touchDuration = Date.now() - touchStartTime;
        
        // Quick tap = place/delete/paint, long press handled differently
        if (!touchMoved && touchDuration < 300) {
          suppressClickUntil = performance.now() + 700;
          const lift = e.changedTouches && e.changedTouches[0];
          if (lift) pointerToMouse(lift.clientX, lift.clientY);
          pointerDirty = false;
          updateGhost({ forPlace: true });
          if (deleteMode) {
            const picked = pickPoint();
            if (picked && picked.brick) deleteBrick();
            else {
              setDeleteMode(false);
              placeBrick();
            }
          }
          else if (dropperMode) pickColor();
          else if (paintMode) paintBrick();
          else if (facePaintMode) facePaintBrick();
          else placeBrick();
        }
      });
      
      window.addEventListener('resize', () => {
        applyViewSize();
      });
      
      // Track which keys are held for smooth panning
      
      // Camera pan function
      
      // Negative delta moves closer. A wheel call passes the cursor and scales
      // the camera and the orbit target around the ground point under it, so
      // that brick stays on the same pixel. Buttons omit the cursor and stay
      // on the target. The cap is wide enough for one click at the far phone
      // pose; a hold still passes ±2 and is not clipped down to the click.
      



      // Focus moves in pointerdown, before a keydown can hit a hotkey.
      // A modal also freezes orbit before the canvas sees the same press.
      let fieldArm = null;
      let fieldArmAt = 0;
      document.addEventListener('pointerdown', (e) => {
        if (controls) controls.enabled = !overlayBlocksPlay();
        const t = e.target;
        if (!t || !t.closest) return;
        const field = t.closest('input, textarea, select, [contenteditable="true"]');
        if (field) {
          fieldArm = field;
          fieldArmAt = performance.now();
          focusFieldNow(field);
        } else fieldArm = null;
      }, true);
      // A key can be queued before focus moves. Capture runs first, puts the
      // character in the field that was just pressed, and stops the hotkey.
      document.addEventListener('keydown', (e) => {
        if (!fieldArm || performance.now() - fieldArmAt > 1500) return;
        if (e.key === 'Escape' || e.ctrlKey || e.metaKey || e.altKey) return;
        focusFieldNow(fieldArm);
        // focus() does not retarget this event. If it is already on the
        // field, the browser inserts the character. Otherwise we do.
        if (e.target === fieldArm) return;
        if (e.key === 'Backspace') {
          e.preventDefault();
          e.stopPropagation();
          fieldArm.value = (fieldArm.value || '').slice(0, -1);
          return;
        }
        if (e.key.length !== 1) return;
        e.preventDefault();
        e.stopPropagation();
        const max = fieldArm.maxLength > 0 ? fieldArm.maxLength : 1000000;
        if ((fieldArm.value || '').length >= max) return;
        fieldArm.value += e.key;
        try { fieldArm.setSelectionRange(fieldArm.value.length, fieldArm.value.length); } catch (err) { /* type=number has no caret */ }
      }, true);

      const projectNameField = document.getElementById('projectName');
      if (projectNameField) {
        projectNameField.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') return;
          e.stopPropagation();
        });
      }



      // Keyboard. A named function stays uncompiled until the first key,
      // so boot does not pay for this handler in one turn.
      document.addEventListener('keydown', onBuilderKeyDown, true);
      document.addEventListener('keydown', onBuilderKeyDown);
      document.addEventListener('keypress', onBuilderKeyPress, true);
      document.addEventListener('keypress', onBuilderKeyPress);
    }
    function onBuilderKeyPress(e) {
      if (e.__brixHotkeyPress) return;
      e.__brixHotkeyPress = true;
      if (hotkeyBlocked(e)) return;
    }
    function bindInputEvents4() {
      
      // Global mouseup to catch drag releases outside canvas
      document.addEventListener('mouseup', e => {
        if (floorMode && floorDragStart) {
          controls.enabled = true;
        }
      });
      
      document.addEventListener('keyup', onBuilderKeyUp, true);
      document.addEventListener('keyup', onBuilderKeyUp);
    function onBuilderKeyUp(e) {
      if (e.__brixHotkeyUp) return;
      e.__brixHotkeyUp = true;
      const key = e.key.toLowerCase();
      keysPressed.delete(key);
      // Releases always run. A key let go over a field or a modal must not stick.
      if (firstPersonMode) {
        switch(key) {
          case 'w': fpKeys.forward = false; break;
          case 's': fpKeys.backward = false; break;
          case 'a': fpKeys.left = false; break;
          case 'd': fpKeys.right = false; break;
          case 'control': fpCrouching = false; document.getElementById('crouchBtn').classList.remove('active'); break;
        }
        if (e.code === 'Space' || e.key === ' ') {
          fpKeys.jump = false;
        }
      }
      if (hotkeyBlocked(e)) return;
    }
      
      // Mouse move for first-person look
      document.addEventListener('mousemove', onFirstPersonMouseMove);
      
      // Pointer lock change handler
      document.addEventListener('pointerlockchange', () => {
        if (!document.pointerLockElement && firstPersonMode) {
          if (fpMenuMode) {
            // User released pointer lock while in menu mode - that's fine, stay in menu mode
            // They can press Escape again to fully exit, or click canvas to re-enter
          } else {
            // User pressed ESC to exit - fully exit FP mode
            exitFirstPersonMode();
          }
        }
      });
      
      // Failsafe: Double-tap Escape always exits walk mode completely
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && firstPersonMode) {
          const now = Date.now();
          if (now - lastEscapeTime < 500) {
            // Double-tap Escape - force exit walk mode
            fpMenuMode = false;
            exitFirstPersonMode();
          }
          lastEscapeTime = now;
        }
      }, true); // Capture phase to run before other handlers
      
      // Zoom button listeners
      document.getElementById('zoomInBtn').addEventListener('click', () => {
        const dist = camera.position.distanceTo(controls.target);
        const frac = window.innerWidth <= 768 ? 0.4 : 0.18;
        zoomCamera(-Math.max(5, dist * frac));
      });
      document.getElementById('zoomOutBtn').addEventListener('click', () => {
        const dist = camera.position.distanceTo(controls.target);
        const frac = window.innerWidth <= 768 ? 0.4 : 0.18;
        zoomCamera(Math.max(5, dist * frac));
      });
      
      // Hold-to-zoom for buttons
      document.getElementById('zoomInBtn').addEventListener('mousedown', () => {
        zoomInterval = setInterval(() => zoomCamera(-2), 50);
      });
      document.getElementById('zoomOutBtn').addEventListener('mousedown', () => {
        zoomInterval = setInterval(() => zoomCamera(2), 50);
      });
      document.addEventListener('mouseup', () => {
        if (zoomInterval) { clearInterval(zoomInterval); zoomInterval = null; }
      });
      
      // Sidebar toggle
      const sidebarToggle = document.getElementById('sidebarToggle');
      const controlsPanel = document.getElementById('controls');
      
      window.toggleSidebar = function() {
        sidebarCollapsed = !sidebarCollapsed;
        controlsPanel.classList.toggle('collapsed', sidebarCollapsed);
        document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);
        sidebarToggle.textContent = sidebarCollapsed ? '☰' : '✕';
        sidebarToggle.title = sidebarCollapsed ? 'Show Menu (Tab)' : 'Hide Menu (Tab)';
        sidebarToggle.style.left = sidebarCollapsed ? '12px' : '304px';
        applyViewSize();
      };
      
      sidebarToggle.addEventListener('click', window.toggleSidebar);

      const infoPanel = document.getElementById('info');
      if (infoPanel) {
        const infoTitle = infoPanel.querySelector('h3');
        if (infoTitle) {
          infoTitle.addEventListener('click', () => infoPanel.classList.toggle('collapsed'));
        }
      }
      
      // A drag that scrolls the phone sheet ends on the title under the finger.
      // Toggle on pointerup only when the finger stayed within 18px.
      const trayScrollEl = document.querySelector('.tray-scroll');
      if (trayScrollEl) {
        trayScrollEl.addEventListener('pointerdown', (e) => {
          trayDownX = e.clientX;
          trayDownY = e.clientY;
          trayDownSeen = true;
        }, true);
      }
      document.querySelectorAll('.section-title').forEach(title => {
        let lastToggle = 0;
        title.addEventListener('pointerup', (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          // A scroll ends on a title. Only a finger that stayed put opens it.
          if (!trayDownSeen || Math.hypot(e.clientX - trayDownX, e.clientY - trayDownY) > 18) return;
          const now = performance.now();
          // A phone tap can be followed by the click the button also
          // expects. That second pointerup arrives just after 400 ms.
          if (now - lastToggle < 700) return;
          lastToggle = now;
          title.parentElement.classList.toggle('collapsed');
        });
      });
      
      // Subsection collapse toggle
      document.querySelectorAll('.subsection-title').forEach(title => {
        title.addEventListener('click', () => {
          const subsection = title.parentElement;
          subsection.classList.toggle('collapsed');
        });
      });
      
      // UI Buttons
      document.querySelectorAll('.brick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedBrick = btn.dataset.brick;
          selectedPrefab = null; // Deselect prefab when selecting a brick
          document.querySelectorAll('.brick-btn').forEach(b => b.classList.remove('selected'));
          document.querySelectorAll('.prefab-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          updateUI(); 
          updateGhost();
        });
      });
    }
    function bindInputEvents5() {
      document.querySelectorAll('.brick-btn').forEach(b => {
        b.classList.toggle('selected', b.dataset.brick === selectedBrick);
      });
      if (typeof updateUI === 'function') updateUI();
      
      document.getElementById('colorPicker').addEventListener('input', e => {
        setDeleteMode(false);
        selectedColor = parseInt(e.target.value.slice(1), 16);
        document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('selected'));
        updateGhost();
        const swatch = document.getElementById('hudColorSwatch');
        if (swatch) swatch.style.background = e.target.value;
      });
      
      document.querySelectorAll('.color-preset').forEach(p => {
        p.addEventListener('click', () => {
          setDeleteMode(false);
          selectedColor = parseInt(p.dataset.color.slice(1), 16);
          isTransparent = p.dataset.trans === 'true';
          document.getElementById('colorPicker').value = p.dataset.color;
          document.querySelectorAll('.color-preset').forEach(x => x.classList.remove('selected'));
          p.classList.add('selected');
          updateGhost();
          const swatch = document.getElementById('hudColorSwatch');
          if (swatch) swatch.style.background = p.dataset.color;
        });
      });
      
      // Light color buttons
      document.querySelectorAll('.light-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedLightColor = parseInt(btn.dataset.lightColor);
          document.querySelectorAll('.light-color-btn').forEach(b => {
            b.style.border = '2px solid transparent';
          });
          btn.style.border = '2px solid #fff';
          btn.classList.add('selected');
          updateGhost();
          toast('💡 Light color set');
        });
      });
      
      document.getElementById('rotateBtn').addEventListener('click', () => rotate(90));
      
      // Pitch rotation (X axis)
      document.getElementById('rotatePitchBtn').addEventListener('click', () => {
        currentPitch = (currentPitch + 90) % 360;
        updateGhost();
        toast(`↕️ Pitch: ${currentPitch}°`);
      });
      
      // Roll rotation (Z axis)
      document.getElementById('rotateRollBtn').addEventListener('click', () => {
        currentRoll = (currentRoll + 90) % 360;
        updateGhost();
        toast(`↔️ Roll: ${currentRoll}°`);
      });
      
      // Prefab buttons - toggle selection mode
      document.querySelectorAll('.prefab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectPrefab(btn.dataset.prefab);
        });
      });
      
      // Prefab search functionality
      const prefabSearchInput = document.getElementById('prefabSearch');
      prefabSearchInput.addEventListener('input', (e) => {
        filterPrefabs(e.target.value);
      });
      
      // Clear search on Escape
      prefabSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          prefabSearchInput.value = '';
          filterPrefabs('');
          prefabSearchInput.blur();
        }
      });
      
      
      document.getElementById('deleteBtn').addEventListener('click', () => {
        setDeleteMode(!deleteMode);
        toast(deleteMode ? '🗑️ Delete ON' : 'Delete OFF');
      });
      const deleteModeExit = document.getElementById('deleteModeExit');
      if (deleteModeExit) deleteModeExit.addEventListener('click', () => setDeleteMode(false));
      const moveModeExit = document.getElementById('moveModeExit');
      if (moveModeExit) moveModeExit.addEventListener('click', () => {
        moveMode = false;
        const moveBtn = document.getElementById('moveBtn');
        if (moveBtn) moveBtn.classList.remove('move-active');
        const ind = document.getElementById('moveModeIndicator');
        if (ind) ind.classList.remove('visible');
        clearMoveSelection();
        updateGhost();
      });
      
      document.getElementById('dropperBtn').addEventListener('click', () => {
        dropperMode = !dropperMode; deleteMode = false;
        document.getElementById('dropperBtn').classList.toggle('dropper-active', dropperMode);
        document.getElementById('deleteBtn').classList.remove('delete-active');
        document.getElementById('paintBtn').classList.remove('paint-active');
        document.body.classList.toggle('dropper-mode', dropperMode);
        document.body.classList.remove('delete-mode', 'paint-mode');
        updateGhost();
        toast(dropperMode ? '💧 Dropper ON' : 'Dropper OFF');
      });
      
      document.getElementById('paintBtn').addEventListener('click', () => {
        paintMode = !paintMode; deleteMode = false; dropperMode = false; floorMode = false; facePaintMode = false;
        document.getElementById('paintBtn').classList.toggle('paint-active', paintMode);
        document.getElementById('deleteBtn').classList.remove('delete-active');
        document.getElementById('dropperBtn').classList.remove('dropper-active');
        document.getElementById('floorBtn').classList.remove('floor-active');
        document.getElementById('facePaintBtn').classList.remove('facepaint-active');
        document.body.classList.toggle('paint-mode', paintMode);
        document.body.classList.remove('delete-mode', 'dropper-mode', 'facepaint-mode');
        if (paintMode) updateBuildToolPopup(); // Close build popup
        updateGhost();
        toast(paintMode ? '🎨 Paint ON - Click bricks to recolor' : 'Paint OFF');
      });
      
      document.getElementById('facePaintBtn').addEventListener('click', () => {
        facePaintMode = !facePaintMode; deleteMode = false; dropperMode = false; paintMode = false; floorMode = false;
        document.getElementById('facePaintBtn').classList.toggle('facepaint-active', facePaintMode);
        document.getElementById('paintBtn').classList.remove('paint-active');
        document.getElementById('deleteBtn').classList.remove('delete-active');
        document.getElementById('dropperBtn').classList.remove('dropper-active');
        document.getElementById('floorBtn').classList.remove('floor-active');
        document.body.classList.toggle('facepaint-mode', facePaintMode);
        document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode');
        if (facePaintMode) updateBuildToolPopup(); // Close build popup
        updateGhost();
        toast(facePaintMode ? '🖌️ Face Paint ON - Click brick sides to paint' : 'Face Paint OFF');
      });
    }
    function bindInputEvents6() {
      
      // A finger lift opens the tool. The click that Chrome synthesizes, and
      // the extra click a missed tap adds, must not close it again. A scroll
      // that ends on the button did not mean to toggle.
      function armTool(key, run) {
        return (e) => {
          if (e && e.type === 'pointerup') {
            if (e.pointerType === 'mouse') return;
            if (!trayDownSeen || Math.hypot(e.clientX - trayDownX, e.clientY - trayDownY) > 18) return;
          }
          if (repeatClick(key)) return;
          run();
        };
      }
      const onFloor = armTool('floor', () => {
        floorMode = !floorMode; deleteMode = false; dropperMode = false; paintMode = false; facePaintMode = false; wallMode = false;
        document.getElementById('floorBtn').classList.toggle('floor-active', floorMode);
        document.getElementById('wallBtn').classList.remove('wall-active');
        document.getElementById('deleteBtn').classList.remove('delete-active');
        document.getElementById('dropperBtn').classList.remove('dropper-active');
        document.getElementById('paintBtn').classList.remove('paint-active');
        document.getElementById('facePaintBtn').classList.remove('facepaint-active');
        document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode', 'facepaint-mode');
        if (!floorMode) cancelFloorDrag();
        updateGhost();
        updateBuildToolPopup();
        toast(floorMode ? '⬜ Floor mode ON - click & drag to draw area' : 'Floor mode OFF');
      });
      document.getElementById('floorBtn').addEventListener('pointerup', onFloor);
      document.getElementById('floorBtn').addEventListener('click', onFloor);
      
      const onWall = armTool('wall', () => {
        wallMode = !wallMode; deleteMode = false; dropperMode = false; paintMode = false; facePaintMode = false; floorMode = false;
        document.getElementById('wallBtn').classList.toggle('wall-active', wallMode);
        document.getElementById('floorBtn').classList.remove('floor-active');
        document.getElementById('deleteBtn').classList.remove('delete-active');
        document.getElementById('dropperBtn').classList.remove('dropper-active');
        document.getElementById('paintBtn').classList.remove('paint-active');
        document.getElementById('facePaintBtn').classList.remove('facepaint-active');
        document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode', 'facepaint-mode');
        if (!wallMode) cancelWallDrag();
        updateGhost();
        updateBuildToolPopup();
        toast(wallMode ? '🧱 Wall mode ON - click & drag to draw wall' : 'Wall mode OFF');
      });
      document.getElementById('wallBtn').addEventListener('pointerup', onWall);
      document.getElementById('wallBtn').addEventListener('click', onWall);
      
      document.getElementById('gravityBtn').addEventListener('click', () => {
        gravityOn = !gravityOn;
        document.getElementById('gravityBtn').classList.toggle('active', gravityOn);
        if (gravityOn) applyGravity();
        toast(gravityOn ? '🌍 Gravity ON' : 'Gravity OFF');
      });
      
      const onMirror = armTool('mirror', () => {
        mirrorOn = !mirrorOn;
        document.getElementById('mirrorBtn').classList.toggle('active', mirrorOn);
        document.getElementById('mirrorSettings').classList.toggle('visible', mirrorOn);
        document.getElementById('mirrorPopup').classList.toggle('visible', mirrorOn);
        if (mirrorOn) showFloating(document.getElementById('mirrorPopup'));
        updateMirrorLines();
        updateGhost();
        toast(mirrorOn ? '🔀 Mirror ON' : 'Mirror OFF');
      });
      document.getElementById('mirrorBtn').addEventListener('pointerup', onMirror);
      document.getElementById('mirrorBtn').addEventListener('click', onMirror);
      
      // Mirror popup close button
      document.getElementById('mirrorPopupClose').addEventListener('click', () => {
        mirrorOn = false;
        document.getElementById('mirrorBtn').classList.remove('active');
        document.getElementById('mirrorSettings').classList.remove('visible');
        document.getElementById('mirrorPopup').classList.remove('visible');
        updateMirrorLines();
        updateGhost();
        toast('Mirror OFF');
      });
      
      // Mirror popup axis buttons
      document.querySelectorAll('.mirror-popup-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.mirror-popup-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.mirror-axis-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          // Also sync the sidebar button
          document.querySelector(`.mirror-axis-btn[data-axis="${btn.dataset.axis}"]`)?.classList.add('active');
          mirrorAxis = btn.dataset.axis;
          updateMirrorPreviewText();
          updateMirrorLines();
          updateGhost();
        });
      });
      
      // Mirror popup offset buttons
      document.getElementById('mirrorPopupOffsetDown').addEventListener('click', () => {
        mirrorOffset -= 1;
        document.getElementById('mirrorOffsetValue').textContent = mirrorOffset;
        document.getElementById('mirrorPopupOffsetValue').textContent = mirrorOffset;
        updateMirrorPreviewText();
        updateMirrorLines();
        updateGhost();
      });
      
      document.getElementById('mirrorPopupOffsetUp').addEventListener('click', () => {
        mirrorOffset += 1;
        document.getElementById('mirrorOffsetValue').textContent = mirrorOffset;
        document.getElementById('mirrorPopupOffsetValue').textContent = mirrorOffset;
        updateMirrorPreviewText();
        updateMirrorLines();
        updateGhost();
      });
      
      // Mirror settings listeners (sidebar - also sync with popup)
      document.querySelectorAll('.mirror-axis-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.mirror-axis-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.mirror-popup-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          // Also sync the popup button
          document.querySelector(`.mirror-popup-btn[data-axis="${btn.dataset.axis}"]`)?.classList.add('active');
          mirrorAxis = btn.dataset.axis;
          updateMirrorPreviewText();
          updateMirrorLines();
          updateGhost();
        });
      });
    }
    function bindInputEvents7() {
      
      document.getElementById('mirrorOffsetDown').addEventListener('click', () => {
        mirrorOffset -= 1;
        document.getElementById('mirrorOffsetValue').textContent = mirrorOffset;
        document.getElementById('mirrorPopupOffsetValue').textContent = mirrorOffset;
        updateMirrorPreviewText();
        updateMirrorLines();
        updateGhost();
      });
      
      document.getElementById('mirrorOffsetUp').addEventListener('click', () => {
        mirrorOffset += 1;
        document.getElementById('mirrorOffsetValue').textContent = mirrorOffset;
        document.getElementById('mirrorPopupOffsetValue').textContent = mirrorOffset;
        updateMirrorPreviewText();
        updateMirrorLines();
        updateGhost();
      });
      
      
      // ==================== DRAGGABLE POPUPS ====================
      
      // Make mirror popup draggable
      makeDraggable(
        document.getElementById('mirrorPopup'),
        document.querySelector('.mirror-popup-header')
      );
      
      // Make build tool popup draggable
      makeDraggable(
        document.getElementById('buildToolPopup'),
        document.querySelector('.build-tool-popup-header')
      );
      
      // ==================== BUILD TOOL POPUP ====================
      const buildToolPopup = document.getElementById('buildToolPopup');
      

      
      // Build tool popup close
      document.getElementById('buildToolPopupClose').addEventListener('click', () => {
        floorMode = false;
        wallMode = false;
        document.getElementById('floorBtn').classList.remove('floor-active');
        document.getElementById('wallBtn').classList.remove('wall-active');
        buildToolPopup.classList.remove('visible');
        cancelFloorDrag();
        cancelWallDrag();
        updateGhost();
        toast('Build tool closed');
      });
      
      // Wall shape toggle in popup
      document.getElementById('buildShapeLine').addEventListener('click', () => {
        wallBoxMode = false;
        document.getElementById('buildShapeLine').classList.add('active');
        document.getElementById('buildShapeBox').classList.remove('active');
        document.getElementById('buildToolInfo').textContent = 'Click & drag to draw wall line';
        if (wallDragStart) updateWallGhost();
        toast('📏 Line mode - single wall');
      });
      
      document.getElementById('buildShapeBox').addEventListener('click', () => {
        wallBoxMode = true;
        document.getElementById('buildShapeBox').classList.add('active');
        document.getElementById('buildShapeLine').classList.remove('active');
        document.getElementById('buildToolInfo').textContent = 'Click & drag to draw 4-sided box';
        if (wallDragStart) updateWallGhost();
        toast('⬜ Box mode - 4 walls');
      });
      
      // Build tool mode switches
      document.getElementById('buildModeFloor').addEventListener('click', () => {
        floorMode = true;
        wallMode = false;
        deleteMode = dropperMode = paintMode = false;
        document.getElementById('floorBtn').classList.add('floor-active');
        document.getElementById('wallBtn').classList.remove('wall-active');
        document.getElementById('deleteBtn').classList.remove('delete-active');
        document.getElementById('dropperBtn').classList.remove('dropper-active');
        document.getElementById('paintBtn').classList.remove('paint-active');
        document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode');
        cancelWallDrag();
        updateBuildToolPopup();
        updateGhost();
        toast('🟫 Floor mode');
      });
      
      document.getElementById('buildModeWall').addEventListener('click', () => {
        wallMode = true;
        floorMode = false;
        deleteMode = dropperMode = paintMode = false;
        document.getElementById('wallBtn').classList.add('wall-active');
        document.getElementById('floorBtn').classList.remove('floor-active');
        document.getElementById('deleteBtn').classList.remove('delete-active');
        document.getElementById('dropperBtn').classList.remove('dropper-active');
        document.getElementById('paintBtn').classList.remove('paint-active');
        document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode');
        cancelFloorDrag();
        updateBuildToolPopup();
        updateGhost();
        toast('🧱 Wall mode');
      });
      
      // Floor type buttons in popup
      document.querySelectorAll('[data-floor-type]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-floor-type]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          floorType = btn.dataset.floorType;
          if (floorDragStart) updateFloorGhost();
        });
      });
      
      // Wall height controls in popup (height in bricks)
      document.getElementById('buildHeightDown').addEventListener('click', () => {
        if (wallHeight > 1) {
          wallHeight--;
          document.getElementById('buildHeightValue').textContent = wallHeight;
          if (wallDragStart) updateWallGhost();
        }
      });
      
      document.getElementById('buildHeightUp').addEventListener('click', () => {
        if (wallHeight < 15) {
          wallHeight++;
          document.getElementById('buildHeightValue').textContent = wallHeight;
          if (wallDragStart) updateWallGhost();
        }
      });
    }
    function bindInputEvents8() {
      
      // Wall depth controls in popup
      document.getElementById('buildDepthDown').addEventListener('click', () => {
        if (wallDepth > 1) {
          wallDepth--;
          document.getElementById('buildDepthValue').textContent = wallDepth;
          if (wallDragStart) updateWallGhost();
        }
      });
      
      document.getElementById('buildDepthUp').addEventListener('click', () => {
        if (wallDepth < 8) {
          wallDepth++;
          document.getElementById('buildDepthValue').textContent = wallDepth;
          if (wallDragStart) updateWallGhost();
        }
      });
      
      // Update floor/wall button handlers to also show popup
      const originalFloorBtn = document.getElementById('floorBtn');
      originalFloorBtn.addEventListener('click', updateBuildToolPopup);
      
      const originalWallBtn = document.getElementById('wallBtn');
      originalWallBtn.addEventListener('click', updateBuildToolPopup);
      
      // ==================== PHOTO UPLOAD ====================
      document.getElementById('uploadPhotoBtn').addEventListener('click', () => {
        document.getElementById('photoInput').click();
      });
      
      document.getElementById('photoInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target.result;
          const loader = new THREE.TextureLoader();
          loader.load(dataUrl, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            const photoData = {
              name: file.name,
              texture: texture,
              dataUrl: dataUrl
            };
            uploadedTextures.push(photoData);
            updatePhotoGrid();
            toast(`📷 Uploaded: ${file.name}`, 'success');
          });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      });
      
      
      // ==================== MOVE MODE ====================
      document.getElementById('moveBtn').addEventListener('click', () => {
        moveMode = !moveMode;
        deleteMode = dropperMode = paintMode = floorMode = wallMode = false;
        document.getElementById('moveBtn').classList.toggle('move-active', moveMode);
        document.getElementById('moveModeIndicator').classList.toggle('visible', moveMode);
        document.getElementById('deleteBtn').classList.remove('delete-active');
        document.getElementById('dropperBtn').classList.remove('dropper-active');
        document.getElementById('paintBtn').classList.remove('paint-active');
        document.getElementById('floorBtn').classList.remove('floor-active');
        document.getElementById('wallBtn').classList.remove('wall-active');
        document.body.classList.remove('delete-mode', 'dropper-mode', 'paint-mode');
        
        if (!moveMode) {
          clearMoveSelection();
        }
        updateGhost();
        toast(moveMode ? '✋ Move mode ON - click a brick to select group' : 'Move mode OFF');
      });
      
      
      
      
      
      
      
      
      // Custom block creator
      document.getElementById('createCustomBtn').addEventListener('click', () => {
        const w = parseInt(document.getElementById('customW').value) || 2;
        const d = parseInt(document.getElementById('customD').value) || 2;
        const typeStr = document.getElementById('customType').value;
        
        const typeName = createCustomType(w, d, typeStr);
        if (typeName) {
          selectedBrick = typeName;
          // Deselect all brick buttons
          document.querySelectorAll('.brick-btn').forEach(b => b.classList.remove('selected'));
          updateUI();
          updateGhost();
          
          const typeLabel = typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
          toast(`✅ Created ${w}×${d} ${typeLabel}`, 'success');
        }
      });
      
      // Custom prefab creator buttons
      document.getElementById('startPrefabBtn').addEventListener('click', startPrefabSelection);
      document.getElementById('stopPrefabBtn').addEventListener('click', stopPrefabSelection);
      document.getElementById('cancelPrefabBtn').addEventListener('click', cancelPrefabSelection);
      document.getElementById('savePrefabBtn').addEventListener('click', saveCustomPrefab);
      
      // Allow Enter key to save prefab name
      document.getElementById('customPrefabName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveCustomPrefab();
      });
      
      // Load saved custom prefabs from localStorage
      loadCustomPrefabsFromStorage();
      
      document.getElementById('clearBtn').addEventListener('click', clearAll);
      document.getElementById('undoBtn').addEventListener('click', undo);
      document.getElementById('redoBtn').addEventListener('click', redo);
      document.getElementById('hudUndoBtn').addEventListener('click', undo);
      document.getElementById('hudRedoBtn').addEventListener('click', redo);
      document.getElementById('hudRotBtn').addEventListener('click', () => {
        currentRotation = (currentRotation + 90) % 360;
        document.getElementById('hudRotLabel').textContent = currentRotation + '°';
        updateGhost();
        needsRender = true;
      });
      const hudDeleteBtn = document.getElementById('hudDeleteBtn');
      hudDeleteBtn.addEventListener('pointerdown', onHudDelete);
    }
    function bindInputEvents9() {
      document.getElementById('hudDeleteBtn').addEventListener('click', onHudDelete);
      document.getElementById('hudColorBtn').addEventListener('click', () => {
        // Open the color section in the sidebar
        const colorSection = document.querySelector('.section[data-section="color"]') || document.getElementById('colorSection');
        if (colorSection) {
          colorSection.scrollIntoView({ behavior: 'smooth' });
          // Also open sidebar if collapsed
          const controls = document.getElementById('controls');
          if (controls && controls.style.transform && controls.style.transform.includes('translateX(-')) {
            document.getElementById('sidebarToggle').click();
          }
        }
      });
      document.getElementById('saveBtn').addEventListener('click', save);
      document.getElementById('loadBtn').addEventListener('click', load);
      document.getElementById('photoBtn').addEventListener('click', screenshot);
      document.getElementById('firstPersonBtn').addEventListener('click', toggleFirstPersonMode);
      document.getElementById('resetBtn').addEventListener('click', resetView);
      document.getElementById('fileInput').addEventListener('change', handleLoad);
      
      // Project management buttons
      document.getElementById('newProjectBtn').addEventListener('click', newProject);
      refreshProjectList();
      const saveProjectBtn = document.getElementById('saveProjectBtn');
      saveProjectBtn.addEventListener('click', onSavePress);
      document.getElementById('loadProjectBtn').addEventListener('click', toggleProjectList);
      document.getElementById('tutorialBtn').addEventListener('click', () => {
        if (typeof showTutorial === 'function') showTutorial();
      });
      document.getElementById('keybindBtn').addEventListener('click', () => {
        if (typeof openKeybindModal === 'function') openKeybindModal();
      });
      
      // Quick bar buttons
      document.getElementById('walkModeToggle').addEventListener('click', toggleFirstPersonMode);
      
      document.getElementById('fullscreenToggle').addEventListener('click', toggleFullscreenMode);
      
      // Sound toggle
      document.getElementById('soundToggle').addEventListener('click', () => {
        const enabled = SoundSystem.toggle();
        document.getElementById('soundToggle').classList.toggle('active', enabled);
        document.getElementById('soundToggle').classList.toggle('is-muted', !enabled);
        SoundSystem.playClick();
      });
      
      // Music toggle
      document.getElementById('musicToggle').addEventListener('click', () => {
        const playing = SoundSystem.toggleMusic();
        document.getElementById('musicToggle').classList.toggle('active', playing);
        SoundSystem.playClick();
      });
      
      // Gallery button
      document.getElementById('galleryBtn').addEventListener('click', () => {
        SoundSystem.playClick();
        openGallery();
      });
      
      // Gallery close button
      document.getElementById('galleryClose').addEventListener('click', closeGallery);
      
      // Gallery tabs
      document.querySelectorAll('.gallery-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          SoundSystem.playClick();
          document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.gallery-panel').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          document.querySelector(`.gallery-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
          
          if (tab.dataset.tab === 'share') fillShareBox();
          if (tab.dataset.tab === 'share' || tab.dataset.tab === 'screenshot') {
            capturePreview(tab.dataset.tab === 'screenshot' ? 'screenshotCanvas' : 'sharePreviewCanvas');
          }
        });
      });
      
      // Gallery save button
      document.getElementById('gallerySaveNew').addEventListener('click', saveToGallery);
      
      // Share buttons
      document.getElementById('shareDownloadImage').addEventListener('click', downloadShareImage);
      document.getElementById('shareCopyLink').addEventListener('click', copyBuildCode);
      const shareUrlBtn = document.getElementById('shareCopyUrl');
      if (shareUrlBtn) shareUrlBtn.addEventListener('click', () => { copyShareLink(); });
      document.getElementById('shareDownloadFile').addEventListener('click', downloadBrickFile);
      document.getElementById('shareLoadCode').addEventListener('click', loadFromCode);
      document.querySelectorAll('[data-starter]').forEach(btn => {
        btn.addEventListener('click', () => placeStarter(btn.getAttribute('data-starter')));
      });
      
      // Screenshot buttons
      document.getElementById('screenshotCapture').addEventListener('click', captureScreenshot);
      document.getElementById('screenshotDownload').addEventListener('click', downloadScreenshot);
      
      // FPS mode buttons
      document.getElementById('crouchBtn').addEventListener('click', toggleCrouch);
      document.getElementById('exitFpsBtn').addEventListener('click', () => {
        fpMenuMode = false;
        exitFirstPersonMode();
      });
      document.getElementById('jumpBtn').addEventListener('click', () => {
        if (firstPersonMode && fpOnGround && !fpCrouching) {
          fpVerticalVelocity = FP_JUMP_VELOCITY;
          fpOnGround = false;
          SoundSystem.playJump();
        }
      });
    }
    function bindInputEvents10() {
      
      // Initialize FPS hotbar
      initFpHotbar();
      
      // Time of day slider
      document.getElementById('timeSlider').addEventListener('input', (e) => {
        timeOfDay = e.target.value / 100;
        updateTimeOfDay();
        needsRender = true;
      });
      
      document.querySelectorAll('[data-quality]').forEach(btn => {
        btn.addEventListener('click', () => applyQuality(btn.dataset.quality));
      });
      
      // Time presets
      document.querySelectorAll('.time-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          timeOfDay = parseFloat(btn.dataset.time);
          document.getElementById('timeSlider').value = timeOfDay * 100;
          updateTimeOfDay();
        });
      });
      
      // Weather buttons
      document.querySelectorAll('.weather-btn[data-weather]').forEach(btn => {
        btn.addEventListener('click', () => {
          setWeather(btn.dataset.weather);
        });
      });
      
      // Background theme buttons
      document.querySelectorAll('.weather-btn[data-background]').forEach(btn => {
        btn.addEventListener('click', () => {
          setBackgroundTheme(btn.dataset.background);
        });
      });
      
      // Mobile panel toggle — start collapsed so the canvas is the play surface
      const panelToggle = document.getElementById('panelToggle');
      const mobileControlsPanel = document.getElementById('controls');
      applyMobileTray();
      window.addEventListener('resize', applyMobileTray);
      if (panelToggle) panelToggle.addEventListener('click', () => {
        if (!isPhoneChrome()) return;
        mobileTrayUserExpanded = !mobileTrayUserExpanded;
        applyMobileTray();
      });
      const phoneViewBtn = document.getElementById('phoneViewBtn');
      if (phoneViewBtn) phoneViewBtn.addEventListener('click', () => {
        const open = document.body.classList.toggle('phone-view-open');
        phoneViewBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        phoneViewBtn.textContent = open ? 'Close' : 'View';
      });
    }
    async function setupEvents() {
      await yieldTick();
      bindInputEvents1();
      await yieldTick();
      bindInputEvents2();
      await yieldTick();
      bindInputEvents3();
      await yieldTick();
      bindInputEvents4();
      await yieldTick();
      bindInputEvents5();
      await yieldTick();
      bindInputEvents6();
      await yieldTick();
      bindInputEvents7();
      await yieldTick();
      bindInputEvents8();
      await yieldTick();
      bindInputEvents9();
      await yieldTick();
      bindInputEvents10();
      await yieldTick();
    }
    
    // ==================== FULLSCREEN MODE ====================
    let fullscreenMode = false;
    
    function toggleFullscreenMode() {
      fullscreenMode = !fullscreenMode;
      document.body.classList.toggle('fullscreen-mode', fullscreenMode);
      document.getElementById('fullscreenToggle').classList.toggle('active', fullscreenMode);
      
      if (fullscreenMode) {
        // Show hint briefly
        const hint = document.getElementById('fullscreenHint');
        hint.classList.add('visible');
        setTimeout(() => hint.classList.remove('visible'), 3000);
        toast('⛶ Fullscreen - press ESC to exit', 'success');
      } else {
        document.getElementById('fullscreenHint').classList.remove('visible');
        toast('Fullscreen OFF');
      }
    }
    
    function exitFullscreenMode() {
      if (!fullscreenMode) return;
      fullscreenMode = false;
      document.body.classList.remove('fullscreen-mode');
      document.getElementById('fullscreenToggle').classList.remove('active');
      document.getElementById('fullscreenHint').classList.remove('visible');
    }
    
    // ==================== GALLERY SYSTEM ====================
    let galleryBuilds = [];
    
    function openGallery() {
      document.getElementById('galleryModal').style.display = 'flex';
      loadGalleryBuilds();
    }
    
    function closeGallery() {
      document.getElementById('galleryModal').style.display = 'none';
    }
    
    function projectStorageKey(name) {
      const slug = String(name || 'Untitled').trim().toLowerCase().replace(/[^a-z0-9]/g, '_') || 'untitled';
      return 'brickProject_' + slug;
    }

    function galleryDateLabel(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString();
    }

    function readGalleryArray() {
      try {
        const saved = localStorage.getItem('brickBuilderGallery');
        const parsed = saved ? JSON.parse(saved) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    function saveGalleryBuilds() {
      try {
        localStorage.setItem('brickBuilderGallery', JSON.stringify(galleryBuilds));
      } catch(e) {
        console.log('Could not save gallery');
      }
    }

    function mergeSavedBuilds() {
      galleryBuilds = readGalleryArray();
      const seen = new Set();
      galleryBuilds = galleryBuilds.filter((b) => {
        if (!b || !b.name) return false;
        const key = projectStorageKey(b.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('brickProject_') || seen.has(key)) continue;
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (!data) continue;
          const name = data.name || 'Untitled';
          const recKey = projectStorageKey(name);
          if (seen.has(recKey)) continue;
          galleryBuilds.push({
            name,
            thumbnail: '',
            brickCount: data.bricks ? data.bricks.length : 0,
            date: galleryDateLabel(data.savedAt),
            data: data.bricks || []
          });
          seen.add(recKey);
        } catch (e) {}
      }
      for (const build of galleryBuilds) {
        const key = projectStorageKey(build.name);
        if (localStorage.getItem(key)) continue;
        try {
          localStorage.setItem(key, JSON.stringify({
            v: 4,
            name: build.name,
            savedAt: new Date().toISOString(),
            bricks: Array.isArray(build.data) ? build.data : []
          }));
        } catch (e) {}
      }
      saveGalleryBuilds();
    }

    function rememberGalleryBuild(name, data, thumbnail) {
      const key = projectStorageKey(name);
      const existing = galleryBuilds.findIndex((b) => b && projectStorageKey(b.name) === key);
      const rec = {
        name,
        thumbnail: thumbnail || (existing >= 0 ? galleryBuilds[existing].thumbnail : '') || '',
        brickCount: data.bricks ? data.bricks.length : 0,
        date: galleryDateLabel(data.savedAt),
        data: data.bricks || []
      };
      if (existing >= 0) galleryBuilds.splice(existing, 1);
      galleryBuilds.unshift(rec);
      if (galleryBuilds.length > 20) galleryBuilds.length = 20;
      saveGalleryBuilds();
    }

    function buildBounds() {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        const p = b.position;
        if (!p) continue;
        const g = b.userData && b.userData.grid;
        const hx = g ? (g.w * STUD) * 0.5 : 0.4;
        const hz = g ? (g.d * STUD) * 0.5 : 0.4;
        const hy = g && g.hp >= 3 ? BRICK_H : PLATE_H;
        minX = Math.min(minX, p.x - hx);
        maxX = Math.max(maxX, p.x + hx);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y + hy);
        minZ = Math.min(minZ, p.z - hz);
        maxZ = Math.max(maxZ, p.z + hz);
      }
      if (minX === Infinity) {
        return { aimX: 38, aimY: 0.5, aimZ: 38, spanX: 2 * STUD, spanY: BRICK_H, spanZ: 2 * STUD };
      }
      return {
        aimX: (minX + maxX) * 0.5,
        aimY: Math.max(0.45, (minY + maxY) * 0.5),
        aimZ: (minZ + maxZ) * 0.5,
        spanX: Math.max(maxX - minX, 0.8),
        spanY: Math.max(maxY - minY + STUD_H, 0.32),
        spanZ: Math.max(maxZ - minZ, 0.8)
      };
    }

    function frameCameraOnBuild(opts) {
      removeGhost();
      removeWallModeGhost();
      const box = buildBounds();
      if (opts && opts.forCapture) {
        placeCaptureCamera(box);
        return;
      }
      const dist = liveFitDistance(box.spanX, box.spanY, box.spanZ);
      placeCameraOnHomeRay(box.aimX, box.aimY, box.aimZ, dist);
    }

    // The live canvas is MSAA and preserveDrawingBuffer is false, so
    // drawImage of that canvas keeps the previous frame. A render target also
    // skips tone mapping and sRGB, which left shares near-black. Draw the
    // scene linear, then apply the same exposure, vignette, and sRGB curve
    // the screen uses, and copy those bytes.
    let gradeQuad = null;
    let gradeCam = null;
    let gradeScene = null;
    let gradeMat = null;
    let gradeLinear = null;
    let gradeOut = null;
    function ensureGrade(w, h) {
      if (!gradeMat) {
        gradeMat = new THREE.ShaderMaterial({
          uniforms: {
            tDiffuse: { value: null },
            exposure: { value: 1 },
            darkness: { value: 0.06 },
            offset: { value: 1.15 },
            useVignette: { value: 0 }
          },
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = vec4(position.xy, 0.0, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float exposure;
            uniform float darkness;
            uniform float offset;
            uniform float useVignette;
            varying vec2 vUv;
            void main() {
              vec4 texel = texture2D(tDiffuse, vUv);
              vec3 color = texel.rgb;
              if (useVignette > 0.5) {
                vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
                float vign = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
                color *= mix(1.0 - darkness, 1.0, vign);
              }
              color = clamp(color * exposure, 0.0, 1.0);
              vec3 encoded = mix(
                pow(color, vec3(0.41666)) * 1.055 - vec3(0.055),
                color * 12.92,
                vec3(lessThanEqual(color, vec3(0.0031308)))
              );
              gl_FragColor = vec4(encoded, texel.a);
            }
          `
        });
        gradeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), gradeMat);
        gradeQuad.frustumCulled = false;
        gradeScene = new THREE.Scene();
        gradeScene.add(gradeQuad);
        gradeCam = new THREE.PerspectiveCamera(1, 1, 0.1, 2);
      }
      if (!gradeLinear || gradeLinear.width !== w || gradeLinear.height !== h) {
        if (gradeLinear) gradeLinear.dispose();
        if (gradeOut) gradeOut.dispose();
        gradeLinear = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, stencilBuffer: false });
        gradeOut = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, stencilBuffer: false });
        gradeLinear.texture.colorSpace = THREE.LinearSRGBColorSpace;
        gradeOut.texture.colorSpace = THREE.LinearSRGBColorSpace;
      }
    }
    function largestRedShare(buf, w, h) {
      if (!buf || w < 2 || h < 2) return 0;
      const seen = new Uint8Array(w * h);
      const redAt = (p) => {
        const i = p * 4;
        const r = buf[i];
        const g = buf[i + 1];
        const b = buf[i + 2];
        return r > 140 && r > g + 28 && r > b + 28;
      };
      let best = 0;
      const n = w * h;
      for (let p = 0; p < n; p++) {
        if (seen[p] || !redAt(p)) continue;
        let minX = p % w;
        let maxX = minX;
        let minY = (p / w) | 0;
        let maxY = minY;
        const stack = [p];
        seen[p] = 1;
        while (stack.length) {
          const q = stack.pop();
          const x = q % w;
          const y = (q - x) / w;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (x > 0 && !seen[q - 1] && redAt(q - 1)) { seen[q - 1] = 1; stack.push(q - 1); }
          if (x + 1 < w && !seen[q + 1] && redAt(q + 1)) { seen[q + 1] = 1; stack.push(q + 1); }
          if (y > 0 && !seen[q - w] && redAt(q - w)) { seen[q - w] = 1; stack.push(q - w); }
          if (y + 1 < h && !seen[q + w] && redAt(q + w)) { seen[q + w] = 1; stack.push(q + w); }
        }
        best = Math.max(best, maxX - minX + 1, maxY - minY + 1);
      }
      return best / Math.min(w, h);
    }

    function redSpan(buf, w, h) {
      let n = 0;
      let minX = w;
      let maxX = 0;
      let minY = h;
      let maxY = 0;
      for (let y = 0; y < h; y++) {
        const row = y * w * 4;
        for (let x = 0; x < w; x++) {
          const i = row + x * 4;
          const r = buf[i];
          const g = buf[i + 1];
          const b = buf[i + 2];
          if (!(r > 140 && r > g + 28 && r > b + 28)) continue;
          n++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (n < 8) return { n, extent: 0, margin: 0, bottom: 0, top: 0 };
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      return {
        n,
        extent: Math.max(bw / w, bh / h),
        margin: Math.min(minX / w, minY / h, (w - 1 - maxX) / w, (h - 1 - maxY) / h),
        bottom: (h - 1 - maxY) / h,
        top: minY / h
      };
    }

    function renderSceneToCanvas(canvas2d) {
      const w = canvas2d.width | 0;
      const h = canvas2d.height | 0;
      if (w < 1 || h < 1) return { n: 0, extent: 0, margin: 0 };
      let thumbRead = { n: 0, extent: 0, margin: 0 };
      ensureGrade(w, h);
      const prevTarget = renderer.getRenderTarget();
      // The opening reveal hides new meshes until scenery settles. A share
      // taken in that window has to draw the bricks anyway.
      const revived = [];
      if (instancedSystem && instancedSystem.meshes) {
        instancedSystem.meshes.forEach((data) => {
          if (data.mesh && data.mesh.visible === false) {
            revived.push(data.mesh);
            data.mesh.visible = true;
          }
        });
      }
      try {
        const draw = renderer.__brixRenderSettled || renderer.render.bind(renderer);
        renderer.setRenderTarget(gradeLinear);
        renderer.clear(true, true, true);
        draw(scene, camera);
        const vignetteOn = !!(composer && qualitySettings.post && vignettePass);
        gradeMat.uniforms.tDiffuse.value = gradeLinear.texture;
        gradeMat.uniforms.exposure.value = renderer.toneMappingExposure;
        gradeMat.uniforms.useVignette.value = vignetteOn ? 1 : 0;
        renderer.setRenderTarget(gradeOut);
        renderer.clear(true, true, true);
        draw(gradeScene, gradeCam);
        const buf = new Uint8Array(w * h * 4);
        renderer.readRenderTargetPixels(gradeOut, 0, 0, w, h, buf);
        const img = new ImageData(w, h);
        const row = w * 4;
        for (let y = 0; y < h; y++) {
          img.data.set(buf.subarray((h - 1 - y) * row, (h - y) * row), y * row);
        }
        canvas2d.getContext('2d').putImageData(img, 0, 0);
        thumbRead = redSpan(buf, w, h);
      } finally {
        for (let i = 0; i < revived.length; i++) revived[i].visible = false;
        renderer.setRenderTarget(prevTarget);
      }
      return thumbRead;
    }

    function withFramedBuild(destW, destH, draw) {
      const prevPos = camera.position.clone();
      const prevTarget = controls.target.clone();
      const prevMin = controls.minDistance;
      const prevMax = controls.maxDistance;
      const prevAspect = camera.aspect;
      const prevPolar = controls.maxPolarAngle;
      try {
        camera.aspect = destW / Math.max(1, destH);
        camera.updateProjectionMatrix();
        frameCameraOnBuild({ forCapture: true });
        draw();
      } finally {
        controls.minDistance = prevMin;
        controls.maxDistance = prevMax;
        controls.maxPolarAngle = prevPolar;
        camera.position.copy(prevPos);
        controls.target.copy(prevTarget);
        controls.update();
        camera.aspect = prevAspect;
        camera.updateProjectionMatrix();
        needsRender = true;
      }
    }

    function captureGalleryThumb() {
      if (!camera || !controls) return '';
      let url = '';
      try {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 200;
        thumbCanvas.height = 150;
        captureFrame = null;
        withFramedBuild(200, 150, () => {
          if (captureFrame) {
            thumbCanvas.getContext('2d').drawImage(captureFrame, 0, 0, thumbCanvas.width, thumbCanvas.height);
          } else {
            renderSceneToCanvas(thumbCanvas);
          }
        });
        url = thumbCanvas.toDataURL('image/png');
      } catch (e) {
        url = '';
      }
      return url;
    }

    function saveNamedBuild(name) {
      const clean = String(name || '').trim() || 'Untitled';
      const input = document.getElementById('projectName');
      if (input) input.value = clean;
      const data = getProjectData();
      data.name = clean;
      localStorage.setItem(projectStorageKey(clean), JSON.stringify(data));
      mergeSavedBuilds();
      rememberGalleryBuild(clean, data, '');
      hasUnsavedChanges = false;
      refreshProjectList();
      touchGalleryMeta();
      paintGalleryGrid();
      const thumb = captureGalleryThumb();
      if (thumb) {
        rememberGalleryBuild(clean, data, thumb);
        touchGalleryMeta();
        paintGalleryGrid();
      }
      return clean;
    }

    function loadGalleryBuilds() {
      mergeSavedBuilds();
      paintGalleryGrid();
    }
    
    function brickWord(n) {
      return (n | 0) === 1 ? 'brick' : 'bricks';
    }

    function touchGalleryMeta() {
      const grid = document.getElementById('galleryGrid');
      if (!grid || !galleryBuilds) return;
      grid.querySelectorAll('.gallery-item').forEach((card) => {
        const nameEl = card.querySelector('.gallery-item-name');
        const meta = card.querySelector('.gallery-item-meta');
        if (!nameEl || !meta) return;
        const build = galleryBuilds.find((b) => b && b.name === nameEl.textContent);
        if (!build) return;
        const n = build.brickCount || 0;
        const prev = meta.textContent || '';
        const date = prev.indexOf('•') >= 0 ? prev.slice(prev.indexOf('•') + 1).trim() : (build.date || '');
        meta.textContent = n + ' ' + brickWord(n) + (date ? ' • ' + date : '');
      });
    }

    function paintGalleryGrid() {
      touchGalleryMeta();
      return import('./gallery-lazy.js').then((mod) => {
        mod.renderGalleryGrid(document.getElementById('galleryGrid'), galleryBuilds, escHtml);
      });
    }
    
    function capturePreview(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas || !camera || !controls) return;
      const w = canvas.width || 320;
      const h = canvas.height || 180;
      canvas.width = w;
      canvas.height = h;
      withFramedBuild(w, h, () => renderSceneToCanvas(canvas));
    }
    
    function captureScreenshot() {
      const scale = parseInt(document.getElementById('screenshotRes').value, 10) || 1;
      const transparent = document.getElementById('screenshotTransparent').checked;
      const canvas = document.getElementById('screenshotCanvas');
      const w = 800 * scale;
      const h = 600 * scale;
      canvas.width = w;
      canvas.height = h;
      const originalBg = scene.background;
      const prevClear = new THREE.Color();
      renderer.getClearColor(prevClear);
      const prevAlpha = renderer.getClearAlpha();
      if (transparent) {
        scene.background = null;
        renderer.setClearColor(0x000000, 0);
      }
      try {
        withFramedBuild(w, h, () => renderSceneToCanvas(canvas));
      } finally {
        if (transparent) {
          scene.background = originalBg;
          renderer.setClearColor(prevClear, prevAlpha);
        }
        needsRender = true;
      }
      SoundSystem.playSuccess();
      toast('📸 Screenshot captured!', 'success');
    }
    
    function downloadScreenshot() {
      const canvas = document.getElementById('screenshotCanvas');
      const link = document.createElement('a');
      link.download = `brick-build-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      SoundSystem.playClick();
    }
    
    function promptName(message, suggested) {
      return new Promise((resolve) => {
        const root = document.getElementById('namePrompt');
        const body = document.getElementById('namePromptBody');
        const input = document.getElementById('namePromptInput');
        const ok = document.getElementById('namePromptOk');
        const cancel = document.getElementById('namePromptCancel');
        if (!root || !input || !ok || !cancel) {
          resolve(null);
          return;
        }
        if (body) body.textContent = message || 'Name your build';
        input.value = suggested || '';
        root.style.display = 'flex';
        const finish = (value) => {
          root.style.display = 'none';
          ok.removeEventListener('click', onOk);
          cancel.removeEventListener('click', onCancel);
          root.removeEventListener('click', onBackdrop);
          document.removeEventListener('keydown', onKey);
          resolve(value);
        };
        const onOk = () => finish(input.value);
        const onCancel = () => finish(null);
        const onBackdrop = (event) => { if (event.target === root) finish(null); };
        const onKey = (event) => {
          if (event.key === 'Escape') finish(null);
          else if (event.key === 'Enter') finish(input.value);
        };
        ok.addEventListener('click', onOk);
        cancel.addEventListener('click', onCancel);
        root.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey);
        input.focus();
        input.select();
      });
    }

    async function saveToGallery() {
      mergeSavedBuilds();
      const suggested = (document.getElementById('projectName').value || '').trim() || `Build ${galleryBuilds.length + 1}`;
      const named = await promptName('Save this build to the gallery.', suggested);
      if (named === null) return;
      try {
        saveNamedBuild(named.trim() || suggested);
        paintGalleryGrid();
        SoundSystem.playSuccess();
        toast('💾 Build saved to gallery!', 'success');
      } catch (e) {
        console.error(e);
        toast('❌ Save failed - storage may be full', 'error');
      }
    }
    
    async function loadGalleryBuild(index) {
      const build = galleryBuilds[index];
      if (!build) return;
      
      const galleryCount = build.brickCount != null ? build.brickCount : (build.data ? build.data.length : 0);
      if (!(await confirmLoad('Load "' + build.name + '" (' + galleryCount + ' bricks)? This will replace your current build.'))) return;
      
      saveUndo();
      bricks.forEach(b => { if (!b.isInstancedBrick) scene.remove(b); });
      bricks.length = 0;
      grid.clear(); cellBrick.clear();
      clearInstancedBricks();
      
      (build.data || []).forEach(b => {
        if (!b || !b.grid || !b.type) return;
        const brickH = getBrickHeight(b.type);
        const dims = getEffectiveDims(b.type, b.rot || 0);
        const pos = new THREE.Vector3(
          b.grid.gx * STUD + (dims.w * STUD) / 2,
          calcWorldY(b.grid.gy, brickH),
          b.grid.gz * STUD + (dims.d * STUD) / 2
        );
        const brick = commitPlacedBrick(b.type, b.color, pos, b.rot || 0, {
          transparent: b.transparent,
          pitch: b.pitch,
          roll: b.roll
        }, { gx: b.grid.gx, gz: b.grid.gz, w: dims.w, d: dims.d, gy: b.grid.gy, hp: b.grid.hp || getHP(b.type) });
        if (brick && b.locked) brick.userData.locked = true;
      });
      
      const nameInput = document.getElementById('projectName');
      if (nameInput) nameInput.value = build.name || '';
      hasUnsavedChanges = false;
      if (bricks.length) hideStarterBar();
      updateStats();
      closeGallery();
      SoundSystem.playSuccess();
      toast(`📂 Loaded "${build.name}"`, 'success');
    }
    
    async function deleteGalleryBuild(index) {
      if (!(await confirmLoad('Delete this build from gallery?', { mode: 'delete' }))) return;
      const build = galleryBuilds[index];
      if (build && build.name) {
        try { localStorage.removeItem(projectStorageKey(build.name)); } catch (e) {}
      }
      galleryBuilds.splice(index, 1);
      saveGalleryBuilds();
      paintGalleryGrid();
      SoundSystem.playDelete();
    }
    
    function downloadShareImage() {
      const canvas = document.getElementById('sharePreviewCanvas');
      const link = document.createElement('a');
      link.download = `brick-build-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      SoundSystem.playClick();
    }
    
    function copyBuildCode() {
      const brickData = buildShareRecords();
      
      // Compress to base64
      const json = JSON.stringify(brickData);
      const code = btoa(json);
      
      document.getElementById('shareBuildCode').value = code;
      navigator.clipboard.writeText(code).then(() => {
        SoundSystem.playSuccess();
        toast('📋 Build code copied to clipboard!', 'success');
      }).catch(() => {
        SoundSystem.playClick();
        toast('Code generated - copy manually', 'info');
      });
    }
    
    function downloadBrickFile() {
      const brickData = bricks.map(b => ({
        type: b.userData.brickType || b.userData.type,
        color: b.userData.color,
        grid: b.userData.grid,
        rotation: b.userData.rot || b.userData.rotation || 0,
        pitch: b.userData.pitch || 0,
        roll: b.userData.roll || 0,
        transparent: b.userData.transparent || false,
        locked: b.userData.locked || false
      }));
      
      const data = {
        version: '1.0',
        name: `Build ${Date.now()}`,
        created: new Date().toISOString(),
        bricks: brickData
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
      const link = document.createElement('a');
      link.download = `brick-build-${Date.now()}.brick`;
      link.href = URL.createObjectURL(blob);
      link.click();
      
      SoundSystem.playClick();
      toast('💾 .brick file downloaded!', 'success');
    }
    
    async function loadFromCode() {
      const raw = await promptName('Paste build code:', '');
      if (!raw) return;
      const code = String(raw).trim();

      const finish = async (brickData) => {
        if (!Array.isArray(brickData)) throw new Error('Invalid format');
        if (!(await confirmLoad('Load build with ' + brickData.length + ' bricks? This will replace your current build.'))) return;
        const n = applyCodeBricks(brickData);
        closeGallery();
        SoundSystem.playSuccess();
        toast('📂 Loaded ' + n + ' bricks!', 'success');
        if (n) hideStarterBar();
      };

      const fail = () => {
        SoundSystem.playError();
        toast('❌ Invalid build code', 'error');
      };

      let token = '';
      const hashAt = code.indexOf('#b=');
      const queryAt = code.indexOf('?b=');
      if (hashAt >= 0) token = decodeURIComponent(code.slice(hashAt + 3).split('&')[0]);
      else if (queryAt >= 0) token = decodeURIComponent(code.slice(queryAt + 3).split('&')[0]);
      else if (code.charAt(0) === 'z' || code.charAt(0) === 'b') token = code;

      if (token) {
        decodeShareToken(token).then(finish).catch(() => {
          try { finish(JSON.parse(atob(code))); } catch (e) { fail(); }
        });
        return;
      }

      try {
        finish(JSON.parse(atob(code)));
      } catch (e) {
        fail();
      }
    }

    // ==================== FIRST-PERSON MODE ====================
    function toggleFirstPersonMode() {
      firstPersonMode = !firstPersonMode;
      
      if (firstPersonMode) {
        // Save current camera state
        savedCameraState = {
          position: camera.position.clone(),
          target: controls.target.clone()
        };
        
        // Find ground height at spawn position
        const spawnX = controls.target.x;
        const spawnZ = controls.target.z;
        const groundHeight = getGroundHeight(spawnX, spawnZ);
        
        // Initialize FP position at current camera target, on top of ground
        fpPosition.set(spawnX, groundHeight + FP_EYE_HEIGHT, spawnZ);
        
        // Reset physics state
        fpVerticalVelocity = 0;
        fpOnGround = true;
        fpCrouching = false;
        fpKeys = { forward: false, backward: false, left: false, right: false, jump: false };
        
        // Reset ghost offset (for arrow key nudging)
        fpGhostOffset = {x: 0, z: 0, y: 0};
        
        // Calculate initial yaw from camera direction
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        fpYaw = Math.atan2(-dir.x, -dir.z);
        fpPitch = 0;
        
        // Disable orbit controls
        controls.enabled = false;
        
        // Hide ghost (will use walk mode ghost instead)
        if (ghost) ghost.visible = false;
        mirrorGhosts.forEach(mg => mg.visible = false);
        prefabGhosts.forEach(pg => pg.visible = false);
        
        // Request pointer lock for mouse look
        renderer.domElement.requestPointerLock();
        
        // Show minimal walk mode UI (crosshair + hints only)
        // Keep sidebar visible - only hide the hotbar/radial parts
        document.getElementById('fpsModeUI').classList.add('visible');
        document.getElementById('fpsHotbar').style.display = 'none';
        document.getElementById('walkModeToggle').classList.add('active');
        
        // Update brick info display
        updateFpBrickInfo();
        
        toast('👤 Walk mode - Arrows XZ, PgUp/Dn Y level, Click/Enter place', 'success');
      } else {
        exitFirstPersonMode();
      }
      
      updateUI();
    }
    
    function exitFirstPersonMode() {
      if (!firstPersonMode) return;
      
      firstPersonMode = false;
      
      // Exit pointer lock
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      
      // Clear target brick highlighting
      clearFpTargetHighlight();
      
      // Restore camera state
      if (savedCameraState) {
        camera.position.copy(savedCameraState.position);
        controls.target.copy(savedCameraState.target);
      }
      
      // Re-enable orbit controls
      controls.enabled = true;
      
      // Show ghost and UI
      if (ghost) ghost.visible = true;
      
      // Remove walk mode ghost
      if (fpGhost) {
        scene.remove(fpGhost);
        fpGhost = null;
      }
      
      // Remove walk mode prefab ghosts
      fpPrefabGhosts.forEach(g => scene.remove(g));
      fpPrefabGhosts = [];
      
      // Hide FPS mode UI, restore hotbar visibility
      document.getElementById('fpsModeUI').classList.remove('visible');
      document.getElementById('fpsHotbar').style.display = '';
      document.getElementById('walkModeToggle').classList.remove('active');
      
      // Reset physics state
      fpKeys = { forward: false, backward: false, left: false, right: false, jump: false };
      fpCrouching = false;
      fpVerticalVelocity = 0;
      fpMenuMode = false;
      fpGhostOffset = {x: 0, z: 0, y: 0};
      
      toast('📷 Returned to build mode');
      updateUI();
    }
    
    function updateFirstPersonCamera(delta) {
      // Clamp delta to prevent huge jumps
      delta = Math.min(delta, 0.1);
      
      // Calculate movement direction based on yaw (horizontal only)
      const forward = new THREE.Vector3(-Math.sin(fpYaw), 0, -Math.cos(fpYaw));
      const right = new THREE.Vector3(Math.cos(fpYaw), 0, -Math.sin(fpYaw));
      
      // Calculate desired horizontal movement
      const moveSpeed = fpSpeed * (fpCrouching ? 0.4 : 1.0) * delta;
      let moveX = 0, moveZ = 0;
      
      if (fpKeys.forward) { moveX += forward.x * moveSpeed; moveZ += forward.z * moveSpeed; }
      if (fpKeys.backward) { moveX -= forward.x * moveSpeed; moveZ -= forward.z * moveSpeed; }
      if (fpKeys.right) { moveX += right.x * moveSpeed; moveZ += right.z * moveSpeed; }
      if (fpKeys.left) { moveX -= right.x * moveSpeed; moveZ -= right.z * moveSpeed; }
      
      // Footstep sounds when moving on ground
      if ((moveX !== 0 || moveZ !== 0) && fpOnGround) {
        if (!window._fpFootstepTime) window._fpFootstepTime = 0;
        window._fpFootstepTime += delta;
        const footstepInterval = fpCrouching ? 0.5 : 0.35;
        if (window._fpFootstepTime > footstepInterval) {
          SoundSystem.playFootstep();
          window._fpFootstepTime = 0;
        }
      }
      
      // Get current eye height based on crouch state
      const currentEyeHeight = fpCrouching ? FP_CROUCH_HEIGHT : FP_EYE_HEIGHT;
      
      // Current positions
      const currentFootY = fpPosition.y - currentEyeHeight;
      const currentHeadY = fpPosition.y + 0.15;
      
      // Handle horizontal movement
      if (moveX !== 0 || moveZ !== 0) {
        const newX = fpPosition.x + moveX;
        const newZ = fpPosition.z + moveZ;
        
        // Check for walls at new position
        const wallBlocking = hasWallAt(newX, newZ, currentFootY, currentHeadY);
        
        if (!wallBlocking) {
          // No wall - get walkable ground height
          const newGroundHeight = getGroundHeight(newX, newZ, currentFootY);
          
          // Move there
          fpPosition.x = newX;
          fpPosition.z = newZ;
          
          // Step up if needed and on ground
          if (newGroundHeight > currentFootY && fpOnGround) {
            fpPosition.y = newGroundHeight + currentEyeHeight;
          }
        } else {
          // Wall blocking - try sliding
          // Try X only
          if (!hasWallAt(newX, fpPosition.z, currentFootY, currentHeadY)) {
            const groundAtX = getGroundHeight(newX, fpPosition.z, currentFootY);
            fpPosition.x = newX;
            if (groundAtX > currentFootY && fpOnGround) {
              fpPosition.y = groundAtX + currentEyeHeight;
            }
          }
          
          // Try Z only
          if (!hasWallAt(fpPosition.x, newZ, currentFootY, currentHeadY)) {
            const groundAtZ = getGroundHeight(fpPosition.x, newZ, currentFootY);
            fpPosition.z = newZ;
            if (groundAtZ > currentFootY && fpOnGround) {
              fpPosition.y = groundAtZ + currentEyeHeight;
            }
          }
        }
      }
      
      // Update ground height after movement (for gravity)
      const footY = fpPosition.y - currentEyeHeight;
      const groundHeight = getGroundHeight(fpPosition.x, fpPosition.z, footY);
      
      // Handle jumping - check BEFORE applying gravity
      if (fpKeys.jump && fpOnGround && !fpCrouching) {
        fpVerticalVelocity = FP_JUMP_VELOCITY;
        fpOnGround = false;
        fpKeys.jump = false; // Consume the jump input
        SoundSystem.playJump();
      }
      
      // Apply gravity
      if (!fpOnGround) {
        fpVerticalVelocity -= FP_GRAVITY * delta;
        fpPosition.y += fpVerticalVelocity * delta;
        
        // Check if we've landed
        const newFootY = fpPosition.y - currentEyeHeight;
        const landingHeight = getGroundHeight(fpPosition.x, fpPosition.z, newFootY);
        if (newFootY <= landingHeight) {
          fpPosition.y = landingHeight + currentEyeHeight;
          fpVerticalVelocity = 0;
          fpOnGround = true;
        }
      } else {
        // On ground - stick to it (for slopes/stairs)
        const targetY = groundHeight + currentEyeHeight;
        
        // Check if we're above ground (walked off edge)
        if (footY > groundHeight + 0.05) {
          // Start falling
          fpOnGround = false;
        } else {
          // Snap to ground
          fpPosition.y = targetY;
        }
      }
      
      // Absolute minimum height (base ground level)
      if (fpPosition.y < currentEyeHeight) {
        fpPosition.y = currentEyeHeight;
        fpVerticalVelocity = 0;
        fpOnGround = true;
      }
      
      // Update camera position
      camera.position.copy(fpPosition);
      
      // Calculate look direction from yaw and pitch
      const lookDir = new THREE.Vector3(
        -Math.sin(fpYaw) * Math.cos(fpPitch),
        Math.sin(fpPitch),
        -Math.cos(fpYaw) * Math.cos(fpPitch)
      );
      
      // Set camera to look in that direction
      const lookTarget = fpPosition.clone().add(lookDir);
      camera.lookAt(lookTarget);
      
      // Update orbit controls target (for when we exit FP mode)
      controls.target.copy(lookTarget);
      
      // Update walk mode building ghost (throttled to every 2 frames for performance)
      if (fpBuildMode) {
        fpUpdateCounter++;
        if (fpUpdateCounter >= 2) {
          fpUpdateCounter = 0;
          updateFpGhost();
        }
      }
    }
    
    // Update ghost preview for walk mode building
    function updateFpGhost() {
      // Only show ghost when click is held
      if (!fpClickHeld) {
        // Clear any existing ghosts
        if (fpGhost) {
          scene.remove(fpGhost);
          fpGhost = null;
        }
        fpPrefabGhosts.forEach(g => scene.remove(g));
        fpPrefabGhosts = [];
        return;
      }
      
      // Raycast from camera center to find placement point
      const rayDir = new THREE.Vector3(
        -Math.sin(fpYaw) * Math.cos(fpPitch),
        Math.sin(fpPitch),
        -Math.cos(fpYaw) * Math.cos(fpPitch)
      ).normalize();
      
      const lookingDown = rayDir.y < -0.3;
      const lookingSteepDown = rayDir.y < -0.7;
      
      // When looking steeply down, just place at foot level (where player is standing)
      if (lookingSteepDown) {
        // Calculate XZ a short distance in front
        const lookXZ = new THREE.Vector2(rayDir.x, rayDir.z);
        if (lookXZ.length() > 0.01) lookXZ.normalize();
        const fwdDist = 1.5;
        
        const baseGx = Math.round((fpPosition.x + lookXZ.x * STUD * fwdDist) / STUD) + fpGhostOffset.x;
        const baseGz = Math.round((fpPosition.z + lookXZ.y * STUD * fwdDist) / STUD) + fpGhostOffset.z;
        
        // Simple: player feet are at fpPosition.y - FP_EYE_HEIGHT
        // That's on TOP of the floor, so that's our Y level
        const footWorldY = fpPosition.y - FP_EYE_HEIGHT;
        let baseGy = Math.round(footWorldY / PLATE_H) + fpGhostOffset.y;
        if (baseGy < 0) baseGy = 0;
        
        if (selectedPrefab && prefabs[selectedPrefab]) {
          updateFpPrefabGhost(baseGx, baseGz, baseGy);
        } else {
          updateFpBrickGhost(baseGx, baseGz, baseGy);
        }
        return;
      }
      
      // Normal raycasting for other angles
      const rayOrigin = fpPosition.clone();
      
      // Cast ray to find where to place
      raycaster.set(rayOrigin, rayDir);
      raycaster.near = 0.1;
      
      const gridHits = pickBuildHits(raycaster.ray, fpPlaceDistance * 2);
      let bestGridHit = null;
      if (lookingDown && gridHits.length > 0) {
        let lowestY = Infinity;
        for (let hi = 0; hi < gridHits.length; hi++) {
          const hit = gridHits[hi];
          if (hit.point.y > fpPosition.y) continue;
          if (hit.point.y < lowestY) {
            lowestY = hit.point.y;
            bestGridHit = hit;
          }
        }
      } else if (gridHits.length) {
        bestGridHit = gridHits[0];
      }

      if (bestGridHit) {
        targetNormal = bestGridHit.normal.clone();
        targetPoint = bestGridHit.point.clone().add(targetNormal.clone().multiplyScalar(0.02));
        hitBrick = true;
        if (bestGridHit.brick && bricks.includes(bestGridHit.brick)) {
          hitBrickObj = bestGridHit.brick;
          hitBrickGrid = bestGridHit.brick.userData && bestGridHit.brick.userData.grid;
        }
      }

      // Update target brick highlighting      // Update target brick highlighting
      updateTargetBrickHighlight(hitBrickObj);
      
      // Update crosshair and target info
      updateFpCrosshair(hitBrickObj, hitBrick);
      
      // If no brick hit, figure out where to place
      if (!hitBrick) {
        // Get grid position under player's feet
        const footGx = Math.round(fpPosition.x / STUD);
        const footGz = Math.round(fpPosition.z / STUD);
        const footY = fpPosition.y - FP_EYE_HEIGHT;
        
        // Calculate target XZ based on look direction
        const lookXZ = new THREE.Vector2(rayDir.x, rayDir.z);
        if (lookXZ.length() > 0.01) lookXZ.normalize();
        
        // How far ahead to place (closer when looking steeply down)
        const forwardDist = Math.abs(rayDir.y) > 0.5 ? 1.5 : 3;
        
        targetPoint = new THREE.Vector3(
          fpPosition.x + lookXZ.x * STUD * forwardDist,
          footY, // Use foot level Y
          fpPosition.z + lookXZ.y * STUD * forwardDist
        );
        
        // If looking mostly down and foot Y would be underground, use 0
        if (targetPoint.y < 0) targetPoint.y = 0;
      }
      
      // If still no target, project forward at a fixed distance and clamp to ground
      if (!targetPoint) {
        targetPoint = rayOrigin.clone().addScaledVector(rayDir, fpPlaceDistance);
        // Clamp to ground level minimum
        if (targetPoint.y < 0) targetPoint.y = 0;
      }
      
      // Calculate base grid position
      let baseGx = Math.round(targetPoint.x / STUD) + fpGhostOffset.x;
      let baseGz = Math.round(targetPoint.z / STUD) + fpGhostOffset.z;
      let baseGy = 0;
      
      // Get brick dimensions
      const dims = selectedPrefab ? {w:1, d:1} : getEffectiveDims(selectedBrick, currentRotation);
      const hpForFind = selectedPrefab ? 1 : getHP(selectedBrick);
      
      // If we hit a brick, check which face we hit
      if (hitBrick && hitBrickGrid) {
        // Check if we hit a top face (normal pointing up) or side face
        const hitTopFace = targetNormal.y > 0.5;
        const hitBottomFace = targetNormal.y < -0.5;
        
        if (hitTopFace) {
          // Hit top face - place ON TOP of the brick
          const hitLocalX = (targetPoint.x / STUD) - hitBrickGrid.gx;
          const hitLocalZ = (targetPoint.z / STUD) - hitBrickGrid.gz;
          baseGx = hitBrickGrid.gx + Math.floor(hitLocalX) + fpGhostOffset.x;
          baseGz = hitBrickGrid.gz + Math.floor(hitLocalZ) + fpGhostOffset.z;
          baseGy = hitBrickGrid.gy + hitBrickGrid.hp;
        } else if (hitBottomFace) {
          // Hit bottom face - place UNDER the brick
          baseGy = hitBrickGrid.gy - hpForFind;
        } else {
          // Hit side face - place at SAME Y level, offset by normal direction
          baseGx = Math.round(targetPoint.x / STUD + targetNormal.x * 0.5) + fpGhostOffset.x;
          baseGz = Math.round(targetPoint.z / STUD + targetNormal.z * 0.5) + fpGhostOffset.z;
          baseGy = hitBrickGrid.gy; // Same Y as the brick we hit
        }
      } else {
        // No brick hit - use foot level (where player is standing)
        const footWorldY = fpPosition.y - FP_EYE_HEIGHT;
        baseGy = Math.round(footWorldY / PLATE_H);
      }
      
      // Apply manual Y offset (Page Up/Down)
      baseGy += fpGhostOffset.y;
      if (baseGy < 0) baseGy = 0;
      
      // Handle prefab vs single brick
      if (selectedPrefab && prefabs[selectedPrefab]) {
        updateFpPrefabGhost(baseGx, baseGz, baseGy);
      } else {
        updateFpBrickGhost(baseGx, baseGz, baseGy);
      }
    }
    
    // Update ghost for single brick in walk mode
    function updateFpBrickGhost(gx, gz, gy) {
      // Clear any prefab ghosts
      fpPrefabGhosts.forEach(g => scene.remove(g));
      fpPrefabGhosts = [];
      
      const dims = getEffectiveDims(selectedBrick, currentRotation);
      const hp = getHP(selectedBrick);
      const brickH = getBrickHeight(selectedBrick);
      
      // Store target for placement
      fpTargetGrid = { gx, gz, gy, w: dims.w, d: dims.d, hp, isPrefab: false };
      
      // SIMPLE: Walk mode only checks collision, not support
      const canPlaceHere = canPlace(gx, gz, dims.w, dims.d, gy, hp, false);
      fpTargetGrid.canPlace = canPlaceHere;
      
      // Update brick info display
      const brickInfoEl = document.getElementById('fpsBrickInfo');
      if (brickInfoEl) {
        brickInfoEl.textContent = `${selectedBrick} Y:${gy} ${canPlaceHere ? '✓ OK' : '✗ blocked'}`;
      }
      
      // Calculate world position for ghost
      const worldX = gx * STUD + (dims.w * STUD) / 2;
      const worldY = calcWorldY(gy, brickH);
      const worldZ = gz * STUD + (dims.d * STUD) / 2;
      
      // Create or update ghost
      if (!fpGhost) {
        fpGhost = createBrick(selectedBrick, brickDisplayColor(selectedColor).getHex(), new THREE.Vector3(worldX, worldY, worldZ), currentRotation, true);
        if (fpGhost) scene.add(fpGhost);
        fpLastCanPlace = null; // Reset to force color update
      } else {
        if (fpGhost.userData.type !== selectedBrick || fpGhost.userData.rot !== currentRotation) {
          scene.remove(fpGhost);
          fpGhost = createBrick(selectedBrick, brickDisplayColor(selectedColor).getHex(), new THREE.Vector3(worldX, worldY, worldZ), currentRotation, true);
          if (fpGhost) scene.add(fpGhost);
          fpLastCanPlace = null; // Reset to force color update
        } else {
          fpGhost.position.set(worldX, worldY, worldZ);
        }
      }
      
      // Update ghost appearance based on canPlace - only if changed
      if (fpGhost && canPlaceHere !== fpLastCanPlace) {
        fpLastCanPlace = canPlaceHere;
        fpGhost.traverse(child => {
          if (child.isMesh && child.material) {
            const color = canPlaceHere ? selectedColor : 0xff0000;
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.color.setHex(color));
            } else {
              child.material.color.setHex(color);
            }
          }
        });
      }
    }
    
    // Update ghost for prefab in walk mode
    function updateFpPrefabGhost(baseGx, baseGz, baseGy) {
      // Clear single brick ghost
      if (fpGhost) {
        scene.remove(fpGhost);
        fpGhost = null;
      }
      
      const prefab = prefabs[selectedPrefab];
      if (!prefab) return;
      
      // Store target for placement
      fpTargetGrid = { gx: baseGx, gz: baseGz, gy: baseGy, isPrefab: true, prefabName: selectedPrefab };
      
      // Calculate all brick positions and check collisions
      let canPlaceAll = true;
      let prefabHasSupport = (baseGy === 0); // Ground level always supported
      const brickData = [];
      
      for (const piece of prefab) {
        const pieceType = piece.type;
        const pieceRot = ((piece.rot || 0) + currentRotation) % 360;
        const pieceDims = getEffectiveDims(pieceType, pieceRot);
        const pieceHp = getHP(pieceType);
        const pieceH = getBrickHeight(pieceType);
        const pieceColor = piece.color !== undefined ? piece.color : selectedColor;
        const pieceTransparent = piece.transparent || false;
        
        // Calculate offset with rotation
        let dx = piece.dx || 0;
        let dz = piece.dz || 0;
        
        // Rotate offsets based on currentRotation
        if (currentRotation === 90) {
          [dx, dz] = [-dz, dx];
        } else if (currentRotation === 180) {
          [dx, dz] = [-dx, -dz];
        } else if (currentRotation === 270) {
          [dx, dz] = [dz, -dx];
        }
        
        const gx = baseGx + dx;
        const gz = baseGz + dz;
        const gy = baseGy + (piece.dy || 0);
        
        // Check collision for this piece (without support check - we check support separately)
        for (let ddx = 0; ddx < pieceDims.w && canPlaceAll; ddx++) {
          for (let ddz = 0; ddz < pieceDims.d && canPlaceAll; ddz++) {
            const key = `${gx + ddx},${gz + ddz}`;
            if (grid.has(key)) {
              const levels = grid.get(key);
              for (let h = 0; h < pieceHp; h++) {
                if (levels.has(gy + h)) {
                  canPlaceAll = false;
                  break;
                }
              }
              // Check if this base-level piece has support
              if (gy === baseGy && baseGy > 0 && levels.has(gy - 1)) {
                prefabHasSupport = true;
              }
            }
          }
        }
        
        // Calculate world position
        const worldX = gx * STUD + (pieceDims.w * STUD) / 2;
        const worldY = calcWorldY(gy, pieceH);
        const worldZ = gz * STUD + (pieceDims.d * STUD) / 2;
        
        brickData.push({
          type: pieceType,
          rot: pieceRot,
          color: pieceColor,
          transparent: pieceTransparent,
          pos: new THREE.Vector3(worldX, worldY, worldZ),
          gx, gz, gy, w: pieceDims.w, d: pieceDims.d, hp: pieceHp
        });
      }
      
      // Must have support to place (no floating prefabs)
      if (!prefabHasSupport) canPlaceAll = false;
      
      fpTargetGrid.canPlace = canPlaceAll;
      fpTargetGrid.brickData = brickData;
      
      // Create or update ghosts
      // Remove extra ghosts if prefab shrank
      while (fpPrefabGhosts.length > brickData.length) {
        const ghost = fpPrefabGhosts.pop();
        scene.remove(ghost);
      }
      
      // Update or create ghosts
      for (let i = 0; i < brickData.length; i++) {
        const data = brickData[i];
        let ghost = fpPrefabGhosts[i];
        
        if (!ghost || ghost.userData.type !== data.type || ghost.userData.rot !== data.rot) {
          if (ghost) scene.remove(ghost);
          ghost = createBrick(data.type, data.color, data.pos, data.rot, true, {transparent: data.transparent});
          if (ghost) {
            scene.add(ghost);
            fpPrefabGhosts[i] = ghost;
          }
        } else {
          ghost.position.copy(data.pos);
        }
        
        // Update color based on canPlace
        if (ghost) {
          ghost.traverse(child => {
            if (child.isMesh && child.material) {
              const color = canPlaceAll ? data.color : 0xff0000;
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.color.setHex(color));
              } else {
                child.material.color.setHex(color);
              }
            }
          });
        }
      }
    }
    
    // Get the walkable ground height at a position (only surfaces you can stand on)
    function getGroundHeight(worldX, worldZ, currentFootY = 0) {
      const gx = Math.floor(worldX / STUD);
      const gz = Math.floor(worldZ / STUD);
      
      let maxWalkableHeight = 0; // Base ground level
      
      for (const brick of bricks) {
        const g = brick.userData.grid;
        if (!g) continue;
        
        const brickType = brick.userData.type || brick.userData.brickType;
        const dims = getEffectiveDims(brickType, brick.userData.rot || 0);
        const hp = getHP(brickType);
        
        // Check if position is within this brick's footprint
        if (gx >= g.gx && gx < g.gx + dims.w && gz >= g.gz && gz < g.gz + dims.d) {
          const brickBottomY = g.gy * PLATE_H;
          const brickTopY = (g.gy + hp) * PLATE_H;
          
          // This brick's top is walkable if:
          // 1. The brick bottom is at or below our feet (we can step onto it)
          // 2. OR the step up is within step height
          const stepUp = brickTopY - currentFootY;
          
          if (brickBottomY <= currentFootY + 0.01 || stepUp <= FP_STEP_HEIGHT) {
            // This is a walkable surface
            if (brickTopY > maxWalkableHeight) {
              maxWalkableHeight = brickTopY;
            }
          }
        }
      }
      
      return maxWalkableHeight;
    }
    
    // Check if there's a wall blocking at player height
    function hasWallAt(worldX, worldZ, footY, headY) {
      const gx = Math.floor(worldX / STUD);
      const gz = Math.floor(worldZ / STUD);
      
      for (const brick of bricks) {
        const g = brick.userData.grid;
        if (!g) continue;
        
        const brickType = brick.userData.type || brick.userData.brickType;
        const dims = getEffectiveDims(brickType, brick.userData.rot || 0);
        const hp = getHP(brickType);
        
        // Check if position is within this brick's footprint
        if (gx >= g.gx && gx < g.gx + dims.w && gz >= g.gz && gz < g.gz + dims.d) {
          const brickBottomY = g.gy * PLATE_H;
          const brickTopY = (g.gy + hp) * PLATE_H;
          
          // A brick is a wall if:
          // 1. Its TOP is higher than what we can step over
          // 2. AND it overlaps with our body vertically
          if (brickTopY > footY + FP_STEP_HEIGHT + 0.01) {
            // This brick is too tall to step over
            // Check if it blocks our body (between feet and head)
            if (brickBottomY < headY && brickTopY > footY) {
              return true;
            }
          }
        }
      }
      
      return false;
    }
    
    function toggleCrouch() {
      if (!firstPersonMode) return;
      fpCrouching = !fpCrouching;
      
      // Adjust position when crouching/standing
      const heightDiff = FP_EYE_HEIGHT - FP_CROUCH_HEIGHT;
      if (fpCrouching) {
        fpPosition.y -= heightDiff;
      } else {
        // Check if there's room to stand
        fpPosition.y += heightDiff;
      }
      
      // Update UI
      document.getElementById('crouchBtn').classList.toggle('active', fpCrouching);
    }
    
    // Place brick in walk mode
    function placeBrickInWalkMode() {
      if (!fpTargetGrid || !fpTargetGrid.canPlace) {
        toast('❌ Cannot place here', 'error');
        return;
      }
      
      saveUndo();
      
      // Handle prefab placement
      if (fpTargetGrid.isPrefab && fpTargetGrid.brickData) {
        const brickData = fpTargetGrid.brickData;
        let placedCount = 0;
        
        for (const data of brickData) {
          if (commitPlacedBrick(data.type, data.color, data.pos.clone(), data.rot, {transparent: data.transparent}, {
            gx: data.gx, gz: data.gz, w: data.w, d: data.d, gy: data.gy, hp: data.hp
          })) placedCount++;
        }
        
        if (placedCount > 0) {
          updateUI();
          updateStats();
          
          // Reset ghost offset after placing
          fpGhostOffset = {x: 0, z: 0, y: 0};
          
          // Force immediate ghost update
          fpUpdateCounter = 99;
          
          toast(`✓ Placed ${selectedPrefab} (${placedCount} pieces)`, 'success');
          SoundSystem.playPlace();
        }
        return;
      }
      
      // Handle single brick placement
      const { gx, gz, gy, w, d, hp } = fpTargetGrid;
      const dims = getEffectiveDims(selectedBrick, currentRotation);
      const brickH = getBrickHeight(selectedBrick);
      
      // Calculate world position
      const worldX = gx * STUD + (dims.w * STUD) / 2;
      const worldY = calcWorldY(gy, brickH);
      const worldZ = gz * STUD + (dims.d * STUD) / 2;
      
      const brick = commitPlacedBrick(selectedBrick, selectedColor, new THREE.Vector3(worldX, worldY, worldZ), currentRotation, {transparent: isTransparent}, {
        gx, gz, w: dims.w, d: dims.d, gy, hp
      });
      if (brick) {
        updateUI();
        updateStats();
        
        // Reset ghost offset after placing
        fpGhostOffset = {x: 0, z: 0, y: 0};
        
        // Force immediate ghost update
        fpUpdateCounter = 99;
        
        // Brief visual feedback
        toast(`✓ Placed ${selectedBrick}`, 'success');
        SoundSystem.playPlace();
      }
    }
    
    // Update target brick highlighting (for deletion preview) - Minecraft-style outline
    function updateTargetBrickHighlight(newTarget) {
      // If targeting same brick, do nothing
      if (fpTargetBrick === newTarget) return;
      
      // Remove previous outline
      if (fpTargetOutline) {
        scene.remove(fpTargetOutline);
        fpTargetOutline = null;
      }
      
      // Store new target
      fpTargetBrick = newTarget;
      
      // Create wireframe outline around target brick (Minecraft-style)
      if (fpTargetBrick) {
        let box;
        
        if (fpTargetBrick.isInstancedBrick) {
          // For instanced bricks, calculate box from grid data
          const g = fpTargetBrick.userData.grid;
          const brickType = fpTargetBrick.userData.brickType;
          const brickH = getBrickHeight(brickType);
          const height = g.hp * PLATE_H;
          const width = g.w * STUD;
          const depth = g.d * STUD;
          
          const minX = fpTargetBrick.position.x - width/2;
          const minY = fpTargetBrick.position.y;
          const minZ = fpTargetBrick.position.z - depth/2;
          
          box = new THREE.Box3(
            new THREE.Vector3(minX, minY, minZ),
            new THREE.Vector3(minX + width, minY + height, minZ + depth)
          );
        } else {
          // For regular bricks, use setFromObject
          box = new THREE.Box3().setFromObject(fpTargetBrick);
        }
        
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Create slightly larger wireframe box
        const outlineGeo = new THREE.BoxGeometry(size.x + 0.04, size.y + 0.04, size.z + 0.04);
        const edges = new THREE.EdgesGeometry(outlineGeo);
        const outlineMat = new THREE.LineBasicMaterial({ 
          color: 0x000000,
          linewidth: 2,
          transparent: true,
          opacity: 0.8
        });
        fpTargetOutline = new THREE.LineSegments(edges, outlineMat);
        fpTargetOutline.position.copy(center);
        fpTargetOutline.renderOrder = 999;
        scene.add(fpTargetOutline);
      }
    }
    
    // Update crosshair appearance and target info
    function updateFpCrosshair(targetBrick, canPlaceOnBrick) {
      const crosshair = document.getElementById('fpsCrosshair');
      const targetInfo = document.getElementById('fpsTargetInfo');
      
      if (!crosshair) return;
      
      // Reset classes
      crosshair.classList.remove('can-place', 'can-delete');
      
      if (targetBrick) {
        // Aiming at a brick - show delete mode
        crosshair.classList.add('can-delete');
        crosshair.textContent = '×';
        
        // Show target info
        if (targetInfo) {
          const brickType = targetBrick.userData.type || targetBrick.userData.brickType || 'brick';
          targetInfo.textContent = `Right-click to delete ${getBrickName(brickType)}`;
          targetInfo.style.display = 'block';
        }
      } else if (fpTargetGrid && fpTargetGrid.canPlace) {
        // Can place here
        crosshair.classList.add('can-place');
        crosshair.textContent = '+';
        
        if (targetInfo) {
          targetInfo.textContent = `Click to place`;
          targetInfo.style.display = 'block';
        }
      } else {
        // Default crosshair
        crosshair.textContent = '+';
        if (targetInfo) {
          targetInfo.style.display = 'none';
        }
      }
    }
    
    // Clear walk mode target highlighting
    function clearFpTargetHighlight() {
      // Remove outline
      if (fpTargetOutline) {
        scene.remove(fpTargetOutline);
        fpTargetOutline = null;
      }
      fpTargetBrick = null;
      
      // Reset crosshair
      const crosshair = document.getElementById('fpsCrosshair');
      const targetInfo = document.getElementById('fpsTargetInfo');
      if (crosshair) {
        crosshair.classList.remove('can-place', 'can-delete');
        crosshair.textContent = '+';
      }
      if (targetInfo) {
        targetInfo.style.display = 'none';
      }
    }
    
    // Pick up brick type in walk mode (middle-click, like Minecraft)
    function pickBrickTypeInWalkMode() {
      if (fpTargetBrick && fpTargetBrick.userData) {
        const brickType = fpTargetBrick.userData.type || fpTargetBrick.userData.brickType;
        const brickColor = fpTargetBrick.userData.color;
        
        if (brickType && types[brickType]) {
          selectedBrick = brickType;
          selectedPrefab = null;
          
          // Also pick up the color
          if (brickColor !== undefined) {
            selectedColor = brickColor;
            // Update color picker UI if possible
            updateColorPickerUI();
          }
          
          // Update ghost
          if (fpGhost) {
            scene.remove(fpGhost);
            fpGhost = null;
          }
          
          updateFpBrickInfo();
          toast(`Picked: ${getBrickName(brickType)}`, 'success');
        }
      }
    }
    
    // Update color picker UI to reflect current selectedColor
    function updateColorPickerUI() {
      // Update color input
      const colorInput = document.getElementById('colorPicker');
      if (colorInput) {
        colorInput.value = '#' + selectedColor.toString(16).padStart(6, '0');
      }
      
      // Update color swatches selection
      document.querySelectorAll('.color-swatch').forEach(swatch => {
        const swatchColor = parseInt(swatch.dataset.color);
        if (swatchColor === selectedColor) {
          swatch.classList.add('selected');
        } else {
          swatch.classList.remove('selected');
        }
      });
    }
    
    // Delete brick in walk mode (right-click)
    function deleteBrickInWalkMode() {
      // Use the already-targeted brick if available
      if (fpTargetBrick && bricks.includes(fpTargetBrick)) {
        saveUndo();
        
        // Store reference before clearing highlight
        const brickToDelete = fpTargetBrick;
        
        // Clear the highlight first
        clearFpTargetHighlight();
        
        // If in prefab selection mode, deselect this brick
        if (isRecordingPrefab && selectedForPrefab.has(brickToDelete)) {
          toggleBrickForPrefab(brickToDelete);
        }
        
        if (brickToDelete.isInstancedBrick) {
          // Handle instanced brick deletion
          removeInstancedBrick(brickToDelete.instanceId);
          bricks = bricks.filter(b => b !== brickToDelete);
        } else {
          // Handle regular brick deletion
          removeFromGrid(brickToDelete);
          scene.remove(brickToDelete);
          bricks = bricks.filter(b => b !== brickToDelete);
        }
        
        updateUI();
        updateStats();
        toast('🗑️ Deleted', 'success');
        SoundSystem.playDelete();
        return;
      }
      
      const rayOrigin = fpPosition.clone();
      const rayDir = new THREE.Vector3(
        -Math.sin(fpYaw) * Math.cos(fpPitch),
        Math.sin(fpPitch),
        -Math.cos(fpYaw) * Math.cos(fpPitch)
      ).normalize();
      raycaster.set(rayOrigin, rayDir);
      const picked = pickBuild(raycaster.ray);
      if (picked && picked.brick && bricks.includes(picked.brick) && picked.distance < fpPlaceDistance * 3) {
        fpTargetBrick = picked.brick;
        deleteBrickInWalkMode();
        return;
      }
      toast('No brick in range', 'error');
    }

    function onFirstPersonMouseMove(e) {
      if (!firstPersonMode || !document.pointerLockElement) return;
      
      fpYaw -= e.movementX * fpMouseSensitivity;
      fpPitch -= e.movementY * fpMouseSensitivity;
      
      // Clamp pitch to prevent flipping
      fpPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, fpPitch));
    }
    
    // ==================== ANIMATION LOOP ====================
    let frames = 0, lastFPS = 0;
    let animateStarted = 0;
    let hudLive = false;
    let lastTime = performance.now();
    let needsRender = true;
    let shadersWarmed = false;
    let hudDrawCalls = 0;
    const MIN_CAMERA_HEIGHT = 0.5;
    const MIN_TARGET_HEIGHT = 0;
    
    let presentStep = 0;
    let presentPending = false;
    let sceneryKick = false;
    function kickScenery() {
      if (sceneryKick) return;
      sceneryKick = true;
      setTimeout(() => { if (window.brixStartScenery) window.brixStartScenery(); }, 0);
    }
    function finishReveal() {
      revealActive = false;
      if (revealAdd) {
        scene.add = revealAdd;
        revealAdd = null;
      }
      // Compile one shadow program per frame. Turning every caster on in
      // the same draw was a single long GPU task.
      casterWarm = [];
      const seen = new Set();
      scene.traverse((obj) => {
        if (!(obj.isMesh || obj.isInstancedMesh) || !obj.castShadow) return;
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        const id = mat && mat.uuid;
        if (!id || seen.has(id)) {
          obj.userData.__castLater = true;
          obj.castShadow = false;
          return;
        }
        seen.add(id);
        obj.userData.__castLater = true;
        obj.castShadow = false;
        casterWarm.push(obj);
      });
    }
    function restoreCasters() {
      scene.traverse((obj) => {
        if (obj.userData && obj.userData.__castLater) {
          obj.castShadow = true;
          obj.userData.__castLater = false;
        }
      });
    }
    function renderFrame() {
      if (renderer) {
        renderer.getDrawingBufferSize(studViewBuf);
        if (studViewBuf.y > 0) studViewH.value = studViewBuf.y;
      }
      if (renderer.info && typeof renderer.info.reset === 'function') renderer.info.reset();
      // One new mesh per frame, shadows off, until the plate, studs, and
      // scenery have each been drawn once. The full shadowed frame was the
      // 30ms animation task.
      if (revealActive) {
        if (revealQueue.length) {
          let next = null;
          while (revealQueue.length && !next) {
            const item = revealQueue.shift();
            if (item && item.parent) next = item;
          }
          if (next) next.visible = true;
        }
        const shadows = renderer.shadowMap.enabled;
        renderer.shadowMap.enabled = false;
        renderer.render(scene, camera);
        renderer.shadowMap.enabled = shadows;
        hudDrawCalls = renderer.info.render.calls;
        window.brixPlateShown = !!(window.baseplateRef && window.baseplateRef.visible !== false);
        if (!revealQueue.length && window.scenerySettled) finishReveal();
        presentPending = true;
        return;
      }
      if (casterWarm && casterWarm.length) {
        const obj = casterWarm.shift();
        obj.castShadow = true;
        obj.userData.__castLater = false;
        const sun = window.sunLight;
        if (sun && sun.shadow) {
          if (sun.shadow.mapSize.width !== 64) {
            sun.shadow.mapSize.set(64, 64);
            if (sun.shadow.map) {
              sun.shadow.map.dispose();
              sun.shadow.map = null;
            }
          }
          sun.shadow.needsUpdate = true;
        }
        const shadows = renderer.shadowMap.enabled;
        renderer.shadowMap.enabled = true;
        renderer.render(scene, camera);
        renderer.shadowMap.enabled = shadows;
        hudDrawCalls = renderer.info.render.calls;
        window.brixPlateShown = !!(window.baseplateRef && window.baseplateRef.visible !== false);
        presentPending = true;
        if (!casterWarm.length) restoreCasters();
        return;
      }
      const direct = !(composer && qualitySettings.post);
      // The plate stays in the first phone frame. Hiding it, then clearing
      // needsRender, left a fresh load as sky until several bricks were placed.
      if (direct && presentStep === 0) {
        const shadows = renderer.shadowMap.enabled;
        renderer.shadowMap.enabled = false;
        renderer.render(scene, camera);
        renderer.shadowMap.enabled = shadows;
        hudDrawCalls = renderer.info.render.calls;
        presentStep = 1;
        presentPending = true;
        window.brixPlateShown = !!(window.baseplateRef && window.baseplateRef.visible !== false);
        return;
      }
      if (direct && presentStep >= 1 && presentStep <= shadowWarmSteps()) {
        const sun = window.sunLight;
        const steps = shadowWarmSteps();
        if (sun && sun.shadow) {
          const size = shadowWarmSize(presentStep);
          if (sun.shadow.mapSize.width !== size) {
            sun.shadow.mapSize.set(size, size);
            if (sun.shadow.map) {
              sun.shadow.map.dispose();
              sun.shadow.map = null;
            }
          }
          sun.shadow.needsUpdate = true;
        }
        markShadowDirty();
        performance.mark('brix-present-' + presentStep);
        renderer.render(scene, camera);
        hudDrawCalls = renderer.info.render.calls;
        presentStep++;
        presentPending = presentStep <= steps;
        if (presentStep > steps) {
          window.sceneryShown = true;
          kickScenery();
        }
        return;
      }
      if (composer && qualitySettings.post) {
        window.sceneryShown = true;
        kickScenery();
        window.brixPlateShown = !!(window.baseplateRef && window.baseplateRef.visible !== false);
        if (gradeScreenPass) gradeScreenPass.uniforms.exposure.value = renderer.toneMappingExposure;
        composer.render();
      } else {
        if (!window.sceneryShown) window.sceneryShown = true;
        kickScenery();
        window.brixPlateShown = !!(window.baseplateRef && window.baseplateRef.visible !== false);
        renderer.render(scene, camera);
      }
      hudDrawCalls = renderer.info.render.calls;
      presentPending = false;
    }
    
    function animate() {
      requestAnimationFrame(animate);
      
      const now = performance.now();
      if (!animateStarted) {
        animateStarted = now;
        lastFPS = now;
        lastTime = now;
      }
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      demandFrames++;
      if (pointerDirty) {
        pointerDirty = false;
        flushPointerHover();
      }
      tickBounces();
      tickDust(delta);
      
      const weatherOn = weatherType !== 'clear';
      
      if (firstPersonMode) {
        updateFirstPersonCamera(delta);
        needsRender = true;
      } else if (controls) {
        const moved = controls.update();
        if (moved) {
          needsRender = true;
          cameraCoasting = true;
          if (ghost || wallModeGhost) hideHoverGhost();
        } else if (cameraCoasting) {
          cameraCoasting = false;
          scheduleHover();
        }
        if (camera.position.y < MIN_CAMERA_HEIGHT) camera.position.y = MIN_CAMERA_HEIGHT;
        if (controls.target.y < MIN_TARGET_HEIGHT) controls.target.y = MIN_TARGET_HEIGHT;
      }
      if (presentPending) needsRender = true;
      
      if (weatherOn) {
        if (now - lastWeatherTick >= 33) {
          updateWeather(delta);
          if (window.animateParticles) window.animateParticles();
          lastWeatherTick = now;
          needsRender = true;
        }
      }
      
      if (ghost && !firstPersonMode && (now - lastPointerMs) < 280) {
        ghost.scale.setScalar(0.97 + Math.sin(now * 0.003) * 0.03);
        needsRender = true;
      }
      
      if (lightSources.size) updateBrickLights(false);
      
      if (lastFPS && now - lastFPS >= 1000) {
        considerAutoQuality(frames, demandFrames, renderedFrames);
        // Startup samples include the boot long-task. Publish rAF ticks only
        // after the loop has been running for 2.5s. Auto-quality still sees
        // the rendered-frame count, so an idle plate does not step quality down.
        if (animateStarted && lastFPS - animateStarted >= 2500) {
          lastHudFps = demandFrames;
          hudLive = true;
        }
        const shownFps = hudLive ? lastHudFps : null;
        demandFrames = 0;
        renderedFrames = 0;
        const el = document.getElementById('fps');
        if (el) {
          let batches = 0;
          instancedSystem.meshes.forEach(d => { if (d.mesh.count > 0) batches++; });
          for (let i = 0; i < bricks.length; i++) if (!bricks[i].isInstancedBrick) batches++;
          const fpsText = shownFps == null ? '--' : String(shownFps);
          el.textContent = fpsText + ' FPS';
        }
        frames = 0;
        lastFPS = now;
      }
      
      if (needsRender && shadersWarmed) {
        frames++;
        renderedFrames++;
        const skipPost = weatherOn && qualityPreset !== 'high';
        if (skipPost) {
          renderer.info.reset();
          renderer.render(scene, camera);
          hudDrawCalls = renderer.info.render.calls;
        } else {
          renderFrame();
        }
        needsRender = false;
      }
    }
    
    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (hasUnsavedChanges && bricks.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });
    
    init().catch((err) => console.error(err));
    
    // Tutorial System
    (function initTutorial() {
      const modal = document.getElementById('tutorialModal');
      const pages = document.querySelectorAll('.tutorial-page');
      const prevBtn = document.getElementById('tutorialPrev');
      const nextBtn = document.getElementById('tutorialNext');
      const skipBtn = document.getElementById('tutorialSkip');
      const dontShowCheckbox = document.getElementById('tutorialDontShow');
      const currentPageSpan = document.getElementById('tutorialCurrentPage');
      const totalPagesSpan = document.getElementById('tutorialTotalPages');
      
      let currentPage = 1;
      const totalPages = pages.length;
      totalPagesSpan.textContent = totalPages;
      
      // Check if user has dismissed tutorial before
      const tutorialDismissed = localStorage.getItem('brickBuilderTutorialDismissed') === 'true';
      
      function showPage(pageNum) {
        pages.forEach(p => p.classList.remove('active'));
        const targetPage = document.querySelector(`.tutorial-page[data-page="${pageNum}"]`);
        if (targetPage) targetPage.classList.add('active');
        
        currentPage = pageNum;
        currentPageSpan.textContent = pageNum;
        
        // Update button states
        prevBtn.disabled = pageNum === 1;
        nextBtn.textContent = pageNum === totalPages ? 'Finish ✓' : 'Next →';
      }
      
      function closeTutorial(persist) {
        modal.classList.remove('visible');
        if (dontShowCheckbox && dontShowCheckbox.checked) {
          localStorage.setItem('brickBuilderTutorialDismissed', 'true');
        }
      }
      
      // Event listeners
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          showPage(currentPage + 1);
        } else {
          closeTutorial(false);
        }
      });
      
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          showPage(currentPage - 1);
        }
      });
      
      skipBtn.addEventListener('click', () => closeTutorial(false));
      
      const phoneCard = document.getElementById('phoneTutorial');
      const phoneOk = document.getElementById('phoneTutorialOk');
      function dismissPhoneTutorial() {
        if (phoneCard) {
          phoneCard.hidden = true;
          // Splash and the boot card can both try to show this. A Got it
          // that lands first must stay dismissed.
          phoneCard.dataset.closed = '1';
        }
        const box = document.getElementById('phoneTutorialDontShow');
        if (box && box.checked) localStorage.setItem('brickBuilderTutorialDismissed', 'true');
        if (!bricks.length && !shareTokenFromLocation()) showStarterBar();
      }
      if (phoneOk) phoneOk.addEventListener('click', dismissPhoneTutorial);
      
      // Close on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('visible')) {
          closeTutorial();
        }
        if (e.key === 'Escape' && phoneCard && !phoneCard.hidden) {
          dismissPhoneTutorial();
        }
      });
      
      // A share link (#b=) opens on the build, on every width.
      // Phone gets a short card. Desktop keeps the multi-page modal.
      const phoneChrome = window.innerWidth <= 768;
      const openingShare = !!shareTokenFromLocation();
      function whenLoaded(show) {
        const checkAndShow = () => {
          const loadingScreen = document.getElementById('loadingScreen');
          if (!loadingScreen || loadingScreen.style.display === 'none' || loadingScreen.classList.contains('hide')) {
            show();
          } else {
            setTimeout(checkAndShow, 400);
          }
        };
        setTimeout(checkAndShow, 900);
      }
      function whenSplashHides(show) {
        const check = () => {
          const loadingScreen = document.getElementById('loadingScreen');
          if (!loadingScreen || loadingScreen.style.display === 'none' || loadingScreen.classList.contains('hide')) show();
          else setTimeout(check, 50);
        };
        check();
      }
      if (!tutorialDismissed && !openingShare) {
        if (phoneChrome && phoneCard) {
          whenSplashHides(() => {
            if (phoneCard.dataset.closed === '1') return;
            phoneCard.hidden = false;
          });
        } else if (!phoneChrome) {
          whenLoaded(() => { modal.classList.add('visible'); });
        }
      }
      
      // Add a way to re-open tutorial from help
      window.showTutorial = function() {
        if (window.innerWidth <= 768 && phoneCard) {
          phoneCard.hidden = false;
          return;
        }
        currentPage = 1;
        showPage(1);
        dontShowCheckbox.checked = false;
        modal.classList.add('visible');
      };
    })();
    
    // Keybind Customization System
    (function initKeybinds() {
      const modal = document.getElementById('keybindModal');
      const keybindList = document.getElementById('keybindList');
      const closeBtn = document.getElementById('keybindClose');
      const resetBtn = document.getElementById('keybindReset');
      
      // Default keybinds
      const defaultKeybinds = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      
      // Slot names for display
      const slotNames = ['2×2 Brick', '2×4 Brick', '1×2 Brick', 'Plate', 'Slope', 'Stairs', 'Pillar', 'Door', 'Window'];
      
      // Load custom keybinds or use defaults
      let customKeybinds = JSON.parse(localStorage.getItem('brickBuilderKeybinds')) || [...defaultKeybinds];
      
      // Ensure we have 9 keybinds
      while (customKeybinds.length < 9) customKeybinds.push(defaultKeybinds[customKeybinds.length]);
      
      let listeningSlot = null;
      
      function saveKeybinds() {
        localStorage.setItem('brickBuilderKeybinds', JSON.stringify(customKeybinds));
        updateHotbarUI();
      }
      
      function updateHotbarUI() {
        // Update the visual hotbar with new keys
        const slots = document.querySelectorAll('.fps-slot');
        slots.forEach((slot, i) => {
          const keySpan = slot.querySelector('.slot-key');
          if (keySpan && customKeybinds[i]) {
            keySpan.textContent = customKeybinds[i].toUpperCase();
          }
        });
      }
      
      function renderKeybindList() {
        keybindList.innerHTML = '';
        
        customKeybinds.forEach((key, i) => {
          const item = document.createElement('div');
          item.className = 'keybind-item';
          item.dataset.slot = i;
          item.innerHTML = `
            <div class="slot-info">
              <span class="slot-num">${i + 1}</span>
              <span class="slot-name">${slotNames[i] || 'Slot ' + (i + 1)}</span>
            </div>
            <div class="key-display">${key.toUpperCase()}</div>
          `;
          
          item.addEventListener('click', () => {
            // Remove listening from other items
            keybindList.querySelectorAll('.keybind-item').forEach(el => el.classList.remove('listening'));
            
            if (listeningSlot === i) {
              // Toggle off
              listeningSlot = null;
            } else {
              // Start listening
              item.classList.add('listening');
              listeningSlot = i;
              item.querySelector('.key-display').textContent = '...';
            }
          });
          
          keybindList.appendChild(item);
        });
      }
      
      function handleKeyPress(e) {
        if (listeningSlot === null) return;
        if (!modal.classList.contains('visible')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        let keyName = e.key;
        
        // Handle special keys
        if (e.key === ' ') keyName = 'Space';
        else if (e.key.length === 1) keyName = e.key.toUpperCase();
        else if (e.key === 'Escape') {
          // Cancel listening
          listeningSlot = null;
          renderKeybindList();
          return;
        }
        
        // Don't allow modifier keys alone
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        
        // Check for duplicates
        const duplicate = customKeybinds.findIndex((k, i) => k.toLowerCase() === keyName.toLowerCase() && i !== listeningSlot);
        if (duplicate >= 0) {
          // Swap keys
          customKeybinds[duplicate] = customKeybinds[listeningSlot];
        }
        
        customKeybinds[listeningSlot] = keyName;
        listeningSlot = null;
        saveKeybinds();
        renderKeybindList();
      }
      
      // Event listeners
      document.addEventListener('keydown', handleKeyPress, true);
      
      closeBtn.addEventListener('click', () => {
        listeningSlot = null;
        modal.classList.remove('visible');
      });
      
      resetBtn.addEventListener('click', () => {
        customKeybinds = [...defaultKeybinds];
        listeningSlot = null;
        saveKeybinds();
        renderKeybindList();
        toast('⌨️ Keys reset to defaults');
      });
      
      // Close on escape (when not listening)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('visible') && listeningSlot === null) {
          modal.classList.remove('visible');
        }
      });
      
      // Initialize
      renderKeybindList();
      updateHotbarUI();
      
      // Expose functions
      window.openKeybindModal = function() {
        listeningSlot = null;
        renderKeybindList();
        modal.classList.add('visible');
      };
      
      window.getCustomKeybind = function(slotIndex) {
        return customKeybinds[slotIndex] || defaultKeybinds[slotIndex];
      };
      
      window.getSlotByKey = function(key) {
        const idx = customKeybinds.findIndex(k => k.toLowerCase() === key.toLowerCase());
        return idx >= 0 ? idx : -1;
      };
    })();
    
    // ==================== EXPOSE GLOBALS FOR TESTING ====================
    // Make key variables/functions accessible to E2E test suite
    window.THREE = THREE;
    // Getters: init() yields before these exist, so a one-time assignment stays empty.
    Object.defineProperty(window, 'scene', { get: () => scene });
    Object.defineProperty(window, 'camera', { get: () => camera });
    Object.defineProperty(window, 'renderer', { get: () => renderer });
    Object.defineProperty(window, 'controls', { get: () => controls });
    Object.defineProperty(window, 'bricks', { get: () => bricks });
    window.grid = grid;
    window.raycaster = raycaster;
    window.instancedSystem = instancedSystem;
    window.undoStack = undoStack;
    window.redoStack = redoStack;
    
    // Use getters/setters for mutable state
    Object.defineProperty(window, 'ghost', { get: () => ghost, set: v => ghost = v });
    Object.defineProperty(window, 'mouse', { get: () => mouse });
    Object.defineProperty(window, 'selectedBrick', { get: () => selectedBrick, set: v => selectedBrick = v });
    Object.defineProperty(window, 'selectedColor', { get: () => selectedColor, set: v => selectedColor = v });
    Object.defineProperty(window, 'selectedLightColor', { get: () => selectedLightColor, set: v => selectedLightColor = v });
    Object.defineProperty(window, 'currentRotation', { get: () => currentRotation, set: v => currentRotation = v });
    Object.defineProperty(window, 'deleteMode', { get: () => deleteMode, set: v => deleteMode = v });
    Object.defineProperty(window, 'firstPersonMode', { get: () => firstPersonMode, set: v => firstPersonMode = v });
    
    // Constants
    window.STUD = STUD;
    window.BRICK_H = BRICK_H;
    window.PLATE_H = PLATE_H;
    window.types = types;
    
    // Functions
    window.placeBrick = placeBrick;
    window.deleteBrick = deleteBrick;
    window.createBrick = createBrick;
    window.updateGhost = updateGhost;
    window.canPlace = canPlace;
    window.addToGrid = addToGrid;
    window.removeFromGrid = removeFromGrid;
    window.getEffectiveDims = getEffectiveDims;
    window.getHP = getHP;
    window.getBrickHeight = getBrickHeight;
    window.calcWorldY = calcWorldY;
    window.findY = findY;
    window.worldToGrid = worldToGrid;
    window.saveUndo = saveUndo;
    window.undo = undo;
    window.redo = redo;
    window.clearAll = clearAll;
    window.getProjectData = getProjectData;
    window.loadProjectData = loadProjectData;
    window.shouldUseInstancing = shouldUseInstancing;
    window.addInstancedBrick = addInstancedBrick;
    window.removeInstancedBrick = removeInstancedBrick;
    window.getGroundHeight = getGroundHeight;
    window.hasWallAt = hasWallAt;
    window.groundPlane = groundPlane;
    window.BRICK_HEIGHT = BRICK_H;
    window.PLATE_HEIGHT = PLATE_H;
    window.commitPlacedBrick = commitPlacedBrick;
    window.placeStarter = placeStarter;
    window.loadGalleryBuild = loadGalleryBuild;
    window.deleteGalleryBuild = deleteGalleryBuild;
    window.applyCodeBricks = applyCodeBricks;
    window.buildShareRecords = buildShareRecords;
    window.encodeShareToken = encodeShareToken;
    window.decodeShareToken = decodeShareToken;
    window.brixRenderSceneToCanvas = renderSceneToCanvas;
    window.brixDebug = {
      getStats() {
        let groupBricks = 0;
        let batches = 0;
        for (let i = 0; i < bricks.length; i++) if (!bricks[i].isInstancedBrick) groupBricks++;
        instancedSystem.meshes.forEach(d => { if (d.mesh.count > 0) batches++; });
        batches += groupBricks;
        return {
          fps: lastHudFps,
          bricks: bricks.length,
          draws: hudDrawCalls,
          batches,
          triangles: renderer.info.render.triangles,
          quality: qualityPreset,
          dpr: renderer.getPixelRatio(),
          shadow: window.sunLight ? window.sunLight.shadow.mapSize.width : 0,
          instancedMeshes: instancedSystem.meshes.size,
          groupBricks,
          lamps: lightSources.size,
          pointLights: scene.children.filter(o => o.isPointLight).length,
          preserveDrawingBuffer: !!(renderer.getContextAttributes() || {}).preserveDrawingBuffer,
          aa: (renderer.getContextAttributes() || {}).antialias ? 'msaa' : 'none',
          scenery: window.sceneryMergedDraws || 0,
          autoSteps: autoQualitySteps,
          env: !!envMap,
          post: !!(composer && qualitySettings.post)
        };
      },
      ensureEnv() { return buildEnvMapNow(); },
      ensureScenery() { if (window.brixStartScenery) window.brixStartScenery(); },
      setQuality(name) { applyQuality(name, { silent: true }); },
      considerAutoQuality,
      placeGrid(count, type = '2x4') {
        const t = types[type] || types['2x4'];
        const w = t.w, d = t.d, hp = getHP(type);
        const brickH = getBrickHeight(type);
        const cols = Math.ceil(Math.sqrt(count));
        const origin = 32;
        let n = 0;
        for (let i = 0; i < count; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const gx = origin + col * w;
          const gz = origin + row * d;
          const pos = new THREE.Vector3(
            gx * STUD + (w * STUD) / 2,
            calcWorldY(0, brickH),
            gz * STUD + (d * STUD) / 2
          );
          if (commitPlacedBrick(type, 0xe53935, pos, 0, {}, { gx, gz, w, d, gy: 0, hp })) n++;
        }
        updateStats();
        needsRender = true;
        return n;
      },
      clear() {
        bricks.forEach(b => { if (!b.isInstancedBrick) scene.remove(b); });
        bricks.length = 0;
        grid.clear(); cellBrick.clear();
        clearInstancedBricks();
        updateStats();
        needsRender = true;
      },
      orbitTick() { needsRender = true; },
      grids() {
        return bricks.map((b) => {
          const g = b.userData.grid || {};
          return {
            t: b.userData.brickType || b.userData.type,
            gx: g.gx, gz: g.gz, gy: g.gy
          };
        });
      },
      // Project every brick corner through the same 4:3 sphere fit the gallery uses.
      captureFit() {
        const v = new THREE.Vector3();
        let worst = 0;
        let outside = 0;
        let behind = 0;
        let dist = 0;
        withFramedBuild(200, 150, () => {
          dist = camera.position.distanceTo(controls.target);
          for (let i = 0; i < bricks.length; i++) {
            const b = bricks[i];
            const p = b.position;
            if (!p) continue;
            const g = b.userData && b.userData.grid;
            const hx = g ? (g.w * STUD) * 0.5 : 0.4;
            const hz = g ? (g.d * STUD) * 0.5 : 0.4;
            const hy = g && g.hp >= 3 ? BRICK_H : PLATE_H;
            const ys = [p.y, p.y + hy];
            const xs = [p.x - hx, p.x + hx];
            const zs = [p.z - hz, p.z + hz];
            for (let yi = 0; yi < ys.length; yi++) {
              for (let xi = 0; xi < xs.length; xi++) {
                for (let zi = 0; zi < zs.length; zi++) {
                  v.set(xs[xi], ys[yi], zs[zi]).project(camera);
                  if (v.z < 0 || v.z > 1) behind++;
                  if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) outside++;
                  worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
                }
              }
            }
          }
        });
        return { worst, outside, behind, dist, count: bricks.length };
      }
    };

  