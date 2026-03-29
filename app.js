/* ── 1. STATE & CONSTANTS ─────────────────────────────────── */
let profileData = JSON.parse(localStorage.getItem('eb_profile')    || '{}');
let goals       = JSON.parse(localStorage.getItem('eb_goals')       || '[]');
let activities  = JSON.parse(localStorage.getItem('eb_activities')  || '[]');
let skills      = JSON.parse(localStorage.getItem('eb_skills')      || '[]');
let quizHistory = JSON.parse(localStorage.getItem('eb_quizHistory') || '[]');

let chatHistory  = [];
let rmAiAnswers  = {};
let rmCurrentQ   = 0;
let msgCount     = 1;

let quizQuestions  = [];
let quizIndex      = 0;
let quizScore      = 0;
let quizAnswered   = false;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const OWNER_API_KEY= "add the grok api key";
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  tutor:     'AI Tutor',
  roadmap:   'Learning Roadmap',
  quiz:      'Quiz Generator',
  progress:  'Progress Tracker',
  profile:   'My Profile',
};

const RM_AI_QUESTIONS = [
  { icon:'🌟', key:'subject', type:'options', text:'What subject or skill do you want to learn?',
    options:['Web Development','Data Science & AI','Cybersecurity','UI/UX Design','Cloud & DevOps','Mobile Development','DSA & Programming','Digital Marketing'] },
  { icon:'🎓', key:'level', type:'options', text:'What is your current level in this subject?',
    options:['Complete Beginner','Know the basics','Intermediate','Advanced'] },
  { icon:'🎯', key:'goal', type:'options', text:'What is your learning goal?',
    options:['Get a job','Build a project','Upskill for promotion','Freelance','Academic / study'] },
  { icon:'⏰', key:'time', type:'options', text:'How much time can you study each week?',
    options:['1–3 hrs (light)','3–7 hrs (regular)','7–15 hrs (focused)','15+ hrs (intensive)'] },
  { icon:'📝', key:'existing', type:'input', text:'List any topics or skills you already know (or type "none"):', placeholder:'e.g. HTML, basic Python, algebra…' },
];

const CAT_ICONS = {
  Programming:'💻', Design:'🎨', 'Data Science':'📊',
  Mathematics:'🔢', Language:'🗣️', Science:'🔬',
  Certification:'📜', Project:'🚀', Other:'📌',
};

function getApiKey() {
  return localStorage.getItem('eb_api_key') || OWNER_API_KEY;
}
function onApiKeyFocus() {
  const stored = localStorage.getItem('eb_api_key');
  const input  = document.getElementById('api-key-input');
  if (input && stored) input.value = stored;
}

function onApiKeyBlur() { setTimeout(updateApiKeyStatus, 250); }

