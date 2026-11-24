import React, { useEffect, useRef } from 'react';
import {
  IconVolumeUp,
  IconVolumeMute,
  IconMenu,
  IconPropeller
} from './Icons';

export default function RikshaCanvas({
  state,
  multiplier,
  countdownProgress,
  vehicle = 'bike',
  onToggleSound,
  soundEnabled,
  onOpenMenu
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const bikeImgRef = useRef(null);

  // Parallax offsets (scrolling LEFT to create forward motion)
  const roadOffsetRef = useRef(0);
  const midgroundOffsetRef = useRef(0);
  const farOffsetRef = useRef(0);
  const skyOffsetRef = useRef(0);
  const engineVibeRef = useRef(0);
  const starsRef = useRef([]);
  const dayPhaseRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const lastVehicleRef = useRef({ x: 0, y: 0 });
  const crashRef = useRef({
    seeded: false,
    t0: 0,
    x: 0,
    y: 0,
    mult: 1,
    particles: [],
    sparks: [],
    shards: []
  });

  // Preload bike image
  useEffect(() => {
    const img = new Image();
    img.src = '/bike.png';
    img.onload = () => {
      bikeImgRef.current = img;
    };

    // Pre-generate stars for night ambiance
    starsRef.current = Array.from({ length: 70 }).map(() => ({
      x: Math.random(),
      y: Math.random() * 0.55,
      size: Math.random() * 2.2 + 0.5,
      twinkle: Math.random() * Math.PI * 2
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // --- 1. DETERMINE SPEED & PROGRESSION ---
      let baseSpeed = 0;
      if (state === 'FLYING') {
        baseSpeed = Math.min(32, 6.0 + Math.log(Math.max(1, multiplier)) * 6.5);
      } else if (state === 'WAITING') {
        baseSpeed = 2.2; // Cruising forward waiting for round
      } else {
        baseSpeed = 0.4;
      }

      // Parallax update (All background layers move to the LEFT)
      roadOffsetRef.current = (roadOffsetRef.current + baseSpeed) % 100000;
      midgroundOffsetRef.current = (midgroundOffsetRef.current + baseSpeed * 0.45) % 100000;
      farOffsetRef.current = (farOffsetRef.current + baseSpeed * 0.15) % 100000;
      skyOffsetRef.current = (skyOffsetRef.current + baseSpeed * 0.05) % 100000;

      // Engine vibration / suspension thump
      engineVibeRef.current += baseSpeed * 0.35;
      const thumpingVibe = Math.sin(engineVibeRef.current) * (state === 'FLYING' ? 1.5 : 0.8);

      const currentMult = state === 'FLYING' || state === 'CRASHED' ? multiplier : 1.0;

      // Day ↔ night advances on real time (not bike speed)
      const now = performance.now();
      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = now;
      const dt = Math.min(0.05, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;
      // Full cycle ~22s while the scene is moving; pause when nearly stopped
      if (baseSpeed > 0.5) {
        dayPhaseRef.current = (dayPhaseRef.current + dt / 22) % 1;
      }
      const dayCycle = getDayCycleFromPhase(dayPhaseRef.current);

      // --- 2. SKY & CLOUDS ---
      drawModernSky(ctx, width, height, skyOffsetRef.current, dayCycle);

      // Scale scene for small/mobile canvases so bike & buildings don't dominate
      const sceneScale = Math.max(0.42, Math.min(1, Math.min(height / 420, width / 780)));

      // --- 3. FAR BACKGROUND ---
      drawFarSilhouettes(ctx, width, height * 0.62, dayCycle, farOffsetRef.current, sceneScale);

      // --- 4. MIDGROUND buildings & palms ---
      const roadTop = height * (height < 260 ? 0.62 : 0.68);
      drawCityTown(ctx, width, roadTop, dayCycle, midgroundOffsetRef.current, sceneScale);

      // --- 5. FOREGROUND ROAD ---
      const roadHeight = height - roadTop;
      const curbH = Math.max(5, 9 * sceneScale);
      const night = dayCycle.night;

      ctx.fillStyle = lerpHex('#e8b896', '#2a3142', night);
      ctx.fillRect(0, roadTop, width, curbH);
      ctx.fillStyle = lerpHex('#c99572', '#1a2030', night);
      ctx.fillRect(0, roadTop + curbH - 2, width, 2);

      const roadGrad = ctx.createLinearGradient(0, roadTop + curbH, 0, height);
      roadGrad.addColorStop(0, lerpHex('#6a7588', '#252b38', night));
      roadGrad.addColorStop(0.35, lerpHex('#555e70', '#1c2230', night));
      roadGrad.addColorStop(1, lerpHex('#3a4250', '#12161f', night));
      ctx.fillStyle = roadGrad;
      ctx.fillRect(0, roadTop + curbH, width, roadHeight - curbH);

      const edgeGrad = ctx.createLinearGradient(0, roadTop + curbH, 0, height);
      edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
      edgeGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(0, roadTop + curbH, width, roadHeight - curbH);

      ctx.fillStyle = '#ffffff';
      const stripeY = roadTop + roadHeight * 0.48;
      const stripeWidth = Math.max(28, 56 * sceneScale);
      const stripeGap = Math.max(18, 32 * sceneScale);
      const stripeH = Math.max(4, 7 * sceneScale);
      const totalStripeStep = stripeWidth + stripeGap;
      const stripeShift = roadOffsetRef.current % totalStripeStep;

      for (let x = -totalStripeStep - stripeShift; x < width + totalStripeStep; x += totalStripeStep) {
        ctx.fillRect(x, stripeY, stripeWidth, stripeH);
      }

      // --- 6. VEHICLE (keep left like reference) ---
      let vehicleX = Math.max(70 * sceneScale, width * 0.14);
      if (state === 'FLYING') {
        const progress = Math.min(1, Math.log(multiplier) / Math.log(25));
        vehicleX = Math.max(70 * sceneScale, width * 0.14) + (width * 0.28) * progress;
      }

      const roadBaseline = roadTop + roadHeight * 0.40;
      const vehicleY = roadBaseline + thumpingVibe * sceneScale;

      if (state === 'FLYING') {
        lastVehicleRef.current = { x: vehicleX, y: vehicleY };
        crashRef.current.seeded = false;
      }

      if (state === 'FLYING' && multiplier > 1.0) {
        drawAviatorSpeedCurve(ctx, width, height, roadTop, vehicleX, vehicleY, currentMult, sceneScale);
      }

      if (state === 'CRASHED') {
        seedCrashIfNeeded(vehicleX, vehicleY, multiplier, sceneScale);
        drawCrashSequence(ctx, width, height, roadTop, sceneScale, currentMult);
      } else if (bikeImgRef.current && bikeImgRef.current.complete) {
        drawRoyalEnfield(ctx, vehicleX, vehicleY, currentMult, state, multiplier, sceneScale);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [state, multiplier, vehicle]);

  const seedCrashIfNeeded = (fallbackX, fallbackY, mult, sceneScale) => {
    const crash = crashRef.current;
    if (crash.seeded) return;

    const x = lastVehicleRef.current.x || fallbackX;
    const y = lastVehicleRef.current.y || fallbackY;
    crash.seeded = true;
    crash.t0 = performance.now();
    crash.x = x;
    crash.y = y;
    crash.mult = mult;

    crash.particles = Array.from({ length: 28 }).map(() => {
      const ang = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
      const spd = (2.5 + Math.random() * 7) * sceneScale;
      return {
        x,
        y: y - 10 * sceneScale,
        vx: Math.cos(ang) * spd + 1.5,
        vy: Math.sin(ang) * spd,
        life: 0.55 + Math.random() * 0.7,
        size: (2 + Math.random() * 5) * sceneScale,
        color: Math.random() > 0.45 ? '#ff6b3d' : Math.random() > 0.5 ? '#fbbf24' : '#1a1a1a'
      };
    });

    crash.sparks = Array.from({ length: 18 }).map(() => {
      const ang = -Math.PI * 0.05 - Math.random() * Math.PI * 0.5;
      const spd = (4 + Math.random() * 9) * sceneScale;
      return {
        x: x + (Math.random() - 0.5) * 20,
        y: y + 4 * sceneScale,
        vx: Math.cos(ang) * spd + 2,
        vy: Math.sin(ang) * spd * 0.6,
        life: 0.25 + Math.random() * 0.45,
        len: (6 + Math.random() * 14) * sceneScale
      };
    });

    crash.shards = Array.from({ length: 8 }).map(() => ({
      x: x + (Math.random() - 0.5) * 16,
      y: y - 8 * sceneScale,
      vx: (Math.random() - 0.2) * 6 * sceneScale,
      vy: (-2 - Math.random() * 5) * sceneScale,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      w: (4 + Math.random() * 10) * sceneScale,
      h: (2 + Math.random() * 5) * sceneScale,
      life: 0.7 + Math.random() * 0.6
    }));
  };

  const drawCrashSequence = (ctx, width, height, roadTop, sceneScale, mult) => {
    const crash = crashRef.current;
    const elapsed = (performance.now() - crash.t0) / 1000;
    const t = Math.min(1, elapsed / 1.35);
    const ease = 1 - Math.pow(1 - t, 3);

    // Broken trail snap
    const trailEndX = crash.x - Math.max(34, 46 * sceneScale);
    const trailEndY = crash.y + Math.max(4, 8 * sceneScale);
    drawAviatorSpeedCurve(ctx, width, height, roadTop, crash.x, crash.y, crash.mult || mult, sceneScale);

    // Jagged break mark at the tip
    ctx.save();
    ctx.strokeStyle = `rgba(255, 70, 70, ${0.85 * (1 - t * 0.4)})`;
    ctx.lineWidth = Math.max(2, 2.6 * sceneScale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trailEndX - 8, trailEndY - 6);
    ctx.lineTo(trailEndX + 4, trailEndY + 2);
    ctx.lineTo(trailEndX - 2, trailEndY + 10);
    ctx.stroke();
    ctx.restore();

    // Rubber skid on road
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - t * 0.35);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = Math.max(3, 5 * sceneScale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(crash.x - 30 * sceneScale, crash.y + 14 * sceneScale);
    ctx.quadraticCurveTo(
      crash.x + 20 * sceneScale,
      crash.y + 18 * sceneScale,
      crash.x + 70 * ease * sceneScale,
      crash.y + 22 * sceneScale + Math.sin(elapsed * 8) * 2
    );
    ctx.stroke();
    ctx.restore();

    // White impact flash
    if (elapsed < 0.22) {
      const flash = 1 - elapsed / 0.22;
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * flash})`;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = `rgba(255, 60, 40, ${0.28 * flash})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Expanding shock ring
    if (elapsed < 0.55) {
      const ringT = elapsed / 0.55;
      ctx.save();
      ctx.beginPath();
      ctx.arc(crash.x, crash.y - 8 * sceneScale, (18 + ringT * 90) * sceneScale, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 120, 70, ${(1 - ringT) * 0.7})`;
      ctx.lineWidth = Math.max(2, (4 - ringT * 3) * sceneScale);
      ctx.stroke();
      ctx.restore();
    }

    // Tumbling bike wipeout
    if (bikeImgRef.current && bikeImgRef.current.complete && t < 0.92) {
      const bikeHeight = Math.max(72, 118 * sceneScale);
      const bikeWidth = bikeHeight * (947 / 531);
      const bx = crash.x + ease * 110 * sceneScale;
      const by = crash.y - Math.sin(ease * Math.PI) * 42 * sceneScale + ease * 28 * sceneScale;
      const rot = ease * 1.85;
      const fade = t > 0.65 ? 1 - (t - 0.65) / 0.27 : 1;

      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(bx, by - bikeHeight * 0.2);
      ctx.rotate(rot);
      ctx.drawImage(
        bikeImgRef.current,
        -bikeWidth / 2,
        -bikeHeight / 2,
        bikeWidth,
        bikeHeight
      );
      ctx.restore();
    }

    // Smoke / fire particles
    crash.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12 * sceneScale;
      p.vx *= 0.985;
      p.life -= 0.016;
      if (p.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + (1 - Math.min(1, p.life)) * 0.8), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Sparks
    crash.sparks.forEach((s) => {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.2 * sceneScale;
      s.life -= 0.022;
      if (s.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = Math.max(1, 1.4 * sceneScale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 1.4, s.y - s.vy * 1.4);
      ctx.stroke();
      ctx.restore();
    });

    // Metal shards
    crash.shards.forEach((sh) => {
      sh.x += sh.vx;
      sh.y += sh.vy;
      sh.vy += 0.18 * sceneScale;
      sh.rot += sh.vr;
      sh.life -= 0.014;
      if (sh.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, sh.life));
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.rot);
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(-sh.w / 2, -sh.h / 2, sh.w, sh.h);
      ctx.restore();
    });

    // Red edge vignette while crash plays
    if (elapsed < 1.1) {
      const v = Math.max(0, 1 - elapsed / 1.1) * 0.55;
      const vig = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        Math.min(width, height) * 0.2,
        width * 0.5,
        height * 0.45,
        Math.max(width, height) * 0.75
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, `rgba(120, 0, 0, ${v})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    }
  };

  // Smooth road-speed trail behind the bike (subtle, not neon scribble)
  const drawAviatorSpeedCurve = (ctx, width, height, roadTop, vx, vy, mult, sceneScale = 1) => {
    const originX = 4;
    const originY = roadTop + Math.max(10, 16 * sceneScale);
    const targetX = vx - Math.max(34, 46 * sceneScale);
    const targetY = vy + Math.max(4, 8 * sceneScale);

    if (targetX <= originX + 8) return;

    // Gentle lift with multiplier — stays near the road, not a steep ski-jump
    const lift = Math.min(height * 0.1, Math.log(Math.max(1.01, mult)) * 12 * sceneScale);
    const cp1x = originX + (targetX - originX) * 0.28;
    const cp1y = originY - lift * 0.08;
    const cp2x = originX + (targetX - originX) * 0.7;
    const cp2y = targetY - lift * 0.55;

    let strokeColor = '#f87171';
    if (mult >= 5 && mult < 15) strokeColor = '#4ade80';
    else if (mult >= 15) strokeColor = '#fbbf24';

    const lw = Math.max(1.6, 2.2 * sceneScale);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Soft under-fill (very light)
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, targetX, targetY);
    ctx.lineTo(targetX, originY + 2);
    ctx.lineTo(originX, originY + 2);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, Math.min(cp2y, targetY) - 8, 0, originY + 4);
    fillGrad.addColorStop(0, `${strokeColor}18`);
    fillGrad.addColorStop(0.55, `${strokeColor}08`);
    fillGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Fade stroke from soft start → solid near bike
    const strokeGrad = ctx.createLinearGradient(originX, originY, targetX, targetY);
    strokeGrad.addColorStop(0, `${strokeColor}00`);
    strokeGrad.addColorStop(0.18, `${strokeColor}55`);
    strokeGrad.addColorStop(0.55, `${strokeColor}cc`);
    strokeGrad.addColorStop(1, strokeColor);

    // Outer soft halo (no heavy shadowBlur — that was looking muddy)
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, targetX, targetY);
    ctx.strokeStyle = `${strokeColor}33`;
    ctx.lineWidth = lw * 3.2;
    ctx.stroke();

    // Main trail
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, targetX, targetY);
    ctx.strokeStyle = strokeGrad;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Bright core tip near the bike
    ctx.beginPath();
    ctx.moveTo(cp2x, cp2y);
    ctx.bezierCurveTo(
      cp2x + (targetX - cp2x) * 0.4,
      cp2y + (targetY - cp2y) * 0.4,
      targetX,
      targetY,
      targetX,
      targetY
    );
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(0.8, lw * 0.45);
    ctx.stroke();

    ctx.restore();
  };

  // --- DRAW ROYAL ENFIELD BULLET 350 MOTORCYCLE ---
  const drawRoyalEnfield = (ctx, bx, by, currentMult, state, mult, sceneScale = 1) => {
    // Smaller base size; further reduced on mobile via sceneScale
    const bikeHeight = Math.max(72, 118 * sceneScale);
    const bikeWidth = bikeHeight * (947 / 531);
    const bAngle = state === 'FLYING' ? -Math.min(0.06, (mult - 1) * 0.015) : 0;

    ctx.save();
    ctx.translate(bx, by - bikeHeight * 0.28);
    ctx.rotate(bAngle);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, bikeHeight * 0.46, bikeWidth * 0.38, Math.max(3, 6 * sceneScale), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
    ctx.fill();
    ctx.restore();

    ctx.drawImage(
      bikeImgRef.current,
      -bikeWidth / 2,
      -bikeHeight / 2,
      bikeWidth,
      bikeHeight
    );

    ctx.restore();
  };

  // Day → sunset → night (moon) → sunrise → day — pace is time-based, not speed-based
  const getDayCycleFromPhase = (phase) => {
    const night =
      phase < 0.28 ? 0 :
      phase < 0.38 ? smoothstep((phase - 0.28) / 0.1) :
      phase < 0.68 ? 1 :
      phase < 0.80 ? 1 - smoothstep((phase - 0.68) / 0.12) :
      0;
    const golden =
      phase < 0.22 ? 0 :
      phase < 0.32 ? smoothstep((phase - 0.22) / 0.1) :
      phase < 0.40 ? 1 - smoothstep((phase - 0.32) / 0.08) :
      phase < 0.66 ? 0 :
      phase < 0.74 ? smoothstep((phase - 0.66) / 0.08) :
      phase < 0.84 ? 1 - smoothstep((phase - 0.74) / 0.1) :
      0;
    return { phase, night, golden };
  };

  const smoothstep = (t) => {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
  };

  const lerp = (a, b, t) => a + (b - a) * t;

  const lerpHex = (a, b, t) => {
    const pa = parseInt(a.replace('#', ''), 16);
    const pb = parseInt(b.replace('#', ''), 16);
    const r = Math.round(lerp((pa >> 16) & 0xff, (pb >> 16) & 0xff, t));
    const g = Math.round(lerp((pa >> 8) & 0xff, (pb >> 8) & 0xff, t));
    const bl = Math.round(lerp(pa & 0xff, pb & 0xff, t));
    return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
  };

  const celestialPos = (phase, width, skyHeight, isMoon) => {
    // Sun rises ~0.74, sets ~0.32; moon is opposite (+0.5)
    const rise = 0.74;
    const set = 0.32;
    const local = isMoon ? (phase + 0.5) % 1 : phase;
    const daySpan = (1 - rise) + set;

    let arcT;
    if (local >= rise) arcT = (local - rise) / daySpan;
    else if (local <= set) arcT = ((1 - rise) + local) / daySpan;
    else return null;

    // π (left/east) → π/2 (zenith) → 0 (right/west)
    const angle = Math.PI - arcT * Math.PI;
    const cx = width * 0.5;
    const cy = skyHeight * 0.92;
    const rx = width * 0.46;
    const ry = skyHeight * 0.78;
    const elev = Math.max(0, Math.sin(angle));
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy - elev * ry,
      elev
    };
  };

  const drawModernSky = (ctx, width, height, offset, cycle) => {
    const skyHeight = height * 0.72;
    const { night, golden } = cycle;

    const dayTop = '#6eb4cc';
    const dayMid = '#9ecfe0';
    const daySoft = '#d9e8ef';
    const dayWarm = '#f7d4b4';
    const dayHorizon = '#f5b888';

    const nightTop = '#0b1020';
    const nightMid = '#1a2744';
    const nightSoft = '#2a3a5c';
    const nightWarm = '#3d2a48';
    const nightHorizon = '#1a1528';

    const goldTop = '#3a4a78';
    const goldMid = '#7a5a88';
    const goldSoft = '#c87860';
    const goldWarm = '#f0a060';
    const goldHorizon = '#ffb070';

    const mix = (day, gold, dark) =>
      lerpHex(lerpHex(day, gold, golden), dark, night);

    const grad = ctx.createLinearGradient(0, 0, 0, skyHeight);
    grad.addColorStop(0, mix(dayTop, goldTop, nightTop));
    grad.addColorStop(0.28, mix(dayMid, goldMid, nightMid));
    grad.addColorStop(0.55, mix(daySoft, goldSoft, nightSoft));
    grad.addColorStop(0.78, mix(dayWarm, goldWarm, nightWarm));
    grad.addColorStop(1, mix(dayHorizon, goldHorizon, nightHorizon));

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Stars — fade in with night
    if (night > 0.05) {
      const tw = performance.now() * 0.001;
      starsRef.current.forEach((s) => {
        const alpha = night * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tw * 2.2 + s.twinkle)));
        ctx.fillStyle = `rgba(220, 230, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x * width, s.y * skyHeight, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Sun (visible during day / golden hour)
    const sun = celestialPos(cycle.phase, width, skyHeight, false);
    if (sun && night < 0.92) {
      const sunAlpha = Math.max(0, 1 - night * 1.15) * (0.55 + sun.elev * 0.45);
      const glowR = 90 + sun.elev * 100;
      const sunGlow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, glowR);
      const warm = golden > 0.2;
      sunGlow.addColorStop(0, warm
        ? `rgba(255, 200, 110, ${0.85 * sunAlpha})`
        : `rgba(255, 240, 180, ${0.75 * sunAlpha})`);
      sunGlow.addColorStop(0.35, warm
        ? `rgba(255, 140, 70, ${0.35 * sunAlpha})`
        : `rgba(255, 210, 140, ${0.28 * sunAlpha})`);
      sunGlow.addColorStop(1, 'rgba(255, 160, 80, 0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, width, skyHeight);

      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 14 + sun.elev * 6, 0, Math.PI * 2);
      ctx.fillStyle = warm
        ? `rgba(255, 190, 90, ${0.95 * sunAlpha})`
        : `rgba(255, 245, 200, ${0.95 * sunAlpha})`;
      ctx.fill();
    }

    // Moon — drifts across during night
    const moon = celestialPos(cycle.phase, width, skyHeight, true);
    if (moon && night > 0.08) {
      const moonAlpha = Math.min(1, night * 1.2) * (0.5 + moon.elev * 0.5);
      const moonGlow = ctx.createRadialGradient(moon.x, moon.y, 3, moon.x, moon.y, 70);
      moonGlow.addColorStop(0, `rgba(200, 220, 255, ${0.45 * moonAlpha})`);
      moonGlow.addColorStop(0.5, `rgba(160, 180, 230, ${0.12 * moonAlpha})`);
      moonGlow.addColorStop(1, 'rgba(140, 160, 220, 0)');
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, width, skyHeight);

      const r = 11 + moon.elev * 4;
      ctx.beginPath();
      ctx.arc(moon.x, moon.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(235, 240, 255, ${0.92 * moonAlpha})`;
      ctx.fill();

      // Crescent cutout
      ctx.beginPath();
      ctx.arc(moon.x + r * 0.35, moon.y - r * 0.1, r * 0.88, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(12, 18, 36, ${0.82 * moonAlpha})`;
      ctx.fill();
    }

    // Clouds dim at night
    ctx.save();
    ctx.globalAlpha = 1 - night * 0.72;
    drawFluffyClouds(ctx, width, height, offset);
    ctx.restore();
  };

  const drawFluffyCloud = (ctx, x, y, scale = 1) => {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
    ctx.shadowBlur = 12;
    const blobs = [
      [0, 0, 38],
      [28, -10, 32],
      [52, 2, 36],
      [78, -6, 28],
      [18, 12, 26],
      [55, 14, 24]
    ];
    ctx.beginPath();
    blobs.forEach(([dx, dy, r]) => {
      ctx.moveTo(x + dx * scale + r * scale, y + dy * scale);
      ctx.arc(x + dx * scale, y + dy * scale, r * scale, 0, Math.PI * 2);
    });
    ctx.fill();
    ctx.restore();
  };

  const drawFluffyClouds = (ctx, width, height, offset) => {
    const cycle = 1400;
    const shift = offset % cycle;
    const clouds = [
      { x: 80, y: height * 0.16, s: 1.15 },
      { x: 380, y: height * 0.26, s: 0.85 },
      { x: 680, y: height * 0.14, s: 1.35 },
      { x: 980, y: height * 0.22, s: 1.0 },
      { x: 1220, y: height * 0.18, s: 0.9 }
    ];

    [-cycle, 0, cycle].forEach((bx) => {
      clouds.forEach((c) => {
        const dx = c.x + bx - shift;
        if (dx > -180 && dx < width + 180) {
          drawFluffyCloud(ctx, dx, c.y, c.s);
        }
      });
    });
  };

  // --- FAR SILHOUETTES ---
  const drawFarSilhouettes = (ctx, width, baseY, dayCycle, offset, sceneScale = 1) => {
    const cycle = 1000;
    const shift = offset % cycle;
    const hScale = 0.75 * sceneScale;
    const { night, golden } = dayCycle;

    const dayCol = [230, 160, 120];
    const goldCol = [180, 100, 90];
    const nightCol = [70, 55, 95];
    const c = dayCol.map((d, i) =>
      Math.round(lerp(lerp(d, goldCol[i], golden), nightCol[i], night))
    );
    const alpha = lerp(0.45, 0.4, night);

    ctx.save();
    ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
    [-cycle, 0, cycle].forEach((bx) => {
      const start = bx - shift;
      ctx.beginPath();
      ctx.moveTo(start - 40, baseY);
      const peaks = [
        [60, 48], [140, 78], [230, 42], [340, 90],
        [450, 55], [560, 85], [680, 40], [800, 72], [920, 50]
      ];
      peaks.forEach(([px, ph]) => {
        ctx.lineTo(start + px, baseY - ph * hScale);
      });
      ctx.lineTo(start + cycle + 40, baseY);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  };

  const drawPalm = (ctx, x, baseY, scale = 1) => {
    ctx.save();
    ctx.strokeStyle = '#6b4428';
    ctx.lineWidth = Math.max(2, 4.5 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x - 8 * scale, baseY - 42 * scale, x - 5 * scale, baseY - 86 * scale);
    ctx.stroke();

    const crownX = x - 5 * scale;
    const crownY = baseY - 86 * scale;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
      ctx.fillStyle = i % 2 === 0 ? '#3cb371' : '#2e9e5b';
      ctx.beginPath();
      ctx.ellipse(
        crownX + Math.cos(a) * 14 * scale,
        crownY + Math.sin(a) * 9 * scale,
        14 * scale,
        4.5 * scale,
        a,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  };

  // --- FLAT-DESIGN TOWN ---
  const drawCityTown = (ctx, width, baseY, dayCycle, offset, sceneScale = 1) => {
    const s = Math.max(0.5, sceneScale * 0.85);
    const { night, golden } = dayCycle;
    const buildings = [
      { color: '#ef8f6a', nightColor: '#3a4558', roof: '#2d3545', w: 72, h: 70, palm: true, palmScale: 0.9 },
      { color: '#6aa4b8', nightColor: '#2e3a4e', roof: '#2d3545', w: 66, h: 82, palm: false },
      { color: '#f6c86a', nightColor: '#3d4254', roof: '#2d3545', w: 74, h: 64, palm: true, palmScale: 1.0 },
      { color: '#7eb0c2', nightColor: '#324056', roof: '#2d3545', w: 68, h: 76, palm: false },
      { color: '#e99a6c', nightColor: '#384456', roof: '#2d3545', w: 76, h: 68, palm: true, palmScale: 0.85 },
      { color: '#f0c478', nightColor: '#3a4050', roof: '#2d3545', w: 70, h: 60, palm: false },
      { color: '#d97d62', nightColor: '#353f52', roof: '#2d3545', w: 72, h: 74, palm: true, palmScale: 0.95 }
    ];

    const gap = Math.max(10, 14 * s);
    const cycleWidth = buildings.reduce((a, b) => a + b.w * s + gap, 0);
    const shift = offset % cycleWidth;

    const groundGrad = ctx.createLinearGradient(0, baseY - 16 * s, 0, baseY);
    const gAlpha = lerp(0.35, 0.12, night);
    groundGrad.addColorStop(0, `rgba(245, 190, 140, 0)`);
    groundGrad.addColorStop(1, `rgba(${Math.round(lerp(235, 80, night))}, ${Math.round(lerp(170, 90, night))}, ${Math.round(lerp(120, 120, night))}, ${gAlpha})`);
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, baseY - 18 * s, width, 18 * s);

    [-cycleWidth, 0, cycleWidth, cycleWidth * 2].forEach((blockX) => {
      let cx = blockX - shift;
      buildings.forEach((b) => {
        const bw = b.w * s;
        const bh = b.h * s;
        if (cx > -120 && cx < width + 120) {
          if (b.palm) {
            ctx.save();
            ctx.globalAlpha = 1 - night * 0.35;
            drawPalm(ctx, cx - 6 * s, baseY, (b.palmScale || 1) * s);
            ctx.restore();
          }

          const facadeColor = lerpHex(
            lerpHex(b.color, shadeHex(b.color, -12), golden * 0.4),
            b.nightColor,
            night
          );
          const facade = ctx.createLinearGradient(cx, baseY - bh, cx + bw, baseY);
          facade.addColorStop(0, facadeColor);
          facade.addColorStop(1, shadeHex(facadeColor, -18));
          ctx.fillStyle = facade;
          ctx.fillRect(cx, baseY - bh, bw, bh);

          ctx.fillStyle = lerpHex(b.roof, '#1a2030', night);
          ctx.fillRect(cx - 2 * s, baseY - bh - 4 * s, bw + 4 * s, 4 * s);

          const winW = 11 * s;
          const winH = 13 * s;
          const cols = [10 * s, bw - 22 * s];
          const rows = [12 * s, 30 * s, 48 * s];
          rows.forEach((ry, ri) => {
            if (ry + winH < bh - 6 * s) {
              cols.forEach((rx, ci) => {
                // Lit windows at night
                if (night > 0.35 && (ri + ci) % 2 === 0) {
                  const glow = Math.min(1, (night - 0.35) / 0.4);
                  ctx.fillStyle = `rgba(255, 210, 120, ${0.55 + glow * 0.35})`;
                } else {
                  ctx.fillStyle = lerpHex('#1e2533', '#0e121a', night);
                }
                ctx.fillRect(cx + rx, baseY - bh + ry, winW, winH);
              });
            }
          });

          ctx.fillStyle = `rgba(255,255,255,${0.12 * (1 - night * 0.7)})`;
          ctx.fillRect(cx, baseY - bh, 3 * s, bh);
        }
        cx += bw + gap;
      });
    });
  };

  const shadeHex = (hex, amount) => {
    const n = hex.replace('#', '');
    const num = parseInt(n, 16);
    let r = Math.min(255, Math.max(0, (num >> 16) + amount));
    let g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    let b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  const glassBtn =
    'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/55 hover:bg-black/70 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-lg transition-all cursor-pointer';

  return (
    <div className="relative w-full h-full min-h-[160px] rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.5)] select-none border border-white/10 bg-[#0a1520]">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* TOP-RIGHT: Sound / Fullscreen / Menu */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1.5 sm:gap-2 z-20">
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Mute' : 'Unmute'}
          className={glassBtn}
        >
          {soundEnabled ? (
            <IconVolumeUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          ) : (
            <IconVolumeMute className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
          )}
        </button>

        <button
          onClick={onOpenMenu}
          title="Menu"
          className={glassBtn}
        >
          <IconMenu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
        </button>
      </div>

      {/* Dark wash + sunburst — same look for waiting loader and crash HUD */}
      {(state === 'WAITING' || state === 'CRASHED') && (
        <div className="absolute inset-0 z-[9] pointer-events-none wait-stage-wash" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(18,20,24,0.72) 0%, rgba(8,10,14,0.88) 70%, rgba(5,8,12,0.94) 100%)'
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(100%,520px)] h-[min(100%,520px)] opacity-50"
            style={{
              background:
                'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.09) 0deg 7deg, transparent 7deg 14deg)',
              maskImage: 'radial-gradient(circle, black 12%, transparent 62%)',
              WebkitMaskImage: 'radial-gradient(circle, black 12%, transparent 62%)'
            }}
          />
        </div>
      )}

      {/* CENTER HUD */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10 pb-2 sm:pb-4">
        {state === 'WAITING' && (
          <div className="relative flex flex-col items-center justify-center animate-fade-in px-5">
            <div className="relative mb-4 sm:mb-5 wait-propeller">
              <IconPropeller className="w-14 h-14 sm:w-16 sm:h-16 text-[#ff2d55]" />
            </div>

            <p
              className="relative text-white text-[13px] sm:text-[15px] font-extrabold uppercase tracking-[0.26em] sm:tracking-[0.32em] text-center leading-snug"
              style={{
                textShadow:
                  '0 1px 0 rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.95), 0 0 24px rgba(0,0,0,0.7)'
              }}
            >
              Waiting for next round
            </p>

            <div className="relative mt-4 w-[200px] sm:w-[240px] h-[6px] rounded-full bg-[#3a3f48] border border-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#ff2d55] transition-[width] duration-200 ease-linear"
                style={{
                  width: `${Math.max(3, Math.min(100, (1 - (countdownProgress ?? 1)) * 100))}%`,
                  boxShadow: '0 0 12px rgba(255,45,85,0.9)'
                }}
              />
            </div>
          </div>
        )}

        {state === 'FLYING' && (
          <div className="text-center animate-fade-in relative">
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-24 blur-3xl opacity-70"
              style={{
                background:
                  multiplier >= 10
                    ? 'radial-gradient(circle, rgba(34,197,94,0.55), transparent 70%)'
                    : multiplier >= 2
                      ? 'radial-gradient(circle, rgba(56,189,248,0.45), transparent 70%)'
                      : 'radial-gradient(circle, rgba(251,191,36,0.4), transparent 70%)'
              }}
            />
            <span
              className="relative font-black tracking-tight text-5xl sm:text-7xl"
              style={{
                fontFamily: "'Chakra Petch', sans-serif",
                color: multiplier >= 10 ? '#4ade80' : multiplier >= 2 ? '#67e8f9' : '#fff',
                textShadow:
                  multiplier >= 10
                    ? '0 0 28px rgba(74,222,128,0.85), 0 6px 18px rgba(0,0,0,0.9)'
                    : multiplier >= 2
                      ? '0 0 28px rgba(103,232,249,0.75), 0 6px 18px rgba(0,0,0,0.9)'
                      : '0 0 24px rgba(251,191,36,0.55), 0 6px 18px rgba(0,0,0,0.9)'
              }}
            >
              {multiplier.toFixed(2)}x
            </span>
          </div>
        )}

        {state === 'CRASHED' && (
          <div className="text-center flex flex-col items-center relative crash-impact">
            <div className="pointer-events-none absolute inset-[-40%] crash-screen-flash rounded-full" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-32 bg-red-600/35 blur-3xl" />

            <div className="relative mb-1.5 px-3 py-0.5 rounded-full border border-red-400/40 bg-black/50 backdrop-blur-sm">
              <span
                className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.28em] text-[#ff6b6b]"
                style={{ textShadow: '0 0 12px rgba(239,68,68,0.8)' }}
              >
                WIPED OUT
              </span>
            </div>

            <span
              className="relative font-black text-[#ff3b3b] text-5xl sm:text-7xl leading-none crash-mult-pop"
              style={{
                fontFamily: "'Chakra Petch', sans-serif",
                textShadow:
                  '0 0 30px rgba(239,68,68,0.95), 0 0 60px rgba(255,80,40,0.45), 0 8px 18px rgba(0,0,0,0.95)'
              }}
            >
              {multiplier.toFixed(2)}x
            </span>

            <span
              className="relative mt-2 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white/80"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
            >
              Round crashed
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
