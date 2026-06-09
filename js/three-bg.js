// ============================================================
// CS - Galaxy Starfield Engine v4
// 螺旋星系 + 4大主题场景 + 相机转场 + 锐利粒子
// ============================================================

class StarfieldEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.galaxyPoints = null;
    this.galaxyUniforms = null;
    this.themeGroups = {};
    this.activeTheme = null;
    this.mouseWorld = new THREE.Vector3(9999, 0, 9999);
    this.mouseNdc = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this.isTransitioning = false;
    this.cameraBase = { pos: new THREE.Vector3(0, 20, 30), target: new THREE.Vector3(0, 0, 0) };
    this.camFrom = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.lookFrom = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.camProgress = 1;
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
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 200);
    this.camera.position.copy(this.cameraBase.pos);
    this.camera.lookAt(this.cameraBase.target);

    this.createGalaxy();
    this.createCoreHalo();
    this.createThemeScenes();

    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("mousemove", (e) => this.onMouseMove(e));
    window.addEventListener("mouseleave", () => this.onMouseLeave());
    this.animate();
  }

  // ==================== 纹理 ====================
  createTex() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.08, "rgba(255,255,255,0.95)");
    g.addColorStop(0.15, "rgba(180,210,255,0.45)");
    g.addColorStop(0.35, "rgba(80,120,255,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // ==================== 着色器 ====================
  createShader() {
    return {
      vertexShader: `
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
          pos.x += sin(pos.z * 0.25 + uTime * 0.35) * 0.12;
          pos.z += cos(pos.x * 0.25 + uTime * 0.35) * 0.12;
          vec3 toMouse = uMouseWorld - pos;
          float dist = length(toMouse);
          float gravity = uMouseStrength / (1.0 + dist * dist * 0.005);
          pos += normalize(toMouse) * gravity;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          float size = aSize * (160.0 / -mv.z) * uPixelRatio;
          size *= (1.0 + gravity * 0.6);
          float cd = length(uMouseWorld);
          float cb = 1.0 - smoothstep(0.0, 4.0, cd);
          size *= (1.0 + cb * 1.5);
          gl_PointSize = clamp(size, 0.3, 18.0);
          gl_Position = projectionMatrix * mv;
          vColor = aColor * (1.0 + cb * 1.5 + gravity * 0.3);
          vAlpha = 0.85 * (1.0 + cb * 0.5);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float alpha = 1.0 - smoothstep(0.0, 0.52, d);
          alpha = pow(alpha, 1.25);
          float glow = exp(-d * 7.0) * 0.03;
          gl_FragColor = vec4(vColor * (1.0 + glow), vAlpha * alpha);
        }
      `
    };
  }

  // ==================== 星系 ====================
  createGalaxy() {
    const ARMS = 5, PA = 1400, CORE = 800, RINGS = 3, PR = 500, BG = 1800;
    const total = ARMS * PA + CORE + RINGS * PR + BG;
    const pa = new Float32Array(total * 3), oa = new Float32Array(total * 3);
    const sa = new Float32Array(total), ca = new Float32Array(total * 3);
    let idx = 0;
    const ci = new THREE.Color("#6688ee"), cm = new THREE.Color("#8866dd"), co = new THREE.Color("#5544aa");

    function add(x, y, z, s, c) {
      const i3 = idx * 3;
      pa[i3] = oa[i3] = x; pa[i3 + 1] = oa[i3 + 1] = y; pa[i3 + 2] = oa[i3 + 2] = z;
      sa[idx] = s; ca[i3] = c.r; ca[i3 + 1] = c.g; ca[i3 + 2] = c.b; idx++;
    }

    function gauss() { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

    // 臂
    for (let arm = 0; arm < ARMS; arm++) {
      const aa = (arm / ARMS) * Math.PI * 2;
      for (let i = 0; i < PA; i++) {
        const t = i / PA, r = 2 + t * 16;
        const sa = aa + t * Math.PI * 2.5 + (Math.random() - 0.5) * 0.45 * (0.3 + t * 0.7);
        const x = Math.cos(sa) * r, z = Math.sin(sa) * r;
        const y = (Math.random() - 0.5) * 0.5 * (1 - t * 0.7);
        const tc = t * 0.7 + Math.random() * 0.3;
        add(x, y, z, 0.35 + Math.random() * 1.0 * (1 - t * 0.5),
          tc < 0.3 ? ci.clone().lerp(cm, tc / 0.3) : cm.clone().lerp(co, (tc - 0.3) / 0.7));
      }
    }
    // 核心
    for (let i = 0; i < CORE; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.abs(gauss() * 2.2);
      add(Math.cos(a) * r, (Math.random() - 0.5) * 0.35, Math.sin(a) * r,
        0.2 + Math.random() * 0.7, ci.clone().lerp(new THREE.Color("#aaccff"), Math.random() * 0.6));
    }
    // 环
    for (let ring = 0; ring < RINGS; ring++) {
      const rr = 6.5 + ring * 4.5, ry = (ring - 1) * 0.25;
      for (let i = 0; i < PR; i++) {
        const a = (i / PR) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
        const r = rr + (Math.random() - 0.5) * 0.6;
        add(Math.cos(a) * r, ry + (Math.random() - 0.5) * 0.2, Math.sin(a) * r,
          0.18 + Math.random() * 0.35, ring === 0 ? ci : ring === 1 ? cm : co);
      }
    }
    // 背景
    for (let i = 0; i < BG; i++) {
      const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 22;
      add(Math.cos(a) * r + (Math.random() - 0.5) * 28, (Math.random() - 0.5) * 7,
        Math.sin(a) * r + (Math.random() - 0.5) * 28, 0.08 + Math.random() * 0.15,
        new THREE.Color(0.08, 0.1, 0.15 + Math.random() * 0.1));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pa, 3));
    geo.setAttribute("aOriginalPos", new THREE.BufferAttribute(oa, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sa, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(ca, 3));

    this.galaxyUniforms = {
      uMouseWorld: { value: new THREE.Vector3(9999, 0, 9999) },
      uMouseStrength: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    };

    const sh = this.createShader();
    const mat = new THREE.ShaderMaterial({
      vertexShader: sh.vertexShader, fragmentShader: sh.fragmentShader,
      uniforms: this.galaxyUniforms, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });

    this.galaxyPoints = new THREE.Points(geo, mat);
    this.scene.add(this.galaxyPoints);
  }

  createCoreHalo() {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.05, 32, 100),
      new THREE.MeshBasicMaterial({ color: 0x3355aa, transparent: true, opacity: 0.25 }));
    ring.rotation.x = Math.PI * 0.5; ring.name = "coreHalo"; this.scene.add(ring);

    const n = 200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 2;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (Math.random() - 0.5) * 0.15; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.18, map: this.createTex(), color: 0x8899dd,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6
    }));
    pts.name = "coreHaloPts"; this.scene.add(pts);
  }

  // ==================== 4大主题场景 ====================
  createThemeScenes() {
    const tex = this.createTex();

    // DNA场景
    (() => {
      const g = new THREE.Group();
      const n = 800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 4, r = 1.5, s = i % 2 === 0 ? 1 : -1;
        pos[i * 3] = Math.cos(t) * r * s;
        pos[i * 3 + 1] = (t / (Math.PI * 4) - 0.5) * 10;
        pos[i * 3 + 2] = Math.sin(t) * r * s;
        const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.7, 0.5 + Math.random() * 0.3);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.2, map: tex, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      for (let i = 0; i < 40; i++) {
        const t = (i / 40) * Math.PI * 4, y = (t / (Math.PI * 4) - 0.5) * 10, r = 1.5;
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-Math.cos(t) * r, y, -Math.sin(t) * r), new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r)
        ]), new THREE.LineBasicMaterial({ color: 0x4488cc, transparent: true, opacity: 0.3 })));
      }
      g.visible = false; g.position.set(0, 0, -10);
      this.scene.add(g); this.themeGroups.dna = g;
    })();

    // 工程几何场景
    (() => {
      const g = new THREE.Group();
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.5, 1)),
        new THREE.LineBasicMaterial({ color: 0x6688cc, transparent: true, opacity: 0.5 })));
      const t = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TorusGeometry(3, 0.08, 16, 64)),
        new THREE.LineBasicMaterial({ color: 0x8866dd, transparent: true, opacity: 0.4 }));
      t.rotation.x = Math.PI * 0.5; g.add(t);
      const orbN = 500, orbPos = new Float32Array(orbN * 3);
      for (let i = 0; i < orbN; i++) {
        const a = (i / orbN) * Math.PI * 2, r = 3.5 + Math.sin(i * 0.5) * 0.5;
        orbPos[i * 3] = Math.cos(a) * r; orbPos[i * 3 + 1] = (Math.random() - 0.5) * 0.3; orbPos[i * 3 + 2] = Math.sin(a) * r;
      }
      const orbGeo = new THREE.BufferGeometry();
      orbGeo.setAttribute("position", new THREE.BufferAttribute(orbPos, 3));
      g.add(new THREE.Points(orbGeo, new THREE.PointsMaterial({ size: 0.12, map: tex, color: 0x8899ee, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      g.visible = false; g.position.set(-8, 3, -10);
      this.scene.add(g); this.themeGroups.engineering = g;
    })();

    // WEB3网络场景
    (() => {
      const g = new THREE.Group();
      const nodes = [], nCount = 200;
      for (let i = 0; i < nCount; i++) {
        nodes.push(new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
      }
      const pos = new Float32Array(nCount * 3);
      nodes.forEach((n, i) => { pos[i * 3] = n.x; pos[i * 3 + 1] = n.y; pos[i * 3 + 2] = n.z; });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: tex, color: 0x9977ee, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      for (let i = 0; i < nCount; i++)
        for (let j = i + 1; j < nCount; j++)
          if (nodes[i].distanceTo(nodes[j]) < 2.0 && Math.random() < 0.08)
            g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([nodes[i], nodes[j]]),
              new THREE.LineBasicMaterial({ color: 0x6655cc, transparent: true, opacity: 0.18 })));
      g.visible = false; g.position.set(10, 2, -8);
      this.scene.add(g); this.themeGroups.web3 = g;
    })();

    // 数据星云场景
    (() => {
      const g = new THREE.Group();
      const n = 1200, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
        const r = 1.5 + Math.abs(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * 3);
        pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
        pos[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * r;
        pos[i * 3 + 2] = Math.cos(ph) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.14, map: tex, color: 0xccaaff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      g.visible = false; g.position.set(5, -2, -12);
      this.scene.add(g); this.themeGroups.data = g;
    })();
  }

  // ==================== 相机转场系统 ====================
  sceneTargets = {
    galaxy: { pos: [0, 20, 30], look: [0, 0, 0] },
    dna: { pos: [0, 0, 6], look: [0, 0, -10] },
    engineering: { pos: [-6, 5, 0], look: [-8, 3, -10] },
    web3: { pos: [12, 4, -2], look: [10, 2, -8] },
    data: { pos: [7, -1, -4], look: [5, -2, -12] },
  };

  // 页面到主题场景的映射
  pageToScene = {
    upload: "dna",
    "edit-resource": "dna",
    feed: "engineering",
    search: "data",
    friends: "web3",
    chat: "web3",
    profile: "data",
    admin: "engineering",
  };

  transitionTo(page, callback) {
    const sceneName = this.pageToScene[page] || "galaxy";
    this.activeTheme = sceneName;

    // 隐藏所有主题场景
    Object.values(this.themeGroups).forEach(g => g.visible = false);
    if (sceneName !== "galaxy" && this.themeGroups[sceneName]) {
      this.themeGroups[sceneName].visible = true;
    }

    // 星系亮度
    if (this.galaxyUniforms) {
      this.galaxyUniforms.uGlobalBrightness = this.galaxyUniforms.uGlobalBrightness || { value: 1.0 };
      this.galaxyUniforms.uGlobalBrightness.value = sceneName === "galaxy" ? 1.0 : 0.3;
    }

    const tgt = this.sceneTargets[sceneName];
    this.camFrom.copy(this.camera.position);
    this.lookFrom.copy(this.targetLookAt || new THREE.Vector3(0, 0, 0));
    this.camTarget.set(...tgt.pos);
    this.lookTarget.set(...tgt.look);
    this.camProgress = 0;
    this.isTransitioning = true;
    this._transitionCallback = callback;
  }

  resetToGalaxy(callback) {
    this.activeTheme = "galaxy";
    Object.values(this.themeGroups).forEach(g => g.visible = false);
    if (this.galaxyUniforms && this.galaxyUniforms.uGlobalBrightness) {
      this.galaxyUniforms.uGlobalBrightness.value = 1.0;
    }
    const tgt = this.sceneTargets.galaxy;
    this.camFrom.copy(this.camera.position);
    this.lookFrom.copy(this.targetLookAt || new THREE.Vector3(0, 0, 0));
    this.camTarget.set(...tgt.pos);
    this.lookTarget.set(...tgt.look);
    this.camProgress = 0;
    this.isTransitioning = true;
    this._transitionCallback = callback;
  }

  // ==================== 鼠标 ====================
  onMouseMove(e) {
    this.mouseNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.galaxyPlane, hit)) this.mouseWorld.copy(hit);
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

  pageTransition(type) {
    // 保持兼容旧接口（router调用），由router.js管理转场
    // 此处改为极简推拉效果
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    if (type === "out") {
      gsap.to(this.camera.position, { z: 8, duration: 0.4, ease: "power2.in" });
    } else {
      gsap.to(this.camera.position, {
        z: this.cameraBase.pos.z, duration: 0.7, ease: "power2.out",
        onComplete: () => { this.isTransitioning = false; }
      });
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.galaxyUniforms) {
      this.galaxyUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }
  }

  // ==================== 渲染 ====================
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;

    // 更新星系shader
    if (this.galaxyUniforms) {
      this.galaxyUniforms.uTime.value = time;
      this.galaxyUniforms.uMouseWorld.value.copy(this.mouseWorld);
      const cur = this.galaxyUniforms.uMouseStrength.value;
      const target = this.mouseWorld.x < 999 ? 3.5 : 0;
      this.galaxyUniforms.uMouseStrength.value += (target - cur) * 0.06;
    }

    // 相机转场动画
    if (this.camProgress < 1) {
      this.camProgress += dt * 1.0;
      this.camProgress = Math.min(this.camProgress, 1);
      const t = this.ease(this.camProgress);
      this.camera.position.lerpVectors(this.camFrom, this.camTarget, t);
      const lookNow = new THREE.Vector3().lerpVectors(this.lookFrom, this.lookTarget, t);
      this.camera.lookAt(lookNow);
      this.targetLookAt = lookNow;
      if (this.camProgress >= 1) {
        this.isTransitioning = false;
        if (this._transitionCallback) {
          const cb = this._transitionCallback;
          this._transitionCallback = null;
          cb();
        }
      }
    }

    // 主题场景旋转
    if (this.themeGroups.dna?.visible) this.themeGroups.dna.rotation.y += dt * 0.35;
    if (this.themeGroups.web3?.visible) this.themeGroups.web3.rotation.y += dt * 0.22;
    if (this.themeGroups.engineering?.visible) {
      this.themeGroups.engineering.children.forEach((c, i) => {
        c.rotation.y += dt * 0.25 * (i + 1) * 0.5;
        c.rotation.x += dt * 0.12 * (i % 2 ? -1 : 1);
      });
    }
    if (this.themeGroups.data?.visible) this.themeGroups.data.rotation.y += dt * 0.14;

    const halo = this.scene.getObjectByName("coreHalo");
    if (halo) halo.rotation.z += dt * 0.025;
    const haloPts = this.scene.getObjectByName("coreHaloPts");
    if (haloPts) haloPts.rotation.y += dt * 0.04;

    if (!this.isTransitioning) {
      this.camera.position.x += (this.mouseNdc.x * 2.5 - this.camera.position.x + this.camTarget.x) * 0.01;
      this.camera.position.y += (this.mouseNdc.y * 1.5 - this.camera.position.y + this.camTarget.y) * 0.01;
    }

    this.renderer.render(this.scene, this.camera);
  }

  ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
}

window.StarfieldEngine = StarfieldEngine;