function navigate(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[id] || id;
  if (id === 'dashboard') refreshDashboard();
  if (id === 'progress')  { renderGoals(); renderActivities(); }
  if (id === 'roadmap')   initRmAiGuide();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
function refreshDashboard() {
  const done       = goals.filter(g => g.status === 'done').length;
  const streak     = parseInt(localStorage.getItem('eb_streak') || '0');
  const topicsDone = goals.length;
  const skillCount = skills.length;
  const pct        = topicsDone > 0 ? Math.round(done / topicsDone * 100) : 0;

  document.getElementById('db-topics').textContent   = topicsDone;
  document.getElementById('db-skills').textContent   = skillCount;
  document.getElementById('db-streak').textContent   = streak;
  document.getElementById('db-progress').textContent = pct + '%';

  const name = profileData.name || 'Learner';
  document.getElementById('db-welcome-name').textContent = `Welcome back, ${name.split(' ')[0]}! 👋`;
  loadRecommendations();
}

async function loadRecommendations() {
  const box = document.getElementById('recommendations-list');
  if (!box) return;

  const apiKey = getApiKey();
  if (!apiKey) { box.innerHTML = buildStaticRecs(); return; }

  box.innerHTML = `<div class="rec-loading">🤖 Generating personalized suggestions…</div>`;

  try {
    const subject    = profileData.career || 'general learning';
    const lvl        = profileData.level  || 'beginner';
    const userSkills = skills.join(', ')  || 'none yet';
    const recentGoals = goals.slice(0, 3).map(g => g.title).join(', ') || 'none';

    const prompt = `You are an AI study advisor. The student is learning ${subject} at ${lvl} level.
Their current skills: ${userSkills}. Recent goals: ${recentGoals}.
Suggest 3 concise study recommendations. Return ONLY a JSON array with this exact shape:
[{ "icon": "emoji", "title": "short title", "desc": "1-2 sentence actionable tip" }]
No markdown, no explanation, just the array.`;

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You are an AI study advisor. Return ONLY valid JSON arrays, no markdown.' },
          { role: 'user',   content: prompt },
        ],
        max_tokens: 500, temperature: 0.7,
      }),
    });

    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content || '[]';
    const recs = JSON.parse(raw.replace(/```json|```/g, '').trim());
    box.innerHTML = recs.map(r => `
      <div class="rec-item">
        <div class="rec-icon">${r.icon}</div>
        <div>
          <div class="rec-title">${r.title}</div>
          <div class="rec-desc">${r.desc}</div>
        </div>
      </div>`).join('');
  } catch { box.innerHTML = buildStaticRecs(); }
}

function buildStaticRecs() {
  return [
    { icon:'📚', title:'Build a micro-project today',     desc:'Apply what you learned in a small 1–2 hour project to solidify your knowledge.' },
    { icon:'🔁', title:"Review yesterday's material",     desc:'Spaced repetition improves retention by up to 80%. Go back and quiz yourself.' },
    { icon:'🌐', title:'Explore freeCodeCamp or Khan Academy', desc:'Free structured courses that match almost every skill level and topic.' },
  ].map(r => `<div class="rec-item"><div class="rec-icon">${r.icon}</div><div><div class="rec-title">${r.title}</div><div class="rec-desc">${r.desc}</div></div></div>`).join('');
}
async function sendMessage() {
  const inp  = document.getElementById('chat-input');
  const text = inp.value.trim();
  if (!text) return;

  appendMsg('user', text);
  inp.value = '';
  msgCount++;
  document.getElementById('msg-count').textContent = msgCount;
  chatHistory.push({ role: 'user', content: text });

  showTypingIndicator();
  const apiKey = getApiKey();

  try {
    const reply = await callGemini(apiKey, buildTutorSystemPrompt(), chatHistory);
    removeTypingIndicator();
    appendMsg('ai', reply);
    chatHistory.push({ role: 'assistant', content: reply });
    msgCount++;
    document.getElementById('msg-count').textContent = msgCount;
  } catch (err) {
    removeTypingIndicator();
    appendMsg('ai', `⚠️ ${err.message || 'Something went wrong. Please try again.'}`);
  }
}

function buildTutorSystemPrompt() {
  const name    = profileData.name   || 'the student';
  const subject = profileData.career || 'various subjects';
  const level   = profileData.level  || 'beginner';
  const uSkills = skills.join(', ')  || 'none listed';
  const major   = profileData.major  || '';
  return `You are EduBuddy AI, a warm and knowledgeable learning mentor helping students learn effectively.
You are currently helping ${name}, who is studying ${subject} at ${level} level.
Their current skills: ${uSkills}.${major ? ` Field of study: ${major}.` : ''}
- Explain concepts clearly with examples and step-by-step breakdowns
- Answer academic questions thoroughly
- Suggest what to study next based on their level
- Use bullet points for complex explanations
- Keep answers concise but complete
Always respond in a friendly, mentor-like tone.`;
}

function showTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'msg ai'; el.id = 'typing';
  el.innerHTML = `<div class="msg-avatar">🎓</div>
    <div class="msg-bubble"><div class="typing-indicator">
      <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
    </div></div>`;
  document.getElementById('chat-messages').appendChild(el);
  scrollChat();
}

