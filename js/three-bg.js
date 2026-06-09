// ============================================================
// CS - Galaxy Starfield Engine v3
// 螺旋星系 + GPU黑洞引力 + 清晰锐利粒子
// ============================================================

class StarfieldEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.galaxyPoints = null;
    this.galaxyUniforms = null;
    this.mouseWorld = new THREE.Vector3(9999, 0, 9999);
    this.mouseNdc = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this.isTransitioning = false;
    this.cameraBaseZ = 30;
    this.cursorGlow = document.getElementById("cursor-glow");
    this.raycaster = new THREE.Raycaster();
    this.galaxyPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.init();
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, alpha: true, antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.5, 200
    );
    this.camera.position.set(0, 20, 30);
    this.camera.lookAt(0, 0, 0);

    this.createGalaxy();
    this.createCoreHalo();

    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("mousemove", (e) => this.onMouseMove(e));
    window.addEventListener("mouseleave", () => this.onMouseLeave());
    this.animate();
  }

  // ==================== 粒子纹理（锐利版） ====================
  createSharpGlowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    // 核心亮白 → 快速衰减，减少光晕模糊
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.08, "rgba(255,255,255,0.95)");
    g.addColorStop(0.15, "rgba(180,210,255,0.45)");
    g.addColorStop(0.35, "rgba(80,120,255,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // ==================== 星系着色器（锐利粒子版） ====================
  createGalaxyShader() {
    const vert = `
      attribute vec3 aOriginalPos;
      attribute float aSize;
      attribute vec3 aColor;

      uniform vec3 uMouseWorld;
      uniform float uMouseStrength;
      uniform float uTime;
      uniform float uPixelRatio;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 pos = aOriginalPos;

        // 微弱流动扰动
        pos.x += sin(pos.z * 0.25 + uTime * 0.35) * 0.12;
        pos.z += cos(pos.x * 0.25 + uTime * 0.35) * 0.12;

        // 黑洞引力：粒子被拉向鼠标
        vec3 toMouse = uMouseWorld - pos;
        float distToMouse = length(toMouse);
        float gravity = uMouseStrength / (1.0 + distToMouse * distToMouse * 0.005);
        pos += normalize(toMouse) * gravity;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

        // 锐利尺寸：基础小尺寸 + 引力区微放大
        float size = aSize * (160.0 / -mvPosition.z) * uPixelRatio;
        size *= (1.0 + gravity * 0.6);

        // 中心鼠标高亮（仅在鼠标贴近中心时触发）
        float centerDist = length(uMouseWorld);
        float centerBoost = 1.0 - smoothstep(0.0, 4.0, centerDist);
        size *= (1.0 + centerBoost * 1.5);

        gl_PointSize = clamp(size, 0.3, 18.0);
        gl_Position = projectionMatrix * mvPosition;

        float bright = 1.0 + centerBoost * 1.5 + gravity * 0.3;
        vColor = aColor * bright;
        vAlpha = 0.85 * (1.0 + centerBoost * 0.5);
      }
    `;

    const frag = `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        // 锐利衰减：smoothstep边缘清晰，pow指数降低减少模糊
        float alpha = 1.0 - smoothstep(0.0, 0.52, d);
        alpha = pow(alpha, 1.25);
        // 微弱辉光（仅为边缘补光，不强）
        float glow = exp(-d * 7.0) * 0.03;
        gl_FragColor = vec4(vColor * (1.0 + glow), vAlpha * alpha);
      }
    `;

    return { vertexShader: vert, fragmentShader: frag };
  }

  // ==================== 构建星系 ====================
  createGalaxy() {
    const ARMS = 5, PER_ARM = 1400;
    const CORE = 800, RINGS = 3, PER_RING = 500, BG = 1800;
    const RADIUS_MIN = 2, RADIUS_MAX = 18;
    const total = ARMS * PER_ARM + CORE + RINGS * PER_RING + BG;

    const posArr = new Float32Array(total * 3);
    const origArr = new Float32Array(total * 3);
    const sizeArr = new Float32Array(total);
    const colArr = new Float32Array(total * 3);

    let idx = 0;
    const cInner = new THREE.Color("#6688ee");
    const cMid   = new THREE.Color("#8866dd");
    const cOuter = new THREE.Color("#5544aa");

    function add(x, y, z, size, color) {
      const i3 = idx * 3;
      posArr[i3] = origArr[i3] = x;
      posArr[i3 + 1] = origArr[i3 + 1] = y;
      posArr[i3 + 2] = origArr[i3 + 2] = z;
      sizeArr[idx] = size;
      colArr[i3] = color.r; colArr[i3 + 1] = color.g; colArr[i3 + 2] = color.b;
      idx++;
    }

    function gauss() {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    // 螺旋臂
    for (let arm = 0; arm < ARMS; arm++) {
      const armAngle = (arm / ARMS) * Math.PI * 2;
      for (let i = 0; i < PER_ARM; i++) {
        const t = i / PER_ARM;
        const r = RADIUS_MIN + t * (RADIUS_MAX - RADIUS_MIN);
        const spiralAngle = armAngle + t * Math.PI * 2.5;
        const spread = (Math.random() - 0.5) * 0.45 * (0.3 + t * 0.7);
        const angle = spiralAngle + spread;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = (Math.random() - 0.5) * 0.5 * (1 - t * 0.7);
        const tc = t * 0.7 + Math.random() * 0.3;
        const color = tc < 0.3
          ? cInner.clone().lerp(cMid, tc / 0.3)
          : cMid.clone().lerp(cOuter, (tc - 0.3) / 0.7);
        // 锐利小尺寸粒子
        add(x, y, z, 0.35 + Math.random() * 1.0 * (1 - t * 0.5), color);
      }
    }

    // 核心密集区
    for (let i = 0; i < CORE; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.abs(gauss() * 2.2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = (Math.random() - 0.5) * 0.35;
      add(x, y, z, 0.2 + Math.random() * 0.7,
        cInner.clone().lerp(new THREE.Color("#aaccff"), Math.random() * 0.6));
    }

    // 轨道环
    for (let ring = 0; ring < RINGS; ring++) {
      const rr = 6.5 + ring * 4.5;
      const ry = (ring - 1) * 0.25;
      for (let i = 0; i < PER_RING; i++) {
        const a = (i / PER_RING) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
        const r = rr + (Math.random() - 0.5) * 0.6;
        add(Math.cos(a) * r, ry + (Math.random() - 0.5) * 0.2, Math.sin(a) * r,
          0.18 + Math.random() * 0.35,
          ring === 0 ? cInner : ring === 1 ? cMid : cOuter);
      }
    }

    // 背景星场
    for (let i = 0; i < BG; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 16 + Math.random() * 22;
      const x = Math.cos(a) * r + (Math.random() - 0.5) * 28;
      const z = Math.sin(a) * r + (Math.random() - 0.5) * 28;
      const y = (Math.random() - 0.5) * 7;
      const dim = 0.15 + Math.random() * 0.25;
      add(x, y, z, 0.08 + Math.random() * 0.15,
        new THREE.Color(dim * 0.5, dim * 0.6, dim));
    }

    // BufferGeometry
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute("aOriginalPos", new THREE.BufferAttribute(origArr, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizeArr, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colArr, 3));

    const shaders = this.createGalaxyShader();
    this.galaxyUniforms = {
      uMouseWorld: { value: new THREE.Vector3(9999, 0, 9999) },
      uMouseStrength: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: shaders.vertexShader,
      fragmentShader: shaders.fragmentShader,
      uniforms: this.galaxyUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.galaxyPoints = new THREE.Points(geo, mat);
    this.scene.add(this.galaxyPoints);
    this.totalParticles = total;
  }

  // ==================== 中心光晕环 ====================
  createCoreHalo() {
    const ringGeo = new THREE.TorusGeometry(2.4, 0.05, 32, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3355aa, transparent: true, opacity: 0.25
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.name = "coreHalo";
    this.scene.add(ring);

    // 内圈亮点
    const n = 200;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const tex = this.createSharpGlowTexture();
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.18, map: tex, color: 0x8899dd,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6
    }));
    pts.name = "coreHaloPts";
    this.scene.add(pts);
  }

  // ==================== 鼠标跟踪 ====================
  onMouseMove(e) {
    const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    this.mouseNdc.set(ndcX, ndcY);

    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.galaxyPlane, hit)) {
      this.mouseWorld.copy(hit);
    }

    // 光标光晕 - 保持但缩小
    if (this.cursorGlow) {
      this.cursorGlow.style.left = e.clientX + "px";
      this.cursorGlow.style.top = e.clientY + "px";
      this.cursorGlow.style.opacity = "1";
    }
  }

  onMouseLeave() {
    this.mouseWorld.set(9999, 0, 9999);
    if (this.cursorGlow) this.cursorGlow.style.opacity = "0";
  }

  // ==================== 页面转场（保持原有接口） ====================
  pageTransition(type) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    if (type === "out") {
      gsap.to(this.camera.position, {
        z: 8, duration: 0.45, ease: "power2.in",
        onComplete: () => { this.isTransitioning = false; }
      });
    } else {
      gsap.to(this.camera.position, {
        z: this.cameraBaseZ, duration: 0.8, ease: "power2.out",
        onComplete: () => { this.isTransitioning = false; }
      });
    }
  }

  // ==================== 窗口适配 ====================
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.galaxyUniforms) {
      this.galaxyUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }
  }

  // ==================== 渲染循环 ====================
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;

    // 更新着色器uniform
    if (this.galaxyUniforms) {
      this.galaxyUniforms.uTime.value = time;
      this.galaxyUniforms.uMouseWorld.value.copy(this.mouseWorld);
      // 平滑过渡引力强度
      const cur = this.galaxyUniforms.uMouseStrength.value;
      const target = this.mouseWorld.x < 999 ? 3.5 : 0;
      this.galaxyUniforms.uMouseStrength.value += (target - cur) * 0.06;
    }

    // 中心光晕缓慢旋转
    const halo = this.scene.getObjectByName("coreHalo");
    if (halo) halo.rotation.z += dt * 0.025;
    const haloPts = this.scene.getObjectByName("coreHaloPts");
    if (haloPts) haloPts.rotation.y += dt * 0.04;

    // 微弱鼠标视差偏移（不被转场打断时）
    if (!this.isTransitioning) {
      const tx = this.mouseNdc.x * 2.5;
      const ty = this.mouseNdc.y * 1.5;
      this.camera.position.x += (tx - this.camera.position.x) * 0.015;
      this.camera.position.y += (ty - this.camera.position.y) * 0.015;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.StarfieldEngine = StarfieldEngine;



