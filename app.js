/* No build step. All paths work in a GitHub Pages repository subdirectory. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id), Q = window.QUIZ_QUESTIONS, cfg = window.QUIZ_CONFIG;
 const online = !!(cfg.supabaseUrl && cfg.supabaseKey);
 let run = null, view = 'intro', returnView = 'intro', timer, busy = false;
 const time = ms => {const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
 function show(id) {document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==id); view=id; window.scrollTo({top:0,behavior:'instant'});}
 function remember(){try{sessionStorage.setItem('lfh8-run-v1',JSON.stringify(run));}catch{/* Storage may be disabled. */}}
 async function rpc(name, body={}) {
  const response = await fetch(cfg.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabaseKey},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok){let msg='Online-Verbindung fehlgeschlagen.';try{msg=(await response.json()).message||msg;}catch{}throw new Error(msg);}
  return response.json();
 }
 const errorText = e => e.name==='TimeoutError'?'Zeitüberschreitung. Bitte Verbindung prüfen und erneut versuchen.':e.message;
 $('mode-note').textContent=online?'Gemeinsame Online-Bestenliste aktiv. Beim Start wird dein Anzeigename an die Quiz-Datenbank übertragen.':'Demomodus: Die Online-Bestenliste ist noch nicht eingerichtet. Dein Ergebnis wird nicht öffentlich gespeichert.';
 $('start-form').onsubmit=async e=>{
  e.preventDefault(); if(busy)return;
  const name=$('nickname').value.trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>24){$('start-status').textContent='Bitte einen Namen mit 2 bis 24 Zeichen eingeben.';return;}
  busy=true;$('start-button').disabled=true;$('start-status').textContent='Versuch wird gestartet …';
  try{
   const data=online?await rpc('quiz_start',{p_name:name}):{token:null};
   run={name,token:data.token,online,bonus:online?data.bonus_enabled===true:window.has67Bonus(name),bonusAnnounced:false,start:Date.now(),index:0,answers:Array(12).fill(null),confirmed:Array(12).fill(false),finished:false,result:null};
   remember();show('quiz');drawQuestion();startTimer();$('start-status').textContent='';
  }catch(err){$('start-status').textContent=errorText(err);}finally{busy=false;$('start-button').disabled=false;}
 };
 function startTimer(){clearInterval(timer);const tick=()=>{if(run&&!run.finished)$('timer').textContent=time(Date.now()-run.start);};tick();timer=setInterval(tick,1000);}
 function drawQuestion(){
  const q=Q[run.index], checked=run.confirmed[run.index], correct=run.answers[run.index]===q[3];$('question-count').textContent=`FRAGE ${run.index+1} / 12 · ${run.name}`;
  $('bonus-badge').hidden=!run.bonus;
  $('question-title').textContent=q[1];$('progress').value=run.confirmed.filter(Boolean).length;
  $('answer-count').textContent=`${run.confirmed.filter(Boolean).length} von 12 Antworten abgeschickt. Abgeschickte Antworten sind festgelegt.`;
  $('answers').replaceChildren();q[2].forEach((text,i)=>{const label=document.createElement('label');label.className='option'+(checked&&i===q[3]?' answer-correct':checked&&i===run.answers[run.index]?' answer-wrong':'');const radio=document.createElement('input');radio.type='radio';radio.name='answer';radio.value=i;radio.required=true;radio.checked=run.answers[run.index]===i;radio.disabled=checked;radio.onchange=()=>{if(run.confirmed[run.index])return;run.answers[run.index]=i;remember();};const span=document.createElement('span');span.textContent=String.fromCharCode(65+i)+' · '+text+(checked&&i===q[3]?' · ✓ Richtig':checked&&i===run.answers[run.index]?' · ✕ Deine Antwort':'');label.append(radio,span);$('answers').append(label);});
  $('previous').disabled=run.index===0;$('next').textContent=!checked?'Antwort abschicken':run.index===11?'Ergebnis anzeigen →':'Nächste Frage →';
  $('quiz-status').className=checked?'answer-feedback '+(correct?'feedback-correct':'feedback-wrong'):'';
  $('quiz-status').textContent=checked?(correct?'✓ Richtig! Deine Antwort stimmt.':'✕ Falsch. Richtig ist: '+q[2][q[3]]):'';
  if(run.bonus&&!run.bonusAnnounced&&run.index===0){$('bonus-popup').showModal();run.bonusAnnounced=true;remember();}
 }
 $('previous').onclick=()=>{if(run.index>0){run.index--;remember();drawQuestion();}};
 $('question-form').onsubmit=e=>{e.preventDefault();if(busy||run.finished)return;if(run.answers[run.index]===null)return;if(!run.confirmed[run.index]){run.confirmed[run.index]=true;remember();drawQuestion();return;}if(run.index<11){run.index++;remember();drawQuestion();}else{const missing=run.confirmed.indexOf(false);if(missing!==-1){run.index=missing;drawQuestion();return;}run.finished=true;run.elapsed=Date.now()-run.start;clearInterval(timer);remember();show('result');drawResult();if(online)saveResult();}};
 function drawResult(){
  const rawScore=run.answers.reduce((n,a,i)=>n+Number(a===Q[i][3]),0);
  const bonusPoints=run.result?.bonus_points??(run.bonus&&rawScore<12?1:0);
  const score=run.result?.score??Math.min(12,rawScore+bonusPoints);
  $('result-title').textContent=`${score} / 12 Punkte`;
  $('result-detail').textContent=`${run.name} · ${Math.round(score/12*100)} % ${run.bonus?'Wertung':'richtig'} · Zeit: ${time(run.result?.duration_ms??run.elapsed)}`;
  $('result-bonus').hidden=!run.bonus;
  $('result-bonus').textContent=run.bonus?(bonusPoints?`67 Bonus · ${rawScore} richtige Antworten + 1 Bonuspunkt. Gewertete Fehler: ${12-score}.`:'67 Bonus · Alle Antworten richtig! Du hast bereits die maximalen 12 Punkte.'):'';
  $('save-status').textContent=run.result?`Gespeichert! Dein Platz zum Zeitpunkt der Abgabe: ${run.result.rank}. Die aktuelle Rangfolge findest du in der Bestenliste.`:online?'Dein Ergebnis ist noch nicht online gespeichert.':'Demomodus: Dieses Ergebnis wird nicht in einer gemeinsamen Bestenliste gespeichert.';
  $('retry-save').hidden=!online||!!run.result;$('review').replaceChildren();
  Q.forEach((q,i)=>{const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=`${run.answers[i]===q[3]?'✓ Richtig':'✕ Falsch'} · ${i+1}. ${q[1]}`;details.append(summary);for(const text of ['Deine Antwort: '+q[2][run.answers[i]],'Richtige Antwort: '+q[2][q[3]],q[4],'Handout: '+q[0]]){const p=document.createElement('p');p.textContent=text;details.append(p);}$('review').append(details);});
 }
 async function saveResult(){
  if(busy||run.result)return;busy=true;$('retry-save').disabled=true;$('restart').disabled=true;$('save-status').textContent='Ergebnis wird gespeichert …';
  try{run.result=await rpc('quiz_finish',{p_token:run.token,p_answers:run.answers});remember();drawResult();}
  catch(e){$('save-status').textContent='Noch nicht gespeichert: '+errorText(e)+' Dein Versuch bleibt in diesem Tab erhalten. Bitte erneut versuchen.';$('retry-save').hidden=false;}
  finally{busy=false;$('retry-save').disabled=false;$('restart').disabled=false;}
 }
 $('retry-save').onclick=saveResult;
 $('restart').onclick=()=>{run=null;remember();show('intro');};
 async function loadBoard(){
  $('board-status').textContent=online?'Bestenliste wird geladen …':'Demomodus: Es gibt noch keine gemeinsame Bestenliste. Richte Supabase gemäß README ein.';$('board-rows').replaceChildren();if(!online)return;
  $('refresh-board').disabled=true;
  try{const rows=await rpc('quiz_leaderboard');$('board-status').textContent=rows.length?'Stand: '+new Date().toLocaleTimeString('de-DE'):'Noch keine Ergebnisse. Mach den Anfang!';rows.forEach(row=>{const tr=document.createElement('tr');if(row.result_id===run?.result?.result_id)tr.className='mine';[row.rank,row.name,row.score+' / 12',time(row.duration_ms)].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});if(tr.className){const badge=document.createElement('span');badge.className='badge';badge.textContent='DEIN VERSUCH';tr.children[1].append(badge);}$('board-rows').append(tr);});}
  catch(e){$('board-status').textContent='Bestenliste konnte nicht geladen werden: '+errorText(e);}
  finally{$('refresh-board').disabled=false;}
 }
 function openBoard(){if(view!=='board'&&view!=='share')returnView=view;show('board');loadBoard();}
 $('show-board').onclick=openBoard;$('result-board').onclick=openBoard;$('refresh-board').onclick=loadBoard;
 document.querySelectorAll('.back-button').forEach(b=>b.onclick=()=>show(returnView));
 $('show-share').onclick=()=>{if(view!=='board'&&view!=='share')returnView=view;show('share');const current=new URL(location.href);current.hash='';current.search='';$('share-url').value=cfg.shareUrl||(/^https?:$/.test(current.protocol)&&!['localhost','127.0.0.1','[::1]'].includes(current.hostname)?current.href:'');if($('share-url').value)makeQr();};
 function shareUrl(){const u=new URL($('share-url').value);if(u.protocol!=='https:'&&u.protocol!=='http:')throw Error('Bitte eine vollständige öffentliche https://-Adresse eingeben.');if(['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('Bitte die veröffentlichte Adresse verwenden, keine lokale Vorschau.');return u.href;}
 function makeQr(){
  $('qr-code').replaceChildren();$('qr-download').hidden=true;
  try{const url=shareUrl();if(!window.QRCode)throw Error('Die QR-Bibliothek konnte nicht geladen werden. Internetverbindung prüfen und Seite neu laden. Der Link lässt sich weiterhin kopieren.');new QRCode($('qr-code'),{text:url,width:256,height:256,colorDark:'#142e38',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});const canvas=$('qr-code').querySelector('canvas');if(canvas){$('qr-download').href=canvas.toDataURL('image/png');$('qr-download').hidden=false;}$('share-status').textContent='Der QR-Code führt zu: '+url;}
  catch(e){$('share-status').textContent=errorText(e);}
 }
 $('make-qr').onclick=makeQr;$('copy-link').onclick=async()=>{try{const url=shareUrl();await navigator.clipboard.writeText(url);$('share-status').textContent='Link kopiert.';}catch{$('share-status').textContent='Bitte eine gültige Adresse eingeben und bei Bedarf direkt aus dem Feld kopieren.';}};
 try{const stored=JSON.parse(sessionStorage.getItem('lfh8-run-v1'));if(stored&&stored.online===online&&Array.isArray(stored.answers)&&stored.answers.length===12&&stored.answers.every(a=>a===null||Number.isInteger(a)&&a>=0&&a<4)&&Number.isInteger(stored.index)&&stored.index>=0&&stored.index<12&&typeof stored.start==='number'&&typeof stored.name==='string'&&(!stored.finished||stored.answers.every(a=>a!==null))){run=stored;run.confirmed=Array.isArray(stored.confirmed)&&stored.confirmed.length===12&&stored.confirmed.every((v,i)=>typeof v==='boolean'&&(!v||stored.answers[i]!==null))?stored.confirmed:Array(12).fill(!!stored.finished);if(run.finished){show('result');drawResult();}else{show('quiz');drawQuestion();startTimer();}}}catch{/* Start fresh if browser storage is unavailable. */}
})();
