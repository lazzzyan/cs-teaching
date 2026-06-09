// ============================================================
// CS - Galaxy Engine v6
// 星系固定自转 + 鼠标粒子引力 + 零转场
// ============================================================

const CFG = {
  ROTATE_PERIOD: 30,          // 自转一圈秒数
  GRAVITY: 2.2,               // 引力强度（柔和）
  GLOW: 0.045,                // 辉光
  SIZE_BASE: 220, SIZE_MAX: 22,
};

class StarfieldEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null; this.scene = null; this.camera = null;
    this.galaxyPoints = null; this.galaxyUniforms = null;
    this.mouseWorld = new THREE.Vector3(9999, 0, 9999);
    this.mouseNdc = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this.autoAngle = 0;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.init();
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, alpha: true, premultipliedAlpha: false,
      antialias: true, powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 200);
    this.camera.position.set(0, 20, 28);
    this.camera.lookAt(0, 0, 0);

    this.buildGalaxy();
    this.buildHalo();

    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("mousemove", (e) => this.onMouse(e));
    window.addEventListener("mouseleave", () => { this.mouseWorld.set(9999, 0, 9999); });
    this.loop();
  }

  // ---- 纹理 ----
  tex() {
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

  // ---- 着色器 ----
  shader() {
    const S = CFG.SIZE_BASE, M = CFG.SIZE_MAX, G = CFG.GLOW;
    return {
      vertex: `
        attribute vec3 aOrig; attribute float aSz; attribute vec3 aCol;
        uniform vec3 uMouse; uniform float uStr; uniform float uTime; uniform float uPR;
        varying vec3 vCol; varying float vA;
        void main() {
          vec3 p = aOrig;
          p.x += sin(p.z*0.25+uTime*0.35)*0.12;
          p.z += cos(p.x*0.25+uTime*0.35)*0.12;
          vec3 d = uMouse - p; float dist = length(d);
          float gv = uStr/(1.0+dist*dist*0.005);
          p += normalize(d)*gv;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          float sz = aSz*(${S}.0/-mv.z)*uPR;
          sz *= (1.0+gv*0.6);
          float cd = length(uMouse);
          float cb = 1.0-smoothstep(0.0,4.0,cd);
          sz *= (1.0+cb*1.5);
          gl_PointSize = clamp(sz,0.3,${M}.0);
          gl_Position = projectionMatrix*mv;
          vCol = aCol*(1.0+cb*1.5+gv*0.3);
          vA = 0.85*(1.0+cb*0.5);
        }`,
      fragment: `
        varying vec3 vCol; varying float vA;
        void main() {
          float d = length(gl_PointCoord-0.5)*2.0;
          float a = 1.0-smoothstep(0.0,0.5,d);
          a = pow(a,1.05);
          float gl = exp(-d*8.0)*${G};
          gl_FragColor = vec4(vCol*(1.0+gl),vA*a);
        }`
    };
  }

  // ---- 星系 ----
  buildGalaxy() {
    const A = 5, PA = 1400, C = 800, R = 3, PR = 500, BG = 1800;
    const total = A * PA + C + R * PR + BG;
    const pa = new Float32Array(total * 3), oa = new Float32Array(total * 3);
    const sa = new Float32Array(total), ca = new Float32Array(total * 3);
    let idx = 0;
    const ci = new THREE.Color("#6688ee"), cm = new THREE.Color("#8866dd"), co = new THREE.Color("#5544aa");
    function add(x, y, z, s, c) {
      const i3 = idx * 3;
      pa[i3] = oa[i3] = x; pa[i3 + 1] = oa[i3 + 1] = y; pa[i3 + 2] = oa[i3 + 2] = z;
      sa[idx] = s; ca[i3] = c.r; ca[i3 + 1] = c.g; ca[i3 + 2] = c.b; idx++;
    }
    function gr() { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

    for (let arm = 0; arm < A; arm++) {
      const aa = (arm / A) * Math.PI * 2;
      for (let i = 0; i < PA; i++) {
        const t = i / PA, r = 2 + t * 16;
        const sa = aa + t * Math.PI * 2.5 + (Math.random() - 0.5) * 0.45 * (0.3 + t * 0.7);
        const x = Math.cos(sa) * r, z = Math.sin(sa) * r, y = (Math.random() - 0.5) * 0.5 * (1 - t * 0.7);
        const tc = t * 0.7 + Math.random() * 0.3;
        add(x, y, z, 0.35 + Math.random() * 1.0 * (1 - t * 0.5),
          tc < 0.3 ? ci.clone().lerp(cm, tc / 0.3) : cm.clone().lerp(co, (tc - 0.3) / 0.7));
      }
    }
    for (let i = 0; i < C; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.abs(gr() * 2.2);
      add(Math.cos(a) * r, (Math.random() - 0.5) * 0.35, Math.sin(a) * r, 0.2 + Math.random() * 0.7,
        ci.clone().lerp(new THREE.Color("#aaccff"), Math.random() * 0.6));
    }
    for (let ring = 0; ring < R; ring++) {
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
    geo.setAttribute("aOrig", new THREE.BufferAttribute(oa, 3));
    geo.setAttribute("aSz", new THREE.BufferAttribute(sa, 1));
    geo.setAttribute("aCol", new THREE.BufferAttribute(ca, 3));

    this.galaxyUniforms = {
      uMouse: { value: new THREE.Vector3(9999, 0, 9999) },
      uStr: { value: 0 },
      uTime: { value: 0 },
      uPR: { value: Math.min(window.devicePixelRatio, 2) },
    };

    const sh = this.shader();
    this.galaxyPoints = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: sh.vertex, fragmentShader: sh.fragment,
      uniforms: this.galaxyUniforms, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.scene.add(this.galaxyPoints);
  }

  buildHalo() {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.05, 32, 100),
      new THREE.MeshBasicMaterial({ color: 0x3355aa, transparent: true, opacity: 0.25 }));
    r.rotation.x = Math.PI * 0.5; r.name = "halo"; this.scene.add(r);
    const n = 200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rr = 0.5 + Math.random() * 2;
      pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = (Math.random() - 0.5) * 0.15; pos[i * 3 + 2] = Math.sin(a) * rr;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.18, map: this.tex(), color: 0x8899dd,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6
    }));
    p.name = "haloPts"; this.scene.add(p);
  }

  // ---- 鼠标 ----
  onMouse(e) {
    this.mouseNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.plane, hit)) this.mouseWorld.copy(hit);
    const gl = document.getElementById("cursor-glow");
    if (gl) { gl.style.left = e.clientX + "px"; gl.style.top = e.clientY + "px"; gl.style.opacity = "1"; }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.galaxyUniforms) this.galaxyUniforms.uPR.value = Math.min(window.devicePixelRatio, 2);
  }

  // ---- 循环 ----
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;

    if (this.galaxyUniforms) {
      this.galaxyUniforms.uTime.value = time;
      this.galaxyUniforms.uMouse.value.copy(this.mouseWorld);
      const cur = this.galaxyUniforms.uStr.value;
      const tgt = this.mouseWorld.x < 999 ? CFG.GRAVITY : 0;
      this.galaxyUniforms.uStr.value += (tgt - cur) * 0.06;
    }

    // 匀速自转
    const speed = (2 * Math.PI) / CFG.ROTATE_PERIOD;
    this.autoAngle += speed * dt;
    const dist = Math.sqrt(this.camera.position.x ** 2 + this.camera.position.z ** 2);
    this.camera.position.x = Math.sin(this.autoAngle) * dist;
    this.camera.position.z = Math.cos(this.autoAngle) * dist;
    this.camera.lookAt(0, 0, 0);

    const halo = this.scene.getObjectByName("halo");
    if (halo) halo.rotation.z += dt * 0.025;
    const hp = this.scene.getObjectByName("haloPts");
    if (hp) hp.rotation.y += dt * 0.04;

    this.renderer.render(this.scene, this.camera);
  }
}

window.StarfieldEngine = StarfieldEngine;
