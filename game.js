'use strict';

// ── Data ─────────────────────────────────────────────────────────────────────

const MAX_LEVEL = 10;

const PARTY = [
  { name: 'Aria',  hp: 30, maxHp: 30, atk: 8,  def: 3, level: 1, xp: 0 },
  { name: 'Bolt',  hp: 25, maxHp: 25, atk: 12, def: 1, level: 1, xp: 0 },
  { name: 'Terra', hp: 35, maxHp: 35, atk: 6,  def: 5, level: 1, xp: 0 },
];

// XP needed to reach next level (index = current level)
const XP_TABLE = [0, 10, 25, 45, 70, 100, 135, 175, 220, 270];

const TOWNS = [
  {
    name: 'Ashvale',
    description: 'A quiet village shrouded in morning mist.',
    enemies: [
      { name: 'Wolf',    hp: 12, atk: 4, def: 1, xp: 5 },
      { name: 'Bandit',  hp: 10, atk: 6, def: 0, xp: 6 },
    ],
    nextTown: 1,
  },
  {
    name: 'Ironhold',
    description: 'A dwarven mining town with soot-stained walls.',
    enemies: [
      { name: 'Golem',    hp: 20, atk: 7, def: 3, xp: 10 },
      { name: 'Dark Elf', hp: 16, atk: 9, def: 2, xp: 12 },
    ],
    nextTown: 2,
  },
  {
    name: 'Skyspire',
    description: 'A floating citadel — the lair of the Dark Sovereign.',
    enemies: [
      { name: 'Shadow Knight', hp: 28, atk: 11, def: 4, xp: 18 },
      { name: 'Dark Sovereign', hp: 50, atk: 14, def: 6, xp: 40, isBoss: true },
    ],
    nextTown: null,
  },
];

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  screen: 'town',   // 'town' | 'battle' | 'levelup' | 'gameover' | 'win'
  townIndex: 0,
  enemy: null,
  levelupQueue: [],  // party members waiting to level up
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg) {
  document.getElementById('log').textContent = msg;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function randInt(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

function aliveParty() { return PARTY.filter(c => c.hp > 0); }

function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderParty() {
  const el = document.getElementById('party-list');
  el.innerHTML = PARTY.map(c => {
    const pct = Math.round((c.hp / c.maxHp) * 100);
    const dead = c.hp <= 0 ? ' dead' : '';
    return `
      <div class="member${dead}">
        <span class="member-name">${c.name}</span>
        <span class="member-level">Lv${c.level}</span>
        <div class="hp-bar"><div class="hp-fill" style="width:${pct}%"></div></div>
        <span class="member-hp">${Math.max(0, c.hp)}/${c.maxHp}</span>
      </div>`;
  }).join('');
}

function renderEnemy(enemy) {
  const panel = document.getElementById('enemy-panel');
  if (!enemy) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  document.getElementById('enemy-name').textContent = enemy.name;
  const pct = Math.round((enemy.hp / enemy.maxHp) * 100);
  document.getElementById('enemy-hp-fill').style.width = pct + '%';
}

function renderButtons(defs) {
  const el = document.getElementById('buttons');
  el.innerHTML = defs.map(({ label, fn }) =>
    `<button>${label}</button>`
  ).join('');
  el.querySelectorAll('button').forEach((btn, i) => {
    btn.addEventListener('click', defs[i].fn);
  });
}

function renderLocation() {
  document.getElementById('location-name').textContent =
    TOWNS[state.townIndex].name;
}

// ── Screens ───────────────────────────────────────────────────────────────────

function showTown() {
  state.screen = 'town';
  const town = TOWNS[state.townIndex];
  renderLocation();
  renderEnemy(null);
  log(town.description);
  renderParty();

  const btns = [
    { label: 'Explore (fight)', fn: startBattle },
    { label: 'Rest (heal 5 HP)', fn: rest },
  ];
  if (town.nextTown !== null) {
    btns.push({ label: `Travel to ${TOWNS[town.nextTown].name}`, fn: travel });
  }
  renderButtons(btns);
}

function rest() {
  aliveParty().forEach(c => {
    c.hp = clamp(c.hp + 5, 0, c.maxHp);
  });
  renderParty();
  log('The party rests and recovers a little health.');
}

function travel() {
  const town = TOWNS[state.townIndex];
  if (town.nextTown === null) return;
  state.townIndex = town.nextTown;
  showTown();
}

// ── Battle ────────────────────────────────────────────────────────────────────

function startBattle() {
  const town = TOWNS[state.townIndex];
  const template = town.enemies[randInt(0, town.enemies.length - 1)];
  state.enemy = deepCopy(template);
  state.enemy.maxHp = state.enemy.hp;
  state.screen = 'battle';

  renderEnemy(state.enemy);
  log(`A ${state.enemy.name} appears!`);
  renderBattleButtons();
}

function renderBattleButtons() {
  renderButtons([
    { label: 'Attack', fn: playerAttack },
    { label: 'Defend', fn: playerDefend },
  ]);
}

function playerAttack() {
  if (state.screen !== 'battle') return;
  const attacker = aliveParty()[0];
  if (!attacker) return;

  const dmg = Math.max(1, attacker.atk - state.enemy.def + randInt(-2, 2));
  state.enemy.hp -= dmg;
  renderEnemy(state.enemy);

  if (state.enemy.hp <= 0) {
    log(`${attacker.name} defeats the ${state.enemy.name}!`);
    awardXP(state.enemy.xp);
    return;
  }

  log(`${attacker.name} hits for ${dmg} — the enemy strikes back.`);
  enemyAttack(false);
}

function playerDefend() {
  if (state.screen !== 'battle') return;
  const defender = aliveParty()[0];
  if (!defender) return;
  log(`${defender.name} braces — the enemy attacks cautiously.`);
  enemyAttack(true);
}

function enemyAttack(halved) {
  const target = aliveParty()[randInt(0, aliveParty().length - 1)];
  if (!target) return;
  let dmg = Math.max(1, state.enemy.atk - target.def + randInt(-2, 2));
  if (halved) dmg = Math.max(1, Math.floor(dmg / 2));
  target.hp -= dmg;
  renderParty();

  if (aliveParty().length === 0) {
    log('The party has fallen — your journey ends here.');
    state.screen = 'gameover';
    renderButtons([{ label: 'Try Again', fn: resetGame }]);
  }
}

// ── XP & Leveling ─────────────────────────────────────────────────────────────

function awardXP(amount) {
  state.levelupQueue = [];
  aliveParty().forEach(c => {
    if (c.level >= MAX_LEVEL) return;
    c.xp += amount;
    const needed = XP_TABLE[c.level];
    if (c.xp >= needed) {
      c.xp -= needed;
      state.levelupQueue.push(c);
    }
  });
  renderParty();
  if (state.levelupQueue.length > 0) {
    processLevelup();
  } else {
    showTown();
  }
}

function processLevelup() {
  if (state.levelupQueue.length === 0) { showTown(); return; }
  const c = state.levelupQueue.shift();
  if (c.level >= MAX_LEVEL) { processLevelup(); return; }

  state.screen = 'levelup';
  c.level++;
  c.maxHp += 5;
  c.hp = clamp(c.hp + 5, 0, c.maxHp);
  c.atk += 1;
  renderParty();
  log(`${c.name} reached level ${c.level}!`);
  renderButtons([{ label: 'Continue', fn: processLevelup }]);
}

// ── Boss Win ──────────────────────────────────────────────────────────────────

function checkWin() {
  const boss = TOWNS[2].enemies.find(e => e.isBoss);
  if (state.enemy && state.enemy.name === boss.name && state.enemy.hp <= 0) {
    state.screen = 'win';
    log('The Dark Sovereign is vanquished — light returns to the realm!');
    renderButtons([]);
  }
}

// Patch awardXP to check win condition
const _awardXP = awardXP;
function awardXP(amount) {  // eslint-disable-line no-inner-declarations
  if (state.enemy && state.enemy.isBoss) {
    state.screen = 'win';
    renderEnemy(null);
    log('The Dark Sovereign is vanquished — light returns to the realm!');
    renderButtons([]);
    return;
  }
  _awardXP(amount);
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetGame() {
  PARTY.forEach(c => {
    c.hp = c.maxHp;
    c.xp = 0;
    c.level = 1;
    c.atk = PARTY_BASE[c.name].atk;
    c.maxHp = PARTY_BASE[c.name].maxHp;
    c.hp = c.maxHp;
  });
  state.townIndex = 0;
  state.enemy = null;
  showTown();
}

// Store base stats for reset
const PARTY_BASE = {};
PARTY.forEach(c => { PARTY_BASE[c.name] = { atk: c.atk, maxHp: c.maxHp }; });

// ── Boot ──────────────────────────────────────────────────────────────────────

showTown();
