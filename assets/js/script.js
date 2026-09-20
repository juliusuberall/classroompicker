(function(){
  "use strict";
  var KEY="cp.v1";
  /* Persisted state. `view` is NOT restored from storage: each tool lives on its own
     route (/, /groups/, /timer/, /order/) and the page tells us which one via
     <body data-view>. localStorage is per-origin, so the class list is shared by all routes. */
  var S={names:[],used:[],accent:"#6667AB",theme:"auto",groups:4,timerLen:300,view:"pick"};
  var timer={left:300,on:false,id:null};

  var $=function(id){return document.getElementById(id)};
  var stage=$("stage"), nameOut=$("nameOut"), clockOut=$("clockOut"), groupsOut=$("groupsOut"),
      orderOut=$("orderOut"), hint=$("stageHint"), mainBtn=$("mainBtn"), countEl=$("count"), setup=$("setup"),
      settings=$("settings"), controls=$("controls"), ta=$("names"),
      progress=$("progress"), progressFill=$("progressFill");

  /* ---------- storage ---------- */
  /** Restore saved state from localStorage, ignoring any parse/permission error. */
  function load(){ try{var r=localStorage.getItem(KEY); if(r) Object.assign(S,JSON.parse(r));}catch(e){} }
  /** Persist state to localStorage, silently skipping if storage is unavailable. */
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){} }

  /* ---------- colour ---------- */
  /** Convert a #rgb or #rrggbb hex string to an [r,g,b] array. */
  function hex2rgb(h){h=h.replace("#","");if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  /** Relative luminance of an [r,g,b] colour per WCAG 2. */
  function lum(c){var a=c.map(function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
    return .2126*a[0]+.7152*a[1]+.0722*a[2];}
  /** WCAG contrast ratio between two [r,g,b] colours. */
  function ratio(a,b){var l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);}
  /** Linearly blend colour c toward colour t by amt (0..1). */
  function mix(c,t,amt){return c.map(function(v,i){return Math.round(v+(t[i]-v)*amt)});}
  /** Convert an [r,g,b] array back to a #rrggbb string, clamping each channel. */
  function rgb2hex(c){return "#"+c.map(function(v){return ("0"+Math.max(0,Math.min(255,v)).toString(16)).slice(-2)}).join("");}
  /** Return a version of the accent that meets 4.5:1 contrast against the page background. */
  function readable(hex,dark){
    var c=hex2rgb(hex), target=dark?[255,255,255]:[0,0,0], bg=dark?hex2rgb("#131318"):hex2rgb("#FBFBFD");
    for(var i=0;i<=10;i++){ var t=mix(c,target,i*0.07); if(ratio(t,bg)>=4.5) return rgb2hex(t); }
    return rgb2hex(mix(c,target,.7));
  }
  /** True when the effective theme (manual or system) is dark. */
  function isDark(){
    var t=document.documentElement.getAttribute("data-theme");
    if(t==="dark") return true; if(t==="light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  /** Push the accent colour into CSS variables, swatch state and the favicon. */
  function applyAccent(){
    var r=document.documentElement, a=S.accent;
    r.style.setProperty("--accent",a);
    r.style.setProperty("--accent-text",readable(a,isDark()));
    r.style.setProperty("--accent-soft",a+"22");
    r.style.setProperty("--accent-ring",a+"55");
    $("customC").value=a;
    [].forEach.call(document.querySelectorAll(".sw"),function(b){
      b.setAttribute("aria-pressed", b.dataset.c.toLowerCase()===a.toLowerCase()?"true":"false");
    });
    var svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='"+a+"'/></svg>";
    $("favicon").setAttribute("href","data:image/svg+xml,"+encodeURIComponent(svg));
  }
  /** Apply the light/dark/auto theme attribute and refresh the accent for it. */
  function applyTheme(){
    if(S.theme==="auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme",S.theme);
    [].forEach.call($("themeSeg").children,function(b){
      b.setAttribute("aria-pressed", b.dataset.t===S.theme?"true":"false");
    });
    applyAccent();
  }

  /* ---------- names ---------- */
  /** Split pasted text into trimmed names. Accepts newline, tab, comma or semicolon separators. */
  function parse(txt){
    return txt.split(/[\n\r\t,;]+/).map(function(s){return s.trim()}).filter(Boolean);
  }
  /** Names not yet picked in the current round. */
  function remaining(){
    return S.names.filter(function(n){return S.used.indexOf(n)<0});
  }

  /* ---------- render ---------- */
  /** Show exactly one stage element (or none) and hide the others. */
  function show(el){ [nameOut,clockOut,groupsOut,orderOut,hint].forEach(function(e){e.classList.add("hidden")});
                     if(el) el.classList.remove("hidden"); }
  /** Redraw every control and the stage from the current state and view. */
  function render(){
    var has=S.names.length>0;
    document.body.classList.toggle("setup-view", !has);
    setup.classList.toggle("hidden", has);
    controls.classList.toggle("hidden", !has);
    stage.classList.toggle("hidden", !has);
    $("editBtn").classList.toggle("hidden", !has);

    $("resetBtn").classList.toggle("hidden", S.view!=="pick");
    $("groupsField").classList.toggle("hidden", S.view!=="groups");
    $("timerField").classList.toggle("hidden", S.view!=="timer");

    if(!has){ show(null); progress.classList.add("hidden"); paintTimerFill(); return; }

    if(S.view==="pick"){
      mainBtn.textContent="Pick someone";
      var left=remaining().length;
      countEl.innerHTML="<b>"+left+"</b> of "+S.names.length+" still to go";
      mainBtn.disabled = false;
      if(nameOut.textContent) show(nameOut);
      else if(left===0){ show(hint); hint.innerHTML="Everyone has had a turn. <b>Start over</b> to go again."; }
      else { show(hint); hint.innerHTML="Press <b>Pick</b> — or tap the spacebar"; }
      if(S.names.length){
        var pct=Math.round(left/S.names.length*100);
        progress.classList.remove("hidden");
        progressFill.style.width=pct+"%";
        progress.setAttribute("aria-valuenow",pct);
      } else progress.classList.add("hidden");
      paintTimerFill();
    }
    else if(S.view==="groups"){
      mainBtn.textContent="Make groups"; mainBtn.disabled=false; countEl.textContent=S.names.length+" students";
      if(groupsOut.children.length) show(groupsOut);
      else { show(hint); hint.innerHTML="Press <b>Make groups</b> to split the class"; }
      progress.classList.add("hidden");
      paintTimerFill();
    }
    else if(S.view==="order"){
      mainBtn.textContent="Shuffle order"; mainBtn.disabled=false; countEl.textContent=S.names.length+" students";
      if(orderOut.children.length) show(orderOut);
      else { show(hint); hint.innerHTML="Press <b>Shuffle order</b> to line up the class"; }
      progress.classList.add("hidden");
      paintTimerFill();
    }
    else {
      mainBtn.textContent = timer.on ? "Pause" : "Start timer";
      mainBtn.disabled=false; countEl.textContent="";
      $("timerMin").disabled = $("timerSec").disabled = timer.on;
      show(clockOut); drawClock();
      progress.classList.add("hidden");
    }
  }

  /* ---------- actions ---------- */
  /** Pick a random not-yet-used name, resetting the round when everyone has had a turn. */
  function pick(){
    var pool=remaining();
    if(!pool.length){ S.used=[]; pool=remaining(); }
    if(!pool.length) return;
    var n=pool[Math.floor(Math.random()*pool.length)];
    S.used.push(n);
    nameOut.textContent=n; show(nameOut);
    nameOut.classList.remove("hit"); void nameOut.offsetWidth; nameOut.classList.add("hit");
    stage.classList.add("lit"); setTimeout(function(){stage.classList.remove("lit")},420);
    save(); render();
  }
  /** Return a shuffled copy of an array (Fisher-Yates, unbiased). */
  function shuffled(list){
    var a=list.slice();
    for(var i=a.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }
  /** Shuffle the class and deal it round-robin into S.groups cards. */
  function makeGroups(){
    var a=shuffled(S.names);
    var k=Math.max(2,Math.min(12,S.groups||4)), buckets=[];
    for(var g=0;g<k;g++) buckets.push([]);
    a.forEach(function(n,idx){ buckets[idx%k].push(n); });
    groupsOut.innerHTML="";
    buckets.forEach(function(b,i){
      if(!b.length) return;
      var d=document.createElement("div"); d.className="gcard";
      var h=document.createElement("h3"); h.textContent="Group "+(i+1); d.appendChild(h);
      var ul=document.createElement("ul");
      b.forEach(function(n){var li=document.createElement("li"); li.textContent=n; ul.appendChild(li);});
      d.appendChild(ul); groupsOut.appendChild(d);
    });
    show(groupsOut);
  }
  /** Shuffle the class into a numbered speaking/presentation order. */
  function makeOrder(){
    orderOut.innerHTML="";
    shuffled(S.names).forEach(function(n){
      var li=document.createElement("li"); li.textContent=n; orderOut.appendChild(li);
    });
    show(orderOut);
  }
  /** Render the remaining time as mm:ss digits. */
  function drawClock(){
    var m=Math.floor(timer.left/60), s=timer.left%60;
    var str=(m<10?"0":"")+m+":"+(s<10?"0":"")+s;
    clockOut.innerHTML=str.split("").map(function(ch){
      return ch===":" ? '<span class="clock-colon">:</span>' : '<span class="clock-digit">'+ch+'</span>';
    }).join("");
    clockOut.classList.toggle("done", timer.left===0);
    paintTimerFill();
  }
  /** Paint the elapsed-time ring behind the clock (timer view only). */
  function paintTimerFill(){
    if(S.view!=="timer"){ stage.style.background=""; return; }
    var pct=S.timerLen>0 ? Math.min(100,Math.max(0,(S.timerLen-timer.left)/S.timerLen*100)) : 0;
    stage.style.background="conic-gradient(var(--accent) "+pct+"%, var(--surface) "+pct+"%)";
  }
  /** Start or pause the countdown. */
  function toggleTimer(){
    if(timer.on){ clearInterval(timer.id); timer.on=false; }
    else {
      if(timer.left<=0) timer.left=S.timerLen;
      timer.on=true;
      timer.id=setInterval(function(){
        timer.left--; if(timer.left<=0){ timer.left=0; clearInterval(timer.id); timer.on=false; render(); }
        drawClock();
      },1000);
    }
    render();
  }

  /* ---------- present ---------- */
  /** Enter or leave presenter mode, requesting fullscreen when available. */
  function present(on){
    document.body.classList.toggle("present", on);
    if(on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function(){});
    if(!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function(){});
  }

  /* ---------- setup <-> edit-button morph ---------- */
  /** True when the user prefers reduced motion. */
  function reduceMotion(){ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  /** Replay the pop animation on an element. */
  function pop(el){ el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
  /** Empty panel used as the flying ghost when the setup card morphs into the Edit button. */
  function ghostShell(){
    var d=document.createElement("div");
    d.className="panel";
    return d;
  }
  /** Animate a clone from rect `from` to rect `to`, then remove it and call cb. */
  function flyGhost(clone, from, to, cb){
    clone.style.position="fixed"; clone.style.margin="0"; clone.style.zIndex="80";
    clone.style.pointerEvents="none"; clone.style.transformOrigin="top left";
    clone.style.boxSizing="border-box"; clone.style.overflow="hidden"; clone.style.transition="none";
    clone.style.left=from.left+"px"; clone.style.top=from.top+"px";
    clone.style.width=from.width+"px"; clone.style.height=from.height+"px";
    clone.style.opacity="1";
    document.body.appendChild(clone);
    var done=false;
    function finish(){ if(done) return; done=true; clone.remove(); cb(); }
    if(reduceMotion()){ finish(); return; }
    void clone.offsetWidth;
    requestAnimationFrame(function(){
      var sx=to.width/from.width, sy=to.height/from.height;
      var dx=to.left-from.left, dy=to.top-from.top;
      clone.style.transition="transform .38s cubic-bezier(.22,.8,.25,1), opacity .32s ease";
      clone.style.transform="translate("+dx+"px,"+dy+"px) scale("+sx+","+sy+")";
      clone.style.opacity="0";
    });
    clone.addEventListener("transitionend", finish, {once:true});
    setTimeout(finish, 550);
  }

  /* ---------- events ---------- */
  $("saveBtn").onclick=function(){
    var list=parse(ta.value);
    if(!list.length){ ta.focus(); return; }
    var r1=setup.getBoundingClientRect();
    var clone=ghostShell();
    S.names=list; S.used=[]; nameOut.textContent=""; save(); render();
    [stage, controls, progress].forEach(function(el){
      el.classList.remove("reveal"); void el.offsetWidth; el.classList.add("reveal");
    });
    var editBtnEl=$("editBtn");
    var r2=editBtnEl.getBoundingClientRect();
    flyGhost(clone, r1, r2, function(){ pop(editBtnEl); });
  };
  $("demoBtn").onclick=function(){
    ta.value=["Amara Okafor","Ben Whitfield","Chloe Nguyen","Dev Patel","Elif Demir","Finn O'Leary",
      "Grace Adeyemi","Hugo Martins","Isla Robertson","Jonas Weber","Kavya Rao","Liam Byrne",
      "Maya Cohen","Noah Andersson","Olive Tran","Priya Shah","Quinn Harper","Rosa Delgado",
      "Sam Iwuchukwu","Tomas Novak","Uma Krishnan","Victor Silva","Wren Baxter","Yusuf Aziz"].join("\n");
    ta.focus();
  };
  $("editBtn").onclick=function(){
    ta.value=S.names.join("\n"); S.names=[]; nameOut.textContent=""; groupsOut.innerHTML=""; orderOut.innerHTML="";
    save(); render(); ta.focus();
  };
  $("resetBtn").onclick=function(){ S.used=[]; nameOut.textContent=""; save(); render(); };
  mainBtn.onclick=function(){
    if(S.view==="pick") pick();
    else if(S.view==="groups") makeGroups();
    else if(S.view==="order") makeOrder();
    else toggleTimer();
  };
  $("presentBtn").onclick=function(){ present(true) };
  $("exitBtn").onclick=function(){ present(false) };
  $("setBtn").onclick=function(){
    var h=settings.classList.toggle("hidden");
    $("setBtn").setAttribute("aria-expanded", String(!h));
  };
  $("swatches").onclick=function(e){
    var b=e.target.closest(".sw"); if(!b) return;
    S.accent=b.dataset.c; save(); applyAccent();
  };
  $("customC").oninput=function(){ S.accent=this.value; save(); applyAccent(); };
  $("themeSeg").onclick=function(e){
    var b=e.target.closest("button[data-t]"); if(!b) return;
    S.theme=b.dataset.t; save(); applyTheme();
  };
  $("gCount").oninput=function(){ S.groups=parseInt(this.value,10)||4; save(); };
  /** Read minutes/seconds inputs into S.timerLen and reset the clock if not running. */
  function applyTimerLen(){
    var m=Math.max(0,parseInt($("timerMin").value,10)||0), s=Math.max(0,Math.min(59,parseInt($("timerSec").value,10)||0));
    S.timerLen=Math.max(1,m*60+s);
    if(!timer.on){ timer.left=S.timerLen; }
    drawClock();
    save();
  }
  $("timerMin").oninput=applyTimerLen;
  $("timerSec").oninput=applyTimerLen;
  stage.onclick=function(){ if(S.names.length && S.view==="pick") pick(); };

  document.addEventListener("keydown",function(e){
    if(/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    var k=e.key.toLowerCase();
    if(e.code==="Space"||k==="enter"){ e.preventDefault(); mainBtn.click(); }
    else if(k==="f"){ present(!document.body.classList.contains("present")); }
    else if(k==="escape"){ present(false); }
    else if(k==="r"){ $("resetBtn").click(); }
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",applyAccent);

  /* ---------- boot ---------- */
  load();
  S.view=document.body.getAttribute("data-view")||"pick";
  $("gCount").value=S.groups;
  timer.left=S.timerLen;
  $("timerMin").value=Math.floor(S.timerLen/60);
  $("timerSec").value=S.timerLen%60;
  applyTheme();
  render();
})();
