// Galaxy Engine v7 — 星系 + 4主题场景 + GSAP转场
const CFG = { ROTATE: 30, GRAVITY: 2.0, GLOW: 0.04, SIZE_BASE: 200, SIZE_MAX: 20, TRANS_MS: 1000 };

class StarfieldEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: false, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0, 0);

    this.scene = new THREE.Scene(); this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 200);
    this.camera.position.set(0, 16, 26); this.camera.lookAt(0, 0, 0);

    this.themeGroups = {}; this.activeTheme = "galaxy"; this.state = "galaxy";
    this.mouseWorld = new THREE.Vector3(9999, 0, 9999); this.mouseNdc = new THREE.Vector2();
    this.clock = new THREE.Clock(); this.autoAngle = 0;
    this.lookProxy = { x: 0, y: 0, z: 0 };
    this._galaxyBrightness = 1;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.buildGalaxy(); this.buildHalo(); this.buildThemes();
    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("mousemove", e => this.onMouse(e));
    window.addEventListener("mouseleave", () => { this.mouseWorld.set(9999, 0, 9999); });
    this.loop();
  }

  tex() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.06, "rgba(255,255,255,0.9)");
    g.addColorStop(0.12, "rgba(160,200,255,0.45)"); g.addColorStop(0.28, "rgba(60,100,220,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  shader() {
    const S = CFG.SIZE_BASE, M = CFG.SIZE_MAX, G = CFG.GLOW;
    return { vertex: `
      attribute vec3 aOrig; attribute float aSz; attribute vec3 aCol;
      uniform vec3 uMouse; uniform float uStr; uniform float uTime; uniform float uPR;
      varying vec3 vCol; varying float vA;
      void main() {
        vec3 p = aOrig;
        p.x += sin(p.z*0.25+uTime*0.35)*0.12; p.z += cos(p.x*0.25+uTime*0.35)*0.12;
        vec3 d = uMouse-p; float dist = length(d);
        float gv = uStr/(1.0+dist*dist*0.005); p += normalize(d)*gv;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        float sz = aSz*(${S}.0/-mv.z)*uPR; sz *= (1.0+gv*0.6);
        float cd = length(uMouse); float cb = 1.0-smoothstep(0.0,4.0,cd);
        sz *= (1.0+cb*1.5);
        gl_PointSize = clamp(sz,0.3,${M}.0); gl_Position = projectionMatrix*mv;
        vCol = aCol*(1.0+cb*1.5+gv*0.3); vA = 0.85*(1.0+cb*0.5);
      }`, fragment: `
      varying vec3 vCol; varying float vA;
      void main() {
        float d = length(gl_PointCoord-0.5)*2.0;
        float a = 1.0-smoothstep(0.0,0.5,d); a = pow(a,1.05);
        float gl = exp(-d*8.0)*${G}; gl_FragColor = vec4(vCol*(1.0+gl),vA*a);
      }`
    };
  }

  buildGalaxy() {
    const A = 5, PA = 1400, CORE = 800, R = 3, PR = 500, BG = 1800;
    const total = A * PA + CORE + R * PR + BG;
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
        add(x, y, z, 0.35 + Math.random() * 1.0 * (1 - t * 0.5), tc < 0.3 ? ci.clone().lerp(cm, tc / 0.3) : cm.clone().lerp(co, (tc - 0.3) / 0.7));
      }
    }
    for (let i = 0; i < CORE; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.abs(gr() * 2.2);
      add(Math.cos(a) * r, (Math.random() - 0.5) * 0.35, Math.sin(a) * r, 0.2 + Math.random() * 0.7, ci.clone().lerp(new THREE.Color("#aaccff"), Math.random() * 0.6));
    }
    for (let ring = 0; ring < R; ring++) {
      const rr = 6.5 + ring * 4.5, ry = (ring - 1) * 0.25;
      for (let i = 0; i < PR; i++) {
        const a = (i / PR) * Math.PI * 2 + (Math.random() - 0.5) * 0.12, r = rr + (Math.random() - 0.5) * 0.6;
        add(Math.cos(a) * r, ry + (Math.random() - 0.5) * 0.2, Math.sin(a) * r, 0.18 + Math.random() * 0.35, ring === 0 ? ci : ring === 1 ? cm : co);
      }
    }
    for (let i = 0; i < BG; i++) {
      const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 22;
      add(Math.cos(a) * r + (Math.random() - 0.5) * 28, (Math.random() - 0.5) * 7, Math.sin(a) * r + (Math.random() - 0.5) * 28, 0.08 + Math.random() * 0.15, new THREE.Color(0.08, 0.1, 0.15 + Math.random() * 0.1));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pa, 3));
    geo.setAttribute("aOrig", new THREE.BufferAttribute(oa, 3));
    geo.setAttribute("aSz", new THREE.BufferAttribute(sa, 1));
    geo.setAttribute("aCol", new THREE.BufferAttribute(ca, 3));

    this.galaxyUniforms = {
      uMouse: { value: new THREE.Vector3(9999, 0, 9999) },
      uStr: { value: 0 }, uTime: { value: 0 },
      uPR: { value: Math.min(devicePixelRatio, 2) },
    };
    const sh = this.shader();
    this.galaxyPoints = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: sh.vertex, fragmentShader: sh.fragment,
      uniforms: this.galaxyUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.scene.add(this.galaxyPoints);
  }

  buildHalo() {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.05, 32, 100), new THREE.MeshBasicMaterial({ color: 0x3355aa, transparent: true, opacity: 0.25 }));
    r.rotation.x = Math.PI * 0.5; r.name = "halo"; this.scene.add(r);
    const n = 200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, rr = 0.5 + Math.random() * 2; pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = (Math.random() - 0.5) * 0.15; pos[i * 3 + 2] = Math.sin(a) * rr; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.18, map: this.tex(), color: 0x8899dd, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
    p.name = "haloPts"; this.scene.add(p);
  }

  // ==================== 4大主题场景 ====================
  buildThemes() {
    const tex = this.tex();
    // DNA
    {
      const g = new THREE.Group(); const n = 800; const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 4, s = i % 2 === 0 ? 1 : -1, r = 1.5;
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
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-Math.cos(t) * r, y, -Math.sin(t) * r), new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r)]), new THREE.LineBasicMaterial({ color: 0x4488cc, transparent: true, opacity: 0.3 })));
      }
      g.visible = false; g.position.set(0, 0, -10); this.scene.add(g); this.themeGroups.dna = g;
    }
    // 工程
    {
      const g = new THREE.Group();
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.5, 1)), new THREE.LineBasicMaterial({ color: 0x6688cc, transparent: true, opacity: 0.5 })));
      const t = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TorusGeometry(3, 0.06, 16, 64)), new THREE.LineBasicMaterial({ color: 0x8866dd, transparent: true, opacity: 0.4 }));
      t.rotation.x = Math.PI * 0.5; g.add(t);
      const orbN = 500, orbPos = new Float32Array(orbN * 3);
      for (let i = 0; i < orbN; i++) { const a = (i / orbN) * Math.PI * 2, r = 3.5 + Math.sin(i * 0.5) * 0.5; orbPos[i * 3] = Math.cos(a) * r; orbPos[i * 3 + 1] = (Math.random() - 0.5) * 0.3; orbPos[i * 3 + 2] = Math.sin(a) * r; }
      const orbGeo = new THREE.BufferGeometry(); orbGeo.setAttribute("position", new THREE.BufferAttribute(orbPos, 3));
      g.add(new THREE.Points(orbGeo, new THREE.PointsMaterial({ size: 0.12, map: tex, color: 0x8899ee, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      g.visible = false; g.position.set(-8, 3, -10); this.scene.add(g); this.themeGroups.engineering = g;
    }
    // WEB3
    {
      const g = new THREE.Group(); const nodes = [];
      for (let i = 0; i < 150; i++) nodes.push(new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
      const pos = new Float32Array(nodes.length * 3);
      nodes.forEach((n, i) => { pos[i * 3] = n.x; pos[i * 3 + 1] = n.y; pos[i * 3 + 2] = n.z; });
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: tex, color: 0x9977ee, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++)
          if (nodes[i].distanceTo(nodes[j]) < 2.0 && Math.random() < 0.08)
            g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([nodes[i], nodes[j]]), new THREE.LineBasicMaterial({ color: 0x6655cc, transparent: true, opacity: 0.18 })));
      g.visible = false; g.position.set(10, 2, -8); this.scene.add(g); this.themeGroups.web3 = g;
    }
    // 数据
    {
      const g = new THREE.Group(); const n = 1000; const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
        const r = 1.5 + Math.abs(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * 3);
        pos[i * 3] = Math.sin(ph) * Math.cos(th) * r; pos[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * r; pos[i * 3 + 2] = Math.cos(ph) * r;
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.14, map: tex, color: 0xccaaff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      g.visible = false; g.position.set(5, -2, -12); this.scene.add(g); this.themeGroups.data = g;
    }
  }

  // ==================== 转场目标 ====================
  sceneTargets = {
    galaxy: { pos: [0, 16, 26], look: [0, 0, 0] },
    dna: { pos: [0, 0, 6], look: [0, 0, -10] },
    engineering: { pos: [-6, 5, 0], look: [-8, 3, -10] },
    web3: { pos: [12, 4, -2], look: [10, 2, -8] },
    data: { pos: [7, -1, -4], look: [5, -2, -12] },
  };

  pageToScene = {
    upload: "dna", "edit-resource": "dna", admin: "dna", feed: "web3", friends: "engineering", chat: "engineering", profile: "data", search: "data",
  };

  transitionTo(page, cb) {
    const sn = this.pageToScene[page] || "galaxy";
    this.activeTheme = sn; this.state = "transitioning";

    Object.values(this.themeGroups).forEach(g => { g.visible = false; });
    const tgtBright = sn === "galaxy" ? 1.0 : 0.3;
    gsap.to(this, { _galaxyBrightness: tgtBright, duration: CFG.TRANS_MS / 1000, ease: "power2.out",
      onUpdate: () => { if (this.galaxyUniforms.uGlobalBrightness) this.galaxyUniforms.uGlobalBrightness.value = this._galaxyBrightness; }
    });

    const tgt = this.sceneTargets[sn];
    gsap.to(this.camera.position, { x: tgt.pos[0], y: tgt.pos[1], z: tgt.pos[2], duration: CFG.TRANS_MS / 1000, ease: "power2.out" });
    const fl = { x: this.lookProxy.x, y: this.lookProxy.y, z: this.lookProxy.z };
    gsap.to(fl, { x: tgt.look[0], y: tgt.look[1], z: tgt.look[2], duration: CFG.TRANS_MS / 1000, ease: "power2.out",
      onUpdate: () => { this.camera.lookAt(fl.x, fl.y, fl.z); },
      onComplete: () => {
        this.lookProxy.x = tgt.look[0]; this.lookProxy.y = tgt.look[1]; this.lookProxy.z = tgt.look[2];
        if (sn !== "galaxy" && this.themeGroups[sn]) this.themeGroups[sn].visible = true;
        this.state = "theme"; if (cb) cb();
      }
    });
  }

  resetToGalaxy(cb) {
    this.activeTheme = "galaxy"; this.state = "transitioning";
    Object.values(this.themeGroups).forEach(g => { g.visible = false; });
    gsap.to(this, { _galaxyBrightness: 1.0, duration: CFG.TRANS_MS / 1000, ease: "power2.out",
      onUpdate: () => { if (this.galaxyUniforms.uGlobalBrightness) this.galaxyUniforms.uGlobalBrightness.value = this._galaxyBrightness; }
    });
    const tgt = this.sceneTargets.galaxy;
    gsap.to(this.camera.position, { x: tgt.pos[0], y: tgt.pos[1], z: tgt.pos[2], duration: CFG.TRANS_MS / 1000, ease: "power2.out" });
    const fl = { x: this.lookProxy.x, y: this.lookProxy.y, z: this.lookProxy.z };
    gsap.to(fl, { x: 0, y: 0, z: 0, duration: CFG.TRANS_MS / 1000, ease: "power2.out",
      onUpdate: () => { this.camera.lookAt(fl.x, fl.y, fl.z); },
      onComplete: () => {
        this.lookProxy.x = 0; this.lookProxy.y = 0; this.lookProxy.z = 0;
        this.autoAngle = Math.atan2(this.camera.position.z, this.camera.position.x);
        this.state = "galaxy"; if (cb) cb();
      }
    });
  }

  onMouse(e) {
    this.mouseNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.plane, hit)) this.mouseWorld.copy(hit);
  }

  onResize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); if (this.galaxyUniforms) this.galaxyUniforms.uPR.value = Math.min(devicePixelRatio, 2); }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.galaxyUniforms) {
      this.galaxyUniforms.uTime.value = this.clock.elapsedTime;
      this.galaxyUniforms.uMouse.value.copy(this.mouseWorld);
      const cur = this.galaxyUniforms.uStr.value;
      this.galaxyUniforms.uStr.value += ((this.mouseWorld.x < 999 ? CFG.GRAVITY : 0) - cur) * 0.06;
    }

    if (this.state === "galaxy") {
      this.autoAngle += (2 * Math.PI / CFG.ROTATE) * dt;
      const d = Math.sqrt(this.camera.position.x ** 2 + this.camera.position.z ** 2);
      this.camera.position.x = Math.sin(this.autoAngle) * d;
      this.camera.position.z = Math.cos(this.autoAngle) * d;
      this.camera.lookAt(0, 0, 0);
    }

    if (this.themeGroups.dna?.visible) this.themeGroups.dna.rotation.y += dt * 0.35;
    if (this.themeGroups.web3?.visible) this.themeGroups.web3.rotation.y += dt * 0.22;
    if (this.themeGroups.engineering?.visible) this.themeGroups.engineering.children.forEach((c, i) => { c.rotation.y += dt * 0.25 * (i + 1) * 0.5; c.rotation.x += dt * 0.12 * (i % 2 ? -1 : 1); });
    if (this.themeGroups.data?.visible) this.themeGroups.data.rotation.y += dt * 0.14;

    const halo = this.scene.getObjectByName("halo");
    if (halo) halo.rotation.z += dt * 0.025;
    const hp = this.scene.getObjectByName("haloPts");
    if (hp) hp.rotation.y += dt * 0.04;

    this.renderer.render(this.scene, this.camera);
  }
}

window.StarfieldEngine = StarfieldEngine;

