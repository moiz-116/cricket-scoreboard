'use strict';

let match = null;
let history = [];
let wicketPanelOpen = false;
let statusMessage = '';

const $ = (id) => document.getElementById(id);

function escapeHTML(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
}

function formatOvers(legalBalls) {
  return Math.floor(legalBalls / 6) + '.' + (legalBalls % 6);
}

function ratePerOver(runs, legalBalls) {
  if (legalBalls === 0) return '0.00';
  return (runs / (legalBalls / 6)).toFixed(2);
}

function parseNames(text) {
  return text
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function hasDuplicates(list) {
  const seen = new Set();
  for (const name of list) {
    const key = name.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function wicketLimit() {
  return Math.min(10, match.batters.length - 1);
}

function swapStrike() {
  const temp = match.striker;
  match.striker = match.nonStriker;
  match.nonStriker = temp;
}

function addChip(label, type) {
  match.overBalls.push({ label: label, type: type });
}

function saveHistory() {
  history.push(JSON.stringify(match));
}

function canScore() {
  return match !== null &&
    !match.inningsOver &&
    match.currentBowler !== null &&
    !wicketPanelOpen;
}

function dismissalText(type, bowlerName) {
  switch (type) {
    case 'Bowled': return 'b ' + bowlerName;
    case 'Caught': return 'caught, b ' + bowlerName;
    case 'LBW': return 'lbw b ' + bowlerName;
    case 'Stumped': return 'stumped, b ' + bowlerName;
    case 'Hit wicket': return 'hit wicket, b ' + bowlerName;
    default: return 'run out';
  }
}

function createMatch(config) {
  return {
    battingTeam: config.battingTeam,
    bowlingTeam: config.bowlingTeam,
    totalOvers: config.totalOvers,

    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wd: 0, nb: 0, b: 0, lb: 0 },

    batters: config.batters.map((name) => ({
      name: name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: ''
    })),
    bowlers: config.bowlers.map((name) => ({
      name: name, legalBalls: 0, runs: 0, wickets: 0
    })),

    striker: 0,
    nonStriker: 1,
    nextBatter: 2,

    currentBowler: null,
    lastBowler: null,

    overBalls: [],
    fow: [],
    inningsOver: false,
    endReason: '',

    innings: 1,
    target: null,
    firstInnings: null
  };
}

function validatePlayers(batters, bowlers) {
  const errors = [];
  if (batters.length < 2 || batters.length > 11) {
    errors.push('Enter between 2 and 11 batters (one per line).');
  } else if (hasDuplicates(batters)) {
    errors.push('Batter names must be different from each other.');
  }
  if (bowlers.length < 2 || bowlers.length > 11) {
    errors.push('Enter between 2 and 11 bowlers (one per line).');
  } else if (hasDuplicates(bowlers)) {
    errors.push('Bowler names must be different from each other.');
  }
  return errors;
}

function startMatch() {
  const battingTeam = $('battingTeam').value.trim();
  const bowlingTeam = $('bowlingTeam').value.trim();
  const totalOvers = Number($('totalOvers').value);
  const batters = parseNames($('batterList').value);
  const bowlers = parseNames($('bowlerList').value);

  const errors = [];
  if (battingTeam === '') errors.push('Enter the batting team name.');
  if (bowlingTeam === '') errors.push('Enter the bowling team name.');
  if (!Number.isInteger(totalOvers) || totalOvers < 1 || totalOvers > 50) {
    errors.push('Total overs must be a whole number from 1 to 50.');
  }
  validatePlayers(batters, bowlers).forEach((message) => errors.push(message));

  if (errors.length > 0) {
    $('setupError').textContent = errors.join(' ');
    return;
  }

  $('setupError').textContent = '';
  match = createMatch({
    battingTeam: battingTeam,
    bowlingTeam: bowlingTeam,
    totalOvers: totalOvers,
    batters: batters,
    bowlers: bowlers
  });
  history = [];
  wicketPanelOpen = false;
  statusMessage = '';

  $('setupSection').classList.add('hidden');
  $('scoreboardSection').classList.remove('hidden');
  $('extraRuns').value = '0';
  render();
}

function fillSampleData() {
  $('battingTeam').value = 'Karachi Strikers';
  $('bowlingTeam').value = 'Lahore Lions';
  $('totalOvers').value = '5';
  $('batterList').value = [
    'Ahmed', 'Bilal', 'Danish', 'Farhan', 'Hamza', 'Imran',
    'Junaid', 'Kamran', 'Luqman', 'Moiz', 'Nadeem'
  ].join('\n');
  $('bowlerList').value = ['Omar', 'Qasim', 'Rashid', 'Sameer', 'Talha'].join('\n');
  $('setupError').textContent = '';
}

function resetMatch() {
  if (match === null) return;
  const sure = confirm('Reset the scoreboard? All scores are cleared and you return to Match setup.');
  if (!sure) return;

  match = null;
  history = [];
  wicketPanelOpen = false;
  statusMessage = '';
  $('setupError').textContent = '';
  $('scoreboardSection').classList.add('hidden');
  $('setupSection').classList.remove('hidden');
}

function afterBall(wasLegal) {
  if (wasLegal && match.legalBalls % 6 === 0) {
    swapStrike();
    match.lastBowler = match.currentBowler;
    match.currentBowler = null;
  }

  if (match.innings === 2 && match.runs >= match.target) {
    match.inningsOver = true;
    match.endReason = 'Target chased';
  } else if (match.wickets >= wicketLimit()) {
    match.inningsOver = true;
    match.endReason = 'All out';
  } else if (match.legalBalls >= match.totalOvers * 6) {
    match.inningsOver = true;
    match.endReason = 'Overs completed';
  }
}

function addRuns(runs) {
  if (!canScore()) return;
  saveHistory();

  const batter = match.batters[match.striker];
  const bowler = match.bowlers[match.currentBowler];

  match.runs += runs;
  batter.runs += runs;
  batter.balls += 1;
  bowler.runs += runs;
  if (runs === 4) batter.fours += 1;
  if (runs === 6) batter.sixes += 1;

  match.legalBalls += 1;
  bowler.legalBalls += 1;

  if (runs % 2 === 1) swapStrike();

  addChip(String(runs), runs === 4 ? 'four' : runs === 6 ? 'six' : 'run');
  statusMessage = '';
  afterBall(true);
  render();
}

function addExtra(type) {
  if (!canScore()) return;

  const extraRuns = Number($('extraRuns').value);

  if ((type === 'bye' || type === 'legbye') && extraRuns < 1) {
    statusMessage = 'Choose at least 1 run for a bye or leg-bye.';
    render();
    return;
  }

  saveHistory();

  const batter = match.batters[match.striker];
  const bowler = match.bowlers[match.currentBowler];
  let wasLegal = false;
  let label = '';

  if (type === 'wide') {
    const total = 1 + extraRuns;
    match.runs += total;
    bowler.runs += total;
    match.extras.wd += total;
    label = extraRuns === 0 ? 'Wd' : 'Wd+' + extraRuns;
  } else if (type === 'noball') {
    match.runs += 1 + extraRuns;
    bowler.runs += 1 + extraRuns;
    match.extras.nb += 1;
    batter.runs += extraRuns;
    batter.balls += 1;
    if (extraRuns === 4) batter.fours += 1;
    if (extraRuns === 6) batter.sixes += 1;
    label = extraRuns === 0 ? 'Nb' : 'Nb+' + extraRuns;
  } else if (type === 'bye') {
    match.runs += extraRuns;
    match.extras.b += extraRuns;
    batter.balls += 1;
    match.legalBalls += 1;
    bowler.legalBalls += 1;
    wasLegal = true;
    label = 'B' + extraRuns;
  } else {
    match.runs += extraRuns;
    match.extras.lb += extraRuns;
    batter.balls += 1;
    match.legalBalls += 1;
    bowler.legalBalls += 1;
    wasLegal = true;
    label = 'Lb' + extraRuns;
  }

  if (extraRuns % 2 === 1) swapStrike();

  addChip(label, 'extra');
  $('extraRuns').value = '0';
  statusMessage = '';
  afterBall(wasLegal);
  render();
}

function toggleRunOutFields() {
  const isRunOut = $('dismissalType').value === 'Run out';
  $('runOutWhoField').classList.toggle('hidden', !isRunOut);
  $('runOutRunsField').classList.toggle('hidden', !isRunOut);
}

function openWicketPanel() {
  if (!canScore()) return;

  wicketPanelOpen = true;
  $('dismissalType').value = 'Bowled';
  $('runOutRuns').value = '0';
  $('runOutWho').value = 'striker';

  const whoOptions = $('runOutWho').options;
  whoOptions[0].textContent = 'Striker: ' + match.batters[match.striker].name;
  whoOptions[1].textContent = 'Non-striker: ' + match.batters[match.nonStriker].name;

  toggleRunOutFields();
  statusMessage = '';
  render();
}

function cancelWicket() {
  wicketPanelOpen = false;
  render();
}

function confirmWicket() {
  if (match === null || match.inningsOver || match.currentBowler === null) return;

  saveHistory();

  const type = $('dismissalType').value;
  const bowler = match.bowlers[match.currentBowler];
  const striker = match.batters[match.striker];

  let runsCompleted = 0;
  let outIndex = match.striker;

  if (type === 'Run out') {
    runsCompleted = Number($('runOutRuns').value);
    outIndex = $('runOutWho').value === 'non' ? match.nonStriker : match.striker;
  }

  match.runs += runsCompleted;
  striker.runs += runsCompleted;
  striker.balls += 1;
  bowler.runs += runsCompleted;
  match.legalBalls += 1;
  bowler.legalBalls += 1;

  if (runsCompleted % 2 === 1) swapStrike();

  const outBatter = match.batters[outIndex];
  outBatter.out = true;
  outBatter.dismissal = dismissalText(type, bowler.name);
  match.wickets += 1;
  if (type !== 'Run out') bowler.wickets += 1;

  match.fow.push(
    match.runs + '-' + match.wickets + ' (' + outBatter.name + ', ' +
    formatOvers(match.legalBalls) + ' ov)'
  );

  if (match.wickets < wicketLimit()) {
    const newIndex = match.nextBatter;
    match.nextBatter += 1;
    if (match.striker === outIndex) {
      match.striker = newIndex;
    } else {
      match.nonStriker = newIndex;
    }
  }

  addChip(runsCompleted > 0 ? 'W+' + runsCompleted : 'W', 'wicket');

  wicketPanelOpen = false;
  statusMessage = '';
  afterBall(true);
  render();
}

function confirmBowler() {
  if (match === null || match.inningsOver || match.currentBowler !== null) return;

  const index = Number($('bowlerSelect').value);
  if (!Number.isInteger(index) || index < 0 || index >= match.bowlers.length) return;

  if (index === match.lastBowler) {
    statusMessage = 'The same bowler cannot bowl two overs in a row.';
    render();
    return;
  }

  match.currentBowler = index;
  match.overBalls = [];
  statusMessage = '';
  render();
}

function startSecondInnings() {
  if (match === null || !match.inningsOver || match.innings !== 1) return;

  const batters = parseNames($('batterList2').value);
  const bowlers = parseNames($('bowlerList2').value);
  const errors = validatePlayers(batters, bowlers);
  if (errors.length > 0) {
    $('setupError2').textContent = errors.join(' ');
    return;
  }
  $('setupError2').textContent = '';

  const first = JSON.parse(JSON.stringify(match));
  match = createMatch({
    battingTeam: first.bowlingTeam,
    bowlingTeam: first.battingTeam,
    totalOvers: first.totalOvers,
    batters: batters,
    bowlers: bowlers
  });
  match.innings = 2;
  match.target = first.runs + 1;
  match.firstInnings = first;

  history = [];
  wicketPanelOpen = false;
  statusMessage = '';
  $('extraRuns').value = '0';
  render();
}

function buildResult() {
  const overs = formatOvers(match.legalBalls);
  const score = match.battingTeam + ' ' + match.runs + '/' + match.wickets +
    ' in ' + overs + ' overs';

  if (match.innings === 1) {
    return 'First innings complete (' + match.endReason + '): ' + score + '. ' +
      match.bowlingTeam + ' need ' + (match.runs + 1) + ' runs to win.';
  }

  let result;
  if (match.runs >= match.target) {
    const left = wicketLimit() - match.wickets;
    result = match.battingTeam + ' won by ' + left + (left === 1 ? ' wicket.' : ' wickets.');
  } else if (match.runs === match.target - 1) {
    result = 'The match is tied.';
  } else {
    const margin = match.target - 1 - match.runs;
    result = match.bowlingTeam + ' won by ' + margin + (margin === 1 ? ' run.' : ' runs.');
  }
  return 'Match complete: ' + score + '. ' + result;
}

function undo() {
  if (match === null || history.length === 0) return;
  match = JSON.parse(history.pop());
  wicketPanelOpen = false;
  statusMessage = 'Last ball undone.';
  render();
}

function extrasLine(m) {
  const ex = m.extras;
  const total = ex.wd + ex.nb + ex.b + ex.lb;
  return 'Extras: ' + total + ' (wides ' + ex.wd + ', no-balls ' + ex.nb +
    ', byes ' + ex.b + ', leg-byes ' + ex.lb + ')';
}

function battingRowsHTML(m) {
  let html = '';
  m.batters.forEach((batter, i) => {
    const atCrease = !batter.out && (i === m.striker || i === m.nonStriker);
    const yetToBat = !batter.out && !atCrease;

    let status;
    if (batter.out) status = batter.dismissal;
    else if (atCrease) status = 'not out';
    else status = 'yet to bat';

    const onStrike = atCrease && i === m.striker && !m.inningsOver;
    const rowClass = onStrike ? 'row-active' : (batter.out ? 'row-out' : '');
    const nameText = escapeHTML(batter.name) + (onStrike ? ' *' : '');

    if (yetToBat) {
      html +=
        '<tr class="' + rowClass + '">' +
        '<td class="name-cell">' + nameText + '</td>' +
        '<td class="status-cell">' + status + '</td>' +
        '<td class="num">-</td><td class="num">-</td><td class="num">-</td>' +
        '<td class="num">-</td><td class="num">-</td></tr>';
    } else {
      const strikeRate = batter.balls === 0
        ? '-'
        : (batter.runs / batter.balls * 100).toFixed(1);
      html +=
        '<tr class="' + rowClass + '">' +
        '<td class="name-cell"><b>' + nameText + '</b></td>' +
        '<td class="status-cell">' + escapeHTML(status) + '</td>' +
        '<td class="num"><b>' + batter.runs + '</b></td>' +
        '<td class="num">' + batter.balls + '</td>' +
        '<td class="num">' + batter.fours + '</td>' +
        '<td class="num">' + batter.sixes + '</td>' +
        '<td class="num">' + strikeRate + '</td></tr>';
    }
  });
  return html;
}

function bowlingRowsHTML(m) {
  let html = '';
  m.bowlers.forEach((bowler, i) => {
    const isCurrent = i === m.currentBowler && !m.inningsOver;
    if (!isCurrent && bowler.legalBalls === 0 && bowler.runs === 0) return;

    const economy = bowler.legalBalls === 0 ? '-' : ratePerOver(bowler.runs, bowler.legalBalls);
    html +=
      '<tr class="' + (isCurrent ? 'row-active' : '') + '">' +
      '<td><b>' + escapeHTML(bowler.name) + (isCurrent ? ' *' : '') + '</b></td>' +
      '<td class="num">' + formatOvers(bowler.legalBalls) + '</td>' +
      '<td class="num">' + bowler.runs + '</td>' +
      '<td class="num"><b>' + bowler.wickets + '</b></td>' +
      '<td class="num">' + economy + '</td></tr>';
  });
  if (html === '') {
    html = '<tr><td colspan="5">No bowler has started an over yet.</td></tr>';
  }
  return html;
}

function scorecardHTML(m) {
  return '' +
    '<div class="table-wrap"><table><thead><tr>' +
    '<th>Batter</th><th>Status</th><th class="num">R</th><th class="num">B</th>' +
    '<th class="num">4s</th><th class="num">6s</th><th class="num">SR</th>' +
    '</tr></thead><tbody>' + battingRowsHTML(m) + '</tbody></table></div>' +
    '<p class="note">' + escapeHTML(extrasLine(m)) + '</p>' +
    (m.fow.length > 0
      ? '<p class="note">Fall of wickets: ' + escapeHTML(m.fow.join(', ')) + '</p>'
      : '') +
    '<div class="table-wrap"><table><thead><tr>' +
    '<th>Bowler</th><th class="num">O</th><th class="num">R</th>' +
    '<th class="num">W</th><th class="num">Econ</th>' +
    '</tr></thead><tbody>' + bowlingRowsHTML(m) + '</tbody></table></div>';
}

function render() {
  if (match === null) return;

  const needBowler = match.currentBowler === null && !match.inningsOver;
  const scoringOn = canScore();
  const inningsBreak = match.inningsOver && match.innings === 1;

  $('teamName').textContent = match.battingTeam;
  $('vsText').textContent =
    'against ' + match.bowlingTeam + ' (' + (match.innings === 1 ? '1st' : '2nd') + ' innings)';
  $('scoreText').textContent = match.runs + '/' + match.wickets;
  $('oversText').textContent = '(' + formatOvers(match.legalBalls) + ')';
  $('oversLimit').textContent = match.totalOvers + (match.totalOvers === 1 ? ' over' : ' overs');
  $('runRate').textContent = ratePerOver(match.runs, match.legalBalls);

  const ex = match.extras;
  const extrasTotal = ex.wd + ex.nb + ex.b + ex.lb;
  $('extrasTotal').textContent = String(extrasTotal);
  $('currentBowlerText').textContent =
    match.currentBowler !== null ? match.bowlers[match.currentBowler].name : '-';

  const chase = $('chaseInfo');
  if (match.innings === 2) {
    chase.classList.remove('hidden');
    if (match.inningsOver) {
      chase.textContent = 'Target was ' + match.target + ' runs.';
    } else {
      const need = match.target - match.runs;
      const ballsLeft = match.totalOvers * 6 - match.legalBalls;
      chase.textContent =
        'Target ' + match.target + '. ' + match.battingTeam + ' need ' + need +
        (need === 1 ? ' run' : ' runs') + ' from ' + ballsLeft +
        (ballsLeft === 1 ? ' ball' : ' balls') +
        '. Required rate ' + ratePerOver(need, ballsLeft) + '.';
    }
  } else {
    chase.classList.add('hidden');
    chase.textContent = '';
  }

  $('overCaption').textContent =
    (match.currentBowler === null && match.overBalls.length > 0) ? 'Last over' : 'This over';
  $('overChips').innerHTML = match.overBalls
    .map((ball) => '<span class="chip ' + ball.type + '">' + escapeHTML(ball.label) + '</span>')
    .join('');

  const banner = $('resultBanner');
  if (match.inningsOver) {
    banner.classList.remove('hidden');
    banner.textContent = buildResult();
  } else {
    banner.classList.add('hidden');
    banner.textContent = '';
  }

  const breakPanel = $('inningsBreakPanel');
  if (inningsBreak) {
    if (breakPanel.classList.contains('hidden')) {
      $('batterList2').value = match.bowlers.map((b) => b.name).join('\n');
      $('bowlerList2').value = match.batters.map((b) => b.name).join('\n');
      $('setupError2').textContent = '';
    }
    breakPanel.classList.remove('hidden');
    $('inningsBreakNote').textContent =
      match.bowlingTeam + ' need ' + (match.runs + 1) + ' runs to win from ' +
      match.totalOvers + (match.totalOvers === 1 ? ' over' : ' overs') +
      '. Check or edit the player lists below, then start the second innings.';
    $('batterList2Label').textContent =
      'Batters for ' + match.bowlingTeam + ' (one per line, in batting order, 2 to 11)';
    $('bowlerList2Label').textContent =
      'Bowlers for ' + match.battingTeam + ' (one per line, at least 2)';
  } else {
    breakPanel.classList.add('hidden');
  }

  const bowlerPanel = $('bowlerPanel');
  if (needBowler) {
    bowlerPanel.classList.remove('hidden');
    const overNumber = Math.floor(match.legalBalls / 6) + 1;
    let prompt = 'Choose who bowls over ' + overNumber + '.';
    if (match.lastBowler !== null) {
      prompt += ' ' + match.bowlers[match.lastBowler].name + ' bowled the last over and cannot bowl again straight away.';
    }
    $('bowlerPrompt').textContent = prompt;
    $('bowlerSelect').innerHTML = match.bowlers
      .map((bowler, i) => (i === match.lastBowler)
        ? ''
        : '<option value="' + i + '">' + escapeHTML(bowler.name) + '</option>')
      .join('');
  } else {
    bowlerPanel.classList.add('hidden');
  }

  document.querySelectorAll('[data-runs], [data-extra]').forEach((btn) => {
    btn.disabled = !scoringOn;
  });
  $('extraRuns').disabled = !scoringOn;
  $('wicketBtn').disabled = !scoringOn;
  $('undoBtn').disabled = history.length === 0;
  $('statusMsg').textContent = statusMessage;

  $('wicketPanel').classList.toggle('hidden', !wicketPanelOpen);

  $('battingBody').innerHTML = battingRowsHTML(match);
  $('bowlingBody').innerHTML = bowlingRowsHTML(match);
  $('extrasDetail').textContent = extrasLine(match);
  $('fowText').textContent =
    match.fow.length > 0 ? 'Fall of wickets: ' + match.fow.join(', ') : '';

  const firstCard = $('firstInningsCard');
  if (match.innings === 2 && match.firstInnings) {
    const first = match.firstInnings;
    firstCard.classList.remove('hidden');
    $('firstInningsSummary').textContent =
      'First innings: ' + first.battingTeam + ' ' + first.runs + '/' + first.wickets +
      ' (' + formatOvers(first.legalBalls) + ' overs). Select to show the scorecard.';

    if (firstCard.dataset.built !== 'yes') {
      $('firstInningsBody').innerHTML = scorecardHTML(first);
      firstCard.dataset.built = 'yes';
    }
  } else {
    firstCard.classList.add('hidden');
    firstCard.dataset.built = 'no';
    $('firstInningsBody').innerHTML = '';
  }
}

function init() {
  $('startBtn').addEventListener('click', startMatch);
  $('sampleBtn').addEventListener('click', fillSampleData);

  document.querySelectorAll('[data-runs]').forEach((btn) => {
    btn.addEventListener('click', () => addRuns(Number(btn.dataset.runs)));
  });
  document.querySelectorAll('[data-extra]').forEach((btn) => {
    btn.addEventListener('click', () => addExtra(btn.dataset.extra));
  });

  $('wicketBtn').addEventListener('click', openWicketPanel);
  $('dismissalType').addEventListener('change', toggleRunOutFields);
  $('confirmWicketBtn').addEventListener('click', confirmWicket);
  $('cancelWicketBtn').addEventListener('click', cancelWicket);

  $('confirmBowlerBtn').addEventListener('click', confirmBowler);
  $('startSecondBtn').addEventListener('click', startSecondInnings);
  $('undoBtn').addEventListener('click', undo);
  $('resetBtn').addEventListener('click', resetMatch);
}

init();
