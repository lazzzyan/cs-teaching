// ============================================================
// CS - Galaxy Engine v5
// 星系原点锁定 + GSAP平滑转场 + 参数化配置
// ============================================================

// ==================== 动画参数（方便微调） ====================
const CFG = {
  AUTO_ROTATE_PERIOD: 25,       // 星系自转一圈秒数
  GRAVITY_STRENGTH: 2.45,      // 鼠标引力强度（下调30%）
  GLOW_INTENSITY: 0.02,        // 粒子辉光强度
  TRANSITION_MS: 1000,         // 相机转场时长ms
  TRANSITION_EASE: "power2.out",
  PARTICLE_SIZE_BASE: 140,     // 粒子基础尺寸缩放
  PARTICLE_SIZE_MAX: 16,       // 粒子最大像素
  CAMERA_DISTANCE: 28,         // 星系视图相机距中心距离
  CAMERA_HEIGHT: 20,           // 星系视图相机高度
};

class StarfieldEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.galaxyPoints = null;
    this.galaxyUniforms = null;
    this.themeGroups = {};
    this.activeTheme = "galaxy";
    this.state = "galaxy";        // "galaxy" | "transitioning" | "theme"
    this.mouseWorld = new THREE.Vector3(9999, 0, 9999);
    this.mouseNdc = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this.cursorGlow = document.getElementById("cursor-glow");
    this.raycaster = new THREE.Raycaster();
    this.galaxyPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.autoRotateAngle = 0;     // 自转累计角度
    this.lookProxy = { x: 0, y: 0, z: 0 };  // GSAP动画代理对象
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

    // 相机初始位置：俯视星系
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 200);
    this.camera.position.set(0, CFG.CAMERA_HEIGHT, CFG.CAMERA_DISTANCE);
    this.camera.lookAt(0, 0, 0);

    this.createGalaxy();
    this.createCoreHalo();
    this.createThemeScenes();

    // 初始化lookProxy
    this.lookProxy.x = 0; this.lookProxy.y = 0; this.lookProxy.z = 0;

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
    g.addColorStop(0.06, "rgba(255,255,255,0.9)");
    g.addColorStop(0.12, "rgba(160,200,255,0.4)");
    g.addColorStop(0.3, "rgba(60,100,220,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // ==================== 着色器 ====================
  createShader() {
    return {
      vertexShader: /* glsl */`
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
          // 粒子原始位置（星系原点锁定在(0,0,0)，永不偏移）
          vec3 pos = aOriginalPos;
          // 微弱流动扰动
          pos.x += sin(pos.z * 0.25 + uTime * 0.35) * 0.12;
          pos.z += cos(pos.x * 0.25 + uTime * 0.35) * 0.12;
          // 黑洞引力：仅影响粒子局部形态，不移动星系原点
          vec3 toMouse = uMouseWorld - pos;
          float dist = length(toMouse);
          float gravity = uMouseStrength / (1.0 + dist * dist * 0.005);
          pos += normalize(toMouse) * gravity;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          float size = aSize * (${CFG.PARTICLE_SIZE_BASE}.0 / -mv.z) * uPixelRatio;
          size *= (1.0 + gravity * 0.6);
          float cd = length(uMouseWorld);
          float cb = 1.0 - smoothstep(0.0, 4.0, cd);
          size *= (1.0 + cb * 1.5);
          gl_PointSize = clamp(size, 0.3, ${CFG.PARTICLE_SIZE_MAX}.0);
          gl_Position = projectionMatrix * mv;
          vColor = aColor * (1.0 + cb * 1.5 + gravity * 0.3);
          vAlpha = 0.85 * (1.0 + cb * 0.5);
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float alpha = 1.0 - smoothstep(0.0, 0.5, d);
          alpha = pow(alpha, 1.3);
          float glow = exp(-d * 8.0) * ${CFG.GLOW_INTENSITY};
          gl_FragColor = vec4(vColor * (1.0 + glow), vAlpha * alpha);
        }
      `
    };
  }

  // ==================== 星系构建 ====================
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

    for (let arm = 0; arm < ARMS; arm++) {
      const aa = (arm / ARMS) * Math.PI * 2;
      for (let i = 0; i < PA; i++) {
        const t = i / PA, r = 2 + t * 16;
        const sa = aa + t * Math.PI * 2.5 + (Math.random() - 0.5) * 0.45 * (0.3 + t * 0.7);
        const x = Math.cos(sa) * r, z = Math.sin(sa) * r, y = (Math.random() - 0.5) * 0.5 * (1 - t * 0.7);
        const tc = t * 0.7 + Math.random() * 0.3;
        add(x, y, z, 0.35 + Math.random() * 1.0 * (1 - t * 0.5),
          tc < 0.3 ? ci.clone().lerp(cm, tc / 0.3) : cm.clone().lerp(co, (tc - 0.3) / 0.7));
      }
    }
    for (let i = 0; i < CORE; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.abs(gauss() * 2.2);
      add(Math.cos(a) * r, (Math.random() - 0.5) * 0.35, Math.sin(a) * r, 0.2 + Math.random() * 0.7,
        ci.clone().lerp(new THREE.Color("#aaccff"), Math.random() * 0.6));
    }
    for (let ring = 0; ring < RINGS; ring++) {
      const rr = 6.5 + ring * 4.5, ry = (ring - 1) * 0.25;
      for (let i = 0; i < PR; i++) {
        const a = (i / PR) * Math.PI * 2 + (Math.random() - 0.5) * 0.12, r = rr + (Math.random() - 0.5) * 0.6;
        add(Math.cos(a) * r, ry + (Math.random() - 0.5) * 0.2, Math.sin(a) * r, 0.18 + Math.random() * 0.35,
          ring === 0 ? ci : ring === 1 ? cm : co);
      }
    }
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
    this.galaxyPoints = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: sh.vertexShader, fragmentShader: sh.fragmentShader,
      uniforms: this.galaxyUniforms, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
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
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.18, map: this.createTex(), color: 0x8899dd,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6
    }));
    pts.name = "coreHaloPts"; this.scene.add(pts);
  }

  // ==================== 4大主题场景 ====================
  createThemeScenes() {
    const tex = this.createTex();

    // DNA
    (() => {
      const g = new THREE.Group(); const n = 800;
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 4, r = 1.5, s = i % 2 === 0 ? 1 : -1;
        pos[i * 3] = Math.cos(t) * r * s; pos[i * 3 + 1] = (t / (Math.PI * 4) - 0.5) * 10; pos[i * 3 + 2] = Math.sin(t) * r * s;
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
      g.visible = false; g.position.set(0, 0, -10); this.scene.add(g); this.themeGroups.dna = g;
    })();

    // 工程几何
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
      const oGeo = new THREE.BufferGeometry(); oGeo.setAttribute("position", new THREE.BufferAttribute(orbPos, 3));
      g.add(new THREE.Points(oGeo, new THREE.PointsMaterial({ size: 0.12, map: tex, color: 0x8899ee, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      g.visible = false; g.position.set(-8, 3, -10); this.scene.add(g); this.themeGroups.engineering = g;
    })();

    // WEB3
    (() => {
      const g = new THREE.Group(); const nodes = [], nCount = 200;
      for (let i = 0; i < nCount; i++) nodes.push(new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
      const pos = new Float32Array(nCount * 3);
      nodes.forEach((n, i) => { pos[i * 3] = n.x; pos[i * 3 + 1] = n.y; pos[i * 3 + 2] = n.z; });
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: tex, color: 0x9977ee, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      for (let i = 0; i < nCount; i++)
        for (let j = i + 1; j < nCount; j++)
          if (nodes[i].distanceTo(nodes[j]) < 2.0 && Math.random() < 0.08)
            g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([nodes[i], nodes[j]]),
              new THREE.LineBasicMaterial({ color: 0x6655cc, transparent: true, opacity: 0.18 })));
      g.visible = false; g.position.set(10, 2, -8); this.scene.add(g); this.themeGroups.web3 = g;
    })();

    // 数据星云
    (() => {
      const g = new THREE.Group(); const n = 1200, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
        const r = 1.5 + Math.abs(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * 3);
        pos[i * 3] = Math.sin(ph) * Math.cos(th) * r; pos[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * r; pos[i * 3 + 2] = Math.cos(ph) * r;
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.14, map: tex, color: 0xccaaff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      g.visible = false; g.position.set(5, -2, -12); this.scene.add(g); this.themeGroups.data = g;
    })();
  }

  // ==================== 场景目标坐标 ====================
  sceneTargets = {
    galaxy:   { pos: [0, CFG.CAMERA_HEIGHT, CFG.CAMERA_DISTANCE], look: [0, 0, 0] },
    dna:      { pos: [0, 0, 6],  look: [0, 0, -10] },
    engineering: { pos: [-6, 5, 0],  look: [-8, 3, -10] },
    web3:     { pos: [12, 4, -2], look: [10, 2, -8] },
    data:     { pos: [7, -1, -4], look: [5, -2, -12] },
  };

  pageToScene = {
    upload: "dna", "edit-resource": "dna",
    feed: "engineering", search: "data",
    friends: "web3", chat: "web3",
    profile: "data", admin: "engineering",
  };

  // ==================== GSAP平滑相机转场 ====================
  transitionTo(page, callback) {
    const sceneName = this.pageToScene[page] || "galaxy";
    this.activeTheme = sceneName;
    this.state = "transitioning";

    // 淡出当前场景
    Object.values(this.themeGroups).forEach(g => { g.visible = false; });
    if (this.galaxyUniforms) {
      // 星系亮度用GSAP动画过渡
      const curBright = this._galaxyBrightness || 1.0;
      const tgtBright = sceneName === "galaxy" ? 1.0 : 0.3;
      gsap.to(this, {
        _galaxyBrightness: tgtBright,
        duration: CFG.TRANSITION_MS / 1000,
        ease: CFG.TRANSITION_EASE,
        onUpdate: () => {
          if (this.galaxyUniforms) this.galaxyUniforms.uGlobalBrightness = this.galaxyUniforms.uGlobalBrightness || { value: 1 };
          if (this.galaxyUniforms.uGlobalBrightness) this.galaxyUniforms.uGlobalBrightness.value = this._galaxyBrightness;
        }
      });
    }

    const tgt = this.sceneTargets[sceneName];

    // 相机位置GSAP动画（平滑插值，无瞬移）
    gsap.to(this.camera.position, {
      x: tgt.pos[0], y: tgt.pos[1], z: tgt.pos[2],
      duration: CFG.TRANSITION_MS / 1000,
      ease: CFG.TRANSITION_EASE,
    });

    // lookAt代理对象GSAP动画
    const fromLook = { x: this.lookProxy.x, y: this.lookProxy.y, z: this.lookProxy.z };
    gsap.to(fromLook, {
      x: tgt.look[0], y: tgt.look[1], z: tgt.look[2],
      duration: CFG.TRANSITION_MS / 1000,
      ease: CFG.TRANSITION_EASE,
      onUpdate: () => {
        this.camera.lookAt(fromLook.x, fromLook.y, fromLook.z);
      },
      onComplete: () => {
        // 转场完成：显示目标场景，锁定相机
        this.lookProxy.x = tgt.look[0];
        this.lookProxy.y = tgt.look[1];
        this.lookProxy.z = tgt.look[2];
        this.camera.lookAt(this.lookProxy.x, this.lookProxy.y, this.lookProxy.z);
        if (sceneName !== "galaxy" && this.themeGroups[sceneName]) {
          this.themeGroups[sceneName].visible = true;
        }
        this.state = "theme";
        if (callback) callback();
      }
    });
  }

  // ==================== 返回星系视图 ====================
  resetToGalaxy(callback) {
    this.activeTheme = "galaxy";
    this.state = "transitioning";

    Object.values(this.themeGroups).forEach(g => { g.visible = false; });
    gsap.to(this, {
      _galaxyBrightness: 1.0,
      duration: CFG.TRANSITION_MS / 1000,
      ease: CFG.TRANSITION_EASE,
      onUpdate: () => {
        if (this.galaxyUniforms && this.galaxyUniforms.uGlobalBrightness)
          this.galaxyUniforms.uGlobalBrightness.value = this._galaxyBrightness;
      }
    });

    const tgt = this.sceneTargets.galaxy;
    gsap.to(this.camera.position, {
      x: tgt.pos[0], y: tgt.pos[1], z: tgt.pos[2],
      duration: CFG.TRANSITION_MS / 1000,
      ease: CFG.TRANSITION_EASE,
    });

    const fromLook = { x: this.lookProxy.x, y: this.lookProxy.y, z: this.lookProxy.z };
    gsap.to(fromLook, {
      x: 0, y: 0, z: 0,
      duration: CFG.TRANSITION_MS / 1000,
      ease: CFG.TRANSITION_EASE,
      onUpdate: () => { this.camera.lookAt(fromLook.x, fromLook.y, fromLook.z); },
      onComplete: () => {
        this.lookProxy.x = 0; this.lookProxy.y = 0; this.lookProxy.z = 0;
        this.camera.lookAt(0, 0, 0);
        this.autoRotateAngle = Math.atan2(this.camera.position.z, this.camera.position.x);
        this.state = "galaxy";
        if (callback) callback();
      }
    });
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

  // 兼容旧接口
  pageTransition(type) {
    if (type === "out") {
      gsap.to(this.camera.position, { z: 10, duration: 0.4, ease: "power2.in" });
    } else {
      gsap.to(this.camera.position, {
        z: CFG.CAMERA_DISTANCE, duration: 0.6, ease: "power2.out"
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

  // ==================== 渲染循环 ====================
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;

    // 更新shader
    if (this.galaxyUniforms) {
      this.galaxyUniforms.uTime.value = time;
      this.galaxyUniforms.uMouseWorld.value.copy(this.mouseWorld);
      const cur = this.galaxyUniforms.uMouseStrength.value;
      const target = this.mouseWorld.x < 999 ? CFG.GRAVITY_STRENGTH : 0;
      this.galaxyUniforms.uMouseStrength.value += (target - cur) * 0.06;
    }

    // 星系自转：仅在galaxy状态下，绕Y轴匀速旋转（每CFG.AUTO_ROTATE_PERIOD秒一圈）
    if (this.state === "galaxy") {
      const rotSpeed = (2 * Math.PI) / CFG.AUTO_ROTATE_PERIOD;
      this.autoRotateAngle += rotSpeed * dt;
      const dist = Math.sqrt(
        this.camera.position.x * this.camera.position.x +
        this.camera.position.z * this.camera.position.z
      );
      this.camera.position.x = Math.sin(this.autoRotateAngle) * dist;
      this.camera.position.z = Math.cos(this.autoRotateAngle) * dist;
      this.camera.lookAt(0, 0, 0);
      this.lookProxy.x = 0; this.lookProxy.y = 0; this.lookProxy.z = 0;
    }

    // 主题场景装饰旋转
    if (this.themeGroups.dna?.visible) this.themeGroups.dna.rotation.y += dt * 0.35;
    if (this.themeGroups.web3?.visible) this.themeGroups.web3.rotation.y += dt * 0.22;
    if (this.themeGroups.engineering?.visible) {
      this.themeGroups.engineering.children.forEach((c, i) => {
        c.rotation.y += dt * 0.25 * (i + 1) * 0.5;
        c.rotation.x += dt * 0.12 * (i % 2 ? -1 : 1);
      });
    }
    if (this.themeGroups.data?.visible) this.themeGroups.data.rotation.y += dt * 0.14;

    // 光晕旋转
    const halo = this.scene.getObjectByName("coreHalo");
    if (halo) halo.rotation.z += dt * 0.025;
    const haloPts = this.scene.getObjectByName("coreHaloPts");
    if (haloPts) haloPts.rotation.y += dt * 0.04;

    this.renderer.render(this.scene, this.camera);
  }
}

window.StarfieldEngine = StarfieldEngine;