function removeTypingIndicator() { document.getElementById('typing')?.remove(); }

function appendMsg(role, text) {
  const now      = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const initials = (profileData.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  const formatted = text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
  document.getElementById('chat-messages').insertAdjacentHTML('beforeend', `
    <div class="msg ${role}">
      <div class="msg-avatar">${role === 'ai' ? '🎓' : initials}</div>
      <div>
        <div class="msg-bubble">${formatted}</div>
        <div class="msg-time">${now}</div>
      </div>
    </div>`);
  scrollChat();
}

function scrollChat() {
  const el = document.getElementById('chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function askQuick(el) {
  const lines = el.innerText.trim().split('\n');
  const text  = lines[lines.length - 1].trim();
  navigate('tutor', document.querySelector('[data-section="tutor"]'));
  document.getElementById('chat-input').value = text;
  setTimeout(sendMessage, 150);
}
function switchRmTab(tab, el) {
  document.querySelectorAll('.rm-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.rm-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`rm-panel-${tab}`).classList.add('active');
  if (tab === 'guide') initRmAiGuide();
}

function initRmAiGuide() {
  rmCurrentQ  = 0;
  rmAiAnswers = {};
  renderRmQuestion();
}

function renderRmQuestion() {
  const q   = RM_AI_QUESTIONS[rmCurrentQ];
  const pct = (rmCurrentQ / RM_AI_QUESTIONS.length) * 100;
  document.getElementById('rm-q-progress').style.width = pct + '%';
  document.getElementById('rm-q-icon').textContent     = q.icon;
  document.getElementById('rm-q-step').textContent     = `STEP ${rmCurrentQ + 1} OF ${RM_AI_QUESTIONS.length}`;
  document.getElementById('rm-q-text').textContent     = q.text;

  const opts    = document.getElementById('rm-q-options');
  const inpWrap = document.getElementById('rm-q-input-wrap');
  opts.innerHTML = ''; inpWrap.style.display = 'none';

  if (q.type === 'options') {
    q.options.forEach(o => {
      const b = document.createElement('button');
      b.className = 'ai-option'; b.textContent = o;
      b.onclick = () => {
        document.querySelectorAll('.ai-option').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        rmAiAnswers[q.key] = o;
        setTimeout(nextRmQuestion, 380);
      };
      opts.appendChild(b);
    });
  } else {
    inpWrap.style.display = 'flex';
    const inp = document.getElementById('rm-q-input');
    inp.placeholder = q.placeholder || 'Type your answer…';
    inp.value = '';
  }
}

function nextRmQuestion() {
  if (RM_AI_QUESTIONS[rmCurrentQ].type === 'input') {
    rmAiAnswers[RM_AI_QUESTIONS[rmCurrentQ].key] =
      document.getElementById('rm-q-input').value.trim() || 'None';
  }
  rmCurrentQ++;
  if (rmCurrentQ >= RM_AI_QUESTIONS.length) {
    document.getElementById('rm-q-progress').style.width = '100%';
    generateRoadmap();
  } else { renderRmQuestion(); }
}

function generateRoadmapFromForm() {
  const subject  = document.getElementById('rm-subject').value;
  const level    = document.getElementById('rm-level').value;
  const goal     = document.getElementById('rm-goal').value;
  const time     = document.getElementById('rm-time').value;
  const existing = document.getElementById('rm-existing').value;
  if (!subject || !level || !goal) { showToast('⚠️ Please fill all required fields'); return; }
  rmAiAnswers = { subject, level, goal, time: time || '3–7 hrs (regular)', existing: existing || 'None' };
  generateRoadmap();
}

async function generateRoadmap() {
  document.getElementById('result-tab-btn').style.display = '';
  const resultPanel = document.getElementById('rm-panel-result');
  resultPanel.classList.add('active');
  document.querySelectorAll('.rm-panel').forEach(p => p !== resultPanel && p.classList.remove('active'));
  document.querySelectorAll('.rm-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('result-tab-btn').classList.add('active');

  resultPanel.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <strong>Building your learning roadmap…</strong>
      <p>EduBuddy AI is crafting a personalized path just for you.<br>This takes about 5–10 seconds.</p>
    </div>`;

  try {
    const roadmap = await fetchRoadmapFromGemini(getApiKey());
    renderRoadmap(roadmap);
    showToast('🗺️ Roadmap ready! Check off topics as you learn.');
  } catch (err) {
    resultPanel.innerHTML = `
      <div class="loading-state">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <strong>Could not generate roadmap</strong>
        <p>${err.message || 'Please try again.'}</p>
        <div style="margin-top:20px;">
          <button class="btn btn-primary" onclick="switchRmTab('form', document.querySelectorAll('.rm-tab')[0])">Try Again</button>
        </div>
      </div>`;
  }
}

async function fetchRoadmapFromGemini(apiKey) {
  const { subject, level, goal, time, existing } = rmAiAnswers;
  const name = profileData.name || 'the student';

  const prompt = `Create a structured learning roadmap for ${name}.
Subject: ${subject}, Level: ${level}, Goal: ${goal}, Weekly time: ${time}, Already knows: ${existing}
Respond ONLY with valid JSON (no markdown) with this exact shape:
{
  "title": "subject title",
  "sub": "brief subtitle",
  "levels": ["Beginner","Intermediate","Advanced","Projects"],
  "phases": [
    { "name": "Phase name", "badge": "e.g. Week 1-3",
      "topics": [{ "icon": "emoji", "name": "Topic name", "desc": "One-line description" }] }
  ]
}
Exactly 4 phases, 4 topics each. Be specific and practical.`;

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are a curriculum designer. Respond ONLY with valid JSON, no markdown fences.' },
        { role: 'user',   content: prompt },
      ],
      max_tokens: 8192, temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Groq API error ${res.status}`);
  }
  const data = await res.json();
  const raw  = (data.choices?.[0]?.message?.content || '').replace(/```json|```/g,'').trim();
  return JSON.parse(raw);
}

function renderRoadmap(rm) {
  const phaseClasses = ['rm-phase-0','rm-phase-1','rm-phase-2','rm-phase-3'];
  document.getElementById('rm-panel-result').innerHTML = `
    <div class="roadmap-result">
      <div class="roadmap-result-header">
        <div>
          <div class="roadmap-result-title">${rm.title} Roadmap</div>
          <div class="roadmap-result-sub">${rm.sub}</div>
        </div>
        <button class="btn btn-outline" onclick="switchRmTab('form', document.querySelectorAll('.rm-tab')[0])">🔄 Regenerate</button>
      </div>
      <div class="rm-level-tabs">
        ${(rm.levels||[]).map((l,i) => `<div class="rm-level-chip ${i===0?'active':''}"
          onclick="this.parentElement.querySelectorAll('.rm-level-chip').forEach(c=>c.classList.remove('active'));this.classList.add('active')">${l}</div>`).join('')}
      </div>
      <div class="rm-timeline">
        ${rm.phases.map((p,i) => `
          <div class="rm-phase ${phaseClasses[i]||'rm-phase-3'}">
            <div class="rm-dot"></div>
            <div class="rm-phase-header">
              <div class="rm-phase-name">${p.name}</div>
              <div class="rm-phase-badge">${p.badge}</div>
            </div>
            <div class="rm-skills-grid">
              ${p.topics.map(t => `
                <div class="rm-skill-item" onclick="toggleTopicCheck(this)">
                  <span class="rm-skill-icon">${t.icon}</span>
                  <div><div class="rm-skill-name">${t.name}</div><div class="rm-skill-desc">${t.desc}</div></div>
                  <div class="rm-skill-check"></div>
                </div>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function toggleTopicCheck(el) {
  el.classList.toggle('checked');
  const name = el.querySelector('.rm-skill-name').textContent;
  if (el.classList.contains('checked')) {
    addActivity(`Completed topic: "${name}"`, '✅');
    showToast(`✅ "${name}" marked as learned!`);
    if (!goals.find(g => g.title === `Learn: ${name}`)) {
      goals.unshift({ id: Date.now(), title: `Learn: ${name}`, category: 'Programming', target: '', progress: 100, status: 'done' });
      saveGoals();
    }
  }
}


/* ── 8. QUIZ GENERATOR ────────────────────────────────────── */
async function generateQuiz() {
  const topic = document.getElementById('quiz-topic').value.trim();
  const diff  = document.getElementById('quiz-difficulty').value;
  const count = parseInt(document.getElementById('quiz-count').value) || 5;
  if (!topic) { showToast('⚠️ Please enter a topic'); return; }

  const area = document.getElementById('quiz-area');
  area.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <strong>Generating your quiz…</strong>
      <p>Creating ${count} ${diff} questions on "${topic}"</p>
    </div>`;

  try {
    quizQuestions = await fetchQuizFromGemini(getApiKey(), topic, diff, count);
    quizIndex = 0; quizScore = 0; quizAnswered = false;
    renderQuizQuestion();
  } catch (err) {
    area.innerHTML = `
      <div class="loading-state">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <strong>Quiz generation failed</strong>
        <p>${err.message || 'Please try again.'}</p>
      </div>`;
  }
}

async function fetchQuizFromGemini(apiKey, topic, difficulty, count) {
  const prompt = `Create a ${difficulty} level quiz on "${topic}" with exactly ${count} multiple-choice questions.
Return ONLY a valid JSON array. No markdown, no explanation, no text before or after.
Shape: [{ "question": "Question?", "options": ["A","B","C","D"], "answer": "A" }]
Rules:
- "answer" must exactly match one of the 4 options word for word
- Keep each question under 20 words
- Keep each option under 10 words
- Do NOT add any text outside the JSON array`;

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are a quiz creator. Return ONLY valid JSON arrays, no markdown.' },
        { role: 'user',   content: prompt },
      ],
      max_tokens: 8192, temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Groq API error ${res.status}`);
  }
  const data = await res.json();
  let raw = (data.choices?.[0]?.message?.content || '').replace(/```json|```/g,'').trim();

  /* Safety net: if JSON is cut off mid-string, trim to the last complete object */
  if (!raw.endsWith(']')) {
    const lastBrace = raw.lastIndexOf('}');
    if (lastBrace !== -1) raw = raw.slice(0, lastBrace + 1) + ']';
  }

  let arr;
  try {
    arr = JSON.parse(raw);
  } catch(e) {
    throw new Error('Gemini returned incomplete JSON. Try fewer questions or a simpler topic.');
  }
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('Invalid quiz data received.');
  return arr;
}

function renderQuizQuestion() {
  const q    = quizQuestions[quizIndex];
  const pct  = (quizIndex / quizQuestions.length) * 100;
  const area = document.getElementById('quiz-area');
  quizAnswered = false;

  area.innerHTML = `
    <div class="quiz-container">
      <div class="quiz-meta">
        <span class="quiz-progress-label">Question ${quizIndex + 1} of ${quizQuestions.length}</span>
        <span class="quiz-score-badge">Score: ${quizScore}/${quizIndex}</span>
      </div>
      <div class="quiz-progress-bar-wrap">
        <div class="quiz-progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="question-card">
        <div class="question-number">Question ${quizIndex + 1}</div>
        <div class="question-text">${q.question}</div>
        <div class="options-grid">
          ${q.options.map((opt,i) => `
            <button class="option-btn" onclick="selectAnswer(this,'${escHtml(opt)}','${escHtml(q.answer)}')" data-opt="${escHtml(opt)}">
              <span class="option-letter">${'ABCD'[i]}</span>${opt}
            </button>`).join('')}
        </div>
      </div>
      <div class="quiz-answer-feedback" id="quiz-feedback"></div>
      <div class="quiz-nav">
        <span style="font-size:13px;color:var(--text3);">${quizIndex + 1} / ${quizQuestions.length}</span>
        <button class="btn btn-primary" id="next-btn" onclick="nextQuestion()" disabled>
          ${quizIndex + 1 < quizQuestions.length ? 'Next Question →' : 'See Results 🏆'}
        </button>
      </div>
    </div>`;
}

function escHtml(s) {
  return (s||'').replace(/'/g,"&#39;").replace(/"/g,'&quot;');
}

function selectAnswer(btn, selected, correct) {
  if (quizAnswered) return;
  quizAnswered = true;
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
  const isCorrect = selected === correct;
  if (isCorrect) { quizScore++; btn.classList.add('correct'); }
  else {
    btn.classList.add('wrong');
    document.querySelectorAll('.option-btn').forEach(b => { if (b.dataset.opt === correct) b.classList.add('correct'); });
  }
  const fb = document.getElementById('quiz-feedback');
  fb.textContent = isCorrect ? '✅ Correct! Great job!' : `❌ Incorrect. The correct answer is: "${correct}"`;
  fb.className   = `quiz-answer-feedback ${isCorrect ? 'correct' : 'wrong'}`;
  document.getElementById('next-btn').disabled = false;
}

function nextQuestion() {
  quizIndex++;
  if (quizIndex >= quizQuestions.length) showQuizResult();
  else renderQuizQuestion();
}

function showQuizResult() {
  const total = quizQuestions.length;
  const pct   = Math.round(quizScore / total * 100);
  const grade = pct >= 90 ? '🏆 Excellent!' : pct >= 70 ? '👍 Good job!' : pct >= 50 ? '📚 Keep practising!' : '💪 Keep going!';
  const msg   = pct >= 70 ? 'Solid understanding! Try a harder difficulty next.' : 'Review missed topics and try again. Repetition is key!';

  quizHistory.unshift({ topic: document.getElementById('quiz-topic').value, score: quizScore, total, date: new Date().toLocaleDateString() });
  quizHistory = quizHistory.slice(0, 10);
  localStorage.setItem('eb_quizHistory', JSON.stringify(quizHistory));
  addActivity(`Completed quiz on "${document.getElementById('quiz-topic').value}" — ${quizScore}/${total}`, '🧠');

  document.getElementById('quiz-area').innerHTML = `
    <div class="quiz-result">
      <div class="quiz-result-score">${pct}%</div>
      <div class="quiz-result-label">${grade}</div>
      <div class="quiz-result-message">${msg}</div>
      <div class="quiz-result-breakdown">
        <div class="quiz-result-stat"><div class="quiz-result-stat-val" style="color:var(--green);">${quizScore}</div><div class="quiz-result-stat-lbl">Correct</div></div>
        <div class="quiz-result-stat"><div class="quiz-result-stat-val" style="color:var(--red);">${total-quizScore}</div><div class="quiz-result-stat-lbl">Incorrect</div></div>
        <div class="quiz-result-stat"><div class="quiz-result-stat-val">${total}</div><div class="quiz-result-stat-lbl">Total</div></div>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="generateQuiz()">🔄 Retake Quiz</button>
        <button class="btn btn-outline" onclick="resetQuiz()">📝 New Topic</button>
        <button class="btn btn-ghost" onclick="navigate('progress',document.querySelector('[data-section=progress]'))">📊 View Progress</button>
      </div>
    </div>`;
}

function resetQuiz() {
  document.getElementById('quiz-area').innerHTML = '';
  document.getElementById('quiz-topic').value = '';
}
function toggleAddGoal() {
  const f = document.getElementById('add-goal-form');
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    document.getElementById('g-date').value = d.toISOString().split('T')[0];
  }
}

function addGoal() {
  const title = document.getElementById('g-title').value.trim();
  if (!title) { showToast('⚠️ Please enter a goal title'); return; }
  goals.unshift({ id: Date.now(), title, category: document.getElementById('g-cat').value, target: document.getElementById('g-date').value, progress: 0, status: 'not-started' });
  saveGoals();
  addActivity(`Added goal: "${title}"`, '🎯');
  document.getElementById('g-title').value = '';
  toggleAddGoal();
  renderGoals();
  showToast('🎯 Goal added!');
}

function renderGoals() {
  const el     = document.getElementById('goals-list');
  const colors = ['bar-indigo','bar-blue','bar-green','bar-orange'];
  if (!el) return;
  if (goals.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-title">No learning goals yet</div><div class="empty-state-desc">Click "Add Goal" to start tracking your progress</div></div>`;
    updateProgressStats(); return;
  }
  el.innerHTML = goals.map((g,i) => `
    <div class="goal-item">
      <div class="goal-top">
        <div class="goal-name">
          ${CAT_ICONS[g.category]||'📌'} ${g.title}
          <span class="goal-badge ${g.status==='done'?'badge-done':g.status==='in-progress'?'badge-in-progress':'badge-not-started'}">
            ${g.status==='done'?'Done':g.status==='in-progress'?'In Progress':'Not Started'}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="goal-pct">${g.progress}%</div>
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px;" onclick="deleteGoal(${g.id})">🗑️</button>
        </div>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar ${colors[i%colors.length]}" style="width:${g.progress}%"></div>
      </div>
      <div class="goal-meta">
        <div class="goal-meta-item">📅 ${g.target||'—'}</div>
        <div class="goal-meta-item">🏷️ ${g.category}</div>
        <div style="margin-left:auto;display:flex;gap:6px;">
          <button class="btn btn-ghost"   style="padding:4px 10px;font-size:12px;" onclick="updateProgress(${g.id},-10)">−</button>
          <button class="btn btn-primary" style="padding:4px 10px;font-size:12px;" onclick="updateProgress(${g.id},10)">+10%</button>
        </div>
      </div>
    </div>`).join('');
  updateProgressStats();
}

function updateProgress(id, delta) {
  const g = goals.find(x => x.id === id);
  if (!g) return;
  g.progress = Math.max(0, Math.min(100, g.progress + delta));
  g.status   = g.progress === 0 ? 'not-started' : g.progress === 100 ? 'done' : 'in-progress';
  if (g.progress === 100) addActivity(`Completed: "${g.title}" 🎉`, '✅');
  saveGoals(); renderGoals();
}

function deleteGoal(id) {
  goals = goals.filter(g => g.id !== id);
  saveGoals(); renderGoals();
  showToast('🗑️ Goal removed');
}

function updateProgressStats() {
  const done   = goals.filter(g => g.status === 'done').length;
  const pct    = goals.length ? Math.round(done / goals.length * 100) : 0;
  const streak = parseInt(localStorage.getItem('eb_streak') || '0');
  const hrs    = parseInt(localStorage.getItem('eb_hours')  || '0');
  const el = id => document.getElementById(id);
  if (el('stat-goals'))    el('stat-goals').textContent    = goals.length;
  if (el('stat-done'))     el('stat-done').textContent     = done;
  if (el('stat-done-pct')) el('stat-done-pct').textContent = `${pct}% completion`;
  if (el('stat-streak'))   el('stat-streak').textContent   = streak;
  if (el('stat-hours'))    el('stat-hours').textContent    = hrs;
}

function addActivity(text, icon = '📌') {
  activities.unshift({ text, icon, time: new Date().toLocaleString() });
  activities = activities.slice(0, 15);
  localStorage.setItem('eb_activities', JSON.stringify(activities));
  renderActivities();
}

function renderActivities() {
  const el = document.getElementById('activity-list');
  if (!el) return;
  if (activities.length === 0) {
    el.innerHTML = `<div class="activity-item"><div class="activity-dot">📘</div><div><div class="activity-text">No activity yet — start learning!</div></div></div>`;
    return;
  }
  el.innerHTML = activities.slice(0,8).map(a => `
    <div class="activity-item">
      <div class="activity-dot">${a.icon}</div>
      <div><div class="activity-text">${a.text}</div><div class="activity-time">${a.time}</div></div>
    </div>`).join('');
}

function saveGoals() { localStorage.setItem('eb_goals', JSON.stringify(goals)); }


/* ── 10. PROFILE ──────────────────────────────────────────── */
function loadProfile() {
  if (!profileData.name) return;
  [['p-name','name'],['p-email','email'],['p-age','age'],['p-location','location'],
   ['p-edu','edu'],['p-major','major'],['p-college','college'],['p-year','year'],
   ['p-career','career'],['p-dream','dream'],['p-bio','bio'],['p-level','level'],['p-hours','hours']]
  .forEach(([id,key]) => { const el = document.getElementById(id); if(el) el.value = profileData[key]||''; });
  skills = JSON.parse(localStorage.getItem('eb_skills') || '[]');
  renderSkills(); updateHero();
}

function saveProfile() {
  profileData = {
    name:document.getElementById('p-name').value, email:document.getElementById('p-email').value,
    age:document.getElementById('p-age').value,   location:document.getElementById('p-location').value,
    edu:document.getElementById('p-edu').value,   major:document.getElementById('p-major').value,
    college:document.getElementById('p-college').value, year:document.getElementById('p-year').value,
    career:document.getElementById('p-career').value,   dream:document.getElementById('p-dream').value,
    bio:document.getElementById('p-bio').value,   level:document.getElementById('p-level').value,
    hours:document.getElementById('p-hours').value,
  };
  localStorage.setItem('eb_profile', JSON.stringify(profileData));
  localStorage.setItem('eb_skills',  JSON.stringify(skills));
  updateHero(); showToast('✅ Profile saved!');
}

function updateHero() {
  const name     = profileData.name || 'Learner';
  const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || '?';
  document.getElementById('hero-avatar').textContent  = initials;
  document.getElementById('hero-name').textContent    = `Welcome, ${name.split(' ')[0]}!`;
  document.getElementById('hero-tagline').textContent = profileData.career
    ? `Studying ${profileData.career} · ${profileData.college||'Student'}`
    : 'Complete your profile to get personalized recommendations';
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent   = name;
  document.getElementById('sidebar-role').textContent   = profileData.career || 'Student';
  const chips = document.getElementById('hero-chips');
  if (chips) chips.innerHTML = [profileData.edu,profileData.major,profileData.location,profileData.level]
    .filter(Boolean).map(t=>`<div class="profile-chip">${t}</div>`).join('');
}

function addSkill() {
  const inp = document.getElementById('skill-input');
  const val = inp.value.trim();
  if (!val) return;
  if (!skills.includes(val)) { skills.push(val); renderSkills(); }
  inp.value = '';
}

function removeSkill(s) { skills = skills.filter(x => x !== s); renderSkills(); }

function renderSkills() {
  const c = document.getElementById('skills-container');
  if (!c) return;
  c.innerHTML = skills.map(s => `<div class="skill-tag">${s}<span class="skill-tag-remove" onclick="removeSkill('${s}')">×</span></div>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('skill-input')?.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();addSkill();} });
});


/* ── GEMINI API WRAPPER ───────────────────────────────────── */
async function callGemini(apiKey, systemPrompt, messages) {
  /* Groq uses OpenAI-compatible format */
  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
  ];

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: groqMessages,
      max_tokens: 8192,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Invalid Groq API key. Please check your key.');
    if (res.status === 429) throw new Error('Rate limit reached. Wait a moment and try again.');
    throw new Error(e?.error?.message || `Groq API error ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'Sorry, no response received.';
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }


/* ── 11. APP INIT ─────────────────────────────────────────── */
function init() {
  loadProfile();
  renderGoals();
  renderActivities();
  updateProgressStats();
  initRmAiGuide();
  refreshDashboard();

  const lastVisit = localStorage.getItem('eb_last_visit');
  const today     = new Date().toDateString();
  if (lastVisit !== today) {
    let streak = parseInt(localStorage.getItem('eb_streak') || '0');
    localStorage.setItem('eb_streak',     String(++streak));
    localStorage.setItem('eb_last_visit', today);
  }
}

init();
