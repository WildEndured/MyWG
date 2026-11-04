import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { EventBus, EVENTS } from './core/EventBus.js';
import { TimeManager } from './core/TimeManager.js';
import { GameMap } from './world/map.js';
import { UnitManager } from './entities/UnitManager.js';
import { Unit } from './entities/Unit.js';
import { Mission } from './entities/Mission.js';
import { CONFIG } from './data/config.js';
import { Debug } from './core/Debug.js';
import { Renderer } from './core/Renderer.js';
import { AudioManager } from './core/AudioManager.js';
import { CaptureZone } from './entities/CaptureZone.js';
import { validateArmorData } from './data/armor.js';
import { validateWeapons } from './data/weapons.js';
import { CALIBERS } from './data/calibers.js';

document.addEventListener('DOMContentLoaded', () => {
  const TEAM_INFO = {
    team1: { id: 'team1', name: 'Команда 1', faction: 'player', player: true },
    team2: { id: 'team2', name: 'Команда 2', faction: 'enemy', player: true },
    spectator: { id: 'spectator', name: 'Наблюдатель', faction: null, player: false }
  };
  const MODE_INFO = {
    attack: { id: 'attack', name: 'Наступление' },
    defense: { id: 'defense', name: 'Оборона' }
  };
  const selection = { team: null, mode: null };

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const coordsDiv = document.getElementById('coords');
  const startScreen = document.getElementById('start-screen');
  const hud = document.getElementById('hud');
  const btnStart = document.getElementById('btn-start');
  const battleTeamEl = document.getElementById('battle-team');
  const battleModeEl = document.getElementById('battle-mode');

  // Валидация данных (не критично, но полезно)
  try {
    const errs = [...validateArmorData(), ...validateWeapons(CALIBERS)];
    if (errs.length) console.error('[data]', errs);
  } catch (e) { console.warn(e); }

  const camera = new Camera(canvas);
  const map = new GameMap(camera);
  const input = new Input(canvas, camera);
  const unitManager = new UnitManager();
  unitManager.camera = camera;
  camera.pathfinder = unitManager.pathfinder;

  // Глобалки (для совместимости со старым кодом)
  window.__CONFIG = CONFIG;
  window.__TimeManager = TimeManager;
  window.__camera = camera;
  window.__unitManager = unitManager;
  window.__Debug = Debug;

  let lastTime = performance.now();
  let rafId = 0;
  let gameStarted = false;
  let lastTapWorld = { x: 0, y: 0 };
  let currentMission = null;
  let currentMapSize = 100;

  // ================== СТАРТОВЫЙ ЭКРАН ==================
  function updateStartButton() {
    if (btnStart) btnStart.disabled = !(selection.team !== null && selection.mode !== null);
  }

  function bindOptionGroup(groupId, key) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.opt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        group.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selection[key] = btn.dataset.value;
        updateStartButton();
      });
    });
  }

  bindOptionGroup('opt-team', 'team');
  bindOptionGroup('opt-mode', 'mode');

  if (btnStart) {
    btnStart.addEventListener('click', () => {
      if (btnStart.disabled) return;
      if (window.AudioManager) AudioManager.init();
      startBattle(selection.team, selection.mode, 100);
    });
  }

  // ================== ЗАПУСК БОЯ ==================
  function startBattle(teamId, modeId, mapSize = 100) {
    const team = TEAM_INFO[teamId], mode = MODE_INFO[modeId];
    if (!team || !mode) return;

    if (!Number.isFinite(mapSize) || mapSize <= 0) mapSize = 100;

    unitManager.reset();
    gameStarted = true;
    currentMapSize = mapSize;

    if (startScreen) startScreen.classList.add('hidden');
    if (hud) hud.classList.remove('hidden');

    unitManager.playerFaction = team.player ? team.faction : null;
    unitManager.playerTeamId = team.id;
    unitManager.gameMode = mode.id;

    if (battleTeamEl) {
      battleTeamEl.textContent = team.name;
      battleTeamEl.className = team.id;
    }
    if (battleModeEl) battleModeEl.textContent = `${mode.name} (${mapSize}м)`;

    const missionId = mode.id === 'attack' ? 'capture_bridge' : 'defend_village';
    currentMission = new Mission(missionId, mapSize);

    // 1. Загрузка миссии
    currentMission.load(unitManager, map, camera);

    // 2. Resize
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    camera.setDpr(dpr);
    input.setWorldSize(mapSize);

    // 3. Fit и clamp
    camera.worldSize = mapSize;
    camera.fit(mapSize, mapSize);
    camera.clampTo(mapSize, mapSize);

    // Сброс таймера времени (включая accumulator)
    TimeManager.reset();
    lastTime = performance.now();
  }

  // ================== RESIZE ==================
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    camera.setDpr(dpr);
    camera.clampTo(map.size, map.size);
    // Инвалидировать кэш высот при смене размера
    if (map._invalidateHeightCache) map._invalidateHeightCache();
  }

  // ================== РАЗМЕР КАРТЫ ==================
  document.querySelectorAll('.hud-top-left button[data-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!gameStarted) return;
      const meters = Number(btn.dataset.size);
      if (!Number.isFinite(meters) || meters <= 0) return;
      if (meters !== map.size && unitManager.units.some(u => !u.isDead)) {
        if (!confirm('Сменить карту? Текущий бой будет сброшен.')) return;
      }
      startBattle(selection.team, selection.mode, meters);
    });
  });

  // ================== КОНЕЦ МИССИИ ==================
  EventBus.on('mission:victory', () => showMissionEnd('ПОБЕДА!', '#0F9D58'));
  EventBus.on('mission:defeat', () => showMissionEnd('ПОРАЖЕНИЕ', '#EA4335'));

  function showMissionEnd(text, color) {
    const endScreen = document.createElement('div');
    endScreen.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 200; font-family: system-ui, sans-serif;`;
    endScreen.innerHTML = `
      <div style="text-align: center;">
        <h1 style="color: ${color}; font-size: 64px; margin: 0; text-shadow: 0 0 20px ${color};">${text}</h1>
        <p style="color: #fff; font-size: 18px; margin: 20px 0;">${currentMission ? currentMission.name : ''}</p>
        <button id="btn-restart" style="padding: 15px 40px; font-size: 18px; font-weight: bold; background: #4285F4; color: #fff; border: none; border-radius: 8px; cursor: pointer; margin-top: 20px;">Начать заново</button>
      </div>
    `;
    document.body.appendChild(endScreen);
    document.getElementById('btn-restart').addEventListener('click', () => {
      endScreen.remove();
      startBattle(selection.team, selection.mode, currentMapSize);
    });
  }

  // ================== ШУМ ==================
  EventBus.on(EVENTS.WORLD_NOISE, ({ x, y, loudness, source }) => {
    if (!source || !loudness) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    for (const unit of unitManager.units) {
      if (unit.isDead || unit.faction === source.faction) continue;
      const dist = Math.max(0.5, Math.hypot(unit.x - x, unit.y - y));
      if (loudness / Math.sqrt(dist) * unit.hearingMultiplier >= 10) {
        unit.lastHeardNoise = { x, y, loudness, time: performance.now() };
      }
    }
  });

  // ================== ТАП ==================
  EventBus.on(EVENTS.INPUT_TAP, (data) => {
    if (coordsDiv) coordsDiv.textContent = `X: ${data.x.toFixed(1)}, Y: ${data.y.toFixed(1)}`;
    lastTapWorld.x = data.x;
    lastTapWorld.y = data.y;
  });

  // ================== FIT ==================
  const fitBtn = document.getElementById('fit');
  if (fitBtn) fitBtn.addEventListener('click', () => {
    camera.worldSize = map.size;
    camera.fit(map.size, map.size);
    camera.clampTo(map.size, map.size);
  });

  // ================== ПОЗЫ ==================
  const stanceButtons = {
    'btn-stand': 'stand',
    'btn-run': 'run',
    'btn-crouch': 'crouch',
    'btn-prone': 'prone'
  };

  function updateStanceUI(active) {
    for (const [id, stance] of Object.entries(stanceButtons)) {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('active', stance === active);
    }
  }

  for (const [id, stance] of Object.entries(stanceButtons)) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => {
      unitManager.setSelectedStance(stance);
      updateStanceUI(stance);
    });
  }
  updateStanceUI('stand');

  // ================== МЕДИЦИНА / ОРУЖИЕ ==================
  const btnBandage = document.getElementById('btn-bandage');
  const btnTourniquet = document.getElementById('btn-tourniquet');
  const btnClearMalfunction = document.getElementById('btn-clear-malfunction');

  if (btnBandage) btnBandage.addEventListener('click', () => {
    if (unitManager.selectedUnits.length === 1) {
      const u = unitManager.selectedUnits[0];
      if (u.bleedingRate > 0) u.applyBandage('torso', true);
    }
  });

  if (btnTourniquet) btnTourniquet.addEventListener('click', () => {
    if (unitManager.selectedUnits.length === 1) {
      const u = unitManager.selectedUnits[0];
      if (u.bleedingRate > 0) u.applyTourniquet('leftLeg', true);
    }
  });

  if (btnClearMalfunction) btnClearMalfunction.addEventListener('click', () => {
    if (unitManager.selectedUnits.length === 1) {
      const u = unitManager.selectedUnits[0];
      if (u.weapon.isJammed || u.weapon.isMisfired) u.weapon.clearMalfunction();
    }
  });

  // ================== ГРАНАТА ==================
  const btnGrenade = document.getElementById('btn-grenade');
  if (btnGrenade) btnGrenade.addEventListener('click', () => {
    if (unitManager.selectedUnits.length === 1) {
      const u = unitManager.selectedUnits[0];
      if (u.grenades > 0) {
        const targetX = lastTapWorld.x || camera.x;
        const targetY = lastTapWorld.y || camera.y;
        u.throwGrenade(targetX, targetY, { unitManager });
      }
    }
  });

  // ================== СМЕНА ОРУЖИЯ ==================
  const btnSwitchWeapon = document.getElementById('btn-switch-weapon');
  if (btnSwitchWeapon) btnSwitchWeapon.addEventListener('click', () => {
    if (unitManager.selectedUnits.length === 1) {
      const u = unitManager.selectedUnits[0];
      if (u.secondaryWeaponConfig) u.switchWeapon();
    }
  });

  // ================== ПРИКАЗЫ ОТРЯДА ==================
  const btnOrderAdvance = document.getElementById('btn-order-advance');
  const btnOrderHold = document.getElementById('btn-order-hold');
  const btnOrderRetreat = document.getElementById('btn-order-retreat');

  if (btnOrderAdvance) btnOrderAdvance.addEventListener('click', () => {
    for (const squad of unitManager.squads) {
      if (squad.faction === unitManager.playerFaction) squad.order = 'advance';
    }
  });
  if (btnOrderHold) btnOrderHold.addEventListener('click', () => {
    for (const squad of unitManager.squads) {
      if (squad.faction === unitManager.playerFaction) squad.order = 'hold';
    }
  });
  if (btnOrderRetreat) btnOrderRetreat.addEventListener('click', () => {
    for (const squad of unitManager.squads) {
      if (squad.faction === unitManager.playerFaction) squad.order = 'retreat';
    }
  });

  // ================== ВРЕМЯ ==================
  const tacticalBtn = document.getElementById('btn-tactical');
  if (tacticalBtn) tacticalBtn.addEventListener('click', () => TimeManager.toggleTacticalPause());

  window.addEventListener('keydown', (e) => {
    if (e.key === CONFIG.TACTICAL_PAUSE.KEY && gameStarted) {
      e.preventDefault();
      TimeManager.toggleTacticalPause();
    }
  });

  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) pauseBtn.addEventListener('click', () => TimeManager.togglePause());

  [1, 2, 4].forEach(s => {
    const b = document.getElementById(`btn-speed-${s}`);
    if (b) b.addEventListener('click', () => TimeManager.setTimeScale(s));
  });

  EventBus.on(EVENTS.TIME_CHANGED, ({ scale, isPaused, isTacticalPause }) => {
    document.querySelectorAll('.time-btn').forEach(btn => {
      if (btn.id === 'btn-debug' || btn.id === 'btn-tactical') return;
      btn.classList.remove('active');
    });
    if (isTacticalPause) {
      document.getElementById('btn-tactical')?.classList.add('active');
      document.getElementById('btn-pause')?.classList.remove('active');
    } else if (isPaused) {
      document.getElementById('btn-pause')?.classList.add('active');
      document.getElementById('btn-tactical')?.classList.remove('active');
    } else {
      document.getElementById(`btn-speed-${scale}`)?.classList.add('active');
      document.getElementById('btn-tactical')?.classList.remove('active');
    }
  });

  // ================== ДЕБАГ ==================
  const debugBtn = document.getElementById('btn-debug');
  function syncDebugButton() {
    if (debugBtn) debugBtn.classList.toggle('active', Debug.isEnabled);
  }
  if (debugBtn) debugBtn.addEventListener('click', () => {
    Debug.setEnabled(!Debug.isEnabled);
    syncDebugButton();
  });
  EventBus.on(EVENTS.DEBUG_TOGGLED, syncDebugButton);

  // ================== ПАНЕЛЬ ЮНИТА ==================
  const unitPanel = document.getElementById('unit-panel');
  const tabButtons = document.querySelectorAll('.unit-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(`tab-${btn.dataset.tab}`);
      if (target) target.classList.add('active');
    });
  });

  function updateUnitPanel(unit) {
    if (!unit) return;

    const nameEl = document.getElementById('info-name');
    if (nameEl) nameEl.textContent = unit.name || 'Безымянный';

    const roleEl = document.getElementById('info-role');
    if (roleEl) roleEl.textContent = `${unit.name} (Ранг ${unit.rank})`;

    let heightText = 'Равнина (0 м)';
    if (unit.pathfinder && unit.pathfinder.heightMap) {
      const h = unit.pathfinder.getHeight(unit.x, unit.y);
      if (h > 0.5) heightText = `Холм (+${h.toFixed(1)} м)`;
      else if (h < -0.5) heightText = `Окоп (${h.toFixed(1)} м)`;
    }
    const weightEl = document.getElementById('info-weight');
    if (weightEl) weightEl.textContent = `${unit.totalWeight.toFixed(1)} кг | ${heightText}`;

    let statusText = 'Живой', statusColor = '#0F9D58';
    if (unit.isDead) { statusText = 'Мертв'; statusColor = '#EA4335'; }
    else if (unit.isUnconscious) { statusText = 'Без сознания'; statusColor = '#F4B400'; }
    else if (unit.isSurrendered) { statusText = 'Сдался'; statusColor = '#FFF'; }

    const statusEl = document.getElementById('info-status');
    if (statusEl) {
      statusEl.textContent = statusText;
      statusEl.style.color = statusColor;
    }

    let weaponStr = unit.weapon.name;
    if (unit.secondaryWeaponConfig) weaponStr += ` (запас: ${unit.secondaryWeaponConfig.name})`;
    const weaponEl = document.getElementById('info-weapon');
    if (weaponEl) weaponEl.textContent = weaponStr;

    const reserveRounds = unit.weapon.getReserveRounds();
    const ammoEl = document.getElementById('info-ammo');
    if (ammoEl) {
      ammoEl.textContent = `${unit.weapon.ammo} / ${reserveRounds} (маг.: ${unit.weapon.reserveMagazines}) | Гранат: ${unit.grenades}`;
    }

    const armorNames = [];
    for (const [, piece] of Object.entries(unit.armor)) {
      if (!armorNames.find(a => a.name === piece.name)) {
        armorNames.push({
          name: piece.name, level: piece.level, maxLevel: piece.baseLevel,
          durability: piece.durability, maxDurability: piece.maxDurability,
          cracked: piece.durability < piece.maxDurability * 0.5
        });
      }
    }
    const armorStr = armorNames.map(a => {
      const status = a.level < a.maxLevel ? (a.level === 0 ? ' (разрушена)' : ` (уровень ${a.level})`) : '';
      const crack = a.cracked ? ' [треснула]' : '';
      return `${a.name}${status}${crack}`;
    }).join(', ');
    const armorEl = document.getElementById('info-armor');
    if (armorEl) armorEl.textContent = armorStr || 'Нет';

    const medEl = document.getElementById('info-medical');
    if (medEl) medEl.textContent = `Бинты: ${unit.medical.bandage} | Жгуты: ${unit.medical.tourniquet}`;

    const hpPercent = Math.max(0, (unit.hp / unit.maxHp) * 100);
    const stamPercent = Math.max(0, (unit.stamina / unit.maxStamina) * 100);
    const bloodPercent = Math.max(0, (unit.blood / unit.maxBlood) * 100);
    const shockPercent = Math.max(0, unit.shock * 100);

    const hpText = document.getElementById('info-hp-text');
    if (hpText) hpText.textContent = `${Math.round(unit.hp)} / ${unit.maxHp}`;
    const hpBar = document.getElementById('info-hp-bar');
    if (hpBar) {
      hpBar.style.width = `${hpPercent}%`;
      hpBar.style.background = hpPercent > 50 ? '#0F9D58' : (hpPercent > 20 ? '#F4B400' : '#EA4335');
    }

    const stamText = document.getElementById('info-stamina-text');
    if (stamText) stamText.textContent = `${Math.round(unit.stamina)} / ${unit.maxStamina}`;
    const stamBar = document.getElementById('info-stamina-bar');
    if (stamBar) stamBar.style.width = `${stamPercent}%`;

    const bloodText = document.getElementById('info-blood-text');
    if (bloodText) bloodText.textContent = `${Math.round(unit.blood)} / ${unit.maxBlood}`;
    const bloodBar = document.getElementById('info-blood-bar');
    if (bloodBar) bloodBar.style.width = `${bloodPercent}%`;

    const shockText = document.getElementById('info-shock-text');
    if (shockText) shockText.textContent = `${Math.round(shockPercent)}%`;
    const shockBar = document.getElementById('info-shock-bar');
    if (shockBar) shockBar.style.width = `${shockPercent}%`;

    const bleedEl = document.getElementById('info-bleeding');
    if (bleedEl) {
      if (unit.bleedingRate > 0) bleedEl.classList.remove('hidden');
      else bleedEl.classList.add('hidden');
    }

    const medProgressEl = document.getElementById('info-med-progress');
    if (medProgressEl) {
      if (unit.medical.isApplying) medProgressEl.classList.remove('hidden');
      else medProgressEl.classList.add('hidden');
    }
  }

  EventBus.on(EVENTS.UNITS_SELECTED, (units) => {
    if (units.length === 1) {
      unitPanel.classList.remove('hidden');
      updateUnitPanel(units[0]);
    } else {
      unitPanel.classList.add('hidden');
    }
  });

  function updatePanelLoop() {
    if (!unitPanel.classList.contains('hidden') && unitManager.selectedUnits.length === 1) {
      const u = unitManager.selectedUnits[0];
      if (!u.isDead) updateUnitPanel(u);
    }
    requestAnimationFrame(updatePanelLoop);
  }
  updatePanelLoop();

  // ================== ГЛАВНЫЙ ЦИКЛ ==================
  function frame(now) {
    const realDt = Math.max(0, (now - lastTime) / 1000);
    lastTime = now;

    if (gameStarted) {
      // FIX (Шаг 4): фиксированный шаг 1/60 с аккумулятором.
      // TimeManager.stepFixed сам решает, сколько подшагов сделать,
      // и останавливается при паузе / тактической паузе.
      Debug.start('update');
      try {
        const steps = TimeManager.stepFixed(realDt, (fixedDt) => {
          unitManager.update(fixedDt);
          if (currentMission && currentMission.status === 'active') {
            currentMission.update(fixedDt, unitManager);
          }
        });
        // Если 0 шагов — не ошибка, просто пауза
        void steps;
      } catch (err) {
        console.error('[Game] update error:', err);
      }
      Debug.end('update');

      // Защита камеры каждый кадр
      camera.validate();

      Debug.update(realDt);

      // Панель миссии
      if (currentMission) {
        const missionNameEl = document.getElementById('mission-name');
        const objectiveEl = document.getElementById('mission-objective');
        const timerEl = document.getElementById('mission-timer');
        if (missionNameEl) missionNameEl.textContent = currentMission.name;
        if (objectiveEl) objectiveEl.textContent = currentMission.getObjectiveText();
        if (timerEl) {
          const remaining = currentMission.getTimeRemaining();
          if (remaining !== null) {
            const min = Math.floor(remaining / 60);
            const sec = Math.floor(remaining % 60);
            timerEl.textContent = `Осталось: ${min}:${sec.toString().padStart(2, '0')}`;
          } else {
            timerEl.textContent = `Время: ${Math.floor(currentMission.timeElapsed)} сек`;
          }
        }
      }

      const dpr = camera.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      Debug.start('draw');
      try {
        Renderer.draw(ctx, camera, map, unitManager);
        Debug.draw(ctx, camera, unitManager, map, unitManager.pathfinder);

        if (TimeManager.isTacticalPause) {
          ctx.save();
          ctx.fillStyle = 'rgba(80, 150, 255, 0.08)';
          ctx.fillRect(0, 0, camera.vw, camera.vh);
          ctx.fillStyle = '#8ab4f8';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('ТАКТИЧЕСКАЯ ПАУЗА — приказы разрешены', camera.vw / 2, 40);
          ctx.restore();
        }
      } catch (err) {
        console.error('[Game] draw error:', err);
      }
      Debug.end('draw');
    }

    rafId = requestAnimationFrame(frame);
  }

  // ================== ЗАВЕРШЕНИЕ ==================
  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(rafId);
    input.destroy();
    unitManager.destroy();
    Debug.destroy();
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !TimeManager.isPaused && !TimeManager.isTacticalPause) {
      TimeManager.togglePause();
    }
  });

  resize();
  lastTime = performance.now();
  rafId = requestAnimationFrame(frame);
});
